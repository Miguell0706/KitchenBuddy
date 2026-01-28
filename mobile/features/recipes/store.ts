import { create } from "zustand";

export type Recipe = {
  title: string;
  ingredients: string;
  instructions: string;
  servings?: string;
};

type RecipesState = {
  queryTitle: string | null;
  recipes: Recipe[];
  cached: boolean;

  saved: Recipe[]; // ✅ add this
  saveRecipe: (r: Recipe) => void; // ✅ add this
  unsaveRecipe: (title: string) => void;

  setResults: (payload: {
    queryTitle: string;
    recipes: Recipe[];
    cached: boolean;
  }) => void;
  clear: () => void;
};

export const useRecipesStore = create<RecipesState>((set, get) => ({
  queryTitle: null,
  recipes: [],
  cached: false,

  saved: [],
  saveRecipe: (r) =>
    set((prev) => {
      if (prev.saved.some((x) => x.title === r.title)) return prev;
      return { ...prev, saved: [r, ...prev.saved] };
    }),
  unsaveRecipe: (title) =>
    set((prev) => ({
      ...prev,
      saved: prev.saved.filter((x) => x.title !== title),
    })),

  setResults: ({ queryTitle, recipes, cached }) =>
    set({ queryTitle, recipes, cached }),

  clear: () => set({ queryTitle: null, recipes: [], cached: false }),
}));
