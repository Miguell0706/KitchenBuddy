import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_CATEGORY_KEYS } from "./constants";
import { usePantryStore } from "./store";
import type { CategoryKey, PantryItem } from "./types";
import { syncExpiryReminders } from "@/features/reminders/pantryReminderSync";

const PANTRY_KEY = "pantry_items_v1";

type PantryData = Record<CategoryKey, PantryItem[]>;

let startPromise: Promise<void> | null = null;
let unsubscribe: (() => void) | null = null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

function isValidPantryShape(value: unknown): value is PantryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const object = value as Record<string, unknown>;

  return ALL_CATEGORY_KEYS.every((key) => Array.isArray(object[key]));
}

function queueSave(pantry: PantryData) {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;

    // Capture the latest snapshot when the debounce finishes.
    const snapshot = JSON.stringify(usePantryStore.getState().pantry);

    // Serialize writes so an older save cannot finish after a newer one.
    saveQueue = saveQueue
      .catch(() => undefined)
      .then(async () => {
        await AsyncStorage.setItem(PANTRY_KEY, snapshot);
        await syncExpiryReminders();

        if (__DEV__) {
          console.log("[KB Pantry] Single-writer save completed.");
        }
      });

    void saveQueue.catch((error) => {
      console.warn(
        "[KB Pantry] Persistence or reminder synchronization failed:",
        error,
      );
    });
  }, 250);
}

export function startPantryPersistence(): Promise<void> {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    // Read BEFORE subscribing. Never persist the initial empty store.
    const raw = await AsyncStorage.getItem(PANTRY_KEY);

    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);

      if (!isValidPantryShape(parsed)) {
        throw new Error("Saved Pantry data has an unexpected structure.");
      }

      usePantryStore.setState({ pantry: parsed });
    }

    // Only one global listener, regardless of mounted Pantry screens.
    if (!unsubscribe) {
      unsubscribe = usePantryStore.subscribe((state, previous) => {
        if (state.pantry !== previous.pantry) {
          queueSave(state.pantry);
        }
      });
    }

    usePantryStore.setState({
      hydrated: true,
      hydrationError: null,
    });

    if (__DEV__) {
      console.log("[KB Pantry] Persistence initialized.");
    }

    // One startup reconciliation. Do not block the Pantry UI while
    // the operating system schedules the notifications.
    void syncExpiryReminders().catch((error) => {
      console.warn("[KB Pantry] Startup reminder sync failed:", error);
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
