// backend/src/llm/geminiCanonicalize.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CanonResult } from "../lib/types.js";

type InputRow = { key: string; text: string };

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = Math.min(60_000);

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM_TIMEOUT_${ms}ms`)), ms)
    ),
  ]);
}

/** Cheap “definitely not pantry-relevant” detector to reduce LLM drift + cost */
function isDefinitelyNonGrocery(text: string): boolean {
  const s = text.trim().toLowerCase();
  if (!s) return true;

  // obvious numeric/promo-ish
  if (/^\d+(\.\d+)?$/.test(s)) return true;
  if (/^(for|save|deal)\b/.test(s)) return true;
  if (/\b(\$|lb|oz|ea|each)\b/.test(s) && !/[a-z]/i.test(s.replace(/\b(lb|oz|ea|each)\b/gi, ""))) return true;

  // non-grocery retail keywords (expand over time)
  const badWords = [
    "ruck", "rucksack", "backpack", "notebook", "binder", "pen", "pencil",
    "folder", "paper clips", "staples", "tape", "scissors",
    "toy", "game", "shirt", "pants", "shoes", "sock",
    "headphones", "charger", "cable", "battery", "flashlight",
  ];

  return badWords.some((w) => s.includes(w));
}

function buildPrompt(rows: InputRow[]) {
  return `
You are a receipt line-item canonicalizer for a pantry/kitchen app.

Return ONLY valid JSON. No markdown, no backticks, no extra text.

Output MUST match this TypeScript type exactly:

type Out = {
  rows: Array<{
    key: string;
    canonicalName: string;
    status: "item" | "not_item" | "unknown";
    kind: "food" | "household" | "other";
    ingredientType: "ingredient" | "product" | "ambiguous";
    confidence: number; // 0..1
  }>;
};

Goal:
- Identify which lines are actual purchasable items vs non-item noise.
- Canonicalize item names into clean, human-friendly names.

status rules (IMPORTANT):
- status="item" if the line refers to a purchasable product (food OR household/personal care OR general merchandise).
  Examples: soy sauce, milk, bananas, paper towels, detergent, shampoo, lotion, vitamins, batteries, notebook.
- status="not_item" if it is NOT a product name:
  prices, weights/unit prices, totals, taxes, discounts, coupons, loyalty lines, tender/payment, change, store address/phone, cashier, survey, barcodes/long numeric codes.
- status="unknown" only if you truly cannot tell whether it is a product name or noise.

kind rules (only meaningful when status="item"):
- kind="food" for edible/drinkable items.
- kind="household" for household + personal care + cleaning + paper goods + OTC meds/supplements.
- kind="other" for general merchandise (electronics, apparel, toys, tools, stationery, etc.).
If status!="item", set kind="other".

ingredientType rules (only meaningful when status="item" AND kind="food"):
- ingredientType="ingredient" for raw ingredients/staples (produce, raw meats, eggs, milk, flour, rice, beans, spices).
- ingredientType="product" for packaged/prepared foods (snacks, frozen meals, bread, branded items).
- ingredientType="ambiguous" only if truly unclear.
If status!="item" OR kind!="food", set ingredientType="product" (or "ambiguous" if you prefer, but be consistent).

canonicalName rules:
- If status="item": Title Case, cleaned, human-friendly. Expand common abbreviations when obvious (e.g., "GV" -> omit brand, "HB" -> "Hand & Body" if context supports).
- If status="not_item": canonicalName MUST be "".
- Remove store prefixes/promo tokens/prices/weights ("PUB", "PUBLIX", "2 FOR", "$", "LB", etc.).
- Preserve each "key" EXACTLY as provided.
- rows.length MUST equal input length.
- Do not add extra fields.

confidence rules:
- Use a real scale:
  0.95-1.0 = obvious
  0.70-0.94 = likely but abbreviated/noisy
  0.40-0.69 = uncertain
  0.10-0.39 = very unsure
  0.00-0.09 = basically guess
- Avoid returning 1.0 unless it is extremely clear.

Input rows JSON:
${JSON.stringify(rows, null, 2)}
`.trim();
}

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(raw.slice(s, e + 1));
    throw new Error(`Gemini returned non-JSON: ${raw.slice(0, 200)}...`);
  }
}

function validate(rowsIn: InputRow[], out: any) {
  if (!out || typeof out !== "object" || !Array.isArray(out.rows)) throw new Error("Bad response shape");
  if (out.rows.length !== rowsIn.length) throw new Error("Row length mismatch");

  const inKeys = new Set(rowsIn.map((r) => r.key));

  for (const r of out.rows) {
    if (typeof r?.key !== "string" || !inKeys.has(r.key)) throw new Error(`Bad/missing key: ${r?.key}`);
    if (typeof r.canonicalName !== "string") throw new Error("canonicalName missing");
    if (!["item", "not_item", "unknown"].includes(r.status)) throw new Error("status invalid");
    if (!["food", "household", "other"].includes(r.kind)) throw new Error("kind invalid");
    if (!["ingredient", "product", "ambiguous"].includes(r.ingredientType)) throw new Error("ingredientType invalid");
    if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) throw new Error("confidence invalid");
  }
}

export async function geminiCanonicalize(rows: InputRow[]): Promise<CanonResult[]> {
  // 1) Prefilter obvious non-grocery items (skip LLM)
  const now = Date.now();
  const pre: CanonResult[] = [];
  const toLLM: InputRow[] = [];

  for (const row of rows) {
    if (isDefinitelyNonGrocery(row.text)) {
      pre.push({
        key: row.key,
        canonicalName: "",        // ✅
        status: "not_item",
        kind: "other",
        ingredientType: "ambiguous",
        confidence: 0.95,
        updatedAt: now,
        source: "none",
      });
    } else {
      toLLM.push(row);
    }
  }

  // If everything was prefiltered, we’re done
  if (toLLM.length === 0) return pre;

  // 2) Call Gemini for the remaining rows
  const apiKey = mustEnv("GEMINI_API_KEY");
  const client = new GoogleGenerativeAI(apiKey);

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const prompt = buildPrompt(toLLM);

  try {
    const resp = await withTimeout(
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      TIMEOUT_MS
    );

    const raw = resp.response.text();
    const parsed = safeParseJson(raw);
    validate(toLLM, parsed);

    const llmResults: CanonResult[] = parsed.rows.map((r: any) => ({
      key: r.key,
      canonicalName: r.canonicalName,
      status: r.status,
      kind: r.kind,
      ingredientType: r.ingredientType,
      confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0))),
      updatedAt: Date.now(),
      source: "llm",
    }));

    // 3) Merge back in original order
    const byKey = new Map<string, CanonResult>();
    for (const r of pre) byKey.set(r.key, r);
    for (const r of llmResults) byKey.set(r.key, r);

    return rows.map((row) => {
      const hit = byKey.get(row.key);
      if (!hit) {
        // Should never happen, but keep it safe
        return {
          key: row.key,
          canonicalName: row.text,
          status: "unknown",
          kind: "other",
          ingredientType: "ambiguous",
          confidence: 0,
          updatedAt: Date.now(),
          source: "none",
        } satisfies CanonResult;
      }
      return hit;
    });
  } catch (err: any) {
    console.error("geminiCanonicalize failed", {
      model: MODEL,
      message: err?.message,
      stack: err?.stack,
    });

    // graceful fallback for LLM subset + preserve prefiltered
    const fallbackLLM: CanonResult[] = toLLM.map((row) => ({
      key: row.key,
      canonicalName: row.text,
      status: "unknown",
      kind: "other",
      ingredientType: "ambiguous",
      confidence: 0,
      updatedAt: Date.now(),
      source: "none",
    }));

    const byKey = new Map<string, CanonResult>();
    for (const r of pre) byKey.set(r.key, r);
    for (const r of fallbackLLM) byKey.set(r.key, r);

    return rows.map((row) => byKey.get(row.key)!);
  }
}
