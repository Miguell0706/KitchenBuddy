/**
 * KitchenBuddy temporary, admin-only smoke test:
 * FLUX.1 Schnell -> download JPEG -> Cloudflare R2 -> public image URL.
 *
 * DOES NOT modify recipe/ingredient caches, and must not be used as a public
 * on-demand image generation API. Remove this route after testing.
 */
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";

export const aiImageSmokeTestRouter = Router();

type TestKind = "ingredient" | "recipe";
const tests: Record<
  TestKind,
  { key: string; prompt: string; width: number; height: number }
> = {
  ingredient: {
    key: "tests/ingredient-leek-v1.jpg",
    width: 960,
    height: 960,
    prompt: [
      "Professional photorealistic grocery catalog photograph of a single fresh leek.",
      "Show a true leek: long thick white stalk, broad flat green leaves, correct botanical form and proportions.",
      "One ingredient centered and fully visible on a warm off-white studio background,",
      "soft diffused daylight, realistic texture, no other ingredients, no garnish, no plate, no labels or text.",
    ].join(" "),
  },
  recipe: {
    key: "tests/recipe-chicken-alfredo-v1.jpg",
    width: 1024,
    height: 768,
    prompt: [
      "Professional photorealistic food photograph of chicken Alfredo pasta.",
      "A plated dish of fettuccine with creamy parmesan Alfredo sauce and slices of cooked chicken breast.",
      "Natural realistic food textures, inviting restaurant-quality presentation,",
      "warm soft daylight, close three-quarter view, no text, no watermark.",
    ].join(" "),
  },
};

function isAuthorized(supplied: string | undefined, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function objectAlreadyExists(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (
      e.name === "NotFound" ||
      e.name === "NoSuchKey" ||
      e.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw err; // Never treat permission failures as an empty cache.
  }
}

aiImageSmokeTestRouter.post("/", async (req, res) => {
  if (process.env.AI_IMAGE_TEST_ENABLED !== "true") {
    res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return;
  }

  const adminToken = process.env.AI_IMAGE_TEST_TOKEN ?? "";
  if (adminToken.length < 32) {
    res.status(503).json({ ok: false, error: "TEST_TOKEN_NOT_CONFIGURED" });
    return;
  }
  if (!isAuthorized(req.get("x-kitchenbuddy-test-token"), adminToken)) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return;
  }

  const kind = req.body?.kind as TestKind | undefined;
  if (kind !== "ingredient" && kind !== "recipe") {
    res
      .status(400)
      .json({ ok: false, error: "KIND_MUST_BE_INGREDIENT_OR_RECIPE" });
    return;
  }

  try {
    requiredEnv("FAL_KEY");
    const bucket = requiredEnv("R2_BUCKET");
    const endpoint = requiredEnv("R2_ENDPOINT").replace(/\/+$/, "");
    const publicBase = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

    const s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    const config = tests[kind];
    const imageUrl = `${publicBase}/${config.key}`;

    // Repeated successful tests reuse their existing R2 image (no extra fal charge).
    if (await objectAlreadyExists(s3, bucket, config.key)) {
      res.json({ ok: true, kind, cached: true, imageUrl, key: config.key });
      return;
    }

    const generated = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: config.prompt,
        image_size: { width: config.width, height: config.height },
        num_inference_steps: 4,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
        acceleration: "none",
      },
    });

    if (generated.data.has_nsfw_concepts?.some(Boolean)) {
      throw new Error("fal safety checker rejected result");
    }
    const generatedUrl = generated.data.images?.[0]?.url;
    if (!generatedUrl) throw new Error("fal returned no generated image URL");

    // Only download from fal's media CDN (defense in depth).
    const sourceUrl = new URL(generatedUrl);
    if (
      sourceUrl.protocol !== "https:" ||
      !(
        sourceUrl.hostname === "fal.media" ||
        sourceUrl.hostname.endsWith(".fal.media")
      )
    ) {
      throw new Error("Unexpected fal image host");
    }

    const download = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!download.ok)
      throw new Error(`Image download failed (${download.status})`);
    const contentLength = Number(download.headers.get("content-length") || 0);
    if (contentLength > 8 * 1024 * 1024)
      throw new Error("Image unexpectedly large");

    const bytes = Buffer.from(await download.arrayBuffer());
    if (
      bytes.length === 0 ||
      bytes.length > 8 * 1024 * 1024 ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes[2] !== 0xff
    ) {
      throw new Error("Downloaded file is not a valid-sized JPEG");
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: config.key,
        Body: bytes,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { provider: "fal-flux-schnell", kind, test: "true" },
      }),
    );

    console.info(
      `[ai-image-smoke-test] ${kind} uploaded to R2 as ${config.key}`,
    );
    res.json({
      ok: true,
      kind,
      cached: false,
      imageUrl,
      key: config.key,
      width: config.width,
      height: config.height,
      seed: generated.data.seed,
    });
  } catch (error) {
    console.error("[ai-image-smoke-test] failed:", error);
    res.status(502).json({ ok: false, error: "AI_IMAGE_TEST_FAILED" });
  }
});
