// features/recipes/store.ts
import { create } from "zustand";
import type { Recipe } from "./types";

type RecipesState = {
  saved: Recipe[];
  addRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
};

export const useRecipesStore = create<RecipesState>((set) => ({
  saved: [],
  addRecipe: (recipe) =>
    set((state) => ({
      saved: [recipe, ...state.saved.filter((r) => r.id !== recipe.id)],
    })),
  removeRecipe: (id) =>
    set((state) => ({
      saved: state.saved.filter((r) => r.id !== id),
    })),
}));
