import type { CategoryKey } from "./types";
import type { Ionicons } from "@expo/vector-icons";

export type Category = {
  key: CategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const CATEGORIES: Category[] = [
  { key: "produce", label: "Produce", icon: "leaf-outline" },
  { key: "meatSeafood", label: "Meat & Seafood", icon: "restaurant-outline" },
  { key: "dairyEggs", label: "Dairy & Eggs", icon: "ice-cream-outline" },
  { key: "bakery", label: "Bakery / Bread", icon: "nutrition-outline" },
  { key: "pantry", label: "Pantry (Dry Goods)", icon: "cube-outline" },
  { key: "condiments", label: "Condiments & Sauces", icon: "water-outline" },
  { key: "spices", label: "Spices & Seasonings", icon: "flame-outline" },
  { key: "beverages", label: "Beverages", icon: "cafe-outline" },
  { key: "frozen", label: "Frozen", icon: "snow-outline" },
  { key: "snacks", label: "Snacks & Sweets", icon: "ice-cream-outline" },
  { key: "pet", label: "Pet Food", icon: "paw-outline" },
  { key: "household", label: "Household (Non-food)", icon: "home-outline" },
  {
    key: "supplements",
    label: "Supplements / Vitamins",
    icon: "medkit-outline",
  },
];
export const CATEGORY_DEFAULT_EXPIRY: Record<CategoryKey, number | "none"> = {
  produce: 5,
  meatSeafood: 3,
  dairyEggs: 7,
  bakery: 3,
  pantry: 180,
  condiments: 365,
  spices: 365,
  beverages: 30,
  frozen: 90,
  snacks: 60,
  pet: 60, // 👈 add
  household: 9999,
  supplements: 180, // 👈 add
};

export const ALL_CATEGORY_KEYS: CategoryKey[] = CATEGORIES.map((c) => c.key);

export function setAllCategories(open: boolean): Record<CategoryKey, boolean> {
  return ALL_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = open;
    return acc;
  }, {} as Record<CategoryKey, boolean>);
}
