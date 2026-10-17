import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { loadPantry } from "@/features/pantry/storage";
import type { PantryItem } from "@/features/pantry/types";
import type { ReminderSettings } from "./reminderStorage";
import { ensureKitchenBuddyNotifications } from "./notificationSetup";
import {
  expiryChannelId,
  EXPIRY_CATEGORY,
  expiryReminderCopy,
} from "./notificationContent";

const EXPIRY_NOTIFICATION_IDS_KEY = "expiry_notification_ids_v1";
let queue: Promise<void> = Promise.resolve();
function serialize(task: () => Promise<void>): Promise<void> {
  const next = queue.catch(() => undefined).then(task);
  queue = next;
  return next;
}

export function parseLocalExpiryDate(dateString: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(dateString);
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}
function leadDays(lead: ReminderSettings["expiryLead"]): number {
  return lead === "3d" ? 3 : lead === "2d" ? 2 : 1;
}
async function readIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(EXPIRY_NOTIFICATION_IDS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string")
    : [];
}
async function cancelTracked(): Promise<void> {
  const ids = await readIds();
  // Cancel first, retaining IDs on any cancellation failure so a later retry can recover.
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  await AsyncStorage.removeItem(EXPIRY_NOTIFICATION_IDS_KEY);
}
export function cancelExpiryReminders(): Promise<void> {
  return serialize(cancelTracked);
}

export function scheduleExpiryReminders(
  settings: ReminderSettings,
): Promise<void> {
  const snapshot = { ...settings };
  return serialize(async () => {
    await cancelTracked();
    if (!snapshot.expiryReminders) return;
    await ensureKitchenBuddyNotifications();
    const permission = await Notifications.getPermissionsAsync();
    if (
      !permission.granted &&
      permission.ios?.status !==
        Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      const requested = await Notifications.requestPermissionsAsync();
      if (
        !requested.granted &&
        requested.ios?.status !==
          Notifications.IosAuthorizationStatus.PROVISIONAL
      )
        throw new Error("Notification permission was not granted.");
    }
    const pantry = await loadPantry();
    const now = new Date();
    const days = leadDays(snapshot.expiryLead);
    const hour = Math.floor(snapshot.expiryTimeMinutes / 60),
      minute = snapshot.expiryTimeMinutes % 60;
    const ids: string[] = [];
    try {
      for (const item of Object.values(pantry).flat() as PantryItem[]) {
        if (!item.expiryDate) continue;
        const expiry = parseLocalExpiryDate(item.expiryDate);
        if (!expiry) {
          console.warn("Invalid expiry date:", item.id, item.expiryDate);
          continue;
        }
        const when = new Date(expiry);
        when.setDate(when.getDate() - days);
        when.setHours(hour, minute, 0, 0);
        if (when <= now) continue; // Preserve original behavior: no past-due notifications.
        const message = expiryReminderCopy(item, days);
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...message,
            categoryIdentifier: EXPIRY_CATEGORY,
            sound: snapshot.expirySound ? "default" : false,
            color: "#586D77",
            data: {
              type: "expiry_reminder",
              pantryItemId: item.id,
              categoryKey: item.categoryKey,
              expiryDate: item.expiryDate,
              kbSound: snapshot.expirySound,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            channelId: expiryChannelId(snapshot.expirySound),
          },
        });
        ids.push(id);
        // Persist progressively so interrupted scheduling remains recoverable.
        await AsyncStorage.setItem(
          EXPIRY_NOTIFICATION_IDS_KEY,
          JSON.stringify(ids),
        );
      }
    } catch (error) {
      console.warn(
        "Partial expiry schedule; next synchronization will cancel recorded IDs:",
        error,
      );
      throw error;
    }
  });
}

/** A single follow-up; does not alter expiry dates, daily schedules, or Pantry history. */
export function scheduleExpirySnooze(
  item: PantryItem,
  settings: ReminderSettings,
): Promise<void> {
  return serialize(async () => {
    if (!settings.expiryReminders) return;
    await ensureKitchenBuddyNotifications();
    const when = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `A follow-up for ${item.name}`,
        body: `Your reminder is back. Check ${item.name} in your Pantry when you have a moment.`,
        categoryIdentifier: EXPIRY_CATEGORY,
        sound: settings.expirySound ? "default" : false,
        color: "#586D77",
        data: {
          type: "expiry_reminder",
          pantryItemId: item.id,
          categoryKey: item.categoryKey,
          expiryDate: item.expiryDate,
          kbSound: settings.expirySound,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: expiryChannelId(settings.expirySound),
      },
    });
    const ids = await readIds();
    ids.push(id);
    await AsyncStorage.setItem(
      EXPIRY_NOTIFICATION_IDS_KEY,
      JSON.stringify(ids),
    );
  });
}
