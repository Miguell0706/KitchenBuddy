/**
 * Stage 4E: a route parameter containing stable Pantry IDs, not ingredient names.
 * This file has no native, React, storage, or navigation dependencies.
 */
export const GROUPED_REMINDER_PARAM = "kbGroupIds" as const;

/** Untrusted notification and URL input. Reject malformed data rather than guessing. */
export function parseGroupedReminderIds(value: unknown): string[] | null {
  if (typeof value !== "string" || value.length > 65536) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 1000)
    return null;
  if (
    !parsed.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 512,
    )
  )
    return null;
  const ids = parsed as string[];
  return new Set(ids).size === ids.length ? ids : null;
}

/** Grouped scheduler already writes `itemIds`; preserve the exact request order. */
export function groupedReminderIdsFromNotification(
  data: unknown,
): string[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as Record<string, unknown>;
  if (payload.type !== "expiry_reminder" || payload.kbReminderKind !== "group")
    return null;
  try {
    return parseGroupedReminderIds(JSON.stringify(payload.itemIds));
  } catch {
    return null;
  }
}
