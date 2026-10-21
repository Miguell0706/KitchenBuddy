/** KitchenBuddy -> YOUR Render backend. Never send the API Ninjas key to Expo. */
export const COOK_NOW_API_URL = `${(process.env.EXPO_PUBLIC_KB_API_BASE_URL || "https://receiptchef.onrender.com").replace(/\/$/, "")}/api/cook-now/search`;

export type MacroLimits = Partial<
  Record<
    | "min_calories"
    | "max_calories"
    | "min_protein"
    | "max_protein"
    | "min_carbs"
    | "max_carbs"
    | "min_fat"
    | "max_fat"
    | "max_sugars"
    | "max_sodium",
    number
  >
>;
export type RecipeIngredient = {
  name: string;
  quantity?: number;
  unit: string;
};
export type RecipeNutrition = Partial<
  Record<
    | "calories"
    | "total_fat"
    | "saturated_fat"
    | "protein"
    | "sodium"
    | "potassium"
    | "dietary_fiber"
    | "cholesterol"
    | "sugars"
    | "total_carbohydrate",
    number
  >
>;
export type PantryMatch = {
  matched_ingredients: unknown[];
  matched_count: number;
  requested_count: number;
  missing_ingredients: unknown[];
  missing_count: number;
};
export type ApiRecipe = {
  title: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  servings: string;
  nutrition: RecipeNutrition;
  pantry_match?: PantryMatch;
  original_servings?: string;
  scale_factor?: number;
};
export type CookNowQuery = {
  title?: string;
  ingredients?: string[]; // API provider allows up to 5
  servings?: number;
  filters?: MacroLimits;
  limit: number;
  offset: number;
};
export type CookNowResponse = {
  recipes: ApiRecipe[];
  pagination: {
    offset: number;
    limit: number;
    count: number;
    hasMore: boolean;
  };
};

/**
 * This hook point MUST be connected to a server-verifiable authenticated account.
 * KitchenBuddy's local test Premium toggle is UI-only and must never authorize API spend.
 * Return null until an actual backend-validated session is implemented.
 */
export async function getCookNowAccessToken(): Promise<string | null> {
  return null;
}

export async function searchCookNowRecipes(
  query: CookNowQuery,
  accessToken: string,
): Promise<CookNowResponse> {
  if (!accessToken) throw new Error("Sign in to use Cook Now Premium.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(COOK_NOW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(query),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    const obj =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new Error(
          "Premium access needs to be verified. Please sign in again.",
        );
      if (response.status === 429)
        throw new Error(
          "You've reached the recipe search limit. Try again later.",
        );
      throw new Error(
        typeof obj.error === "string"
          ? obj.error
          : "Recipe search is temporarily unavailable.",
      );
    }
    if (
      !Array.isArray(obj.recipes) ||
      !obj.pagination ||
      typeof obj.pagination !== "object"
    )
      throw new Error("Recipe service returned an unexpected response.");
    return data as CookNowResponse;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Recipe search timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function ingredientLabel(item: RecipeIngredient): string {
  const quantity =
    typeof item.quantity === "number" && Number.isFinite(item.quantity)
      ? `${Number(item.quantity.toFixed(2))} `
      : "";
  const unit =
    item.unit?.trim().toLowerCase() === "unit"
      ? ""
      : `${item.unit?.trim() || ""} `;
  return `${quantity}${unit}${item.name}`.trim();
}
export function missingName(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
  }
  return "";
}
