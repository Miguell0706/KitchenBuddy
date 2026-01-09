// features/recipes/types.ts
export type RecipeId = string;

export type Recipe = {
  id: RecipeId;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  totalTimeMinutes?: number | null;
  source?: "api" | "manual";
  savedAt: number; // Date.now()
};
