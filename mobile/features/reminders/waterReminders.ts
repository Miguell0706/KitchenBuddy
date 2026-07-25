import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { ReminderSettings } from "./reminderStorage";

const WATER_NOTIFICATION_IDS_KEY = "water_notification_ids_v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission() {
  const existing = await Notifications.getPermissionsAsync();

  console.log("Current notification permission:", existing.status);

  if (existing.status === "granted") {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();

  console.log("Requested notification permission:", requested.status);

  return requested.status === "granted";
}

export async function cancelWaterReminders() {
  try {
    const raw = await AsyncStorage.getItem(WATER_NOTIFICATION_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    console.log("Cancelling existing water reminders:", ids.length);

    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );

    await AsyncStorage.removeItem(WATER_NOTIFICATION_IDS_KEY);

    console.log("Existing water reminders cancelled.");
  } catch (error) {
    console.error("Failed to cancel water reminders:", error);
  }
}

export async function logScheduledNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  console.log(
    "All currently scheduled notifications:",
    JSON.stringify(scheduled, null, 2),
  );

  return scheduled;
}

export async function scheduleWaterReminders(settings: ReminderSettings) {
  console.log("Scheduling water reminders with settings:", settings);

  await cancelWaterReminders();

  if (!settings.waterReminders) {
    console.log("Water reminders are disabled.");
    return;
  }

  const allowed = await requestReminderPermission();

  if (!allowed) {
    console.warn("Notification permission was not granted.");
    return;
  }

  if (settings.waterStartMinutes >= settings.waterEndMinutes) {
    console.warn(
      "Water reminder start time must be earlier than the end time.",
    );
    return;
  }

  const ids: string[] = [];

  try {
    const intervalMinutes =
      settings.waterCadence === "2h"
        ? 2 * 60
        : settings.waterCadence === "3h"
          ? 3 * 60
          : 4 * 60;

    for (
      let scheduledMinutes = settings.waterStartMinutes;
      scheduledMinutes <= settings.waterEndMinutes;
      scheduledMinutes += intervalMinutes
    ) {
      const hour = Math.floor(scheduledMinutes / 60);
      const minute = scheduledMinutes % 60;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Drink water 💧",
          body: "Time for a hydration break.",
          data: {
            type: "water_reminder",
            scheduledMinutes,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      ids.push(id);

      console.log("Water reminder scheduled:", {
        id,
        hour,
        minute,
      });
    }

    await AsyncStorage.setItem(WATER_NOTIFICATION_IDS_KEY, JSON.stringify(ids));

    console.log(
      `Successfully scheduled ${ids.length} water reminder notification${
        ids.length === 1 ? "" : "s"
      }.`,
    );

    await logScheduledNotifications();
  } catch (error) {
    console.error("Failed to schedule water reminders:", error);
  }
}
