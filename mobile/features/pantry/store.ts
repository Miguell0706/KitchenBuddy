// features/pantry/store.ts
import { create } from "zustand";
import { ALL_CATEGORY_KEYS } from "@/features/pantry/constants";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";

type PantryByCategory = Record<CategoryKey, PantryItem[]>;

type PantryState = {
  pantry: PantryByCategory;

  setPantry: (
    next: PantryByCategory | ((prev: PantryByCategory) => PantryByCategory)
  ) => void;

  addItem: (categoryKey: CategoryKey, item: PantryItem) => void;
  getItem: (categoryKey: CategoryKey, id: string) => PantryItem | undefined;
  updateItem: (
    categoryKey: CategoryKey,
    id: string,
    patch: Partial<PantryItem>
  ) => void;
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
  pantry: buildEmptyPantry(),

  // 🔐 Single mutation + (later) persistence point
  setPantry: (next) => {
    set((state) => {
      const nextPantry = typeof next === "function" ? next(state.pantry) : next;

      // 👇 This is where you'd persist to AsyncStorage:
      // await savePantryToStorage(nextPantry);
      return { pantry: nextPantry };
    });
  },

  addItem: (categoryKey, item) => {
    const normalized = normalizeItemPatch(item) as PantryItem;

    get().setPantry((prev) => ({
      ...prev,
      [categoryKey]: [normalized, ...(prev[categoryKey] ?? [])],
    }));
  },

  getItem: (categoryKey, id) => {
    return get().pantry[categoryKey].find((i) => i.id === id);
  },

  updateItem: (categoryKey, id, patch) => {
    const normalizedPatch = normalizeItemPatch(patch);

    get().setPantry((prev) => ({
      ...prev,
      [categoryKey]: prev[categoryKey].map((i) =>
        i.id === id ? { ...i, ...normalizedPatch } : i
      ),
    }));
  },
}));
