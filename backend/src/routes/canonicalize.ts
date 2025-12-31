import express from "express";
import { z } from "zod";
import { normalizeKey } from "../lib/normalizeKey.js";
import { cacheGetMany, cacheUpsertMany } from "../lib/cache.js";
import { enforceReceiptCaps, rateLimitDaily } from "../lib/guards.js";
import type { CanonResult } from "../lib/types.js";
import { geminiCanonicalize } from "../llm/geminiCanonicalize.js";

export const canonicalizeRouter = express.Router();

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
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "bad_request", details: parsed.error.flatten() });
  }

  const { deviceId } = parsed.data;
  const items = parsed.data.items.map((it) => ({
    ...it,
    key: normalizeKey(it.text)
  }));
  
  console.log("📥 canonicalize-items called", {
  deviceId,
  itemCount: items.length,
});

  // 1) cache lookup
  const keys = Array.from(new Set(items.map((i) => i.key)));
  const cached = await cacheGetMany(keys);
  
  // 2) find uncached keys + representative text (first occurrence)
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

 // 3) guards
  const MAX_UNKNOWN_ITEMS = Number.POSITIVE_INFINITY; // effectively no item cap
  const MAX_CHARS = 1800;
  const MAX_LLM_RECEIPTS_PER_DAY = 30;

  let llmUsed = false;
  let llmRemaining = null as null | number;

  let newRows: CanonResult[] = [];

  if (uncachedPairs.length > 0) {
    const rl = rateLimitDaily(deviceId, MAX_LLM_RECEIPTS_PER_DAY);
    llmRemaining = rl.remaining;

    console.log("🛡️ guards", { rateLimitOk: rl.ok, llmRemaining });

    if (rl.ok) {
        const { trimmed } = enforceReceiptCaps({
          maxItems: MAX_UNKNOWN_ITEMS,
          maxChars: MAX_CHARS,
          items: uncachedPairs
        });

        console.log("✂️ cap result", { itemsSentToLLM: trimmed.length });

        // STUB (later replace with real LLM call)
        newRows = await geminiCanonicalize(trimmed);


        // ✅ CACHE WRITE (only cache meaningful results)
        const toCache = newRows.filter(
          (r) =>
            r.status === "not_item" ||
            (r.status === "item" && r.confidence >= 0.75)
        );

        // Right now this will cache nothing (all are "unknown")
        // Once LLM is real, this starts saving money immediately
        if (toCache.length > 0) {
          await cacheUpsertMany(toCache);
          console.log("💾 cached", toCache.length);
        }
        llmUsed = newRows.length > 0;
        console.log(llmUsed ? "🤖 LLM used" : "💾 cache-only response");
      } else {
        console.log("🚫 rate limited; skipping LLM");
      }
    } else {
      console.log("💾 cache-only response");
  }

  
  // 5) merge: choose best available by key: cached > newRows > none
  const freshByKey: Record<string, CanonResult> = {};
  for (const r of newRows) freshByKey[r.key] = r;

  const merged = items.map((it) => {
    const hit = cached[it.key] ?? freshByKey[it.key] ?? null;
    return {
      id: it.id,
      text: it.text,
      key: it.key,
      result: hit
    };
  });

  return res.json({
    ok: true,
    llmUsed,
    llmRemaining,
    merged
  });
});
