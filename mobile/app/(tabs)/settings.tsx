import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import { CardStyles, Layout, TextStyles } from "@/constants/styles";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CORRECTIONS_KEY } from "@/features/scan/correctionStorage";

async function debugDumpCorrections() {
  const raw = await AsyncStorage.getItem(CORRECTIONS_KEY);
  console.log("📦 CORRECTIONS RAW:", raw);
}
debugDumpCorrections();
function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        Layout.rowBetween,
        {
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: "rgba(0,0,0,0.03)",
          marginBottom: 8,
        },
      ]}
    >
      <View style={[Layout.row, { flex: 1, paddingRight: 10 }]}>
        <Ionicons
          name={icon}
          size={18}
          color={Colors.text}
          style={{ marginRight: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={TextStyles.body}>{title}</Text>
          {subtitle ? (
            <Text style={[TextStyles.small, { marginTop: 2 }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function RadioRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        Layout.rowBetween,
        {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.02)",
          marginBottom: 8,
          borderWidth: 1,
          borderColor: selected ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.06)",
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={TextStyles.body}>{title}</Text>
        {subtitle ? (
          <Text style={[TextStyles.small, { marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>

      <Ionicons
        name={selected ? "radio-button-on-outline" : "radio-button-off-outline"}
        size={18}
        color={selected ? Colors.primary : Colors.textLight}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  // toggles
  const [expiryReminders, setExpiryReminders] = useState(true);
  const [waterReminders, setWaterReminders] = useState(false);

  // expiry options
  type ExpiryLead = "3d" | "1d" | "12h";
  const [expiryLead, setExpiryLead] = useState<ExpiryLead>("1d");

  const expirySubtitle = useMemo(() => {
    if (!expiryReminders) return "Get reminded before food expires";
    if (expiryLead === "3d") return "Notify me 3 days before expiry";
    if (expiryLead === "1d") return "Notify me 1 day before expiry";
    return "Notify me 12 hours before expiry";
  }, [expiryReminders, expiryLead]);

  // water options
  type WaterCadence = "2h" | "3h" | "4h";
  const [waterCadence, setWaterCadence] = useState<WaterCadence>("3h");
  const [waterStartHour, setWaterStartHour] = useState(9); // 9am
  const [waterEndHour, setWaterEndHour] = useState(21); // 9pm

  const waterSubtitle = useMemo(() => {
    if (!waterReminders) return "Optional reminders to drink water";
    const every =
      waterCadence === "2h"
        ? "Every 2 hours"
        : waterCadence === "3h"
        ? "Every 3 hours"
        : "Every 4 hours";
    const fmt = (h: number) => {
      const suffix = h >= 12 ? "PM" : "AM";
      const hr = ((h + 11) % 12) + 1;
      return `${hr}${suffix}`;
    };
    return `${every} • ${fmt(waterStartHour)}–${fmt(waterEndHour)}`;
  }, [waterReminders, waterCadence, waterStartHour, waterEndHour]);

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
      }}
    >
      <View style={{ marginBottom: Spacing.md }}>
        <Text style={TextStyles.screenTitle}>Settings</Text>
        <Text style={TextStyles.bodyMuted}></Text>
      </View>

      {/* Notifications */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Notifications</Text>

        <Row
          icon="notifications-outline"
          title="Expiry reminders"
          subtitle={expirySubtitle}
          right={
            <Switch
              value={expiryReminders}
              onValueChange={setExpiryReminders}
              trackColor={{
                true: "rgba(0,0,0,0.25)",
                false: "rgba(0,0,0,0.15)",
              }}
              thumbColor={Colors.background}
            />
          }
        />

        {expiryReminders ? (
          <View style={{ marginTop: 4, marginBottom: 8, marginLeft: 28 }}>
            <RadioRow
              title="3 days before"
              subtitle="Best if you shop weekly"
              selected={expiryLead === "3d"}
              onPress={() => setExpiryLead("3d")}
            />
            <RadioRow
              title="1 day before"
              subtitle="Good default"
              selected={expiryLead === "1d"}
              onPress={() => setExpiryLead("1d")}
            />
            <RadioRow
              title="12 hours before"
              subtitle="Last-chance reminder"
              selected={expiryLead === "12h"}
              onPress={() => setExpiryLead("12h")}
            />
          </View>
        ) : null}

        <Row
          icon="water-outline"
          title="Water reminders"
          subtitle={waterSubtitle}
          right={
            <Switch
              value={waterReminders}
              onValueChange={setWaterReminders}
              trackColor={{
                true: "rgba(0,0,0,0.25)",
                false: "rgba(0,0,0,0.15)",
              }}
              thumbColor={Colors.background}
            />
          }
        />

        {waterReminders ? (
          <View style={{ marginTop: 4, marginBottom: 8, marginLeft: 28 }}>
            <RadioRow
              title="Every 2 hours"
              subtitle="More frequent nudges"
              selected={waterCadence === "2h"}
              onPress={() => setWaterCadence("2h")}
            />
            <RadioRow
              title="Every 3 hours"
              subtitle="Balanced"
              selected={waterCadence === "3h"}
              onPress={() => setWaterCadence("3h")}
            />
            <RadioRow
              title="Every 4 hours"
              subtitle="Light reminders"
              selected={waterCadence === "4h"}
              onPress={() => setWaterCadence("4h")}
            />

            <Row
              icon="time-outline"
              title="Reminder window"
              subtitle="Set active hours"
              onPress={() =>
                Alert.alert(
                  "Reminder window",
                  "Placeholder.\n\nLater you can add a time picker:\n• Start hour\n• End hour"
                )
              }
              right={
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[
                      TextStyles.small,
                      { marginRight: 6, color: Colors.textLight },
                    ]}
                  >
                    {(() => {
                      const fmt = (h: number) => {
                        const suffix = h >= 12 ? "PM" : "AM";
                        const hr = ((h + 11) % 12) + 1;
                        return `${hr}${suffix}`;
                      };
                      return `${fmt(waterStartHour)}–${fmt(waterEndHour)}`;
                    })()}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textLight}
                  />
                </View>
              }
            />
          </View>
        ) : null}
      </View>

      {/* Scan */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Scan</Text>

        <Row
          icon="time-outline"
          title="View previous scans"
          subtitle="See your scan history"
          onPress={() => router.push("/settings/scan-history")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />

        <Row
          icon="document-text-outline"
          title="View scan cache & receipt corrections"
          subtitle="Redo local line edits before saving to pantry"
          onPress={() => router.push("/settings/scan-cache")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />
      </View>

      {/* Pantry */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Pantry</Text>

        <Row
          icon="options-outline"
          title="Change category expiry default dates"
          subtitle="Set default expiry days per category"
          onPress={() => Alert.alert("Category defaults", "Placeholder.")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />

        <Row
          icon="trash-outline"
          title="View used/trashed items"
          subtitle="Recently used or removed items"
          onPress={() => Alert.alert("Used/trashed", "Placeholder.")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />
      </View>

      {/* Account */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Account</Text>

        <Row
          icon="star-outline"
          title="Upgrade to Premium"
          subtitle="Smart grocery list, advanced scan, and more"
          onPress={() =>
            Alert.alert(
              "Premium",
              "Premium features coming soon.\n\n• Smart grocery list\n• 2x Scan rewards\n• Unlimited scans per day\n• 10/recipes a day\n"
            )
          }
          right={
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={[
                  TextStyles.small,
                  { marginRight: 6, color: Colors.primary },
                ]}
              >
                Coming soon
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textLight}
              />
            </View>
          }
        />

        <Row
          icon="analytics-outline"
          title="Analytics (Premium)"
          subtitle="Trends on waste, savings, and scan accuracy"
          onPress={() =>
            Alert.alert(
              "Analytics",
              "Premium feature (placeholder).\n\nExamples:\n• $ saved estimate\n• Items trashed vs used\n• Top expiring categories\n• Correction rate over time"
            )
          }
          right={
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={[
                  TextStyles.small,
                  { marginRight: 6, color: Colors.primary },
                ]}
              >
                Premium
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textLight}
              />
            </View>
          }
        />

        <Row
          icon="key-outline"
          title="Restore purchase"
          subtitle="If you bought Premium before"
          onPress={() => Alert.alert("Restore", "Placeholder.")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />

        <Row
          icon="help-circle-outline"
          title="Help"
          subtitle="FAQ + contact"
          onPress={() => Alert.alert("Help", "Placeholder.")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />

        <Row
          icon="information-circle-outline"
          title="About"
          subtitle="KitchenBuddy v0.1"
          onPress={() => Alert.alert("About", "KitchenBuddy .")}
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />
      </View>
    </ScrollView>
  );
}
