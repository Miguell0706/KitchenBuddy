// backend/src/llm/geminiCanonicalize.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CanonResult } from "../lib/types.js";

type InputRow = {
  key: string;
  text: string;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 60_000;

function mustEnv(name: string): string {
  const v = process.env[name];

  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }

  return v;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM_TIMEOUT_${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Cheap detector for lines that are definitely not pantry food.
 *
 * This skips obvious:
 * - receipt noise
 * - household goods
 * - personal care
 * - supplements / medicine
 * - general merchandise
 *
 * Anything that could reasonably be food is left for Gemini.
 */
function isDefinitelyNonGrocery(text: string): boolean {
  const s = text.trim().toLowerCase();

  if (!s) {
    return true;
  }

  // Pure numeric value
  if (/^\d+(\.\d+)?$/.test(s)) {
    return true;
  }

  // Standalone price
  if (/^\$\s*\d+(\.\d{1,2})?$/.test(s)) {
    return true;
  }

  // Long numeric barcode / code
  if (/^\d{8,}$/.test(s.replace(/\s/g, ""))) {
    return true;
  }

  // Promotions / discounts
  if (
    /^(for|save|savings|you saved|deal|coupon|discount|loyalty|reward|rewards)\b/.test(
      s,
    )
  ) {
    return true;
  }

  // Totals / payment / receipt metadata
  if (
    /^(subtotal|total|tax|sales tax|amount due|balance|cash|credit|debit|visa|mastercard|amex|discover|payment|tender|change|cashier|register|terminal|transaction|receipt|survey)\b/.test(
      s,
    )
  ) {
    return true;
  }

  // Weight / quantity / unit-price lines
  if (/^\s*\d+(\.\d+)?\s*(lb|oz|kg|g|ea|each)\b.*\$?\d*(\.\d+)?\s*$/i.test(s)) {
    return true;
  }

  const nonFoodWords = [
    // Household / cleaning
    "paper towel",
    "toilet paper",
    "napkin",
    "tissue",
    "trash bag",
    "garbage bag",
    "detergent",
    "laundry detergent",
    "dish soap",
    "hand soap",
    "body soap",
    "cleaner",
    "cleaning spray",
    "disinfectant",
    "bleach",
    "sponge",
    "scrubber",
    "aluminum foil",
    "plastic wrap",
    "cling wrap",
    "ziploc",
    "ziplock",
    "storage bag",
    "paper plate",
    "plastic plate",
    "plastic cup",

    // Personal care
    "shampoo",
    "conditioner",
    "body wash",
    "toothpaste",
    "toothbrush",
    "mouthwash",
    "floss",
    "deodorant",
    "antiperspirant",
    "lotion",
    "moisturizer",
    "razor",
    "shaving cream",
    "tampon",
    "diaper",
    "baby wipes",
    "hand sanitizer",

    // Medicine / supplements
    "vitamin",
    "multivitamin",
    "supplement",
    "protein powder",
    "collagen",
    "creatine",
    "omega 3",
    "ibuprofen",
    "acetaminophen",
    "tylenol",
    "advil",
    "aspirin",
    "medicine",
    "medication",
    "cough syrup",
    "antacid",
    "allergy medicine",
    "bandage",
    "bandaid",
    "band-aid",

    // General merchandise
    "ruck",
    "rucksack",
    "backpack",
    "notebook",
    "binder",
    "pen",
    "pencil",
    "folder",
    "paper clips",
    "staples",
    "tape",
    "scissors",
    "toy",
    "game",
    "shirt",
    "pants",
    "shoes",
    "sock",
    "headphones",
    "charger",
    "cable",
    "battery",
    "flashlight",
  ];

  return nonFoodWords.some((word) => s.includes(word));
}

function buildPrompt(rows: InputRow[]): string {
  return `
You are a receipt line-item canonicalizer for a FOOD-ONLY pantry/kitchen app.

Return ONLY valid JSON.
No markdown.
No backticks.
No explanations.
No extra text.

Output MUST match this TypeScript type exactly:

type Out = {
  rows: Array<{
    key: string;
    canonicalName: string;
    recipeSearchName: string;
    status: "item" | "not_item" | "unknown";
    kind: "food" | "other";
    ingredientType: "ingredient" | "product" | "ambiguous";
    confidence: number;
  }>;
};

GOAL:

For every receipt line:

1. Determine whether it represents an edible or drinkable food product.
2. Reject anything that is not food.
3. Canonicalize valid food names into clean, human-friendly names.
4. Create a recipeSearchName optimized for recipe searching.
5. Preserve the provided key exactly.

STATUS RULES:

status="item"
Use ONLY if the line represents an edible or drinkable food product.

Examples:
- milk
- eggs
- bananas
- apples
- chicken breast
- ground beef
- bread
- cereal
- rice
- beans
- flour
- sugar
- spices
- cooking oil
- yogurt
- cheese
- frozen pizza
- chips
- cookies
- coffee
- juice
- soda
- canned food
- sauces
- condiments

status="not_item"
Use for anything that should NOT enter a food pantry.

Examples include:

HOUSEHOLD:
- paper towels
- toilet paper
- trash bags
- detergent
- dish soap
- bleach
- cleaners
- sponges
- aluminum foil
- plastic wrap

PERSONAL CARE:
- shampoo
- conditioner
- body wash
- toothpaste
- toothbrush
- deodorant
- lotion
- razors
- diapers

HEALTH / SUPPLEMENTS:
- vitamins
- supplements
- protein powder
- collagen
- creatine
- medicine
- OTC medicine
- pain relievers
- cough medicine
- allergy medicine
- bandages

GENERAL MERCHANDISE:
- batteries
- notebooks
- pens
- toys
- clothing
- electronics
- chargers
- cables
- tools

RECEIPT NOISE:
- prices
- standalone quantities
- standalone weights
- unit prices
- subtotal
- total
- taxes
- discounts
- coupons
- loyalty lines
- tender/payment
- change
- store information
- cashier
- register
- transaction number
- survey text
- barcodes
- long numeric codes

status="unknown"
Use ONLY when you genuinely cannot determine whether the line represents food.

KIND RULES:

- If status="item", kind MUST be "food".
- If status!="item", kind MUST be "other".

There is no household category.

INGREDIENT TYPE RULES:

ingredientType="ingredient"
Use for raw ingredients and basic cooking staples.

Examples:
- fruits
- vegetables
- raw meat
- eggs
- milk
- flour
- rice
- beans
- sugar
- salt
- spices
- butter
- cooking oil

ingredientType="product"
Use for packaged, processed, prepared, or ready-to-eat foods.

Examples:
- cereal
- chips
- crackers
- cookies
- frozen meals
- frozen pizza
- bread
- soda
- packaged snacks
- pasta sauce
- canned soup

ingredientType="ambiguous"
Use only if a valid food item's role is genuinely unclear.

If status!="item":
- ingredientType MUST be "ambiguous".

CANONICAL NAME RULES:

If status="item":
- Return a clean human-readable food name.
- Use Title Case.
- Remove prices.
- Remove weights and package quantities unless needed for identity.
- Remove store prefixes.
- Remove promotional text.
- Remove unnecessary SKU information.
- Usually remove store brands when the generic food is obvious.
- Preserve meaningful food distinctions.

Examples:

"GV WHOLE MILK 1GAL"
-> "Whole Milk"

"BANANAS 2.31 LB"
-> "Bananas"

"TYSON CHKN BRST"
-> "Chicken Breast"

"GROUND BEEF 80/20"
-> "80/20 Ground Beef"

"2% MILK"
-> "2% Milk"

"DIET COKE 12PK"
-> "Diet Coke"

If status!="item":
- canonicalName MUST be "".

RECIPE SEARCH NAME RULES:

recipeSearchName is used to search for recipes.

If status!="item":
- recipeSearchName MUST be "".

If status="item":
- Use a simple ingredient-oriented name.
- Remove brand names.
- Remove package sizes.
- Remove store names.
- Remove marketing words such as organic unless important.
- Remove preparation or grocery-display wording that hurts recipe search.
- Preserve the actual ingredient identity.
- Keep meaningful varieties when they affect recipes.

Examples:

"Broccoli Crowns"
-> canonicalName: "Broccoli Crowns"
-> recipeSearchName: "Broccoli"

"Organic Broccoli Crowns"
-> canonicalName: "Broccoli Crowns"
-> recipeSearchName: "Broccoli"

"Red Onion"
-> canonicalName: "Red Onion"
-> recipeSearchName: "Red Onion"

"Romaine Hearts"
-> canonicalName: "Romaine Hearts"
-> recipeSearchName: "Romaine Lettuce"

"Tyson BBQ Chicken Chunks"
-> canonicalName: "BBQ Chicken Chunks"
-> recipeSearchName: "BBQ Chicken"

"Potato Wedges"
-> canonicalName: "Potato Wedges"
-> recipeSearchName: "Potato Wedges"

"Boneless Skinless Chicken Breast"
-> canonicalName: "Boneless Skinless Chicken Breast"
-> recipeSearchName: "Chicken Breast"

KEY RULES:

- Preserve each key EXACTLY.
- Never change a key.
- Never invent a key.
- Every input row must have exactly one output row.
- rows.length MUST equal input length.
- Do not add extra fields.

CONFIDENCE RULES:

0.95-0.99 = extremely clear
0.85-0.94 = clear
0.70-0.84 = likely but abbreviated/noisy
0.50-0.69 = uncertain
0.25-0.49 = very uncertain
0.00-0.24 = mostly guessing

Avoid returning 1.0 unless it is exceptionally clear.

INPUT ROWS:

${JSON.stringify(rows, null, 2)}
`.trim();
}

function safeParseJson(raw: string): any {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error(`Gemini returned non-JSON: ${trimmed.slice(0, 200)}...`);
  }
}

function validate(rowsIn: InputRow[], out: any): void {
  if (!out || typeof out !== "object" || !Array.isArray(out.rows)) {
    throw new Error("Bad response shape");
  }

  if (out.rows.length !== rowsIn.length) {
    throw new Error(
      `Row length mismatch: expected ${rowsIn.length}, got ${out.rows.length}`,
    );
  }

  const inputKeys = rowsIn.map((r) => r.key);
  const inputKeySet = new Set(inputKeys);

  if (inputKeySet.size !== inputKeys.length) {
    throw new Error("Duplicate input keys");
  }

  const outputKeys = new Set<string>();

  for (const r of out.rows) {
    if (typeof r?.key !== "string" || !inputKeySet.has(r.key)) {
      throw new Error(`Bad/missing key: ${r?.key}`);
    }

    if (outputKeys.has(r.key)) {
      throw new Error(`Duplicate output key: ${r.key}`);
    }

    outputKeys.add(r.key);

    if (typeof r.canonicalName !== "string") {
      throw new Error(`canonicalName missing: ${r.key}`);
    }

    if (typeof r.recipeSearchName !== "string") {
      throw new Error(`recipeSearchName missing: ${r.key}`);
    }

    if (!["item", "not_item", "unknown"].includes(r.status)) {
      throw new Error(`status invalid: ${r.key}`);
    }

    if (!["food", "other"].includes(r.kind)) {
      throw new Error(`kind invalid: ${r.key}`);
    }

    if (!["ingredient", "product", "ambiguous"].includes(r.ingredientType)) {
      throw new Error(`ingredientType invalid: ${r.key}`);
    }

    if (
      typeof r.confidence !== "number" ||
      !Number.isFinite(r.confidence) ||
      r.confidence < 0 ||
      r.confidence > 1
    ) {
      throw new Error(`confidence invalid: ${r.key}`);
    }

    if (r.status === "item" && r.kind !== "food") {
      throw new Error(`Item must have kind="food": ${r.key}`);
    }

    if (r.status !== "item" && r.kind !== "other") {
      throw new Error(`Non-item must have kind="other": ${r.key}`);
    }

    if (r.status !== "item" && r.canonicalName !== "") {
      throw new Error(`Non-item must have empty canonicalName: ${r.key}`);
    }

    if (r.status !== "item" && r.recipeSearchName !== "") {
      throw new Error(`Non-item must have empty recipeSearchName: ${r.key}`);
    }

    if (r.status !== "item" && r.ingredientType !== "ambiguous") {
      throw new Error(
        `Non-item must have ingredientType="ambiguous": ${r.key}`,
      );
    }
  }

  for (const key of inputKeys) {
    if (!outputKeys.has(key)) {
      throw new Error(`Missing output key: ${key}`);
    }
  }
}

function makeNonItemResult(row: InputRow, updatedAt: number): CanonResult {
  return {
    key: row.key,
    canonicalName: "",
    recipeSearchName: "",
    status: "not_item",
    kind: "other",
    ingredientType: "ambiguous",
    confidence: 0.95,
    updatedAt,
    source: "none",
  };
}

function makeFallbackResult(row: InputRow, updatedAt: number): CanonResult {
  return {
    key: row.key,
    canonicalName: row.text.trim(),
    recipeSearchName: "",
    status: "unknown",
    kind: "other",
    ingredientType: "ambiguous",
    confidence: 0,
    updatedAt,
    source: "none",
  };
}

export async function geminiCanonicalize(
  rows: InputRow[],
): Promise<CanonResult[]> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const now = Date.now();

  const pre: CanonResult[] = [];
  const toLLM: InputRow[] = [];

  // 1) Prefilter obvious non-food lines
  for (const row of rows) {
    if (isDefinitelyNonGrocery(row.text)) {
      pre.push(makeNonItemResult(row, now));
    } else {
      toLLM.push(row);
    }
  }

  // Everything was confidently filtered out
  if (toLLM.length === 0) {
    const byKey = new Map<string, CanonResult>();

    for (const r of pre) {
      byKey.set(r.key, r);
    }

    return rows.map(
      (row) => byKey.get(row.key) ?? makeFallbackResult(row, now),
    );
  }

  const apiKey = mustEnv("GEMINI_API_KEY");

  const client = new GoogleGenerativeAI(apiKey);

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const prompt = buildPrompt(toLLM);

  try {
    // 2) Call Gemini
    const resp = await withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
      TIMEOUT_MS,
    );

    const raw = resp.response.text();
    const parsed = safeParseJson(raw);

    validate(toLLM, parsed);

    const updatedAt = Date.now();

    // 3) Normalize Gemini results into our food-only contract
    const llmResults: CanonResult[] = parsed.rows.map((r: any) => {
      const isFoodItem = r.status === "item" && r.kind === "food";

      if (!isFoodItem) {
        return {
          key: r.key,
          canonicalName: "",
          recipeSearchName: "",
          status: r.status === "unknown" ? "unknown" : "not_item",
          kind: "other",
          ingredientType: "ambiguous",
          confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0))),
          updatedAt,
          source: "llm",
        } satisfies CanonResult;
      }

      return {
        key: r.key,
        canonicalName: r.canonicalName.trim(),
        recipeSearchName: r.recipeSearchName.trim() || r.canonicalName.trim(),
        status: "item",
        kind: "food",
        ingredientType: r.ingredientType,
        confidence: Math.max(0, Math.min(1, Number(r.confidence ?? 0))),
        updatedAt,
        source: "llm",
      } satisfies CanonResult;
    });

    // 4) Merge back into original order
    const byKey = new Map<string, CanonResult>();

    for (const r of pre) {
      byKey.set(r.key, r);
    }

    for (const r of llmResults) {
      byKey.set(r.key, r);
    }

    return rows.map(
      (row) => byKey.get(row.key) ?? makeFallbackResult(row, updatedAt),
    );
  } catch (err: any) {
    console.error("geminiCanonicalize failed", {
      model: MODEL,
      message: err?.message,
      stack: err?.stack,
    });

    // Gemini failed:
    // preserve known non-items and mark unresolved rows as unknown.
    const fallbackTime = Date.now();

    const byKey = new Map<string, CanonResult>();

    for (const r of pre) {
      byKey.set(r.key, r);
    }

    for (const row of toLLM) {
      byKey.set(row.key, makeFallbackResult(row, fallbackTime));
    }

    return rows.map(
      (row) => byKey.get(row.key) ?? makeFallbackResult(row, fallbackTime),
    );
  }
}
