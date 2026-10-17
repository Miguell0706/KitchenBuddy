import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { ReminderSettings } from "./reminderStorage";
import { ensureKitchenBuddyNotifications } from "./notificationSetup";
import {
  waterChannelId,
  WATER_CATEGORY,
  waterReminderCopy,
} from "./notificationContent";

const WATER_NOTIFICATION_IDS_KEY = "water_notification_ids_v1";
let queue: Promise<void> = Promise.resolve();
function serialize(task: () => Promise<void>): Promise<void> {
  const next = queue.catch(() => undefined).then(task);
  queue = next;
  return next;
}
export async function requestReminderPermission(): Promise<boolean> {
  await ensureKitchenBuddyNotifications(); // Android creates channels before permission request.
  const current = await Notifications.getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    return true;
  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
async function readIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(WATER_NOTIFICATION_IDS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string")
    : [];
}
async function cancelTracked(): Promise<void> {
  const ids = await readIds();
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  await AsyncStorage.removeItem(WATER_NOTIFICATION_IDS_KEY);
}
export function cancelWaterReminders(): Promise<void> {
  return serialize(cancelTracked);
}
export async function logScheduledNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(
    "All currently scheduled notifications:",
    JSON.stringify(scheduled, null, 2),
  );
  return scheduled;
}
export function scheduleWaterReminders(
  settings: ReminderSettings,
): Promise<void> {
  const snapshot = { ...settings };
  return serialize(async () => {
    await cancelTracked();
    if (!snapshot.waterReminders) return;
    if (!(await requestReminderPermission()))
      throw new Error("Notification permission was not granted.");
    if (snapshot.waterStartMinutes >= snapshot.waterEndMinutes)
      throw new Error("Water reminder start time must be before end time.");
    const interval =
      snapshot.waterCadence === "2h"
        ? 120
        : snapshot.waterCadence === "3h"
          ? 180
          : 240;
    const ids: string[] = [];
    for (
      let minutes = snapshot.waterStartMinutes, slot = 0;
      minutes <= snapshot.waterEndMinutes;
      minutes += interval, slot++
    ) {
      const copy = waterReminderCopy(slot);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          ...copy,
          categoryIdentifier: WATER_CATEGORY,
          sound: snapshot.waterSound ? "default" : false,
          color: "#586D77",
          data: {
            type: "water_reminder",
            scheduledMinutes: minutes,
            kbSound: snapshot.waterSound,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
          channelId: waterChannelId(snapshot.waterSound),
        },
      });
      ids.push(id);
      // Persist every ID for recovery after an interrupted reschedule.
      await AsyncStorage.setItem(
        WATER_NOTIFICATION_IDS_KEY,
        JSON.stringify(ids),
      );
    }
  });
}
/** One-time water snooze (never creates another recurring daily alarm). */
export function scheduleWaterSnooze(settings: ReminderSettings): Promise<void> {
  return serialize(async () => {
    if (!settings.waterReminders) return;
    if (!(await requestReminderPermission())) return;
    const when = new Date(Date.now() + 30 * 60 * 1000);
    const minuteOfDay = when.getHours() * 60 + when.getMinutes();
    if (
      minuteOfDay > settings.waterEndMinutes ||
      minuteOfDay < settings.waterStartMinutes
    ) {
      if (minuteOfDay > settings.waterEndMinutes)
        when.setDate(when.getDate() + 1);
      when.setHours(
        Math.floor(settings.waterStartMinutes / 60),
        settings.waterStartMinutes % 60,
        0,
        0,
      );
    }
    const copy = waterReminderCopy(1);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        ...copy,
        categoryIdentifier: WATER_CATEGORY,
        sound: settings.waterSound ? "default" : false,
        color: "#586D77",
        data: {
          type: "water_reminder",
          kbSound: settings.waterSound,
          snoozed: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: waterChannelId(settings.waterSound),
      },
    });
    const ids = await readIds();
    ids.push(id);
    await AsyncStorage.setItem(WATER_NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  });
}
