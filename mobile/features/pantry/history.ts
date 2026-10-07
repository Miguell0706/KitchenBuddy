// features/pantry/history.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CategoryKey, PantryItem } from "./types";

const HISTORY_KEY = "@kb_pantry_history_v2";

/**
 * Every meaningful way an item can enter or leave the pantry.
 *
 * purchased = added through a receipt/scan
 * added     = manually added
 * used      = consumed/used
 * expired   = discarded because it expired/went bad
 * removed   = removed for another reason/correction
 */
export type PantryHistoryAction =
  | "purchased"
  | "added"
  | "used"
  | "expired"
  | "removed";

/**
 * Where an item entered the pantry from.
 *
 * This is mainly useful on "purchased" and "added" events,
 * but is kept optional because exit events don't necessarily
 * need to repeat it.
 */
export type PantryHistorySource = "receipt" | "manual" | "quickAdd" | "unknown";

export type PantryHistoryEntry = {
  // Unique ID for this specific event.
  // Used for Undo and event removal.
  entryId: string;

  // ID of the PantryItem involved in this event.
  id: string;

  // Snapshot of useful item data at the time of the event.
  name: string;
  recipeSearchName?: string;
  categoryKey: CategoryKey;
  quantity: string;
  expiryDate: string | null;
  addedAt: number;

  ingredientType?: "ingredient" | "product" | "ambiguous";
  kind?: "food" | "other";

  // What happened.
  action: PantryHistoryAction;

  // How the item entered the pantry, when applicable.
  source?: PantryHistorySource;

  // When this event happened.
  at: number;
};

/**
 * Serialize writes so rapid pantry actions cannot overwrite
 * one another in AsyncStorage.
 */
let historyWriteQueue: Promise<void> = Promise.resolve();

function makeEntryId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Append a permanent pantry event.
 *
 * Unlike the old history implementation, events are NOT
 * automatically discarded after 200 entries because the full
 * history will power Pantry Analytics and Smart Grocery.
 */
export function appendPantryHistory(
  item: PantryItem,
  action: PantryHistoryAction,
  source?: PantryHistorySource,
): Promise<string> {
  const entryId = makeEntryId();

  const writeOperation = historyWriteQueue.then(async () => {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);

    const previous: PantryHistoryEntry[] = raw ? JSON.parse(raw) : [];

    const nextEntry: PantryHistoryEntry = {
      entryId,

      id: item.id,
      name: item.name,
      recipeSearchName: item.recipeSearchName,

      categoryKey: item.categoryKey,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      addedAt: item.addedAt,

      ingredientType: item.ingredientType,
      kind: item.kind,

      action,
      source,

      at: Date.now(),
    };

    // Newest events first.
    const next = [nextEntry, ...previous];

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  });

  /**
   * Keep the global queue alive even if this particular write fails.
   */
  historyWriteQueue = writeOperation.catch((error) => {
    console.warn("Pantry history write queue error", error);
  });

  /**
   * Resolve only after THIS event's write has completed.
   *
   * This matters for Undo because the caller receives the exact
   * entryId after its event has been persisted.
   */
  return writeOperation.then(() => entryId);
}

/**
 * Remove one specific event.
 *
 * Primarily used when a user performs Undo after marking
 * something used/removed.
 */
export async function removePantryHistoryEntry(entryId: string): Promise<void> {
  try {
    await historyWriteQueue;

    const raw = await AsyncStorage.getItem(HISTORY_KEY);

    const previous: PantryHistoryEntry[] = raw ? JSON.parse(raw) : [];

    const next = previous.filter((entry) => entry.entryId !== entryId);

    if (next.length !== previous.length) {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    }
  } catch (error) {
    console.warn("Failed to remove pantry history entry", error);
  }
}

/**
 * Return the complete pantry event history.
 *
 * Analytics will eventually read from this same event store.
 */
export async function getPantryHistory(): Promise<PantryHistoryEntry[]> {
  try {
    await historyWriteQueue;

    const raw = await AsyncStorage.getItem(HISTORY_KEY);

    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Failed to read pantry history", error);
    return [];
  }
}

/**
 * Completely delete the event history.
 *
 * IMPORTANT:
 * Once Analytics is live, this should NOT be exposed as a casual
 * "Clear History" action because these events are the user's
 * analytics data.
 */
export async function clearPantryHistory(): Promise<void> {
  try {
    await historyWriteQueue;
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.warn("Failed to clear pantry history", error);
  }
}
