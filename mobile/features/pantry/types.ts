export type IngredientImage = {
  url: string;
  avgColor?: string | null;
  credit?: {
    provider: string;
    providerUrl: string;
    photoUrl: string;
    photographer: string;
    photographerUrl: string;
  };
};

export type PantryItem = {
  id: string;
  name: string;
  recipeSearchName?: string;

  ingredientType?: "ingredient" | "product" | "ambiguous";
  kind?: "food" | "household" | "other";
  confidence?: number;

  quantity: string;
  categoryKey: CategoryKey;
  expiryDate: string | null;
  ingredientImage?: IngredientImage | null;
};
export type CategoryKey =
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
  | "household"
  | "supplements";
