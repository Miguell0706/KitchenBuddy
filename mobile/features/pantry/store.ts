// features/pantry/store.ts
import { create } from "zustand";
import { ALL_CATEGORY_KEYS } from "@/features/pantry/constants";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";

type PantryByCategory = Record<CategoryKey, PantryItem[]>;

type PantryState = {
  pantry: PantryByCategory;

  // ✅ accept either a full object OR an updater fn like React setState
  setPantry: (next: PantryByCategory | ((prev: PantryByCategory) => PantryByCategory)) => void;

  addItem: (categoryKey: CategoryKey, item: PantryItem) => void;
  getItem: (categoryKey: CategoryKey, id: string) => PantryItem | undefined;
  updateItem: (categoryKey: CategoryKey, id: string, patch: Partial<PantryItem>) => void;
};

const NAME_MAX = 40;

function buildEmptyPantry(): PantryByCategory {
  return ALL_CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = [];
    return acc;
  }, {} as PantryByCategory);
}

const normalizeItemPatch = (patch: Partial<PantryItem>) => {
  const next = { ...patch };

  if (typeof next.name === "string") {
    next.name = next.name.trim().slice(0, NAME_MAX);
  }

  if (typeof next.quantity === "string") {
    next.quantity = next.quantity.trim();
  }

  return next;
};

export const usePantryStore = create<PantryState>((set, get) => ({
  // ✅ Option A: start empty; PantryScreen hydrates from AsyncStorage
  pantry: buildEmptyPantry(),

  setPantry: (next) => {
    set((state) => ({
      pantry: typeof next === "function" ? next(state.pantry) : next,
    }));
  },

  addItem: (categoryKey, item) => {
    // normalize full item (safe: name/quantity trimming)
    const normalized = normalizeItemPatch(item) as PantryItem;

    set((state) => ({
      pantry: {
        ...state.pantry,
        [categoryKey]: [normalized, ...state.pantry[categoryKey]],
      },
    }));
  },

  getItem: (categoryKey, id) => {
    return get().pantry[categoryKey].find((i) => i.id === id);
  },

  updateItem: (categoryKey, id, patch) => {
    const normalizedPatch = normalizeItemPatch(patch);

    set((state) => ({
      pantry: {
        ...state.pantry,
        [categoryKey]: state.pantry[categoryKey].map((i) =>
          i.id === id ? { ...i, ...normalizedPatch } : i
        ),
      },
    }));
  },
}));
