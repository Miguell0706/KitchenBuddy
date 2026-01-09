// features/premium/store.ts
import { create } from "zustand";

type PremiumState = {
  isPremium: boolean;
  setPremium: (val: boolean) => void;
};

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremium: false,
  setPremium: (val) => set({ isPremium: val }),
}));
