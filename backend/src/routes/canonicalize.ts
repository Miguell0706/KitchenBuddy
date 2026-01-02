import express from "express";
import { z } from "zod";
import { normalizeKey } from "../lib/normalizeKey.js";
import { cacheGetMany, cacheUpsertMany } from "../lib/cache.js";
import { enforceReceiptCaps, rateLimitDaily } from "../lib/guards.js";
import type { CanonResult } from "../lib/types.js";
import { geminiCanonicalize } from "../llm/geminiCanonicalize.js";

export const canonicalizeRouter = express.Router();
const PROMPT_VERSION = "v3";

const BodySchema = z.object({
  deviceId: z.string().min(6),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1) // this should already be your cleaned final item text
      })
    )
    .min(1)
});

canonicalizeRouter.post("/", async (req, res) => {
  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "bad_request", details: parsed.error.flatten() });
    }

    const { deviceId } = parsed.data;

    const items = parsed.data.items.map((it) => {
      const rawKey = normalizeKey(it.text);
      return { ...it, rawKey, key: `${PROMPT_VERSION}:${rawKey}` };
    });



    // 1) Cache lookup (unique keys)
    const keys = Array.from(new Set(items.map((i) => i.key)));
    const cached = await cacheGetMany(keys);

    // 2) Build uncached (unique) pairs
    const uncachedPairs: { key: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.key)) continue;
      seen.add(it.key);
      if (!cached[it.key]) uncachedPairs.push({ key: it.key, text: it.text });
    }

    console.log("🧠 cache stats", {
      total: keys.length,
      cached: Object.keys(cached).length,
      uncached: uncachedPairs.length,
    });

    // 3) Guards + LLM
    const MAX_UNKNOWN_ITEMS = Number.POSITIVE_INFINITY;
    const MAX_CHARS = 1800;
    const MAX_LLM_RECEIPTS_PER_DAY = 30;

    let llmUsed = false;
    let llmRemaining: number | null = null;
    let newRows: CanonResult[] = [];

    if (uncachedPairs.length > 0) {
      const rl = rateLimitDaily(deviceId, MAX_LLM_RECEIPTS_PER_DAY);
      llmRemaining = rl.remaining;
      console.log("🛡️ guards", { rateLimitOk: rl.ok, llmRemaining });

      if (rl.ok) {
        const { trimmed } = enforceReceiptCaps({
          maxItems: MAX_UNKNOWN_ITEMS,
          maxChars: MAX_CHARS,
          items: uncachedPairs,
        });

        console.log("✂️ cap result", { itemsSentToLLM: trimmed.length });

        // Call LLM only for uncached keys
        newRows = await geminiCanonicalize(trimmed);
        llmUsed = newRows.length > 0;

        // Cache only meaningful results (avoid poisoning cache)
        const toCache = newRows.filter(
          (r) =>
            r.status === "not_item" ||
            (r.status === "item" && (r.confidence ?? 0) >= 0.75) ||
            (r.status === "unknown" && (r.confidence ?? 0) >= 0.9)
        );

        if (toCache.length > 0) {
          await cacheUpsertMany(toCache);
          console.log("💾 cached", toCache.length);
        }

        console.log(llmUsed ? "🤖 LLM used" : "💾 cache-only response");
      } else {
        console.log("🚫 rate limited; skipping LLM");
      }
    } else {
      console.log("💾 cache-only response");
    }

    // 4) Merge: cached > fresh > null
    const freshByKey: Record<string, CanonResult> = {};
    for (const r of newRows) freshByKey[r.key] = r;

    const merged = items.map((it) => {
      const hit = freshByKey[it.key] ?? cached[it.key] ?? null;
      return {
        id: it.id,
        text: it.text,
        key: it.key,
        result: hit,
      };
    });

    return res.json({
      ok: true,
      llmUsed,
      llmRemaining,
      merged,
    });
  } catch (e: any) {
    console.error("❌ canonicalize-items crash:", e);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message ?? String(e),
    });
  }
});
