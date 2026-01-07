// features/pantry/history.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PantryItem } from "./types";

const HISTORY_KEY = "@kb_pantry_history_v1";

export type PantryHistoryAction = "used" | "deleted";

export type PantryHistoryEntry = {
  id: string; // pantry item id (at time of action)
  name: string; // snapshot
  categoryKey?: string;
  quantity?: string;
  action: PantryHistoryAction;
  at: number; // timestamp (ms)
};

const MAX_HISTORY = 200;

export async function appendPantryHistory(
  item: PantryItem,
  action: PantryHistoryAction
) {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const prev: PantryHistoryEntry[] = raw ? JSON.parse(raw) : [];

    const nextEntry: PantryHistoryEntry = {
      id: item.id,
      name: item.name,
      categoryKey: item.categoryKey,
      quantity: item.quantity,
      action,
      at: Date.now(),
    };

    const next = [nextEntry, ...prev].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to append pantry history", e);
  }
}

export async function getPantryHistory(): Promise<PantryHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to read pantry history", e);
    return [];
  }
}

export async function clearPantryHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn("Failed to clear pantry history", e);
  }
}
