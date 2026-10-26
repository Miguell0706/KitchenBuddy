/**
 * KitchenBuddy — Settings, Ivory / Slate editorial edition.
 * Retains existing reminder storage, scheduling functions and navigation routes.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { usePremium } from "@/context/PremiumContext";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  loadReminderSettings,
  saveReminderSettings,
  defaultReminderSettings,
  type ReminderSettings,
} from "@/features/reminders/reminderStorage";
import {
  scheduleWaterReminders,
  cancelWaterReminders,
} from "@/features/reminders/waterReminders";
import {
  scheduleExpiryReminders,
  cancelExpiryReminders,
} from "@/features/reminders/expiryReminders";
import {
  expiryReminderCopy,
  waterReminderCopy,
} from "@/features/reminders/notificationContent";
const P = {
  ivory: "#F5F2EC",
  white: "#FFFEFA",
  fog: "#E8E5E0",
  row: "#F1EFEB",
  slate: "#586D77",
  deepSlate: "#445A64",
  brown: "#786450",
  charcoal: "#2E2E2E",
  muted: "#79736F",
  pale: "#F3E5D0",
  line: "#E3DED7",
};
const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});
type AppIcon = keyof typeof Ionicons.glyphMap;
type ExpiryLead = ReminderSettings["expiryLead"];
type WaterCadence = ReminderSettings["waterCadence"];
const INITIAL: ReminderSettings = { ...defaultReminderSettings };
function minutesToDate(minutes: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}
function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
function SectionHeader({
  icon,
  title,
  caption,
}: {
  icon: AppIcon;
  title: string;
  caption?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={P.deepSlate} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
    </View>
  );
}
function SettingRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  disabled = false,
}: {
  icon: AppIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={21} color={P.deepSlate} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={P.muted} />
        ) : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.settingRow, disabled && styles.disabled]}>
      {content}
    </View>
  );
}
function Choice({
  title,
  subtitle,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text
          style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}
        >
          {title}
        </Text>
        <Text style={styles.choiceCaption}>{subtitle}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}
export default function SettingsScreen() {
  const {
    isPremium,
    isLoading: isPremiumLoading,
    restorePremium,
  } = usePremium();
  const restoringRef = useRef(false);
  const [restoring, setRestoring] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>(INITIAL);
  const settingsRef = useRef<ReminderSettings>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const updatingRef = useRef(false);
  const [updating, setUpdating] = useState(false);
  const [showIOSStartPicker, setShowIOSStartPicker] = useState(false);
  const [showIOSEndPicker, setShowIOSEndPicker] = useState(false);
  const [showIOSExpiryPicker, setShowIOSExpiryPicker] = useState(false);
  const [iosExpiryDraft, setIOSExpiryDraft] = useState<Date | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await loadReminderSettings();
        if (active) {
          settingsRef.current = stored;
          setSettings(stored);
        }
      } catch (error) {
        console.warn("Could not load reminder settings", error);
        if (active)
          setNotice({
            title: "Settings unavailable",
            body: "Your reminder preferences could not be loaded. Please try reopening Settings.",
          });
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function updateReminderSettings(changes: Partial<ReminderSettings>) {
    if (!loaded || updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(true);
    const previous = settingsRef.current;
    const updated: ReminderSettings = { ...previous, ...changes };
    settingsRef.current = updated;
    setSettings(updated);
    try {
      try {
        await saveReminderSettings(updated);
      } catch (error) {
        settingsRef.current = previous;
        setSettings(previous);
        throw new Error(
          "Your reminder settings couldn't be saved. Please try again.",
        );
      }
      const waterChanged =
        "waterReminders" in changes ||
        "waterCadence" in changes ||
        "waterStartMinutes" in changes ||
        "waterEndMinutes" in changes ||
        "waterSound" in changes;
      const expiryChanged =
        "expiryReminders" in changes ||
        "expiryLead" in changes ||
        "expiryTimeMinutes" in changes ||
        "expirySound" in changes;
      // The schedulers serialize their own changes, including disabling and snoozes.
      if (waterChanged) await scheduleWaterReminders(updated);
      if (expiryChanged) await scheduleExpiryReminders(updated);
    } catch (error) {
      console.warn("Unable to save or reschedule reminder settings", error);
      setNotice({
        title: "Reminder update needs attention",
        body:
          error instanceof Error
            ? error.message
            : "Please check notification permissions and try again.",
      });
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  }
  async function selectStartTime(date?: Date) {
    if (!date) return;
    const start = dateToMinutes(date);
    if (start >= settingsRef.current.waterEndMinutes) {
      setNotice({
        title: "Invalid reminder window",
        body: "The start time must be earlier than the end time.",
      });
      return;
    }
    await updateReminderSettings({ waterStartMinutes: start });
  }
  async function selectEndTime(date?: Date) {
    if (!date) return;
    const end = dateToMinutes(date);
    if (end <= settingsRef.current.waterStartMinutes) {
      setNotice({
        title: "Invalid reminder window",
        body: "The end time must be later than the start time.",
      });
      return;
    }
    await updateReminderSettings({ waterEndMinutes: end });
  }
  function openStartTimePicker() {
    if (!loaded || updating) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: minutesToDate(settings.waterStartMinutes),
        mode: "time",
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set") void selectStartTime(date);
        },
      });
    } else setShowIOSStartPicker(true);
  }
  function openEndTimePicker() {
    if (!loaded || updating) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: minutesToDate(settings.waterEndMinutes),
        mode: "time",
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set") void selectEndTime(date);
        },
      });
    } else setShowIOSEndPicker(true);
  }
  async function selectExpiryTime(date?: Date) {
    if (date)
      await updateReminderSettings({ expiryTimeMinutes: dateToMinutes(date) });
  }
  function openExpiryTimePicker() {
    if (!loaded || updating) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: minutesToDate(settings.expiryTimeMinutes),
        mode: "time",
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set") void selectExpiryTime(date);
        },
      });
    } else {
      setIOSExpiryDraft(minutesToDate(settings.expiryTimeMinutes));
      setShowIOSExpiryPicker(true);
    }
  }
  const expiryPreview = expiryReminderCopy(
    { name: "Spinach" },
    Number(settings.expiryLead[0]),
  );
  const waterPreview = waterReminderCopy(0);
  const expirySubtitle = settings.expiryReminders
    ? `Notify me ${settings.expiryLead === "3d" ? "3 days" : settings.expiryLead === "2d" ? "2 days" : "1 day"} before expiry`
    : "Get reminded before food expires";
  const cadenceLabel =
    settings.waterCadence === "2h"
      ? "Every 2 hours"
      : settings.waterCadence === "3h"
        ? "Every 3 hours"
        : "Every 4 hours";
  const waterSubtitle = settings.waterReminders
    ? `${cadenceLabel} · ${formatTime(settings.waterStartMinutes)}–${formatTime(settings.waterEndMinutes)}`
    : "Optional reminders to drink water";
  async function handleRestorePurchase() {
    if (restoringRef.current || isPremiumLoading) return;
    restoringRef.current = true;
    setRestoring(true);
    try {
      const active = await restorePremium();
      setNotice({
        title: active ? "Purchase restored" : "No active subscription found",
        body: active
          ? "Your KitchenBuddy Premium membership has been restored."
          : "We couldn't find an active Premium membership to restore.",
      });
    } catch (error) {
      console.error("Restore purchase error:", error);
      setNotice({
        title: "Restore unsuccessful",
        body: "We couldn't restore your purchases. Please try again.",
      });
    } finally {
      restoringRef.current = false;
      setRestoring(false);
    }
  }

  const disabled = !loaded || updating;
  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={styles.eyebrow}>YOUR KITCHEN, YOUR WAY</Text>
          <Text style={styles.screenTitle}>Settings</Text>
          <Text style={styles.screenSubtitle}>
            A little care in the everyday.
          </Text>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroOverline}>
              <Ionicons name="sparkles-outline" size={16} color={P.pale} />
              <Text style={styles.heroOverlineText}>MADE FOR YOUR ROUTINE</Text>
            </View>
            <Text style={styles.heroTitle}>
              Make room for{"\n"}better habits.
            </Text>
            <Text style={styles.heroBody}>
              Tailor your reminders and keep your kitchen running beautifully.
            </Text>
          </View>
          <View style={styles.heroArt}>
            <View style={styles.heroArtCircle} />
            <Ionicons
              name="leaf-outline"
              size={62}
              color="#D7D0C1"
              style={styles.heroLeaf}
            />
            <Ionicons
              name="notifications-outline"
              size={32}
              color="#F5EEE2"
              style={styles.heroBell}
            />
          </View>
        </View>
        <View style={styles.card}>
          <SectionHeader
            icon="notifications-outline"
            title="Notifications"
            caption="Gentle reminders, right on time"
          />
          <SettingRow
            icon="alarm-outline"
            title="Expiry reminders"
            subtitle={expirySubtitle}
            right={
              <Switch
                accessibilityLabel="Expiry reminders"
                value={settings.expiryReminders}
                disabled={disabled}
                onValueChange={(value) =>
                  void updateReminderSettings({ expiryReminders: value })
                }
                trackColor={{ false: "#D7D4D0", true: P.slate }}
                thumbColor={P.white}
                ios_backgroundColor="#D7D4D0"
              />
            }
          />
          {settings.expiryReminders ? (
            <View style={styles.options} accessibilityRole="radiogroup">
              <Text style={styles.optionsLabel}>REMIND ME</Text>
              <Choice
                title="3 days before"
                subtitle="Best if you shop weekly"
                selected={settings.expiryLead === "3d"}
                disabled={disabled}
                onPress={() =>
                  void updateReminderSettings({
                    expiryLead: "3d" as ExpiryLead,
                  })
                }
              />
              <Choice
                title="2 days before"
                subtitle="More time to plan"
                selected={settings.expiryLead === "2d"}
                disabled={disabled}
                onPress={() =>
                  void updateReminderSettings({
                    expiryLead: "2d" as ExpiryLead,
                  })
                }
              />
              <Choice
                title="1 day before"
                subtitle="A good everyday default"
                selected={settings.expiryLead === "1d"}
                disabled={disabled}
                onPress={() =>
                  void updateReminderSettings({
                    expiryLead: "1d" as ExpiryLead,
                  })
                }
              />
              <Text style={[styles.optionsLabel, { marginTop: 12 }]}>
                DELIVERY
              </Text>
              <SettingRow
                icon="time-outline"
                title="Reminder time"
                subtitle="When expiry alerts arrive"
                disabled={disabled}
                onPress={openExpiryTimePicker}
                right={
                  <View style={styles.timeRight}>
                    <Text style={styles.timeValue}>
                      {formatTime(settings.expiryTimeMinutes)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={P.muted}
                    />
                  </View>
                }
              />
              {Platform.OS === "ios" && showIOSExpiryPicker ? (
                <View style={styles.iosPicker}>
                  <DateTimePicker
                    value={
                      iosExpiryDraft ??
                      minutesToDate(settings.expiryTimeMinutes)
                    }
                    mode="time"
                    display="spinner"
                    onChange={(_event: DateTimePickerEvent, date?: Date) => {
                      if (date) setIOSExpiryDraft(date);
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      setShowIOSExpiryPicker(false);
                      void selectExpiryTime(iosExpiryDraft ?? undefined);
                    }}
                    style={styles.pickerDone}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              ) : null}
              <SettingRow
                icon="volume-medium-outline"
                title="Expiry notification sound"
                subtitle="Use the phone's default alert tone"
                right={
                  <Switch
                    accessibilityLabel="Expiry notification sound"
                    value={settings.expirySound}
                    disabled={disabled}
                    onValueChange={(value) =>
                      void updateReminderSettings({ expirySound: value })
                    }
                    trackColor={{ false: "#D7D4D0", true: P.slate }}
                    thumbColor={P.white}
                    ios_backgroundColor="#D7D4D0"
                  />
                }
              />
              <View style={styles.previewBox}>
                <Text style={styles.previewEyebrow}>NOTIFICATION PREVIEW</Text>
                <View style={styles.previewTop}>
                  <Ionicons name="leaf-outline" size={17} color={P.deepSlate} />
                  <Text style={styles.previewApp}>
                    KITCHENBUDDY · FOOD EXPIRY
                  </Text>
                </View>
                <Text style={styles.previewTitle}>{expiryPreview.title}</Text>
                <Text style={styles.previewBody}>{expiryPreview.body}</Text>
                <Text style={styles.previewAction}>
                  VIEW PANTRY · FIND RECIPES · REMIND TOMORROW
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.hairline} />
          <SettingRow
            icon="water-outline"
            title="Water reminders"
            subtitle={waterSubtitle}
            right={
              <Switch
                accessibilityLabel="Water reminders"
                value={settings.waterReminders}
                disabled={disabled}
                onValueChange={(value) =>
                  void updateReminderSettings({ waterReminders: value })
                }
                trackColor={{ false: "#D7D4D0", true: P.slate }}
                thumbColor={P.white}
                ios_backgroundColor="#D7D4D0"
              />
            }
          />
          {settings.waterReminders ? (
            <View style={styles.options}>
              <Text style={styles.optionsLabel}>REMINDER FREQUENCY</Text>
              <View accessibilityRole="radiogroup">
                <Choice
                  title="Every 2 hours"
                  subtitle="More frequent nudges"
                  selected={settings.waterCadence === "2h"}
                  disabled={disabled}
                  onPress={() =>
                    void updateReminderSettings({
                      waterCadence: "2h" as WaterCadence,
                    })
                  }
                />
                <Choice
                  title="Every 3 hours"
                  subtitle="A balanced rhythm"
                  selected={settings.waterCadence === "3h"}
                  disabled={disabled}
                  onPress={() =>
                    void updateReminderSettings({
                      waterCadence: "3h" as WaterCadence,
                    })
                  }
                />
                <Choice
                  title="Every 4 hours"
                  subtitle="Light reminders"
                  selected={settings.waterCadence === "4h"}
                  disabled={disabled}
                  onPress={() =>
                    void updateReminderSettings({
                      waterCadence: "4h" as WaterCadence,
                    })
                  }
                />
              </View>
              <Text style={[styles.optionsLabel, { marginTop: 12 }]}>
                DAILY WINDOW
              </Text>
              <SettingRow
                icon="sunny-outline"
                title="Start time"
                subtitle="First possible reminder"
                disabled={disabled}
                onPress={openStartTimePicker}
                right={
                  <View style={styles.timeRight}>
                    <Text style={styles.timeValue}>
                      {formatTime(settings.waterStartMinutes)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={P.muted}
                    />
                  </View>
                }
              />
              {Platform.OS === "ios" && showIOSStartPicker ? (
                <View style={styles.iosPicker}>
                  <DateTimePicker
                    value={minutesToDate(settings.waterStartMinutes)}
                    mode="time"
                    display="spinner"
                    onChange={(_event: DateTimePickerEvent, date?: Date) => {
                      if (date) void selectStartTime(date);
                    }}
                  />
                  <Pressable
                    onPress={() => setShowIOSStartPicker(false)}
                    style={styles.pickerDone}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              ) : null}
              <SettingRow
                icon="moon-outline"
                title="End time"
                subtitle="No reminders after this time"
                disabled={disabled}
                onPress={openEndTimePicker}
                right={
                  <View style={styles.timeRight}>
                    <Text style={styles.timeValue}>
                      {formatTime(settings.waterEndMinutes)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={P.muted}
                    />
                  </View>
                }
              />
              {Platform.OS === "ios" && showIOSEndPicker ? (
                <View style={styles.iosPicker}>
                  <DateTimePicker
                    value={minutesToDate(settings.waterEndMinutes)}
                    mode="time"
                    display="spinner"
                    onChange={(_event: DateTimePickerEvent, date?: Date) => {
                      if (date) void selectEndTime(date);
                    }}
                  />
                  <Pressable
                    onPress={() => setShowIOSEndPicker(false)}
                    style={styles.pickerDone}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              ) : null}
              <SettingRow
                icon="volume-medium-outline"
                title="Water notification sound"
                subtitle="Use the phone's default alert tone"
                right={
                  <Switch
                    accessibilityLabel="Water notification sound"
                    value={settings.waterSound}
                    disabled={disabled}
                    onValueChange={(value) =>
                      void updateReminderSettings({ waterSound: value })
                    }
                    trackColor={{ false: "#D7D4D0", true: P.slate }}
                    thumbColor={P.white}
                    ios_backgroundColor="#D7D4D0"
                  />
                }
              />
              <View style={styles.previewBox}>
                <Text style={styles.previewEyebrow}>NOTIFICATION PREVIEW</Text>
                <View style={styles.previewTop}>
                  <Ionicons
                    name="water-outline"
                    size={17}
                    color={P.deepSlate}
                  />
                  <Text style={styles.previewApp}>
                    KITCHENBUDDY · WATER REMINDER
                  </Text>
                </View>
                <Text style={styles.previewTitle}>{waterPreview.title}</Text>
                <Text style={styles.previewBody}>{waterPreview.body}</Text>
                <Text style={styles.previewAction}>DONE · IN 30 MINUTES</Text>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.card}>
          <SectionHeader
            icon="scan-outline"
            title="Scan"
            caption="Receipts & corrections"
          />
          <SettingRow
            icon="time-outline"
            title="Previous scans"
            subtitle="See your scan history"
            onPress={() => router.push("/settings/scan-history")}
          />
          <SettingRow
            icon="document-text-outline"
            title="Scan cache & corrections"
            subtitle="Review local receipt line edits"
            onPress={() => router.push("/settings/scan-cache")}
          />
        </View>
        <View style={styles.card}>
          <SectionHeader
            icon="cube-outline"
            title="Pantry"
            caption="Make your food work for you"
          />
          <SettingRow
            icon="calendar-outline"
            title="Category expiry defaults"
            subtitle="Set default expiry days by category"
            onPress={() => router.push("/settings/category-settings")}
          />
          <SettingRow
            icon="archive-outline"
            title="Used & trashed items"
            subtitle="Recently used or removed items"
            onPress={() => router.push("/settings/pantry-history")}
          />
        </View>
        <View style={styles.card}>
          <SectionHeader
            icon="person-outline"
            title="Account & more"
            caption="Your KitchenBuddy essentials"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings/premium")}
            style={({ pressed }) => [
              styles.premiumRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.premiumIcon}>
              <Ionicons name="sparkles-outline" size={21} color={P.pale} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>KitchenBuddy Premium</Text>
              <Text style={styles.premiumSub}>
                More recipes, smart lists & insights
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={P.white} />
          </Pressable>
          <SettingRow
            icon="analytics-outline"
            title="Analytics"
            subtitle="Understand your food usage"
            onPress={() => router.push("/settings/pantry-analytics")}
            right={
              <View style={styles.rightLabel}>
                {!isPremiumLoading && !isPremium ? (
                  <>
                    <Ionicons
                      name="lock-closed-outline"
                      size={13}
                      color={P.brown}
                    />
                    <Text style={styles.rightLabelText}>Premium</Text>
                  </>
                ) : isPremium ? (
                  <Text style={styles.rightLabelText}>Included</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={P.muted} />
              </View>
            }
          />
          <SettingRow
            icon="refresh-outline"
            title="Restore purchase"
            subtitle={
              restoring
                ? "Checking previous purchases…"
                : "Restore a previous subscription"
            }
            disabled={restoring || isPremiumLoading}
            onPress={() => void handleRestorePurchase()}
          />
          <SettingRow
            icon="help-circle-outline"
            title="Help"
            subtitle="FAQ & contact"
            onPress={() => router.push("/settings/help")}
          />
          <SettingRow
            icon="information-circle-outline"
            title="About"
            subtitle="KitchenBuddy v0.1"
            onPress={() => router.push("/settings/about")}
          />
        </View>
        <View style={styles.footer}>
          <Ionicons name="heart-outline" size={15} color={P.brown} />
          <Text style={styles.footerText}>
            A more thoughtful kitchen, every day.
          </Text>
        </View>
      </ScrollView>
      <Modal
        visible={!!notice}
        animationType="fade"
        transparent
        onRequestClose={() => setNotice(null)}
      >
        <View style={styles.modalShade}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setNotice(null)}
            accessibilityLabel="Dismiss notice"
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalIcon}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={P.deepSlate}
              />
            </View>
            <Text style={styles.modalTitle}>{notice?.title}</Text>
            <Text style={styles.modalBody}>{notice?.body}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice(null)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ivory },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 56 },
  head: { marginBottom: 20, paddingHorizontal: 2 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: P.brown,
    marginBottom: 7,
  },
  screenTitle: {
    fontFamily: SERIF,
    fontSize: 43,
    lineHeight: 51,
    color: P.charcoal,
  },
  screenSubtitle: { fontSize: 14, color: P.muted, marginTop: 3 },
  hero: {
    minHeight: 155,
    overflow: "hidden",
    borderRadius: 23,
    backgroundColor: P.slate,
    marginBottom: 17,
    flexDirection: "row",
    alignItems: "center",
  },
  heroCopy: { padding: 20, flex: 1, zIndex: 1 },
  heroOverline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  heroOverlineText: {
    fontSize: 9,
    color: P.pale,
    fontWeight: "800",
    letterSpacing: 1.35,
  },
  heroTitle: {
    fontFamily: SERIF,
    fontSize: 25,
    lineHeight: 29,
    color: P.white,
  },
  heroBody: {
    color: "#ECEBE6",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
    maxWidth: 235,
  },
  heroArt: {
    position: "absolute",
    width: 115,
    height: "100%",
    right: 0,
    top: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  heroArtCircle: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: "#A9B6B6",
    right: -29,
    top: 17,
    opacity: 0.65,
  },
  heroLeaf: {
    position: "absolute",
    right: 7,
    top: 28,
    transform: [{ rotate: "-28deg" }],
    opacity: 0.6,
  },
  heroBell: { position: "absolute", right: 32, bottom: 28, opacity: 0.85 },
  card: {
    backgroundColor: P.white,
    borderRadius: 23,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0EBE5",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  sectionIcon: {
    height: 39,
    width: 39,
    borderRadius: 13,
    backgroundColor: "#E8EBEA",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 25,
    color: P.charcoal,
    lineHeight: 30,
  },
  sectionCaption: { fontSize: 11, color: P.muted, marginTop: 3 },
  settingRow: {
    backgroundColor: P.row,
    borderRadius: 16,
    minHeight: 68,
    marginBottom: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowIcon: {
    height: 36,
    width: 36,
    borderRadius: 11,
    backgroundColor: P.white,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, paddingRight: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: P.charcoal,
    lineHeight: 19,
  },
  rowSubtitle: { fontSize: 11, lineHeight: 16, color: P.muted, marginTop: 3 },
  hairline: {
    height: 1,
    backgroundColor: P.line,
    marginVertical: 9,
    marginHorizontal: 3,
  },
  options: { paddingLeft: 15, paddingRight: 2, paddingBottom: 3 },
  optionsLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: P.brown,
    letterSpacing: 1.4,
    marginTop: 4,
    marginBottom: 10,
    marginLeft: 2,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    minHeight: 62,
    backgroundColor: "#FBFAF7",
  },
  choiceSelected: { borderColor: P.slate, backgroundColor: "#EEF1F0" },
  choiceTitle: { fontSize: 13, fontWeight: "600", color: P.charcoal },
  choiceTitleSelected: { color: P.deepSlate, fontWeight: "800" },
  choiceCaption: { fontSize: 11, color: P.muted, marginTop: 4 },
  radioOuter: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#A7A19A",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: P.slate, borderWidth: 2 },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: P.slate,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  timeRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeValue: { fontSize: 12, color: P.deepSlate, fontWeight: "800" },
  iosPicker: {
    backgroundColor: P.ivory,
    padding: 10,
    borderRadius: 14,
    marginBottom: 10,
  },
  pickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: P.slate,
  },
  pickerDoneText: { color: P.white, fontWeight: "700" },
  premiumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: P.deepSlate,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 17,
    marginBottom: 11,
  },
  premiumIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#8A9A9D",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumTitle: { fontFamily: SERIF, fontSize: 19, color: P.white },
  premiumSub: { fontSize: 11, color: "#E2E6E5", marginTop: 4 },
  rightLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  rightLabelText: {
    fontSize: 11,
    color: P.brown,
    fontWeight: "700",
    marginRight: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    paddingVertical: 9,
  },
  footerText: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 13,
    color: P.brown,
  },
  previewBox: {
    backgroundColor: "#F4F3EE",
    borderColor: P.line,
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    marginTop: 6,
    marginBottom: 13,
  },
  previewEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: P.brown,
    marginBottom: 12,
  },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  previewApp: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: P.deepSlate,
    flexShrink: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: P.charcoal,
    marginBottom: 5,
  },
  previewBody: { fontSize: 12, lineHeight: 18, color: P.muted },
  previewAction: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontWeight: "700",
    color: P.deepSlate,
    marginTop: 14,
  },
  modalShade: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(27,33,35,.43)",
  },
  modalSheet: {
    backgroundColor: P.white,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 38,
    alignItems: "center",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.fog,
    marginBottom: 21,
  },
  modalIcon: {
    backgroundColor: "#E8EBEA",
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  modalTitle: {
    fontFamily: SERIF,
    fontSize: 25,
    color: P.charcoal,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 20,
    color: P.muted,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },
  modalButton: {
    width: "100%",
    backgroundColor: P.deepSlate,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonText: { color: P.white, fontWeight: "800", fontSize: 13 },
});
