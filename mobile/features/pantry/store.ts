import { create } from "zustand";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";
import { MOCK_PANTRY } from "@/features/pantry/mock";

type PantryState = {
  pantry: Record<CategoryKey, PantryItem[]>;

  // ✅ accept either a full object OR an updater fn like React setState
  setPantry: (
    next:
      | Record<CategoryKey, PantryItem[]>
      | ((prev: Record<CategoryKey, PantryItem[]>) => Record<CategoryKey, PantryItem[]>)
  ) => void;

  addItem: (categoryKey: CategoryKey, item: PantryItem) => void;
  getItem: (categoryKey: CategoryKey, id: string) => PantryItem | undefined;
  updateItem: (
    categoryKey: CategoryKey,
    id: string,
    patch: Partial<PantryItem>
  ) => void;
};

export const usePantryStore = create<PantryState>((set, get) => ({
  pantry: MOCK_PANTRY,

  setPantry: (next) => {
    set((state) => ({
      pantry: typeof next === "function" ? next(state.pantry) : next,
    }));
  },

  addItem: (categoryKey, item) => {
    set((state) => ({
      pantry: {
        ...state.pantry,
        [categoryKey]: [item, ...state.pantry[categoryKey]],
      },
    }));
  },

  getItem: (categoryKey, id) => {
    return get().pantry[categoryKey].find((i) => i.id === id);
  },

  updateItem: (categoryKey, id, patch) => {
    set((state) => ({
      pantry: {
        ...state.pantry,
        [categoryKey]: state.pantry[categoryKey].map((i) =>
          i.id === id ? { ...i, ...patch } : i
        ),
      },
    }));
  },
}));
