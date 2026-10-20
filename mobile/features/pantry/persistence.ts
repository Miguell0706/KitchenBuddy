import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_CATEGORY_KEYS } from "./constants";
import { usePantryStore } from "./store";
import type { CategoryKey, PantryItem } from "./types";
import {
  syncExpiryReminders,
  syncExpiryRemindersIncremental,
} from "@/features/reminders/pantryReminderSync";

const PANTRY_KEY = "pantry_items_v1";
type PantryData = Record<CategoryKey, PantryItem[]>;

let startPromise: Promise<void> | null = null;
let unsubscribe: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

function isValidPantryShape(value: unknown): value is PantryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return ALL_CATEGORY_KEYS.every((key) => Array.isArray(object[key]));
}

/** Queue an immutable Pantry snapshot, retaining the existing single-writer order. */
function enqueueCurrentSnapshot(): Promise<void> {
  const snapshot = JSON.stringify(usePantryStore.getState().pantry);
  const pantrySnapshot = JSON.parse(snapshot) as PantryData;

  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      // The Pantry is durable before scheduling its notifications. A failed
      // notification permission/OS operation must NOT report a failed Pantry save.
      await AsyncStorage.setItem(PANTRY_KEY, snapshot);
      try {
        await syncExpiryRemindersIncremental(pantrySnapshot);
        if (__DEV__) {
          console.log("[KB Pantry] Single-writer incremental save completed.");
        }
      } catch (error) {
        console.warn(
          "[KB Pantry] Pantry saved, but reminder sync failed; startup will retry:",
          error,
        );
      }
    });
  return saveQueue;
}

/** Multiple rapid Zustand updates collapse to one storage + notification pass. */
function queueSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void enqueueCurrentSnapshot().catch((error) => {
      console.warn("[KB Pantry] Pantry save failed:", error);
    });
  }, 250);
}

/**
 * Force any debounced Pantry write to disk now. For receipt confirmation, do
 * not navigate away until this resolves. Also waits for older queued writes.
 * A failed AsyncStorage write rejects; reminder-only failures log separately.
 */
export function flushPantryPersistence(): Promise<void> {
  if (!usePantryStore.getState().hydrated) {
    return Promise.reject(new Error("Pantry is not hydrated yet."));
  }
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return enqueueCurrentSnapshot();
  }
  return saveQueue;
}

/**
 * Receipt/bulk imports use one Zustand mutation and the SAME single writer as
 * manual Pantry edits. Re-importing an existing ID updates it instead of
 * duplicating it; if its category changes, it moves to the new category.
 */
export async function commitPantryItemsBatch(
  newItems: PantryItem[],
): Promise<void> {
  if (newItems.length === 0) return;
  for (const item of newItems) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      throw new Error("Cannot import an item without a stable Pantry ID.");
    }
  }

  // Critical: do not merge into the store's initial empty Pantry before load.
  await startPantryPersistence();

  const incoming = new Map<string, PantryItem>();
  for (const item of newItems) incoming.set(item.id, item);
  const incomingIds = new Set(incoming.keys());

  usePantryStore.getState().setPantry((previous) => {
    const existingById = new Map<string, PantryItem>();
    const next = {} as PantryData;

    for (const category of ALL_CATEGORY_KEYS) {
      const original = previous[category] ?? [];
      for (const item of original) existingById.set(item.id, item);
      next[category] = original.filter((item) => !incomingIds.has(item.id));
    }

    // Match the previous storage helper's newest-first insert behavior.
    for (const item of incoming.values()) {
      const category: CategoryKey = ALL_CATEGORY_KEYS.includes(item.categoryKey)
        ? item.categoryKey
        : "pantry";
      const merged: PantryItem = {
        ...existingById.get(item.id),
        ...item,
        categoryKey: category,
      };
      next[category].unshift(merged);
    }
    return next;
  });

  // Flushes the debounce immediately and waits for the persistent write.
  // The subscribed service performs ONE incremental batch synchronization.
  await flushPantryPersistence();
}

export function startPantryPersistence(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    // Load before listening. Never write the store's initial empty Pantry.
    const raw = await AsyncStorage.getItem(PANTRY_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidPantryShape(parsed)) {
        throw new Error("Saved Pantry data has an unexpected structure.");
      }
      usePantryStore.setState({ pantry: parsed });
    }
    if (!unsubscribe) {
      unsubscribe = usePantryStore.subscribe((state, previous) => {
        if (state.pantry !== previous.pantry) queueSave();
      });
    }
    usePantryStore.setState({ hydrated: true, hydrationError: null });
    if (__DEV__) console.log("[KB Pantry] Persistence initialized.");

    // Recovery/startup verifies pending OS notifications without blindly
    // recreating unchanged reminders. This remains the full-sync path.
    void syncExpiryReminders().catch((error) => {
      console.warn(
        "[KB Pantry] Startup reminder reconciliation failed:",
        error,
      );
    });
  })().catch((error) => {
    startPromise = null;
    usePantryStore.setState({
      hydrated: false,
      hydrationError:
        error instanceof Error
          ? error.message
          : "Unable to load your saved pantry.",
    });
    throw error;
  });
  return startPromise;
}
