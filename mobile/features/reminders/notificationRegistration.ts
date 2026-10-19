import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

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
