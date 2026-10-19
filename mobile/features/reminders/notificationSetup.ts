/**
 * Initialize once at app root.
 * Native notification buttons require the app JS to process actions.
 */

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

// Preserve compatibility with any existing imports from notificationSetup.
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
  if (__DEV__) {
    console.log("[KB Reminder Sync]", ...args);
  }
};

/**
 * One-time reschedule migrates previously scheduled notifications
 * onto the newer action categories and Android channels.
 */
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

    // Do not surprise first-time users with a permission prompt
    // just because the migration is running.
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

    // The schedulers cancel their tracked old IDs before rebuilding.
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

/**
 * Handles taps on KitchenBuddy notification action buttons.
 */
const processed = new Set<string>();

async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const request = response.notification.request;
  const action = response.actionIdentifier;

  const dedupeKey = `${request.identifier}:${action}`;

  if (processed.has(dedupeKey)) return;

  processed.add(dedupeKey);

  if (processed.size > 150) processed.clear();

  const data = request.content.data;

  try {
    if (data?.type === "expiry_reminder") {
      const id = data.pantryItemId;
      const categoryKey = data.categoryKey;

      if (action === ACTION_EXPIRY_LATER) {
        if (typeof id === "string" && typeof categoryKey === "string") {
          const pantry = await loadPantry();

          const item = Object.values(pantry)
            .flat()
            .find((row) => row.id === id && row.categoryKey === categoryKey);

          if (item) {
            await scheduleExpirySnooze(item, await loadReminderSettings());
          }
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
              params: {
                itemIds: JSON.stringify([id]),
              },
            });
          } else {
            router.push("/(tabs)/pantry");
          }
        } else {
          router.push("/(tabs)/pantry");
        }
      } else if (
        action === ACTION_VIEW_PANTRY ||
        action === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        router.push("/(tabs)/pantry");
      }
    } else if (data?.type === "water_reminder") {
      if (action === ACTION_WATER_LATER) {
        await scheduleWaterSnooze(await loadReminderSettings());
      } else if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        router.push("/(tabs)/settings");
      } else if (action === ACTION_WATER_DONE) {
        // Acknowledge this occurrence.
        // Recurring daily water reminders continue unchanged.
        return;
      }
    }
  } finally {
    // Prevent replaying the same cold-start notification action.
    await Notifications.clearLastNotificationResponse();
  }
}

/**
 * Call once inside a useEffect in mobile/app/_layout.tsx.
 * Returns the listener cleanup function.
 */
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
      if (active && response) {
        return handleResponse(response);
      }
    })
    .catch((error) => {
      console.warn("Cold-start notification handling failed:", error);
    });

  return () => {
    active = false;
    subscription.remove();
  };
}
