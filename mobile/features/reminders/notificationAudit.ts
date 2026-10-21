/**
 * KitchenBuddy Stage 4A: READ-ONLY native notification inventory.
 *
 * This file NEVER schedules, cancels, updates or requests permission for a
 * notification. Call after scheduler operations have finished, not mid-sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REGULAR_KEY = "@kb_expiry_regular_index_v2";
const GROUP_INDEX_PREFIX = "@kb_hybrid_group:";
const EXPIRY_SNOOZE_KEY = "@kb_expiry_snooze_index_v2";
const WATER_KEY = "water_notification_ids_v1";
const LEGACY_EXPIRY_KEY = "expiry_notification_ids_v1";

const KEYS = [
  REGULAR_KEY,
  EXPIRY_SNOOZE_KEY,
  WATER_KEY,
  LEGACY_EXPIRY_KEY,
] as const;

export type AuditKind =
  | "regularExpiry"
  | "groupExpiry"
  | "expirySnooze"
  | "legacyExpiry"
  | "waterRecurring"
  | "waterSnooze"
  | "unknown";

type TrackSource =
  | "regularExpiry"
  | "groupExpiry"
  | "expirySnooze"
  | "water"
  | "legacyExpiry";
type NativeRequest = Awaited<
  ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
>[number];

type TrackingCounts = {
  regularExpiry: number;
  groupExpiry: number;
  expirySnooze: number;
  water: number;
  legacyExpiry: number;
  uniqueIds: number;
  missingFromOS: number;
  untrackedPending: number;
  metadataMismatch: number;
  duplicateTrackedIds: number;
};

export type NotificationAudit = {
  auditedAt: number;
  platform: string;
  pending: Record<AuditKind, number> & { total: number };
  tracking: TrackingCounts;
  capacity: {
    planningBudget: number | null;
    used: number;
    available: number | null;
    overBudget: boolean;
  };
  /** IDs are returned for local debugging but deliberately omitted from logs. */
  diagnostics: {
    missingTrackedIds: string[];
    untrackedKitchenBuddyIds: string[];
    metadataMismatchIds: string[];
    duplicateTrackedIds: string[];
  };
  warnings: string[];
};

function objectValue(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function parseObjectIndex(
  raw: string | null,
  label: string,
): Record<string, unknown> {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Notification audit: malformed JSON in ${label}.`);
  }
  const index = objectValue(parsed);
  if (!index)
    throw new Error(`Notification audit: unexpected shape in ${label}.`);
  return index;
}

function parseIds(raw: string | null, label: string): string[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Notification audit: malformed JSON in ${label}.`);
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new Error(`Notification audit: unexpected ID list in ${label}.`);
  }
  return parsed;
}

function collectIndexIds(
  raw: string | null,
  label: string,
  requireSignature: boolean,
): string[] {
  const index = parseObjectIndex(raw, label);
  return Object.entries(index).map(([entryKey, value]) => {
    const entry = objectValue(value);
    if (
      !entry ||
      typeof entry.notificationId !== "string" ||
      !entry.notificationId
    ) {
      throw new Error(
        `Notification audit: invalid notification record in ${label} (${entryKey}).`,
      );
    }
    if (requireSignature && typeof entry.signature !== "string") {
      throw new Error(
        `Notification audit: missing signature in ${label} (${entryKey}).`,
      );
    }
    if (!requireSignature && typeof entry.pantryItemId !== "string") {
      throw new Error(
        `Notification audit: missing Pantry ID in ${label} (${entryKey}).`,
      );
    }
    return entry.notificationId;
  });
}

function classifyNative(entry: NativeRequest): AuditKind {
  const data = objectValue(entry.content.data);
  if (data?.type === "expiry_reminder") {
    if (data.kbReminderKind === "regular") return "regularExpiry";
    if (data.kbReminderKind === "group") return "groupExpiry";
    if (data.kbReminderKind === "snooze") return "expirySnooze";
    return "legacyExpiry";
  }
  if (data?.type === "water_reminder") {
    return data.snoozed === true ? "waterSnooze" : "waterRecurring";
  }
  return "unknown";
}

function expectedKindMatches(source: TrackSource, actual: AuditKind): boolean {
  switch (source) {
    case "regularExpiry":
      return actual === "regularExpiry";
    case "groupExpiry":
      return actual === "groupExpiry";
    case "expirySnooze":
      return actual === "expirySnooze";
    case "water":
      return actual === "waterRecurring" || actual === "waterSnooze";
    case "legacyExpiry":
      return actual === "legacyExpiry";
  }
}

/**
 * Pure analysis function. Useful for tests: no native or storage calls occur.
 * Pass a complete, stable snapshot; results are not meaningful during a write.
 */
export function analyzeNotificationSnapshot(
  native: NativeRequest[],
  storedValues: Record<(typeof KEYS)[number], string | null>,
  platform: string,
  auditedAt = Date.now(),
): NotificationAudit {
  const regularEntries = Object.entries(
    parseObjectIndex(storedValues[REGULAR_KEY], REGULAR_KEY),
  );
  const allRegularIds = collectIndexIds(
    storedValues[REGULAR_KEY],
    REGULAR_KEY,
    true,
  );
  const regularIds: string[] = [];
  const groupIds: string[] = [];
  regularEntries.forEach(([key], i) => {
    (key.startsWith(GROUP_INDEX_PREFIX) ? groupIds : regularIds).push(
      allRegularIds[i],
    );
  });
  const expirySnoozeIds = collectIndexIds(
    storedValues[EXPIRY_SNOOZE_KEY],
    EXPIRY_SNOOZE_KEY,
    false,
  );
  const waterIds = parseIds(storedValues[WATER_KEY], WATER_KEY);
  const legacyIds = parseIds(
    storedValues[LEGACY_EXPIRY_KEY],
    LEGACY_EXPIRY_KEY,
  );

  const ownership = new Map<string, Set<TrackSource>>();
  const add = (ids: string[], source: TrackSource) => {
    for (const id of ids) {
      const current = ownership.get(id) ?? new Set<TrackSource>();
      // Detect repeated IDs within the same list as well as cross-list overlap.
      const duplicates = seenOccurrences.get(id) ?? 0;
      seenOccurrences.set(id, duplicates + 1);
      current.add(source);
      ownership.set(id, current);
    }
  };
  const seenOccurrences = new Map<string, number>();
  add(regularIds, "regularExpiry");
  add(groupIds, "groupExpiry");
  add(expirySnoozeIds, "expirySnooze");
  add(waterIds, "water");
  add(legacyIds, "legacyExpiry");

  const nativeIds = new Set(native.map((entry) => entry.identifier));
  const pending: NotificationAudit["pending"] = {
    total: native.length,
    regularExpiry: 0,
    groupExpiry: 0,
    expirySnooze: 0,
    legacyExpiry: 0,
    waterRecurring: 0,
    waterSnooze: 0,
    unknown: 0,
  };
  const untrackedKitchenBuddyIds: string[] = [];
  const metadataMismatchIds: string[] = [];
  for (const entry of native) {
    const kind = classifyNative(entry);
    pending[kind] += 1;
    const sources = ownership.get(entry.identifier);
    if (!sources?.size) {
      if (kind !== "unknown") untrackedKitchenBuddyIds.push(entry.identifier);
    } else if (
      ![...sources].every((source) => expectedKindMatches(source, kind))
    ) {
      metadataMismatchIds.push(entry.identifier);
    }
  }
  const missingTrackedIds = [...ownership.keys()].filter(
    (id) => !nativeIds.has(id),
  );
  const duplicateTrackedIds = [...seenOccurrences.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  // iOS uses a conservative planning policy, not a guaranteed platform limit.
  // Android is reported without inventing a universal OS-specific capacity.
  const planningBudget = platform === "ios" ? 56 : null;
  const available =
    planningBudget === null
      ? null
      : Math.max(0, planningBudget - native.length);
  const warnings: string[] = [];
  if (missingTrackedIds.length)
    warnings.push(
      `${missingTrackedIds.length} tracked request(s) missing from native pending list.`,
    );
  if (untrackedKitchenBuddyIds.length)
    warnings.push(
      `${untrackedKitchenBuddyIds.length} KitchenBuddy request(s) pending but absent from tracking indexes.`,
    );
  if (metadataMismatchIds.length)
    warnings.push(
      `${metadataMismatchIds.length} pending request(s) disagree with their tracking-index type.`,
    );
  if (duplicateTrackedIds.length)
    warnings.push(
      `${duplicateTrackedIds.length} request ID(s) recorded more than once across tracking indexes.`,
    );
  if (pending.unknown)
    warnings.push(
      `${pending.unknown} pending request(s) are unrecognized; they still count toward capacity and will not be modified.`,
    );
  if (planningBudget !== null && native.length > planningBudget) {
    warnings.push(
      `Pending requests exceed KitchenBuddy's ${planningBudget}-slot iOS planning budget; the audit does not delete any.`,
    );
  }
  return {
    auditedAt,
    platform,
    pending,
    tracking: {
      regularExpiry: regularIds.length,
      groupExpiry: groupIds.length,
      expirySnooze: expirySnoozeIds.length,
      water: waterIds.length,
      legacyExpiry: legacyIds.length,
      uniqueIds: ownership.size,
      missingFromOS: missingTrackedIds.length,
      untrackedPending: untrackedKitchenBuddyIds.length,
      metadataMismatch: metadataMismatchIds.length,
      duplicateTrackedIds: duplicateTrackedIds.length,
    },
    capacity: {
      planningBudget,
      used: native.length,
      available,
      overBudget: planningBudget !== null && native.length > planningBudget,
    },
    diagnostics: {
      missingTrackedIds,
      untrackedKitchenBuddyIds,
      metadataMismatchIds,
      duplicateTrackedIds,
    },
    warnings,
  };
}

/** Read-only native + local-storage snapshot. Never silently treats a read error as an empty index. */
export async function auditScheduledNotifications(): Promise<NotificationAudit> {
  const [native, pairs] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    AsyncStorage.multiGet([...KEYS]),
  ]);
  const storedValues = Object.fromEntries(pairs) as Record<
    (typeof KEYS)[number],
    string | null
  >;
  return analyzeNotificationSnapshot(native, storedValues, Platform.OS);
}

/** Explicit development-only diagnostics. No names, bodies or raw identifiers are logged. */
export async function logNotificationAudit(): Promise<NotificationAudit> {
  if (!__DEV__)
    throw new Error("Notification audit logging is development-only.");
  const result = await auditScheduledNotifications();
  console.log(
    "[KB Notification Audit]",
    JSON.stringify(
      {
        auditedAt: new Date(result.auditedAt).toISOString(),
        platform: result.platform,
        pending: result.pending,
        tracking: result.tracking,
        capacity: result.capacity,
        warnings: result.warnings,
        readOnly: true,
      },
      null,
      2,
    ),
  );
  return result;
}
