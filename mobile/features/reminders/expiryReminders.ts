import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { loadPantry } from "@/features/pantry/storage";
import type { PantryItem } from "@/features/pantry/types";
import type { ReminderSettings } from "./reminderStorage";

const EXPIRY_NOTIFICATION_IDS_KEY = "expiry_notification_ids_v1";
let expirySyncInProgress: Promise<void> | null = null;
function parseLocalExpiryDate(dateString: string): Date | null {
  const dateOnly = dateString.slice(0, 10);
  const parts = dateOnly.split("-").map(Number);

  if (parts.length !== 3) {
    return null;
  }

  const [year, month, day] = parts;

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getLeadDays(expiryLead: ReminderSettings["expiryLead"]): number {
  switch (expiryLead) {
    case "3d":
      return 3;

    case "2d":
      return 2;

    case "1d":
    default:
      return 1;
  }
}

function getReminderBody(item: PantryItem, leadDays: number): string {
  if (leadDays === 1) {
    return `${item.name} expires tomorrow.`;
  }

  return `${item.name} expires in ${leadDays} days.`;
}

export async function cancelExpiryReminders(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EXPIRY_NOTIFICATION_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    console.log("Cancelling existing expiry reminders:", ids.length);

    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );

    await AsyncStorage.removeItem(EXPIRY_NOTIFICATION_IDS_KEY);

    console.log("Existing expiry reminders cancelled.");
  } catch (error) {
    console.error("Failed to cancel expiry reminders:", error);
  }
}

export function scheduleExpiryReminders(
  settings: ReminderSettings,
): Promise<void> {
  if (expirySyncInProgress) {
    console.log("Expiry reminder sync already running; reusing it.");
    return expirySyncInProgress;
  }

  expirySyncInProgress = runScheduleExpiryReminders(settings).finally(() => {
    expirySyncInProgress = null;
  });

  return expirySyncInProgress;
}

async function runScheduleExpiryReminders(
  settings: ReminderSettings,
): Promise<void> {
  console.log("Scheduling expiry reminders with settings:", {
    expiryReminders: settings.expiryReminders,
    expiryLead: settings.expiryLead,
  });

  await cancelExpiryReminders();

  if (!settings.expiryReminders) {
    console.log("Expiry reminders are disabled.");
    return;
  }

  try {
    const pantry = await loadPantry();
    const allItems = Object.values(pantry).flat();

    const now = new Date();
    const leadDays = getLeadDays(settings.expiryLead);
    const ids: string[] = [];

    for (const item of allItems) {
      if (!item.expiryDate) {
        continue;
      }

      const expiryDate = parseLocalExpiryDate(item.expiryDate);

      if (!expiryDate) {
        console.warn("Invalid expiry date:", {
          itemId: item.id,
          itemName: item.name,
          expiryDate: item.expiryDate,
        });

        continue;
      }

      const notificationDate = new Date(expiryDate);

      notificationDate.setDate(notificationDate.getDate() - leadDays);

      notificationDate.setHours(9, 0, 0, 0);

      if (notificationDate <= now) {
        console.log("Skipping past expiry reminder:", {
          itemName: item.name,
          notificationDate: notificationDate.toString(),
        });

        continue;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.name} expires soon`,
          body: getReminderBody(item, leadDays),
          data: {
            type: "expiry_reminder",
            pantryItemId: item.id,
            categoryKey: item.categoryKey,
            expiryDate: item.expiryDate,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationDate,
        },
      });

      ids.push(id);

      console.log("Expiry reminder scheduled:", {
        id,
        itemId: item.id,
        itemName: item.name,
        expiryDate: item.expiryDate,
        notificationDate: notificationDate.toString(),
      });
    }

    await AsyncStorage.setItem(
      EXPIRY_NOTIFICATION_IDS_KEY,
      JSON.stringify(ids),
    );

    console.log(
      `Successfully scheduled ${ids.length} expiry reminder notification${
        ids.length === 1 ? "" : "s"
      }.`,
    );
  } catch (error) {
    console.error("Failed to schedule expiry reminders:", error);
  }
}
