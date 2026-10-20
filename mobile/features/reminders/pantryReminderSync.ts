import type { CategoryKey, PantryItem } from "@/features/pantry/types";
import { loadReminderSettings } from "@/features/reminders/reminderStorage";
import {
  scheduleExpiryReminders,
  cancelExpiryReminders,
  reconcileExpiryRemindersForPantry,
} from "@/features/reminders/expiryReminders";

type PantryData = Record<CategoryKey, PantryItem[]>;

/** Startup, changed global settings, or recovery: check all OS reminders. */
export async function syncExpiryReminders(): Promise<void> {
  const settings = await loadReminderSettings();
  if (settings.expiryReminders) await scheduleExpiryReminders(settings);
  else await cancelExpiryReminders();
}

/** Everyday and bulk Pantry writes: native operations only for changed items. */
export async function syncExpiryRemindersIncremental(
  savedPantry: PantryData,
): Promise<void> {
  const settings = await loadReminderSettings();
  await reconcileExpiryRemindersForPantry(savedPantry, settings);
}
