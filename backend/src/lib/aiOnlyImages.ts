/**
 * KitchenBuddy AI-only image service, v1.
 * No Pexels, no existing Pexels cache reads.
 * Uses persistent AI image metadata, R2 object storage, and atomic shared
 * generation-attempt quotas in the existing api_usage_counters table.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";
import { pool } from "../db.js";

export type AiImageKind = "ingredient" | "recipe";
export type AiImage = {
  url: string;
  avgColor: string;
  generated: true;
  credit: {
    provider: "fal-flux-schnell";
    providerUrl: string;
    photoUrl: string;
    photographer: string;
    photographerUrl: string;
  };
};
export type AiLookupResult = {
  image: AiImage | null;
  status:
    | "cached"
    | "generated"
    | "pending"
    | "budget"
    | "disabled"
    | "invalid"
    | "failed";
};

type AssetRow = {
  status: "pending" | "ready" | "failed";
  public_url: string | null;
  lease_expires_at: Date | null;
  retry_after: Date | null;
};

const MODEL = "fal-ai/flux/schnell";
const PROVIDER_URL = "https://fal.ai/models/fal-ai/flux/schnell";
const PROMPT_VERSION = "v1";
const MAX_BYTES = 8 * 1024 * 1024;
const inFlight = new Map<string, Promise<AiLookupResult>>();
let activeGenerations = 0;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in Render environment`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`Invalid ${name}`);
  return value;
}

function normalizedName(
  raw: string,
): { display: string; lookup: string } | null {
  if (typeof raw !== "string") return null;
  const display = raw
    .normalize("NFKC")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!display || display.length > 120) return null;
  // Search terms, not arbitrary free-form instructions or HTML markup.
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s'’&+,.():\-/]*$/u.test(display)) return null;
  return { display, lookup: display.toLocaleLowerCase("en-US") };
}

function objectKey(kind: AiImageKind, lookup: string): string {
  const hash = createHash("sha256").update(`${kind}:${lookup}`).digest("hex");
  return `ai/${PROMPT_VERSION}/${kind}/${hash}.jpg`;
}

function publicUrl(key: string): string {
  return `${env("R2_PUBLIC_URL").replace(/\/+$/, "")}/${key}`;
}

function imageRecord(url: string): AiImage {
  return {
    url,
    avgColor: "#F5EBDD", // warm cream palette; not a sampled pixel value
    generated: true,
    credit: {
      provider: "fal-flux-schnell",
      providerUrl: PROVIDER_URL,
      photoUrl: url,
      photographer: "AI-generated for KitchenBuddy",
      photographerUrl: PROVIDER_URL,
    },
  };
}

function buildPrompt(kind: AiImageKind, name: string): string {
  if (kind === "ingredient") {
    return [
      `Professional photorealistic grocery catalog photograph of ${name}.`,
      "Show only this food ingredient in its standard, accurate, easily recognizable grocery-store form.",
      "Correct color, natural anatomy, shape, texture and proportions, realistic food photography.",
      "Centered, fully visible, warm cream off-white seamless studio background, soft daylight and subtle natural shadow.",
      "Minimal premium grocery catalog aesthetic. No unrelated foods, garnish, plate, props, writing, brand logos or watermark.",
    ].join(" ");
  }
  return [
    `Professional photorealistic editorial food photograph of a finished dish called ${name}.`,
    "Depict the recognizable cooked meal with visually plausible ingredients and authentic textures.",
    "Single prepared serving, appetizing natural plating, three-quarter food photography angle.",
    "Consistent warm cream and ivory visual palette, soft diffused daylight, subtle realistic shadows.",
    "No arbitrary decorative garnishes, no people, no text, brand logos or watermark.",
  ].join(" ");
}

function s3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: env("R2_ENDPOINT").replace(/\/+$/, ""),
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
}

async function alreadyStored(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const e = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (
      e.name === "NotFound" ||
      e.name === "NoSuchKey" ||
      e.$metadata?.httpStatusCode === 404
    )
      return false;
    throw error;
  }
}

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Image endpoints: protect per-client costs using the trusted CF header.
 * Canonicalization calls may not have req, but are still protected by global budgets.
 */
function clientSubject(req?: Request): string | null {
  if (!req) return null;
  const ip = req.headers["cf-connecting-ip"];
  const key = process.env.API_ABUSE_HASH_SECRET;
  if (
    typeof ip !== "string" ||
    isIP(ip.trim()) === 0 ||
    !key ||
    key.length < 32
  ) {
    throw new Error("Trusted image client identity unavailable");
  }
  return createHmac("sha256", key)
    .update(`ai-image-ip:${ip.trim()}`)
    .digest("hex");
}

/**
 * Reserve job ownership AND rate budget in one serializable-by-advisory-lock
 * transaction. Failed upstream attempts still cost one reservation.
 */
async function acquireLease(
  kind: AiImageKind,
  lookup: string,
  display: string,
  req?: Request,
): Promise<
  | { state: "leased"; leaseId: string }
  | { state: "cached"; url: string }
  | { state: "pending" | "budget" }
> {
  const now = new Date();
  const subject = clientSubject(req);
  const client = await pool.connect();
  let complete = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8137003)"); // shared with existing quota reservations
    const stored = await client.query<AssetRow>(
      `SELECT status, public_url, lease_expires_at, retry_after
         FROM ai_image_assets WHERE kind = $1 AND lookup_key = $2`,
      [kind, lookup],
    );
    const row = stored.rows[0];
    if (row?.status === "ready" && row.public_url) {
      await client.query("COMMIT");
      complete = true;
      return { state: "cached", url: row.public_url };
    }
    if (
      (row?.status === "pending" &&
        row.lease_expires_at &&
        row.lease_expires_at > now) ||
      (row?.status === "failed" && row.retry_after && row.retry_after > now)
    ) {
      await client.query("COMMIT");
      complete = true;
      return { state: "pending" };
    }

    const counters: Array<{
      scope: string;
      subject: string;
      window: string;
      max: number;
    }> = [
      {
        scope: "ai-images-global-day-v1",
        subject: "global",
        window: dateKey(now),
        max: positiveInt("AI_IMAGE_DAILY_MAX", 100),
      },
      {
        scope: "ai-images-global-month-v1",
        subject: "global",
        window: monthKey(now),
        max: positiveInt("AI_IMAGE_MONTHLY_MAX", 1000),
      },
    ];
    if (subject) {
      counters.push({
        scope: "ai-images-per-client-day-v1",
        subject,
        window: dateKey(now),
        max: positiveInt("AI_IMAGE_PER_IP_DAILY_MAX", 10),
      });
    }
    for (const c of counters) {
      const result = await client.query<{ used: number }>(
        `SELECT used FROM api_usage_counters WHERE scope=$1 AND subject_key=$2 AND window_key=$3`,
        [c.scope, c.subject, c.window],
      );
      if (Number(result.rows[0]?.used ?? 0) >= c.max) {
        await client.query("ROLLBACK");
        complete = true;
        return { state: "budget" };
      }
    }
    const leaseId = randomUUID();
    await client.query(
      `INSERT INTO ai_image_assets
       (kind, lookup_key, display_name, status, lease_id, lease_expires_at, retry_after, error_code, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, now() + interval '5 minutes', NULL, NULL, now())
       ON CONFLICT (kind, lookup_key) DO UPDATE SET
         display_name=EXCLUDED.display_name, status='pending',
         lease_id=EXCLUDED.lease_id, lease_expires_at=EXCLUDED.lease_expires_at,
         retry_after=NULL, error_code=NULL, updated_at=now()`,
      [kind, lookup, display, leaseId],
    );
    for (const c of counters) {
      await client.query(
        `INSERT INTO api_usage_counters (scope,subject_key,window_key,used,updated_at)
         VALUES ($1,$2,$3,1,now())
         ON CONFLICT (scope,subject_key,window_key)
         DO UPDATE SET used = api_usage_counters.used + 1, updated_at=now()`,
        [c.scope, c.subject, c.window],
      );
    }
    await client.query("COMMIT");
    complete = true;
    return { state: "leased", leaseId };
  } catch (error) {
    if (!complete) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function finishSuccess(
  kind: AiImageKind,
  lookup: string,
  leaseId: string,
  key: string,
  seed?: number,
): Promise<void> {
  const result = await pool.query(
    `UPDATE ai_image_assets SET status='ready', public_url=$4, storage_key=$5,
       seed=$6, lease_id=NULL, lease_expires_at=NULL,
       retry_after=NULL, error_code=NULL, updated_at=now()
     WHERE kind=$1 AND lookup_key=$2 AND lease_id=$3`,
    [kind, lookup, leaseId, publicUrl(key), key, seed ?? null],
  );
  if (result.rowCount !== 1) throw new Error("Image generation lease lost");
}

async function finishFailure(
  kind: AiImageKind,
  lookup: string,
  leaseId: string,
  code: string,
): Promise<void> {
  await pool
    .query(
      `UPDATE ai_image_assets SET status='failed', lease_id=NULL, lease_expires_at=NULL,
       retry_after=now() + interval '15 minutes', error_code=$4, updated_at=now()
     WHERE kind=$1 AND lookup_key=$2 AND lease_id=$3`,
      [kind, lookup, leaseId, code.slice(0, 120)],
    )
    .catch((error) =>
      console.error("[ai-images] failure record could not be saved", error),
    );
}

async function doGenerate(
  kind: AiImageKind,
  display: string,
  lookup: string,
  leaseId: string,
): Promise<AiLookupResult> {
  try {
    env("FAL_KEY");
    const bucket = env("R2_BUCKET");
    const s3 = s3Client();
    const key = objectKey(kind, lookup);
    if (await alreadyStored(s3, bucket, key)) {
      await finishSuccess(kind, lookup, leaseId, key);
      return { image: imageRecord(publicUrl(key)), status: "cached" };
    }
    const generated = await fal.subscribe(MODEL, {
      input: {
        prompt: buildPrompt(kind, display),
        image_size:
          kind === "ingredient"
            ? { width: 960, height: 960 }
            : { width: 1024, height: 768 },
        num_inference_steps: 4,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
        acceleration: "none",
      },
    });
    if (generated.data.has_nsfw_concepts?.some(Boolean))
      throw new Error("Rejected by fal safety checker");
    const remote = generated.data.images?.[0]?.url;
    if (!remote) throw new Error("fal returned no JPEG");
    const sourceUrl = new URL(remote);
    if (
      sourceUrl.protocol !== "https:" ||
      !(
        sourceUrl.hostname === "fal.media" ||
        sourceUrl.hostname.endsWith(".fal.media")
      )
    ) {
      throw new Error("Unrecognized fal image hostname");
    }
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length") ?? 0) > MAX_BYTES
    ) {
      throw new Error(`fal JPEG download failed: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (
      buffer.length < 4 ||
      buffer.length > MAX_BYTES ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      throw new Error("fal returned an invalid JPEG");
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          provider: "fal-flux-schnell",
          kind,
          promptversion: PROMPT_VERSION,
        },
      }),
    );
    await finishSuccess(kind, lookup, leaseId, key, generated.data.seed);
    return { image: imageRecord(publicUrl(key)), status: "generated" };
  } catch (err) {
    console.error("[ai-images] generation or R2 upload failed", {
      kind,
      lookup,
      error: err,
    });
    await finishFailure(
      kind,
      lookup,
      leaseId,
      err instanceof Error ? err.name : "UNKNOWN",
    );
    return { image: null, status: "failed" };
  }
}

/** Primary public integration function. All image sources are AI-generated. */
export async function getAiOnlyImage(
  kind: AiImageKind,
  rawName: string,
  req?: Request,
): Promise<AiLookupResult> {
  const cleanedName =
    kind === "recipe"
      ? rawName.replace(
          /^\s*(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\s*[-–]\s*(?:breakfast|lunch|dinner|snack)\s*:\s*/i,
          "",
        )
      : rawName;

  const name = normalizedName(cleanedName);
  if (!name) return { image: null, status: "invalid" };
  if (process.env.AI_IMAGES_ENABLED !== "true")
    return { image: null, status: "disabled" };
  const mapKey = `${kind}:${name.lookup}`;
  const pending = inFlight.get(mapKey);
  if (pending) return pending;

  const work = (async (): Promise<AiLookupResult> => {
    // Check shared DB cache first, even when this instance has no available generation slots.
    const cached = await pool.query<AssetRow>(
      `SELECT status,public_url,lease_expires_at,retry_after FROM ai_image_assets
         WHERE kind=$1 AND lookup_key=$2`,
      [kind, name.lookup],
    );
    if (cached.rows[0]?.status === "ready" && cached.rows[0].public_url) {
      return {
        image: imageRecord(cached.rows[0].public_url),
        status: "cached",
      };
    }
    if (activeGenerations >= positiveInt("AI_IMAGE_CONCURRENCY", 3)) {
      return { image: null, status: "pending" };
    }
    // Claim the process-local concurrency slot before the first await.
    // The PostgreSQL lease separately deduplicates across Render replicas.
    activeGenerations += 1;
    try {
      const reservation = await acquireLease(
        kind,
        name.lookup,
        name.display,
        req,
      );

      if (reservation.state === "cached") {
        return {
          image: imageRecord(reservation.url),
          status: "cached",
        };
      }

      if (reservation.state === "leased") {
        return await doGenerate(
          kind,
          name.display,
          name.lookup,
          reservation.leaseId,
        );
      }

      return {
        image: null,
        status: reservation.state,
      };
    } finally {
      activeGenerations -= 1;
    }
  })();
  inFlight.set(mapKey, work);
  try {
    return await work;
  } finally {
    if (inFlight.get(mapKey) === work) inFlight.delete(mapKey);
  }
}
