import { create } from "zustand";

export type RecipeImage = {
  url: string;
  avgColor?: string;
  credit?: {
    provider: "pexels";
    providerUrl: string;
    photoUrl: string;
    photographer: string;
    photographerUrl: string;
  };
};

export type Recipe = {
  title: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  nutrition?: string;
  image?: RecipeImage;
};

type RecipesState = {
  queryTitle: string | null;
  recipes: Recipe[];
  cached: boolean;

  selectedTitle: string | null;
  selectRecipe: (title: string) => void;

  saved: Recipe[];
  saveRecipe: (r: Recipe) => void;
  unsaveRecipe: (title: string) => void;

  setResults: (payload: {
    queryTitle: string;
    recipes: Recipe[];
    cached: boolean;
  }) => void;

  ensureRecipeImage: (title: string) => Promise<void>;

  // internal helper (prevents duplicate fetches)
  _inFlight: Record<string, boolean>;

  clear: () => void;
};

export const useRecipesStore = create<RecipesState>((set, get) => ({
  queryTitle: null,
  recipes: [],
  cached: false,

  selectedTitle: null,
  selectRecipe: (title) => set({ selectedTitle: title }),

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

  _inFlight: {},

  setResults: ({ queryTitle, recipes, cached }) => {
    set({ queryTitle, recipes, cached, selectedTitle: null });

    // Prefetch images for the first N results (don’t await)
    const top = recipes.slice(0, 5);
    for (const r of top) {
      void get().ensureRecipeImage(r.title);
    }
  },

  ensureRecipeImage: async (title) => {
    const state = get();

    // already have it?
    const existing = state.recipes.find((r) => r.title === title);
    if (!existing || existing.image?.url) return;

    // already fetching it?
    if (state._inFlight[title]) return;

    // mark in-flight
    set((prev) => ({
      ...prev,
      _inFlight: { ...prev._inFlight, [title]: true },
    }));

    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      if (!baseUrl) throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");

      // ✅ use your mounted route: /api/images/recipe-image
      const res = await fetch(
        `${baseUrl}/api/images/recipe-image?title=${encodeURIComponent(title)}`,
      );

      const json = await res.json();

      if (!res.ok || !json.ok || !json.image?.url) return;

      set((prev) => ({
        ...prev,
        recipes: prev.recipes.map((r) =>
          r.title === title ? { ...r, image: json.image } : r,
        ),
      }));
    } catch (e) {
      console.warn("ensureRecipeImage failed", e);
    } finally {
      // clear in-flight
      set((prev) => {
        const next = { ...prev._inFlight };
        delete next[title];
        return { ...prev, _inFlight: next };
      });
    }
  },

  clear: () =>
    set({
      queryTitle: null,
      recipes: [],
      cached: false,
      selectedTitle: null,
      _inFlight: {},
    }),
}));
