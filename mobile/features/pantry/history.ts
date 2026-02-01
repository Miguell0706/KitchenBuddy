// features/pantry/history.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PantryItem } from "./types";

const HISTORY_KEY = "@kb_pantry_history_v1";

export type PantryHistoryAction = "used" | "deleted";

export type PantryHistoryEntry = {
  entryId: string; // ✅ unique id for undo/removal
  id: string; // pantry item id (at time of action)
  name: string; // snapshot
  categoryKey?: string;
  quantity?: string;
  action: PantryHistoryAction;
  at: number; // timestamp (ms)
};

const MAX_HISTORY = 200;

// ✅ serialize writes to avoid lost updates
let historyWriteQueue: Promise<any> = Promise.resolve();

function makeEntryId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Appends a history entry and returns the entryId.
 * Writes are serialized so rapid calls can't overwrite each other.
 */ export function appendPantryHistory(
  item: PantryItem,
  action: PantryHistoryAction,
): Promise<string> {
  const entryId = makeEntryId();

  historyWriteQueue = historyWriteQueue.then(async () => {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const prev: PantryHistoryEntry[] = raw ? JSON.parse(raw) : [];

    const nextEntry: PantryHistoryEntry = {
      entryId,
      id: item.id,
      name: item.name,
      categoryKey: item.categoryKey,
      quantity: item.quantity,
      action,
      at: Date.now(),
    };

    const next = [nextEntry, ...prev].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  });

  // keep queue alive on failure
  historyWriteQueue = historyWriteQueue.catch((e) => {
    console.warn("History write queue error", e);
  });

  // ✅ return a promise that resolves AFTER this entry is written
  return historyWriteQueue.then(() => entryId);
}

/** Remove a specific history entry (used for Undo). */
export async function removePantryHistoryEntry(entryId: string): Promise<void> {
  try {
    // wait for any pending append so we don't race it
    await historyWriteQueue;

    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const prev: PantryHistoryEntry[] = raw ? JSON.parse(raw) : [];
    const next = prev.filter((e) => e.entryId !== entryId);

    if (next.length !== prev.length) {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    }
  } catch (e) {
    console.warn("Failed to remove pantry history entry", e);
  }
}

export async function getPantryHistory(): Promise<PantryHistoryEntry[]> {
  try {
    // ensure you read after queued writes
    await historyWriteQueue;

    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to read pantry history", e);
    return [];
  }
}

export async function clearPantryHistory(): Promise<void> {
  try {
    await historyWriteQueue;
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn("Failed to clear pantry history", e);
  }
}
