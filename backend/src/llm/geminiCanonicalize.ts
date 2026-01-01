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

function buildPrompt(rows: InputRow[]) {
  return `
You are a grocery receipt item canonicalizer.

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


Rules:
- rows.length MUST equal input length.
- Preserve each "key" exactly as provided.
- canonicalName: cleaned, human-friendly Title Case (e.g., "Boneless Chicken Breast", "Diced Tomatoes").
- Remove store prefixes/promo tokens/prices/weights ("PUB", "PUBLIX", "2 FOR", "$", "LB", etc.).
- If line is clearly not an item (totals, payment, coupons, survey, store meta) => status="not_item".
- If unclear => status="unknown" with low confidence.
- confidence 0..1. Keep it conservative if abbreviated/uncertain.
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM_TIMEOUT_${ms}ms`)), ms)
    ),
  ]);
}


export async function geminiCanonicalize(rows: InputRow[]): Promise<CanonResult[]> {
  const apiKey = mustEnv("GEMINI_API_KEY");
  const client = new GoogleGenerativeAI(apiKey);


  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });


  const prompt = buildPrompt(rows);

  try {
    const resp = await withTimeout(
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      TIMEOUT_MS
    );

    const raw = resp.response.text();
    const parsed = safeParseJson(raw);
    validate(rows, parsed);

    const now = Date.now();
    return parsed.rows.map((r: any) => ({
      key: r.key,
      canonicalName: r.canonicalName,
      status: r.status,
      kind: r.kind,
      ingredientType: r.ingredientType,

      confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0))),
      updatedAt: now,
      source: "llm",
    }));

  } catch (err: any) {
   console.error("geminiCanonicalize failed", { model: MODEL, message: err?.message, stack: err?.stack });


    // ✅ graceful fallback that matches your CanonResult type
    const now = Date.now();
    return rows.map((row) => ({
      key: row.key,
      canonicalName: row.text,
      status: "unknown",
      kind: "other",
      ingredientType: "ambiguous",
      confidence: 0,
      updatedAt: now,
      source: "none",
    }));
  }
}
