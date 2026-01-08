// features/settings/store.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CategoryKey } from "@/features/pantry/types";

type ExpiryValue = number | "none";
type ExpiryOverrides = Partial<Record<CategoryKey, ExpiryValue>>;

type SettingsState = {
  expiryOverrides: ExpiryOverrides;
  setExpiryOverride: (key: CategoryKey, value: ExpiryValue) => void;
  resetExpiryOverride: (key: CategoryKey) => void;
  hydrate: () => Promise<void>;
};

const STORAGE_KEY = "settings:expiryOverrides";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  expiryOverrides: {},

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ExpiryOverrides;
      set({ expiryOverrides: parsed });
    } catch (err) {
      console.warn("Failed to load expiryOverrides", err);
    }
  },

  setExpiryOverride: (key, value) => {
    const next = { ...get().expiryOverrides, [key]: value };
    set({ expiryOverrides: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
      console.warn("Failed to save expiryOverrides", err)
    );
  },

  resetExpiryOverride: (key) => {
    const next = { ...get().expiryOverrides };
    delete next[key];
    set({ expiryOverrides: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
      console.warn("Failed to save expiryOverrides", err)
    );
  },
}));
