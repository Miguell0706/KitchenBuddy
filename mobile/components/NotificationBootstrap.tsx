import { useEffect } from "react";
import { installKitchenBuddyNotificationResponses } from "@/features/reminders/notificationSetup";

/** Mount this once under your app's root layout, not in Settings or an individual tab. */
export default function NotificationBootstrap() {
  useEffect(() => installKitchenBuddyNotificationResponses(), []);
  return null;
}
