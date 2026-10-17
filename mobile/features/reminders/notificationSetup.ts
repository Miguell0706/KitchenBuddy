/** Initialize once at app root. Native notification buttons require the app JS to process actions. */
import { Platform } from "react-native";
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
import {
  ACTION_EXPIRY_LATER,
  ACTION_FIND_RECIPE,
  ACTION_VIEW_PANTRY,
  ACTION_WATER_DONE,
  ACTION_WATER_LATER,
  EXPIRY_CATEGORY,
  WATER_CATEGORY,
  expiryChannelId,
  waterChannelId,
} from "./notificationContent";

let setupPromise: Promise<void> | null = null;
let initialMigration: Promise<void> | null = null;
const NOTIFICATION_UPGRADE_KEY = "@kb_notification_actions_channels_v1";

/** One-time reschedule migrates previously scheduled notifications onto new action categories/channels. */
export function migrateExistingReminderSchedules(): Promise<void> {
  if (initialMigration) return initialMigration;
  initialMigration = (async () => {
    if (await AsyncStorage.getItem(NOTIFICATION_UPGRADE_KEY)) return;
    await ensureKitchenBuddyNotifications();
    // Never surprise a first-time user with a system permission prompt just for migration.
    // Existing settings toggles/schedulers will request permission when the user opts in.
    const permission = await Notifications.getPermissionsAsync();
    if (
      !permission.granted &&
      permission.ios?.status !==
        Notifications.IosAuthorizationStatus.PROVISIONAL
    )
      return;
    const settings = await loadReminderSettings();
    // Serialized schedulers cancel their tracked old IDs before replacing schedules.
    await scheduleExpiryReminders(settings);
    await scheduleWaterReminders(settings);
    await AsyncStorage.setItem(NOTIFICATION_UPGRADE_KEY, "yes");
  })().catch((error) => {
    initialMigration = null;
    throw error;
  });
  return initialMigration;
}

// This handler is GLOBAL: remove the duplicate setNotificationHandler from waterReminders.ts.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: notification.request.content.data?.kbSound !== false,
    shouldSetBadge: false,
  }),
});

export function ensureKitchenBuddyNotifications(): Promise<void> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    if (Platform.OS === "android") {
      await Promise.all([
        Notifications.setNotificationChannelAsync(expiryChannelId(true), {
          name: "KitchenBuddy · Food expiry",
          description: "Food expiry reminders with sound",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
          showBadge: false,
        }),
        Notifications.setNotificationChannelAsync(expiryChannelId(false), {
          name: "KitchenBuddy · Food expiry (silent)",
          description: "Food expiry reminders without sound",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
          showBadge: false,
        }),
        Notifications.setNotificationChannelAsync(waterChannelId(true), {
          name: "KitchenBuddy · Water reminders",
          description: "Hydration reminders with sound",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
          showBadge: false,
        }),
        Notifications.setNotificationChannelAsync(waterChannelId(false), {
          name: "KitchenBuddy · Water reminders (silent)",
          description: "Hydration reminders without sound",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
          showBadge: false,
        }),
      ]);
    }
    await Notifications.setNotificationCategoryAsync(EXPIRY_CATEGORY, [
      {
        identifier: ACTION_VIEW_PANTRY,
        buttonTitle: "View Pantry",
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_FIND_RECIPE,
        buttonTitle: "Find Recipes",
        options: { opensAppToForeground: true },
      },
      {
        identifier: ACTION_EXPIRY_LATER,
        buttonTitle: "Remind Tomorrow",
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
      {
        identifier: ACTION_WATER_DONE,
        buttonTitle: "Done",
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_WATER_LATER,
        buttonTitle: "In 30 Minutes",
        options: { opensAppToForeground: true },
      },
    ]);
  })().catch((error) => {
    setupPromise = null;
    throw error;
  });
  return setupPromise;
}

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
          } else router.push("/(tabs)/pantry");
        } else router.push("/(tabs)/pantry");
      } else if (
        action === ACTION_VIEW_PANTRY ||
        action === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        router.push("/(tabs)/pantry");
      }
    } else if (data?.type === "water_reminder") {
      if (action === ACTION_WATER_LATER)
        await scheduleWaterSnooze(await loadReminderSettings());
      else if (action === Notifications.DEFAULT_ACTION_IDENTIFIER)
        router.push("/(tabs)/settings");
      // Done acknowledges this occurrence. Regular daily reminders continue unchanged.
      else if (action === ACTION_WATER_DONE) return;
    }
  } finally {
    // Don't replay a cold-start action on the next app mount.
    Notifications.clearLastNotificationResponse();
  }
}

/** Call once inside a useEffect in mobile/app/_layout.tsx; returns its cleanup. */
export function installKitchenBuddyNotificationResponses(): () => void {
  let active = true;
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      void handleResponse(response).catch((error) =>
        console.warn("Notification action failed:", error),
      );
    },
  );
  void migrateExistingReminderSchedules().catch((error) =>
    console.warn("Notification migration pending; retry next launch:", error),
  );
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (active && response) return handleResponse(response);
    })
    .catch((error) =>
      console.warn("Cold-start notification handling failed:", error),
    );
  return () => {
    active = false;
    subscription.remove();
  };
}
