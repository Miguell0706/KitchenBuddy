import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { loadPantry } from "@/features/pantry/storage";
import type { CategoryKey, PantryItem } from "@/features/pantry/types";
import type { ReminderSettings } from "./reminderStorage";
import { ensureKitchenBuddyNotifications } from "./notificationRegistration";
import {
  expiryChannelId,
  EXPIRY_CATEGORY,
  expiryReminderCopy,
} from "./notificationContent";

type PantryData = Record<CategoryKey, PantryItem[]>;
type RegularRecord = { notificationId: string; signature: string };
type RegularIndex = Record<string, RegularRecord>;
type SnoozeRecord = { notificationId: string; pantryItemId: string };
type SnoozeIndex = Record<string, SnoozeRecord>;

type ReminderPlan = {
  item: PantryItem;
  when: Date;
  days: number;
  message: ReturnType<typeof expiryReminderCopy>;
  signature: string;
};

const LEGACY_IDS_KEY = "expiry_notification_ids_v1";
const REGULAR_INDEX_KEY = "@kb_expiry_regular_index_v2";
const SNOOZE_INDEX_KEY = "@kb_expiry_snooze_index_v2";

const reminderLog = (...args: unknown[]) => {
  if (__DEV__) console.log("[KitchenBuddy Expiry]", ...args);
};

// Every scheduling operation, including a snooze or global settings change,
// shares one queue. No two operations can overwrite each other's ID index.
let queue: Promise<void> = Promise.resolve();
function serialize(task: () => Promise<void>): Promise<void> {
  const next = queue.catch(() => undefined).then(task);
  queue = next;
  return next;
}

export function parseLocalExpiryDate(dateString: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(dateString);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

function readObject<T>(raw: string | null, label: string): Record<string, T> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid ${label}; refusing to discard notification tracking.`,
    );
  }
  return parsed as Record<string, T>;
}

async function readRegularIndex(): Promise<RegularIndex> {
  return readObject<RegularRecord>(
    await AsyncStorage.getItem(REGULAR_INDEX_KEY),
    "regular reminder index",
  );
}
async function writeRegularIndex(index: RegularIndex): Promise<void> {
  await AsyncStorage.setItem(REGULAR_INDEX_KEY, JSON.stringify(index));
}
async function readSnoozeIndex(): Promise<SnoozeIndex> {
  return readObject<SnoozeRecord>(
    await AsyncStorage.getItem(SNOOZE_INDEX_KEY),
    "snooze reminder index",
  );
}
async function writeSnoozeIndex(index: SnoozeIndex): Promise<void> {
  await AsyncStorage.setItem(SNOOZE_INDEX_KEY, JSON.stringify(index));
}

// Old v1 tracked both regular reminders AND snoozes in one array.
// This one-time migration cancels those old IDs before creating the new map.
async function migrateLegacyIds(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_IDS_KEY);
  if (!raw) return;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    throw new Error("Invalid legacy expiry ID list; migration stopped safely.");
  }
  const remaining = [...parsed] as string[];
  while (remaining.length) {
    await Notifications.cancelScheduledNotificationAsync(remaining[0]);
    remaining.shift();
    await AsyncStorage.setItem(LEGACY_IDS_KEY, JSON.stringify(remaining));
  }
  await AsyncStorage.removeItem(LEGACY_IDS_KEY);
  reminderLog("Migrated legacy expiry notification IDs.");
}

function buildPlan(
  item: PantryItem,
  settings: ReminderSettings,
  now: Date,
): ReminderPlan | null {
  if (!item.expiryDate) return null;
  const expiry = parseLocalExpiryDate(item.expiryDate);
  if (!expiry) {
    console.warn("Invalid expiry date:", item.id, item.expiryDate);
    return null;
  }
  const days = leadDays(settings.expiryLead);
  const when = new Date(expiry);
  when.setDate(when.getDate() - days);
  when.setHours(
    Math.floor(settings.expiryTimeMinutes / 60),
    settings.expiryTimeMinutes % 60,
    0,
    0,
  );
  if (when <= now) return null; // Same past-due behavior as v1.

  const message = expiryReminderCopy(item, days);
  // Fingerprint the *actual notification content*, not the whole Pantry item.
  // An irrelevant change (such as quantity, if not used in the copy) is a no-op.
  const signature = JSON.stringify({
    when: when.getTime(),
    message,
    expiryDate: item.expiryDate,
    categoryKey: item.categoryKey,
    sound: settings.expirySound,
    days,
  });
  return { item, when, days, message, signature };
}

async function ensurePermission(): Promise<void> {
  await ensureKitchenBuddyNotifications();
  const permission = await Notifications.getPermissionsAsync();
  if (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return;
  }
  const requested = await Notifications.requestPermissionsAsync();
  if (
    !requested.granted &&
    requested.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    throw new Error("Notification permission was not granted.");
  }
}

async function cancelRegularItem(
  index: RegularIndex,
  itemId: string,
): Promise<void> {
  const existing = index[itemId];
  if (!existing) return;
  await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
  delete index[itemId];
  await writeRegularIndex(index);
}

async function applyRegularPlan(
  index: RegularIndex,
  itemId: string,
  plan: ReminderPlan | null,
  settings: ReminderSettings,
  scheduledIds?: Set<string>,
): Promise<"unchanged" | "scheduled" | "cancelled"> {
  const current = index[itemId];
  if (
    current &&
    plan &&
    current.signature === plan.signature &&
    (!scheduledIds || scheduledIds.has(current.notificationId))
  ) {
    return "unchanged";
  }
  // Cancel first. If the new schedule fails, startup reconciliation can
  // restore the missing item instead of leaving two active notifications.
  if (current) await cancelRegularItem(index, itemId);
  if (!plan) return current ? "cancelled" : "unchanged";

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      ...plan.message,
      categoryIdentifier: EXPIRY_CATEGORY,
      sound: settings.expirySound ? "default" : false,
      color: "#586D77",
      data: {
        type: "expiry_reminder",
        kbReminderKind: "regular",
        pantryItemId: plan.item.id,
        categoryKey: plan.item.categoryKey,
        expiryDate: plan.item.expiryDate,
        kbSound: settings.expirySound,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plan.when,
      channelId: expiryChannelId(settings.expirySound),
    },
  });
  index[itemId] = { notificationId: id, signature: plan.signature };
  // Persist after EACH addition, so a partially completed batch is recoverable.
  await writeRegularIndex(index);
  reminderLog("Scheduled:", {
    item: plan.item.name,
    notificationId: id,
    expiryDate: plan.item.expiryDate,
    reminderDate: plan.when.toLocaleString(),
  });
  return "scheduled";
}

async function cancelSnoozesForMissingItems(
  validItemIds: Set<string>,
): Promise<void> {
  const snoozes = await readSnoozeIndex();
  for (const [id, record] of Object.entries(snoozes)) {
    if (validItemIds.has(record.pantryItemId)) continue;
    await Notifications.cancelScheduledNotificationAsync(record.notificationId);
    delete snoozes[id];
    await writeSnoozeIndex(snoozes);
  }
}
async function cancelAllSnoozes(): Promise<void> {
  const snoozes = await readSnoozeIndex();
  for (const [id, record] of Object.entries(snoozes)) {
    await Notifications.cancelScheduledNotificationAsync(record.notificationId);
    delete snoozes[id];
    await writeSnoozeIndex(snoozes);
  }
}
async function cancelAllRegular(): Promise<void> {
  const index = await readRegularIndex();
  for (const itemId of Object.keys(index))
    await cancelRegularItem(index, itemId);
}

// Only v2 reminders carry kbReminderKind, so unrelated water notifications
// and old v1 notifications are not touched by this repair step.
async function cancelUntrackedV2Notifications(): Promise<void> {
  const regular = await readRegularIndex();
  const snoozes = await readSnoozeIndex();
  const tracked = new Set([
    ...Object.values(regular).map((entry) => entry.notificationId),
    ...Object.values(snoozes).map((entry) => entry.notificationId),
  ]);
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const entry of pending) {
    const data = entry.content.data;
    if (
      data?.type !== "expiry_reminder" ||
      (data?.kbReminderKind !== "regular" &&
        data?.kbReminderKind !== "snooze") ||
      tracked.has(entry.identifier)
    )
      continue;
    await Notifications.cancelScheduledNotificationAsync(entry.identifier);
  }
}

// Use this when a Pantry snapshot changes. It examines O(n) items in memory,
// but performs native scheduling/cancellation only for changed reminders.
export function reconcileExpiryRemindersForPantry(
  pantry: PantryData,
  settings: ReminderSettings,
): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(pantry)) as PantryData;
  const options = { ...settings };
  return serialize(async () => {
    await migrateLegacyIds();
    if (!options.expiryReminders) {
      await cancelAllRegular();
      await cancelAllSnoozes();
      await cancelUntrackedV2Notifications();
      reminderLog("Expiry reminders disabled. Existing reminders cleared.");
      return;
    }

    const index = await readRegularIndex();
    const items = Object.values(snapshot).flat() as PantryItem[];
    const itemIds = new Set(items.map((item) => item.id));
    const now = new Date();
    const plans = new Map<string, ReminderPlan>();
    const seenItemIds = new Set<string>();
    for (const item of items) {
      if (!item.id || seenItemIds.has(item.id)) {
        throw new Error(`Missing/duplicate Pantry item ID: ${item.id}`);
      }
      seenItemIds.add(item.id);
      const plan = buildPlan(item, options, now);
      if (plan) plans.set(item.id, plan);
    }
    // Only prompt for permission when new notifications need scheduling.
    const needsSchedule = Array.from(plans.entries()).some(
      ([id, plan]) => index[id]?.signature !== plan.signature,
    );
    if (needsSchedule) await ensurePermission();

    let scheduled = 0;
    let cancelled = 0;
    for (const itemId of Object.keys(index)) {
      if (plans.has(itemId)) continue;
      await cancelRegularItem(index, itemId);
      cancelled++;
    }
    for (const [itemId, plan] of plans) {
      const result = await applyRegularPlan(index, itemId, plan, options);
      if (result === "scheduled") scheduled++;
      else if (result === "cancelled") cancelled++;
    }
    await cancelSnoozesForMissingItems(itemIds);
    reminderLog("Incremental synchronization complete.", {
      scheduled,
      cancelled,
      unchanged: plans.size - scheduled,
      tracked: Object.keys(index).length,
    });
  });
}

// Full reconciliation: startup, app recovery, and changes to global settings.
// Verifies tracked IDs against the OS and removes orphaned v2 regular reminders.
export function scheduleExpiryReminders(
  settings: ReminderSettings,
): Promise<void> {
  const options = { ...settings };
  return serialize(async () => {
    reminderLog("Reconciling all expiry reminders...", {
      enabled: options.expiryReminders,
      lead: options.expiryLead,
      time: options.expiryTimeMinutes,
      sound: options.expirySound,
    });
    await migrateLegacyIds();
    if (!options.expiryReminders) {
      await cancelAllRegular();
      await cancelAllSnoozes();
      await cancelUntrackedV2Notifications();
      reminderLog("Expiry reminders disabled. Existing reminders cleared.");
      return;
    }
    const pantry = await loadPantry();
    const index = await readRegularIndex();
    const items = Object.values(pantry).flat() as PantryItem[];
    const uniqueIds = new Set<string>();
    const plans = new Map<string, ReminderPlan>();
    const now = new Date();
    for (const item of items) {
      if (!item.id || uniqueIds.has(item.id)) {
        throw new Error(`Missing/duplicate Pantry item ID: ${item.id}`);
      }
      uniqueIds.add(item.id);
      const plan = buildPlan(item, options, now);
      if (plan) plans.set(item.id, plan);
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(scheduled.map((entry) => entry.identifier));
    const needsSchedule = Array.from(plans.entries()).some(
      ([id, plan]) =>
        index[id]?.signature !== plan.signature ||
        !scheduledIds.has(index[id]?.notificationId ?? ""),
    );
    if (needsSchedule) await ensurePermission();
    // Clean up an interrupted post-schedule/pre-index write from a prior run.
    const trackedIds = new Set(
      Object.values(index).map((entry) => entry.notificationId),
    );
    for (const entry of scheduled) {
      if (
        entry.content.data?.kbReminderKind === "regular" &&
        entry.content.data?.type === "expiry_reminder" &&
        !trackedIds.has(entry.identifier)
      ) {
        await Notifications.cancelScheduledNotificationAsync(entry.identifier);
      }
    }
    for (const itemId of Object.keys(index)) {
      if (!plans.has(itemId)) await cancelRegularItem(index, itemId);
    }
    let created = 0;
    for (const [itemId, plan] of plans) {
      const result = await applyRegularPlan(
        index,
        itemId,
        plan,
        options,
        scheduledIds,
      );
      if (result === "scheduled") created++;
    }
    await cancelSnoozesForMissingItems(uniqueIds);
    reminderLog("Full reconciliation complete.", {
      created,
      tracked: Object.keys(index).length,
    });
  });
}

export function cancelExpiryReminders(): Promise<void> {
  return serialize(async () => {
    await migrateLegacyIds();
    await cancelAllRegular();
    await cancelAllSnoozes();
    await cancelUntrackedV2Notifications();
    reminderLog("All expiry reminders and snoozes cancelled.");
  });
}

/** One follow-up; independent of regular reminders and Pantry History. */
export function scheduleExpirySnooze(
  item: PantryItem,
  settings: ReminderSettings,
): Promise<void> {
  const options = { ...settings };
  const itemSnapshot = { ...item };
  return serialize(async () => {
    if (!options.expiryReminders) {
      reminderLog("Snooze skipped: expiry reminders disabled.");
      return;
    }
    await migrateLegacyIds();
    await ensurePermission();
    const when = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `A follow-up for ${itemSnapshot.name}`,
        body: `Your reminder is back. Check ${itemSnapshot.name} in your Pantry when you have a moment.`,
        categoryIdentifier: EXPIRY_CATEGORY,
        sound: options.expirySound ? "default" : false,
        color: "#586D77",
        data: {
          type: "expiry_reminder",
          kbReminderKind: "snooze",
          pantryItemId: itemSnapshot.id,
          categoryKey: itemSnapshot.categoryKey,
          expiryDate: itemSnapshot.expiryDate,
          kbSound: options.expirySound,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: expiryChannelId(options.expirySound),
      },
    });
    const snoozes = await readSnoozeIndex();
    snoozes[id] = { notificationId: id, pantryItemId: itemSnapshot.id };
    await writeSnoozeIndex(snoozes);
    reminderLog("Snooze scheduled:", {
      item: itemSnapshot.name,
      notificationId: id,
      reminderDate: when.toLocaleString(),
    });
  });
}
