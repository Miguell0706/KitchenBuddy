export type CanonResult = {
  key: string;
  canonicalName: string;
  status: "item" | "not_item" | "unknown";
  kind: "food" | "household" | "other";
  ingredientType: "ingredient" | "product" | "ambiguous";
  confidence: number; // 0..1
  updatedAt: number;
  source: "cache" | "llm" | "none";
};
