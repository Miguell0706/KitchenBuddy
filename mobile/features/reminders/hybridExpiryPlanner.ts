/**
 * KitchenBuddy Stage 4B — PURE hybrid expiry reminder planner.
 *
 * Does not import Expo Notifications, AsyncStorage, a Zustand store, or call
 * any native API. It does NOT schedule/cancel/repair existing notifications.
 * Feed it an already-hydrated Pantry snapshot and current reminder settings.
 *
 * Policy: 1–3 eligible ingredients at an identical reminder instant get
 * individual reminders; 4+ get ONE grouped reminder. No OS capacity policy
 * is applied here. Capacity selection and reconciliation are later stages.
 *
 * IMPORTANT: The existing Stage 1–3 scheduler remains active until explicitly
 * integrated with a group-aware native scheduler. Do NOT call both schedulers.
 */
import type { CategoryKey, PantryItem } from "@/features/pantry/types";
import type { ReminderSettings } from "./reminderStorage";
import { expiryReminderCopy } from "./notificationContent";

export type HybridPantry = Record<CategoryKey, PantryItem[]>;
export type HybridSettings = Pick<
  ReminderSettings,
  "expiryReminders" | "expiryLead" | "expiryTimeMinutes" | "expirySound"
>;

export const HYBRID_GROUP_THRESHOLD = 4 as const;

export type HybridItemStatus =
  | "disabled"
  | "no_expiry"
  | "invalid_expiry"
  | "past_reminder"
  | "planned_individual"
  | "planned_group";

export type HybridItemDecision = {
  itemId: string;
  status: HybridItemStatus;
  /** Local YYYY-MM-DD, or null when the Pantry entry has no valid expiry. */
  expiryDate: string | null;
  /** Populated only for items with a valid expiry date. */
  reminderAt: number | null;
  /** Null for disabled, invalid, past, or missing expiry entries. */
  reminderKey: string | null;
};

export type HybridReminderItem = {
  id: string;
  name: string;
  categoryKey: CategoryKey;
  /** Normalized local YYYY-MM-DD. */
  expiryDate: string;
};

export type HybridPlannedReminder = {
  kind: "individual" | "group";
  /** Stable *logical* identity, NOT a native notification identifier. */
  key: string;
  /** Fingerprint of content, time, membership and relevant settings. */
  signature: string;
  /** Epoch milliseconds of the LOCAL reminder date/time. */
  when: number;
  reminderDate: string;
  expiryDate: string;
  leadDays: 1 | 2 | 3;
  sound: boolean;
  title: string;
  body: string;
  /** Stable sorted ID order; grouped notifications retain member identities. */
  itemIds: string[];
  items: HybridReminderItem[];
};

export type HybridPlan = {
  asOf: number;
  enabled: boolean;
  groupThreshold: typeof HYBRID_GROUP_THRESHOLD;
  reminders: HybridPlannedReminder[];
  /** One decision per Pantry item; useful for later deferred-capacity status. */
  decisions: HybridItemDecision[];
  counts: {
    pantryItems: number;
    eligibleItems: number;
    individualNotifications: number;
    groupNotifications: number;
    plannedNotifications: number;
    representedItems: number;
    noExpiry: number;
    invalidExpiry: number;
    pastReminder: number;
    disabledItems: number;
  };
};

function localYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Mirrors Stage 1's LOCAL date parsing, including an optional T suffix. */
function parseLocalExpiry(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(raw);
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

function daysBeforeExpiry(lead: ReminderSettings["expiryLead"]): 1 | 2 | 3 {
  if (lead === "1d") return 1;
  if (lead === "2d") return 2;
  if (lead === "3d") return 3;
  throw new Error("Hybrid expiry planner: invalid expiryLead setting.");
}

function assertSettings(settings: HybridSettings, now: Date): void {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Hybrid expiry planner: now must be a valid Date.");
  }
  if (
    typeof settings.expiryReminders !== "boolean" ||
    typeof settings.expirySound !== "boolean" ||
    !Number.isInteger(settings.expiryTimeMinutes) ||
    settings.expiryTimeMinutes < 0 ||
    settings.expiryTimeMinutes > 1439
  ) {
    throw new Error("Hybrid expiry planner: invalid reminder settings.");
  }
  daysBeforeExpiry(settings.expiryLead);
}

function assertPantry(pantry: HybridPantry): PantryItem[] {
  if (!pantry || typeof pantry !== "object" || Array.isArray(pantry)) {
    throw new Error("Hybrid expiry planner: invalid Pantry snapshot.");
  }
  const items: PantryItem[] = [];
  const seen = new Set<string>();
  for (const value of Object.values(pantry)) {
    if (!Array.isArray(value)) {
      throw new Error(
        "Hybrid expiry planner: a Pantry category is not an array.",
      );
    }
    for (const item of value as PantryItem[]) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !item.id ||
        seen.has(item.id) ||
        typeof item.name !== "string" ||
        typeof item.categoryKey !== "string"
      ) {
        throw new Error(
          "Hybrid expiry planner: Pantry has an invalid or duplicate item.",
        );
      }
      seen.add(item.id);
      items.push(item);
    }
  }
  // Avoid relying on Pantry object/category insertion order for deterministic output.
  return items.sort((a, b) => compareText(a.id, b.id));
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function shortName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.length > 32
    ? `${clean.slice(0, 31).trimEnd()}…`
    : clean || "Ingredient";
}

function groupMessage(
  items: HybridReminderItem[],
  days: 1 | 2 | 3,
): {
  title: string;
  body: string;
} {
  const suffix = days === 1 ? "tomorrow" : `in ${days} days`;
  const title = `${items.length} ingredients expire ${suffix}`;
  const names = items.slice(0, 3).map((item) => shortName(item.name));
  const remaining = items.length - names.length;
  const body = `${names.join(", ")}${remaining ? ` and ${remaining} more` : ""}. Open Pantry to review them.`;
  return { title, body };
}

function fingerprint(plan: Omit<HybridPlannedReminder, "signature">): string {
  // Do not include quantity, image or addedAt: changing those fields must not
  // unnecessarily replace existing notifications when we integrate scheduling.
  return JSON.stringify({
    version: 1,
    kind: plan.kind,
    key: plan.key,
    when: plan.when,
    reminderDate: plan.reminderDate,
    expiryDate: plan.expiryDate,
    leadDays: plan.leadDays,
    sound: plan.sound,
    title: plan.title,
    body: plan.body,
    members: plan.items.map(({ id, name, categoryKey, expiryDate }) => [
      id,
      name,
      categoryKey,
      expiryDate,
    ]),
  });
}

function finalize(
  base: Omit<HybridPlannedReminder, "signature">,
): HybridPlannedReminder {
  return { ...base, signature: fingerprint(base) };
}

/**
 * Computes *desired* reminders only. It is safe to call in tests, on a debug
 * screen or before the future group-aware native scheduler is implemented.
 *
 * Skips reminders whose intended trigger is <= now, exactly like Stage 1.
 * Does not apply capacity limits or generate catch-up notifications.
 */
export function buildHybridExpiryPlan(
  pantry: HybridPantry,
  settings: HybridSettings,
  now: Date = new Date(),
): HybridPlan {
  assertSettings(settings, now);
  const items = assertPantry(pantry);
  const days = daysBeforeExpiry(settings.expiryLead);
  const asOf = now.getTime();
  const decisions: HybridItemDecision[] = [];
  const byWhen = new Map<
    number,
    { item: PantryItem; member: HybridReminderItem; date: string; when: Date }[]
  >();

  for (const item of items) {
    const initial: HybridItemDecision = {
      itemId: item.id,
      status: "no_expiry",
      expiryDate: null,
      reminderAt: null,
      reminderKey: null,
    };
    if (!settings.expiryReminders) {
      decisions.push({ ...initial, status: "disabled" });
      continue;
    }
    if (item.expiryDate == null || item.expiryDate === "") {
      decisions.push(initial);
      continue;
    }
    if (typeof item.expiryDate !== "string") {
      decisions.push({ ...initial, status: "invalid_expiry" });
      continue;
    }
    const expiry = parseLocalExpiry(item.expiryDate);
    if (!expiry) {
      decisions.push({ ...initial, status: "invalid_expiry" });
      continue;
    }
    const normalized = localYmd(expiry);
    const when = new Date(expiry);
    when.setDate(when.getDate() - days);
    when.setHours(
      Math.floor(settings.expiryTimeMinutes / 60),
      settings.expiryTimeMinutes % 60,
      0,
      0,
    );
    const reminderAt = when.getTime();
    if (reminderAt <= asOf) {
      decisions.push({
        ...initial,
        status: "past_reminder",
        expiryDate: normalized,
        reminderAt,
      });
      continue;
    }
    const member: HybridReminderItem = {
      id: item.id,
      name: item.name,
      categoryKey: item.categoryKey,
      expiryDate: normalized,
    };
    const group = byWhen.get(reminderAt) ?? [];
    group.push({ item, member, date: normalized, when });
    byWhen.set(reminderAt, group);
    decisions.push({
      ...initial,
      status: "planned_individual",
      expiryDate: normalized,
      reminderAt,
    });
  }

  const reminders: HybridPlannedReminder[] = [];
  const assigned = new Map<string, { status: HybridItemStatus; key: string }>();
  for (const [reminderAt, group] of [...byWhen.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    // Stable order for summaries, fingerprints and item navigation data.
    group.sort(
      (a, b) =>
        compareText(a.member.name.toLowerCase(), b.member.name.toLowerCase()) ||
        compareText(a.member.id, b.member.id),
    );
    const reminderDate = localYmd(group[0].when);
    if (group.length >= HYBRID_GROUP_THRESHOLD) {
      const members = group.map(({ member }) => member);
      const { title, body } = groupMessage(members, days);
      const key = `expiry:group:${reminderDate}:${settings.expiryTimeMinutes}`;
      reminders.push(
        finalize({
          kind: "group",
          key,
          when: reminderAt,
          reminderDate,
          expiryDate: group[0].date,
          leadDays: days,
          sound: settings.expirySound,
          title,
          body,
          itemIds: members.map((member) => member.id),
          items: members,
        }),
      );
      for (const member of members)
        assigned.set(member.id, { status: "planned_group", key });
    } else {
      for (const { item, member, date } of group) {
        // Reuse the *existing* individual reminder copy. The planner should not
        // silently create a second, slightly different copy implementation.
        const content = expiryReminderCopy(item, days);
        const key = `expiry:item:${encodeURIComponent(item.id)}`;
        reminders.push(
          finalize({
            kind: "individual",
            key,
            when: reminderAt,
            reminderDate,
            expiryDate: date,
            leadDays: days,
            sound: settings.expirySound,
            title: content.title,
            body: content.body,
            itemIds: [item.id],
            items: [member],
          }),
        );
        assigned.set(item.id, { status: "planned_individual", key });
      }
    }
  }
  // Tie-break same-time notifications by logical key for deterministic ordering.
  reminders.sort((a, b) => a.when - b.when || compareText(a.key, b.key));
  for (const decision of decisions) {
    const assignment = assigned.get(decision.itemId);
    if (assignment) {
      decision.status = assignment.status;
      decision.reminderKey = assignment.key;
    }
  }
  const count = (status: HybridItemStatus) =>
    decisions.filter((row) => row.status === status).length;
  const individualNotifications = reminders.filter(
    (entry) => entry.kind === "individual",
  ).length;
  const groupNotifications = reminders.length - individualNotifications;
  return {
    asOf,
    enabled: settings.expiryReminders,
    groupThreshold: HYBRID_GROUP_THRESHOLD,
    reminders,
    decisions,
    counts: {
      pantryItems: items.length,
      eligibleItems: count("planned_individual") + count("planned_group"),
      individualNotifications,
      groupNotifications,
      plannedNotifications: reminders.length,
      representedItems: reminders.reduce(
        (sum, reminder) => sum + reminder.itemIds.length,
        0,
      ),
      noExpiry: count("no_expiry"),
      invalidExpiry: count("invalid_expiry"),
      pastReminder: count("past_reminder"),
      disabledItems: count("disabled"),
    },
  };
}

/** Compact, redacted diagnostic (does not print ingredient names or IDs). */
export function summarizeHybridExpiryPlan(plan: HybridPlan) {
  return {
    asOf: new Date(plan.asOf).toISOString(),
    enabled: plan.enabled,
    threshold: plan.groupThreshold,
    ...plan.counts,
    groups: plan.reminders
      .filter((entry) => entry.kind === "group")
      .map((entry) => ({
        reminderDate: entry.reminderDate,
        itemCount: entry.itemIds.length,
      })),
    readOnly: true as const,
  };
}
