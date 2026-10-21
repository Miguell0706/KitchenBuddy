import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { loadPantry } from "@/features/pantry/storage";
import type { CategoryKey, PantryItem } from "@/features/pantry/types";
import type { ReminderSettings } from "./reminderStorage";
import {
  buildHybridExpiryPlan,
  type HybridPlannedReminder,
} from "./hybridExpiryPlanner";
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

/** Groups share the legacy index, with keys that cannot be confused with item IDs. */
const GROUP_INDEX_PREFIX = "@kb_hybrid_group:";
type NativeRequest = Awaited<
  ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
>[number];
type DesiredEntry = {
  indexKey: string;
  signature: string;
  reminder: HybridPlannedReminder;
  sourceExpiryDate?: string | null;
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

/** Preserve original v2 signatures and native requests for unchanged individuals. */
function previousIndividualSignature(
  item: PantryItem,
  reminder: HybridPlannedReminder,
  settings: ReminderSettings,
): string {
  return JSON.stringify({
    when: reminder.when,
    message: expiryReminderCopy(item, reminder.leadDays),
    expiryDate: item.expiryDate,
    categoryKey: item.categoryKey,
    sound: settings.expirySound,
    days: reminder.leadDays,
  });
}

function readObject<T>(raw: string | null, label: string): Record<string, T> {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Invalid JSON in ${label}; refusing to discard notification tracking.`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Invalid ${label}; refusing to discard notification tracking.`,
    );
  }
  return parsed as Record<string, T>;
}

async function readRegularIndex(): Promise<RegularIndex> {
  const index = readObject<RegularRecord>(
    await AsyncStorage.getItem(REGULAR_INDEX_KEY),
    "regular/group reminder index",
  );
  const ids = new Set<string>();
  for (const record of Object.values(index)) {
    if (
      !record ||
      typeof record.notificationId !== "string" ||
      !record.notificationId ||
      typeof record.signature !== "string" ||
      ids.has(record.notificationId)
    ) {
      throw new Error(
        "Invalid or duplicate regular/group tracking entry; refusing to modify reminders.",
      );
    }
    ids.add(record.notificationId);
  }
  return index;
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
// Preserve the existing per-ID, recoverable cancellation migration.
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

function desiredHybridEntries(
  pantry: PantryData,
  settings: ReminderSettings,
  now: Date,
) {
  const plan = buildHybridExpiryPlan(pantry, settings, now);
  const items = new Map(
    (Object.values(pantry).flat() as PantryItem[]).map((item) => [
      item.id,
      item,
    ]),
  );
  const desired = new Map<string, DesiredEntry>();
  const itemIds = new Set(items.keys());
  if ([...itemIds].some((id) => id.startsWith(GROUP_INDEX_PREFIX))) {
    throw new Error("Pantry item uses reserved hybrid tracking prefix.");
  }
  for (const reminder of plan.reminders) {
    const indexKey =
      reminder.kind === "individual"
        ? reminder.itemIds[0]
        : `${GROUP_INDEX_PREFIX}${reminder.key}`;
    // Protect against any unexpected key overlap (and reject Pantry IDs using the reserved prefix).
    if (
      desired.has(indexKey) ||
      (reminder.kind === "group" && itemIds.has(indexKey))
    ) {
      throw new Error(
        "Hybrid reminder tracking key collision; refusing to modify notifications.",
      );
    }
    const item =
      reminder.kind === "individual"
        ? items.get(reminder.itemIds[0])
        : undefined;
    if (reminder.kind === "individual" && !item) {
      throw new Error("Hybrid planner refers to a missing Pantry item.");
    }
    const signature = item
      ? previousIndividualSignature(item, reminder, settings)
      : reminder.signature;
    desired.set(indexKey, {
      indexKey,
      signature,
      reminder,
      sourceExpiryDate: item?.expiryDate,
    });
  }
  return { desired, plan, itemIds };
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

/** Check the native request as well as storage; do not trust an index entry alone. */
function nativeMatches(
  entry: NativeRequest | undefined,
  desired: DesiredEntry,
): boolean {
  if (!entry || entry.content.data?.type !== "expiry_reminder") return false;
  const data = entry.content.data;
  if (desired.reminder.kind === "individual") {
    return (
      data.kbReminderKind === "regular" &&
      data.pantryItemId === desired.reminder.itemIds[0]
    );
  }
  return (
    data.kbReminderKind === "group" &&
    data.kbReminderKey === desired.reminder.key &&
    data.kbPlanSignature === desired.signature &&
    Array.isArray(data.itemIds) &&
    JSON.stringify(data.itemIds) === JSON.stringify(desired.reminder.itemIds)
  );
}

/** Schedule FIRST, then persist the replacement ID, then cancel its predecessor.
 *  A crash may leave an orphan, but full reconciliation cleans it up. */
async function applyHybridEntry(
  index: RegularIndex,
  desired: DesiredEntry,
  settings: ReminderSettings,
  pending: Map<string, NativeRequest>,
): Promise<"unchanged" | "scheduled"> {
  const old = index[desired.indexKey];
  if (
    old?.signature === desired.signature &&
    nativeMatches(pending.get(old.notificationId), desired)
  ) {
    return "unchanged";
  }
  const reminder = desired.reminder;
  const member = reminder.items[0];
  const data =
    reminder.kind === "group"
      ? {
          type: "expiry_reminder",
          kbReminderKind: "group",
          kbReminderKey: reminder.key,
          kbPlanSignature: desired.signature,
          itemIds: [...reminder.itemIds],
          expiryDate: reminder.expiryDate,
          kbSound: settings.expirySound,
        }
      : {
          type: "expiry_reminder",
          kbReminderKind: "regular",
          pantryItemId: member.id,
          categoryKey: member.categoryKey,
          // Use the source Pantry expiry string when available for v2 compatibility.
          expiryDate: desired.sourceExpiryDate,
          kbSound: settings.expirySound,
        };
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.body,
      // Group alerts have no single item to snooze; no individual-action category.
      ...(reminder.kind === "individual"
        ? { categoryIdentifier: EXPIRY_CATEGORY }
        : {}),
      sound: settings.expirySound ? "default" : false,
      color: "#586D77",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminder.when),
      channelId: expiryChannelId(settings.expirySound),
    },
  });
  index[desired.indexKey] = {
    notificationId: id,
    signature: desired.signature,
  };
  // Keep the local index in sync with the last successfully persisted write.
  try {
    await writeRegularIndex(index);
  } catch (error) {
    if (old) index[desired.indexKey] = old;
    else delete index[desired.indexKey];
    throw error;
  }
  if (old)
    await Notifications.cancelScheduledNotificationAsync(old.notificationId);
  reminderLog("Scheduled hybrid reminder:", {
    kind: reminder.kind,
    items: reminder.itemIds.length,
    reminderDate: new Date(reminder.when).toLocaleString(),
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
        data?.kbReminderKind !== "snooze" &&
        data?.kbReminderKind !== "group") ||
      tracked.has(entry.identifier)
    )
      continue;
    await Notifications.cancelScheduledNotificationAsync(entry.identifier);
  }
}

/** Shared group-aware reconciliation. The existing serial queue protects this and snoozes. */
async function reconcileHybridSnapshot(
  pantry: PantryData,
  settings: ReminderSettings,
  mode: "full" | "incremental",
): Promise<void> {
  if (!settings.expiryReminders) {
    await cancelAllRegular();
    await cancelAllSnoozes();
    await cancelUntrackedV2Notifications();
    reminderLog(
      "Expiry reminders disabled. Existing expiry reminders cleared.",
    );
    return;
  }
  const { desired, plan, itemIds } = desiredHybridEntries(
    pantry,
    settings,
    new Date(),
  );
  const index = await readRegularIndex();
  const pendingList = await Notifications.getAllScheduledNotificationsAsync();
  const pending = new Map(
    pendingList.map((entry) => [entry.identifier, entry]),
  );
  const needsSchedule = [...desired.values()].some((entry) => {
    const existing = index[entry.indexKey];
    return (
      !existing ||
      existing.signature !== entry.signature ||
      !nativeMatches(pending.get(existing.notificationId), entry)
    );
  });
  if (needsSchedule) await ensurePermission();

  // Clean up orphaned post-schedule/pre-index writes. Never touch water, snoozes,
  // legacy v1, or unknown request kinds. This also recovers interrupted migrations.
  const trackedIds = new Set(
    Object.values(index).map((entry) => entry.notificationId),
  );
  const snoozes = await readSnoozeIndex();
  for (const record of Object.values(snoozes))
    trackedIds.add(record.notificationId);
  let repaired = 0;
  for (const entry of pendingList) {
    const data = entry.content.data;
    if (
      data?.type !== "expiry_reminder" ||
      (data?.kbReminderKind !== "regular" &&
        data?.kbReminderKind !== "group") ||
      trackedIds.has(entry.identifier)
    )
      continue;
    await Notifications.cancelScheduledNotificationAsync(entry.identifier);
    pending.delete(entry.identifier);
    repaired++;
  }

  let created = 0;
  let unchanged = 0;
  // Create desired coverage BEFORE removing superseded individual/group requests.
  // Signatures on unchanged individual reminders match Stage 1, so these remain intact.
  for (const entry of desired.values()) {
    const status = await applyHybridEntry(index, entry, settings, pending);
    if (status === "scheduled") created++;
    else unchanged++;
  }
  let cancelled = 0;
  for (const key of Object.keys(index)) {
    if (desired.has(key)) continue;
    await cancelRegularItem(index, key);
    cancelled++;
  }
  await cancelSnoozesForMissingItems(itemIds);
  reminderLog(
    mode === "full"
      ? "Full hybrid reconciliation complete."
      : "Incremental hybrid synchronization complete.",
    {
      created,
      cancelled,
      unchanged,
      orphanedCleaned: repaired,
      individual: plan.counts.individualNotifications,
      groups: plan.counts.groupNotifications,
      tracked: Object.keys(index).length,
    },
  );
}

/** Retains the public Stage 1–3 API; now invokes the hybrid scheduler. */
export function reconcileExpiryRemindersForPantry(
  pantry: PantryData,
  settings: ReminderSettings,
): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(pantry)) as PantryData;
  const options = { ...settings };
  return serialize(async () => {
    await migrateLegacyIds();
    await reconcileHybridSnapshot(snapshot, options, "incremental");
  });
}

/** Full startup/recovery pass using the same planner as the incremental path. */
export function scheduleExpiryReminders(
  settings: ReminderSettings,
): Promise<void> {
  const options = { ...settings };
  return serialize(async () => {
    reminderLog("Reconciling all hybrid expiry reminders...", {
      enabled: options.expiryReminders,
      lead: options.expiryLead,
      time: options.expiryTimeMinutes,
      sound: options.expirySound,
    });
    await migrateLegacyIds();
    const pantry = await loadPantry();
    await reconcileHybridSnapshot(pantry, options, "full");
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

/** Stage 4D: barrier behind every expiry/snooze operation already queued. */
export function waitForExpiryReminderIdle(): Promise<void> {
  return serialize(async () => undefined);
}
