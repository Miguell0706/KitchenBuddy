export type CanonResult = {
  key: string;
  canonicalName: string;
  recipeSearchName: string;

  status: "item" | "not_item" | "unknown";
  kind: "food" | "other";
  ingredientType: "ingredient" | "product" | "ambiguous";

  categoryKey:
    | "produce"
    | "meatSeafood"
    | "dairyEggs"
    | "bakery"
    | "pantry"
    | "condiments"
    | "spices"
    | "beverages"
    | "frozen"
    | "snacks"
    | "pet"
    | "unknown";

  storageType: "pantry" | "refrigerated" | "frozen" | "unknown";

  expiryDays: number | null;
  expiryConfidence: number;

  confidence: number;
  updatedAt: number;
  source: "cache" | "llm" | "none";
};
