// backend/src/llm/geminiCanonicalize.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CanonResult } from "../lib/types.js";

type InputRow = { key: string; text: string };

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000);

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
You are a grocery receipt item canonicalizer for a pantry/kitchen app.

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

Definition of status:
- status="item" ONLY if pantry-relevant:
  - FOOD (anything edible: produce, meat, dairy, pantry staples, snacks, frozen foods, drinks)
  - HOUSEHOLD consumables used around food/home (paper towels, soap, detergent, trash bags, foil, etc.)
- If it is NOT pantry-relevant (e.g., rucksack/backpack, notebook, office supplies, apparel, toys, electronics) => status="not_item" and kind="other".
- Totals/payment/coupons/surveys/store meta => status="not_item".

ingredientType rules:
- ingredientType="ingredient" for raw ingredients / staples:
  - produce (bananas, apples, onions), raw meat cuts, eggs, milk, flour, rice, beans, spices.
- ingredientType="product" for packaged/prepared items:
  - cookies, donut holes, breadsticks, frozen potato wedges, branded snacks.
- ingredientType="ambiguous" only if truly unclear.

canonicalName rules:
- Title Case, cleaned, human-friendly.
- Remove store prefixes/promo tokens/prices/weights ("PUB", "PUBLIX", "2 FOR", "$", "LB", etc.).
- Preserve each "key" EXACTLY as provided.
- rows.length MUST equal input length.
- Do not add extra fields.

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
        canonicalName: row.text,
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
