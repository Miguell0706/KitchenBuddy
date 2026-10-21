import type { ApiRecipe, CookNowQuery } from "@/features/recipes/cookNowApi";

/** The provider matches at most five *requested names*, not Pantry quantities. */
export type BuilderExtraRule = "any" | "two" | "none";
export type BuilderFocusRule = "prioritize" | "every";

export function normalizeBuilderIngredient(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildBuilderQuery(args: {
  names: string[];
  servings?: number;
  minProtein?: number;
  maxCalories?: number;
  offset?: number;
}): CookNowQuery {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const name of args.names) {
    const clean = name.trim().replace(/,/g, " ").replace(/\s+/g, " ");
    const key = normalizeBuilderIngredient(clean);
    if (!key || seen.has(key)) continue;
    if (clean.length > 65)
      throw new Error("Ingredient names must be 65 characters or less.");
    seen.add(key);
    names.push(clean);
  }
  if (names.length < 1 || names.length > 5)
    throw new Error("Choose between one and five different ingredients.");
  if (
    args.servings !== undefined &&
    (!Number.isInteger(args.servings) ||
      args.servings < 1 ||
      args.servings > 1000)
  )
    throw new Error("Servings must be a whole number from 1 to 1,000.");
  for (const [label, value] of [
    ["Protein goal", args.minProtein],
    ["Calorie limit", args.maxCalories],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 50000)
    )
      throw new Error(`${label} must be between 0 and 50,000.`);
  }
  return {
    ingredients: names,
    ...(args.servings !== undefined ? { servings: args.servings } : {}),
    filters: {
      ...(args.minProtein !== undefined
        ? { min_protein: args.minProtein }
        : {}),
      ...(args.maxCalories !== undefined
        ? { max_calories: args.maxCalories }
        : {}),
    },
    limit: 10,
    offset: args.offset ?? 0,
  };
}

/** Filtering is done on the server-returned pantry_match, relative ONLY to submitted names. */
export function builderRecipeVisible(
  recipe: ApiRecipe,
  focus: BuilderFocusRule,
  extras: BuilderExtraRule,
): boolean {
  if (focus === "prioritize" && extras === "any") return true;
  const p = recipe.pantry_match;
  if (
    !p ||
    !Number.isFinite(p.matched_count) ||
    !Number.isFinite(p.requested_count) ||
    !Number.isFinite(p.missing_count)
  )
    return false;
  if (
    focus === "every" &&
    (p.requested_count < 1 || p.matched_count < p.requested_count)
  )
    return false;
  if (extras === "none" && p.missing_count > 0) return false;
  if (extras === "two" && p.missing_count > 2) return false;
  return true;
}

export function rankBuilderRecipes(recipes: ApiRecipe[]): ApiRecipe[] {
  return [...recipes].sort(
    (a, b) =>
      (b.pantry_match?.matched_count ?? -1) -
        (a.pantry_match?.matched_count ?? -1) ||
      (a.pantry_match?.missing_count ?? Number.MAX_SAFE_INTEGER) -
        (b.pantry_match?.missing_count ?? Number.MAX_SAFE_INTEGER),
  );
}
