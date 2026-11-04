import express from "express";
import { z } from "zod";
import { normalizeKey } from "../lib/normalizeKey.js";
import { cacheGetMany, cacheUpsertMany } from "../lib/cache.js";
import { enforceReceiptCaps } from "../lib/guards.js";
import {
  reserveCanonicalizeRequest,
  reserveGeminiUpstreamCall,
  retryAfterSeconds,
} from "../lib/apiUsage.js";
import type { QuotaDecision } from "../lib/apiUsage.js";
import type { CanonResult } from "../lib/types.js";
import { geminiCanonicalize } from "../llm/geminiCanonicalize.js";
import { getOrCreateIngredientImage } from "../lib/ingredientImage.js";

export const canonicalizeRouter = express.Router();
const PROMPT_VERSION = "v2";
const MAX_ITEMS_PER_REQUEST = 60;
const MAX_CHARS_TO_GEMINI = 1800;
const IMAGE_CONCURRENCY = 3;

const BodySchema = z.object({
  // Kept for compatibility with the existing mobile app. NOT used for quotas.
  deviceId: z.string().min(6).max(128),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        text: z.string().trim().min(1).max(180),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_PER_REQUEST),
});

type QuotaDenied = Extract<QuotaDecision, { allowed: false }>;

canonicalizeRouter.post("/", async (req, res) => {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "BAD_REQUEST",
        details: parsed.error.flatten(),
      });
    }

    // Every request is protected, even if the whole receipt is cached.
    const requestBudget = await reserveCanonicalizeRequest(req);
    if (!requestBudget.allowed) {
      res.setHeader(
        "Retry-After",
        String(retryAfterSeconds(requestBudget.resetAt)),
      );
      return res.status(429).json({
        ok: false,
        error: requestBudget.reason,
        resetAt: requestBudget.resetAt,
      });
    }

    const items = parsed.data.items.map((it) => {
      const rawKey = normalizeKey(it.text);
      return { ...it, rawKey, key: `${PROMPT_VERSION}:${rawKey}` };
    });

    // Cache first; do not count cache hits against the Gemini budget.
    const keys = Array.from(new Set(items.map((it) => it.key)));
    const cached = await cacheGetMany(keys);
    const uncachedPairs: { key: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.key)) continue;
      seen.add(it.key);
      if (!cached[it.key]) uncachedPairs.push({ key: it.key, text: it.text });
    }

    let llmUsed = false; // True if an actual Gemini attempt was reserved.
    const quotaState: { denied: QuotaDenied | null } = { denied: null };
    let modelFailed = false;
    let newRows: CanonResult[] = [];
    let deferredByCaps = 0;

    if (uncachedPairs.length > 0) {
      const { trimmed } = enforceReceiptCaps({
        maxItems: MAX_ITEMS_PER_REQUEST,
        maxChars: MAX_CHARS_TO_GEMINI,
        items: uncachedPairs,
      });
      deferredByCaps = uncachedPairs.length - trimmed.length;

      if (trimmed.length > 0) {
        newRows = await geminiCanonicalize(trimmed, {
          // Called ONLY if the prefilter still has rows that need Gemini.
          beforeModelCall: async () => {
            const decision = await reserveGeminiUpstreamCall(req);
            if (!decision.allowed) {
              quotaState.denied = decision;
              return false;
            }
            llmUsed = true;
            return true;
          },
          onModelFailure: () => {
            modelFailed = true;
          },
        });
      }

      // Preserve existing cache-quality thresholds. Never cache uncertain fallbacks.
      const toCache = newRows.filter(
        (r) =>
          r.status === "not_item" ||
          (r.status === "item" && (r.confidence ?? 0) >= 0.75) ||
          (r.status === "unknown" && (r.confidence ?? 0) >= 0.9),
      );
      if (toCache.length > 0) {
        await cacheUpsertMany(toCache);
      }
    }

    const freshByKey: Record<string, CanonResult> = {};
    for (const r of newRows) freshByKey[r.key] = r;

    // Preserve response ordering, deduplicate image lookups, and limit
    // concurrent image-service work per receipt.
    type IngredientImage = Awaited<
      ReturnType<typeof getOrCreateIngredientImage>
    >;
    const imageLookups = new Map<string, Promise<IngredientImage>>();
    const merged = new Array<{
      id: string;
      text: string;
      key: string;
      result: CanonResult | null;
      ingredientImage: IngredientImage | null;
    }>(items.length);
    let cursor = 0;

    async function imageWorker() {
      while (cursor < items.length) {
        const index = cursor++;
        const it = items[index];
        const hit = freshByKey[it.key] ?? cached[it.key] ?? null;
        let ingredientImage: IngredientImage | null = null;

        if (
          hit?.status === "item" &&
          hit.kind === "food" &&
          hit.canonicalName
        ) {
          try {
            const imageKey = hit.canonicalName.trim().toLowerCase();
            let lookup = imageLookups.get(imageKey);
            if (!lookup) {
              lookup = getOrCreateIngredientImage(hit.canonicalName);
              imageLookups.set(imageKey, lookup);
            }
            ingredientImage = await lookup;
          } catch (error) {
            console.warn("Ingredient image lookup failed:", error);
          }
        }

        merged[index] = {
          id: it.id,
          text: it.text,
          key: it.key,
          result: hit,
          ingredientImage,
        };
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(IMAGE_CONCURRENCY, items.length) }, () =>
        imageWorker(),
      ),
    );

    const partial =
      deferredByCaps > 0 || quotaState.denied !== null || modelFailed;
    return res.json({
      ok: true,
      llmUsed,
      llmRemaining: quotaState.denied ? 0 : null, // Exact remaining count isn't tracked in this response.
      partial,
      rateLimitReason: quotaState.denied?.reason ?? null,
      resetAt: quotaState.denied?.resetAt ?? null,
      modelFailed,
      deferredByCaps,
      merged,
    });
  } catch (error) {
    console.error("canonicalize-items failed:", error);
    // Do not leak provider keys, internal DB errors, or prompt content.
    return res
      .status(503)
      .json({ ok: false, error: "CANONICALIZATION_UNAVAILABLE" });
  }
});
