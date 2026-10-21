/** Root notification responses. Stage 4E adds group-aware default-tap navigation only. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { loadReminderSettings } from "./reminderStorage";
import { loadPantry } from "@/features/pantry/storage";
import {
  scheduleExpirySnooze,
  scheduleExpiryReminders,
} from "./expiryReminders";
import { scheduleWaterSnooze, scheduleWaterReminders } from "./waterReminders";
import { ensureKitchenBuddyNotifications } from "./notificationRegistration";
import { groupedReminderIdsFromNotification } from "./groupedReminderRoute";
export { ensureKitchenBuddyNotifications } from "./notificationRegistration";
import {
  ACTION_EXPIRY_LATER,
  ACTION_FIND_RECIPE,
  ACTION_VIEW_PANTRY,
  ACTION_WATER_DONE,
  ACTION_WATER_LATER,
} from "./notificationContent";

let initialMigration: Promise<void> | null = null;
const NOTIFICATION_UPGRADE_KEY = "@kb_notification_actions_channels_v1";
const reminderLog = (...args: unknown[]) => {
  if (__DEV__) console.log("[KB Reminder Sync]", ...args);
};

/** Keep the existing one-time channel/action migration unchanged. */
export function migrateExistingReminderSchedules(): Promise<void> {
  if (initialMigration) return initialMigration;
  initialMigration = (async () => {
    const alreadyMigrated = await AsyncStorage.getItem(
      NOTIFICATION_UPGRADE_KEY,
    );
    if (alreadyMigrated) {
      reminderLog("Migration already completed.");
      return;
    }
    reminderLog("Starting one-time notification migration.");
    await ensureKitchenBuddyNotifications();
    const permission = await Notifications.getPermissionsAsync();
    if (
      !permission.granted &&
      permission.ios?.status !==
        Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      reminderLog("Migration deferred: notification permission unavailable.");
      return;
    }
    const settings = await loadReminderSettings();
    reminderLog("Requested by notification migration: expiry.");
    await scheduleExpiryReminders(settings);
    reminderLog("Requested by notification migration: water.");
    await scheduleWaterReminders(settings);
    await AsyncStorage.setItem(NOTIFICATION_UPGRADE_KEY, "yes");
    reminderLog("One-time notification migration completed.");
  })().catch((error) => {
    initialMigration = null;
    throw error;
  });
  return initialMigration;
}

const processed = new Set<string>();
const processing = new Set<string>();

/** Both warm listener and cold-start response use this same handler. */
async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const request = response.notification.request;
  const action = response.actionIdentifier;
  const dedupeKey = `${request.identifier}:${action}`;
  if (processed.has(dedupeKey) || processing.has(dedupeKey)) return;
  processing.add(dedupeKey);
  let succeeded = false;
  try {
    const data = request.content.data;
    if (data?.type === "expiry_reminder") {
      const id = data.pantryItemId;
      const categoryKey = data.categoryKey;
      if (action === ACTION_EXPIRY_LATER) {
        // Only individuals have a supported one-item snooze action.
        if (typeof id === "string" && typeof categoryKey === "string") {
          const pantry = await loadPantry();
          const item = Object.values(pantry)
            .flat()
            .find((row) => row.id === id && row.categoryKey === categoryKey);
          if (item)
            await scheduleExpirySnooze(item, await loadReminderSettings());
        }
      } else if (action === ACTION_FIND_RECIPE) {
        if (typeof id === "string" && typeof categoryKey === "string") {
          const pantry = await loadPantry();
          const item = Object.values(pantry)
            .flat()
            .find((row) => row.id === id && row.categoryKey === categoryKey);
          if (item) {
            router.push({
              pathname: "/recipes/expiring",
              params: { itemIds: JSON.stringify([id]) },
            });
          } else {
            router.push({
              pathname: "/(tabs)/pantry",
              params: { kbGroupIds: "", kbNotificationId: "" },
            });
          }
        } else {
          router.push({
            pathname: "/(tabs)/pantry",
            params: { kbGroupIds: "", kbNotificationId: "" },
          });
        }
      } else if (
        action === ACTION_VIEW_PANTRY ||
        action === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        const groupIds = groupedReminderIdsFromNotification(data);
        if (groupIds) {
          router.push({
            pathname: "/(tabs)/pantry",
            params: {
              kbGroupIds: JSON.stringify(groupIds),
              kbNotificationId: request.identifier,
            },
          });
          if (__DEV__)
            console.log(
              "[KB Notification Navigation] Opened grouped Pantry view",
              { items: groupIds.length },
            );
        } else {
          // Preserve the current Stage 4D individual/legacy behavior (normal Pantry).
          router.push({
            pathname: "/(tabs)/pantry",
            params: { kbGroupIds: "", kbNotificationId: "" },
          });
        }
      }
    } else if (data?.type === "water_reminder") {
      if (action === ACTION_WATER_LATER) {
        await scheduleWaterSnooze(await loadReminderSettings());
      } else if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        router.push("/(tabs)/settings");
      } else if (action === ACTION_WATER_DONE) {
        // Acknowledge this occurrence; the daily series continues.
      }
    }
    succeeded = true;
    processed.add(dedupeKey);
    if (processed.size > 150) processed.clear();
  } finally {
    processing.delete(dedupeKey);
    // Only consume the cold-start response after successful handling. On error,
    // retain it for a future retry rather than silently discarding a user tap.
    if (succeeded) await Notifications.clearLastNotificationResponse();
  }
}

export function installKitchenBuddyNotificationResponses(): () => void {
  let active = true;
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      void handleResponse(response).catch((error) => {
        console.warn("Notification action failed:", error);
      });
    },
  );
  void migrateExistingReminderSchedules().catch((error) => {
    console.warn("Notification migration pending; retry next launch:", error);
  });
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (active && response) return handleResponse(response);
    })
    .catch((error) => {
      console.warn("Cold-start notification handling failed:", error);
    });
  return () => {
    active = false;
    subscription.remove();
  };
}
