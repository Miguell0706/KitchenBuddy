import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReminderSettings = {
  expiryReminders: boolean;
  expiryLead: "3d" | "2d" | "1d";
  /** Minutes after midnight, 0–1439. Existing installations default to 9 AM. */
  expiryTimeMinutes: number;
  expirySound: boolean;
  waterReminders: boolean;
  waterCadence: "2h" | "3h" | "4h";
  waterStartMinutes: number;
  waterEndMinutes: number;
  waterSound: boolean;
};

// The key intentionally stays unchanged: existing preferences are migrated in place.
const STORAGE_KEY = "reminder_settings_v1";
export const defaultReminderSettings: ReminderSettings = {
  expiryReminders: true,
  expiryLead: "1d",
  expiryTimeMinutes: 9 * 60,
  expirySound: true,
  waterReminders: false,
  waterCadence: "3h",
  waterStartMinutes: 9 * 60,
  waterEndMinutes: 21 * 60,
  waterSound: true,
};

function minutesOr(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 1440
    ? value
    : fallback;
}
function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultReminderSettings };
    const stored: Record<string, unknown> = JSON.parse(raw);
    if (!stored || typeof stored !== "object" || Array.isArray(stored))
      return { ...defaultReminderSettings };
    const start =
      stored.waterStartMinutes ??
      (typeof stored.waterStartHour === "number"
        ? stored.waterStartHour * 60
        : undefined);
    const end =
      stored.waterEndMinutes ??
      (typeof stored.waterEndHour === "number"
        ? stored.waterEndHour * 60
        : undefined);
    const waterStartMinutes = minutesOr(
      start,
      defaultReminderSettings.waterStartMinutes,
    );
    const waterEndMinutes = minutesOr(
      end,
      defaultReminderSettings.waterEndMinutes,
    );
    return {
      expiryReminders:
        typeof stored.expiryReminders === "boolean"
          ? stored.expiryReminders
          : defaultReminderSettings.expiryReminders,
      expiryLead: choice(
        stored.expiryLead,
        ["1d", "2d", "3d"] as const,
        defaultReminderSettings.expiryLead,
      ),
      expiryTimeMinutes: minutesOr(
        stored.expiryTimeMinutes,
        defaultReminderSettings.expiryTimeMinutes,
      ),
      expirySound:
        typeof stored.expirySound === "boolean" ? stored.expirySound : true,
      waterReminders:
        typeof stored.waterReminders === "boolean"
          ? stored.waterReminders
          : defaultReminderSettings.waterReminders,
      waterCadence: choice(
        stored.waterCadence,
        ["2h", "3h", "4h"] as const,
        defaultReminderSettings.waterCadence,
      ),
      waterStartMinutes:
        waterStartMinutes < waterEndMinutes
          ? waterStartMinutes
          : defaultReminderSettings.waterStartMinutes,
      waterEndMinutes:
        waterStartMinutes < waterEndMinutes
          ? waterEndMinutes
          : defaultReminderSettings.waterEndMinutes,
      waterSound:
        typeof stored.waterSound === "boolean" ? stored.waterSound : true,
    };
  } catch (error) {
    console.error("Failed to load reminder settings:", error);
    return { ...defaultReminderSettings };
  }
}

export async function saveReminderSettings(
  settings: ReminderSettings,
): Promise<void> {
  // Intentionally propagate write errors so the UI can report failure.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
