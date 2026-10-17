import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CategoryKey, PantryItem } from "./types";

// Keep this key unchanged: existing Pantry History and Analytics use this store.
const HISTORY_KEY = "@kb_pantry_history_v2";

export type PantryHistoryAction =
  | "purchased"
  | "added"
  | "used"
  | "expired"
  | "removed";

export type PantryHistorySource = "receipt" | "manual" | "quickAdd" | "unknown";

export type PantryHistoryEntry = {
  entryId: string; // Event ID (not the PantryItem ID).
  id: string; // PantryItem ID.
  name: string;
  recipeSearchName?: string;
  categoryKey: CategoryKey;
  quantity: string;
  expiryDate: string | null;
  addedAt: number;
  ingredientType?: "ingredient" | "product" | "ambiguous";
  kind?: "food" | "other";
  action: PantryHistoryAction;
  source?: PantryHistorySource;
  at: number;
};

export type PantryHistoryCorrection = {
  name: string;
  quantity: string;
  categoryKey: CategoryKey;
  // Only exit outcomes can be interchanged. Purchased/added are never
  // converted into exit events; those would corrupt lifecycle analytics.
  action: PantryHistoryAction;
};

// A single queue serializes ALL read-modify-write operations, including Undo,
// editing, single deletion, and clearing. Keep it alive after a failed write.
let historyWriteQueue: Promise<void> = Promise.resolve();

function enqueueHistoryWrite<T>(work: () => Promise<T>): Promise<T> {
  const operation = historyWriteQueue.then(work);
  historyWriteQueue = operation.then(
    () => undefined,
    (error) => {
      console.warn("Pantry history write queue error", error);
    },
  );
  return operation;
}

function makeEntryId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function readStoredHistory(): Promise<PantryHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error("Stored pantry history is invalid.");
  return parsed as PantryHistoryEntry[];
}

async function writeStoredHistory(
  entries: PantryHistoryEntry[],
): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function appendPantryHistory(
  item: PantryItem,
  action: PantryHistoryAction,
  source?: PantryHistorySource,
): Promise<string> {
  const entryId = makeEntryId();
  return enqueueHistoryWrite(async () => {
    const previous = await readStoredHistory();
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
    await writeStoredHistory([nextEntry, ...previous]);
    return entryId;
  });
}

/** Strict deletion for the management screen; errors propagate to the UI. */
export function deletePantryHistoryEntry(entryId: string): Promise<boolean> {
  return enqueueHistoryWrite(async () => {
    const previous = await readStoredHistory();
    const next = previous.filter((entry) => entry.entryId !== entryId);
    if (next.length === previous.length) return false;
    await writeStoredHistory(next);
    return true;
  });
}

/** Keep the legacy Undo API, but make its write part of the shared queue. */
export async function removePantryHistoryEntry(entryId: string): Promise<void> {
  try {
    await deletePantryHistoryEntry(entryId);
  } catch (error) {
    console.warn("Failed to remove pantry history entry", error);
  }
}

function isExit(action: PantryHistoryAction): boolean {
  return action === "used" || action === "expired" || action === "removed";
}

/**
 * Correct an event IN THE SOURCE STORE used by Analytics.
 * Name and category corrections are propagated to other history snapshots for
 * the SAME PantryItem ID, to keep rankings/categories consistent. Quantity is
 * event-specific: intake and exit quantities need not be identical.
 * Does not alter the live Pantry, original timestamp, item ID or event ID.
 */
export function updatePantryHistoryEntry(
  entryId: string,
  correction: PantryHistoryCorrection,
): Promise<PantryHistoryEntry> {
  return enqueueHistoryWrite(async () => {
    const previous = await readStoredHistory();
    const current = previous.find((entry) => entry.entryId === entryId);
    if (!current)
      throw new Error("This entry no longer exists. Please refresh.");

    const name = correction.name.trim();
    const quantity = correction.quantity.trim();
    if (!name || name.length > 120) {
      throw new Error("Enter an item name of 1–120 characters.");
    }
    if (!quantity || quantity.length > 60) {
      throw new Error("Enter a quantity of 1–60 characters.");
    }
    if (!correction.categoryKey) throw new Error("Choose a category.");
    if (isExit(current.action) !== isExit(correction.action)) {
      throw new Error(
        "An arrival event cannot become a usage/disposal event, or vice versa.",
      );
    }
    if (!isExit(current.action) && correction.action !== current.action) {
      throw new Error(
        "Purchased and manually added events cannot be interchanged here.",
      );
    }

    const next = previous.map((entry) => {
      // Propagate corrected name/category to this specific item's lifecycle.
      // A different shopping occurrence with a different PantryItem ID is intact.
      if (entry.id !== current.id) return entry;
      const common = {
        ...entry,
        name,
        recipeSearchName:
          entry.recipeSearchName === entry.name ? name : entry.recipeSearchName,
        categoryKey: correction.categoryKey,
      };
      return entry.entryId === entryId
        ? { ...common, quantity, action: correction.action }
        : common;
    });
    await writeStoredHistory(next);
    return next.find((entry) => entry.entryId === entryId)!;
  });
}

export async function getPantryHistory(): Promise<PantryHistoryEntry[]> {
  try {
    await historyWriteQueue;
    return await readStoredHistory();
  } catch (error) {
    console.warn("Failed to read pantry history", error);
    return [];
  }
}

/** Strict clear for the management UI; a failure does not masquerade as success. */
export function clearPantryHistoryStrict(): Promise<void> {
  return enqueueHistoryWrite(async () => {
    await AsyncStorage.removeItem(HISTORY_KEY);
  });
}

/** Preserve the existing public API for older callers. */
export async function clearPantryHistory(): Promise<void> {
  try {
    await clearPantryHistoryStrict();
  } catch (error) {
    console.warn("Failed to clear pantry history", error);
  }
}
