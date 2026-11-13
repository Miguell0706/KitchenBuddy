import { ingredientKey } from "@/features/grocery/groceryIngredients";
import type { PantryItem } from "@/features/pantry/types";

const waterTemperature =
  "(?:ice cold|cold|cool|room temperature|tepid|lukewarm|warm|hot|boiling|boiled)";
const plainCookingWater = new RegExp(
  `^(?:(?:${waterTemperature} )?(?:tap )?water|(?:tap )?water(?:,\\s*${waterTemperature}| \\(${waterTemperature}\\)))$`,
);

export function isPlainCookingWater(key: string): boolean {
  return plainCookingWater.test(key);
}

export function getPantryIngredientKeys(pantry: PantryItem[]): Set<string> {
  const date = new Date();
  const today = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  const keys = new Set<string>();
  for (const item of pantry) {
    if (item.kind === "other" || item.categoryKey === "pet") continue;
    if (item.quantity.trim() === "0") continue;
    if (item.expiryDate && item.expiryDate.slice(0, 10) < today) continue;

    for (const name of [item.recipeSearchName, item.name]) {
      const key = ingredientKey(name ?? "");
      if (key) keys.add(key);
    }
  }
  return keys;
}

export function countPantryIngredients(
  ingredients: unknown,
  pantryKeys: ReadonlySet<string>,
): { matched: number; total: number } {
  const keys = new Set<string>();
  if (Array.isArray(ingredients)) {
    for (const ingredient of ingredients) {
      const name =
        typeof ingredient === "string" ? ingredient : ingredient?.name;
      if (typeof name !== "string") continue;
      const key = ingredientKey(name);
      if (key && !isPlainCookingWater(key)) keys.add(key);
    }
  }

  let matched = 0;
  for (const key of keys) {
    if (pantryKeys.has(key)) matched++;
  }
  return { matched, total: keys.size };
}
