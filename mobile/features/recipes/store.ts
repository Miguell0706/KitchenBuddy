import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  selectedRecipe: Recipe | null;

  // keep signature compatible (title), but we’ll also set selectedRecipe
  selectRecipe: (title: string) => void;
  clearSelectedRecipe: () => void;

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

export const useRecipesStore = create<RecipesState>()(
  persist(
    (set, get) => ({
      queryTitle: null,
      recipes: [],
      cached: false,

      selectedTitle: null,
      selectedRecipe: null,
      selectRecipe: (title) => {
        const state = get();
        const found =
          state.saved.find((r) => r.title === title) ??
          state.recipes.find((r) => r.title === title) ??
          null;

        set({ selectedTitle: title, selectedRecipe: found });

        // only kick off image fetch if it exists in results list and missing image
        if (found && !found.image?.url) {
          void get().ensureRecipeImage(title);
        }
      },

      clearSelectedRecipe: () =>
        set({ selectedTitle: null, selectedRecipe: null }),

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
        set({
          queryTitle,
          recipes,
          cached,
          selectedTitle: null,
          selectedRecipe: null,
        });

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

          const res = await fetch(
            `${baseUrl}/api/images/recipe-image?title=${encodeURIComponent(title)}`,
          );
          const json = await res.json();

          if (!res.ok || !json.ok || !json.image?.url) return;

          set((prev) => {
            const updatedRecipes = prev.recipes.map((r) =>
              r.title === title ? { ...r, image: json.image } : r,
            );

            // also update selectedRecipe if it’s the same one
            const updatedSelected =
              prev.selectedRecipe?.title === title
                ? { ...prev.selectedRecipe, image: json.image }
                : prev.selectedRecipe;

            return {
              ...prev,
              recipes: updatedRecipes,
              selectedRecipe: updatedSelected,
            };
          });
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
          selectedRecipe: null,
          _inFlight: {},
        }),
    }),
    {
      name: "recipes-store",
      storage: createJSONStorage(() => AsyncStorage),

      // Persist only what should survive reloads.
      // If you ALSO want saved recipes to persist, include `saved: state.saved`.
      partialize: (state) => ({
        selectedTitle: state.selectedTitle,
        selectedRecipe: state.selectedRecipe,
        saved: state.saved, // uncomment if you want saved recipes persisted too
      }),
    },
  ),
);
