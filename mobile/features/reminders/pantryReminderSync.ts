import { loadReminderSettings } from "@/features/reminders/reminderStorage";
import {
  scheduleExpiryReminders,
  cancelExpiryReminders,
} from "@/features/reminders/expiryReminders";

export async function syncExpiryReminders() {
  const settings = await loadReminderSettings();

  if (settings.expiryReminders) {
    await scheduleExpiryReminders(settings);
  } else {
    await cancelExpiryReminders();
  }
}
