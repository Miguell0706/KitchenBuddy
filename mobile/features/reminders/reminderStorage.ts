import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReminderSettings = {
  expiryReminders: boolean;
  expiryLead: "3d" | "2d" | "1d";

  waterReminders: boolean;
  waterCadence: "2h" | "3h" | "4h";

  // Minutes after midnight:
  // 9:00 AM = 540
  // 9:00 PM = 1260
  waterStartMinutes: number;
  waterEndMinutes: number;
};

const STORAGE_KEY = "reminder_settings_v1";

export const defaultReminderSettings: ReminderSettings = {
  expiryReminders: true,
  expiryLead: "1d",

  waterReminders: false,
  waterCadence: "3h",
  waterStartMinutes: 9 * 60,
  waterEndMinutes: 21 * 60,
};

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultReminderSettings;
    }

    const stored = JSON.parse(raw);

    /*
     * Migration from the older hour-only values:
     * waterStartHour: 9
     * waterEndHour: 21
     */
    const waterStartMinutes =
      typeof stored.waterStartMinutes === "number"
        ? stored.waterStartMinutes
        : typeof stored.waterStartHour === "number"
          ? stored.waterStartHour * 60
          : defaultReminderSettings.waterStartMinutes;

    const waterEndMinutes =
      typeof stored.waterEndMinutes === "number"
        ? stored.waterEndMinutes
        : typeof stored.waterEndHour === "number"
          ? stored.waterEndHour * 60
          : defaultReminderSettings.waterEndMinutes;

    return {
      ...defaultReminderSettings,
      ...stored,
      waterStartMinutes,
      waterEndMinutes,
    };
  } catch (error) {
    console.error("Failed to load reminder settings:", error);
    return defaultReminderSettings;
  }
}

export async function saveReminderSettings(settings: ReminderSettings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save reminder settings:", error);
    throw error;
  }
}
