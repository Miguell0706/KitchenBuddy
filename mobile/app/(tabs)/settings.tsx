import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import { CardStyles, Layout, TextStyles } from "@/constants/styles";

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

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [expireBadges, setExpireBadges] = useState(true);
  const [highAccuracyScan, setHighAccuracyScan] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
      }}
    >
      <View style={{ marginBottom: Spacing.md }}>
        <Text style={TextStyles.screenTitle}>Settings</Text>
        <Text style={TextStyles.bodyMuted}>
          Keep this boring + predictable.
        </Text>
      </View>

      {/* Notifications */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Notifications</Text>

        <Row
          icon="notifications-outline"
          title="Expiry reminders"
          subtitle="Get reminded before food expires"
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{
                true: "rgba(0,0,0,0.25)",
                false: "rgba(0,0,0,0.15)",
              }}
              thumbColor={Colors.background}
            />
          }
        />

        <Row
          icon="alert-circle-outline"
          title="Show expiring badges"
          subtitle="Badges and counts in Pantry"
          right={
            <Switch
              value={expireBadges}
              onValueChange={setExpireBadges}
              trackColor={{
                true: "rgba(0,0,0,0.25)",
                false: "rgba(0,0,0,0.15)",
              }}
              thumbColor={Colors.background}
            />
          }
        />
      </View>

      {/* Scan */}
      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Scan</Text>

        <Row
          icon="scan-outline"
          title="High accuracy mode"
          subtitle="Uses heavier processing (slower). Premium later."
          right={
            <Switch
              value={highAccuracyScan}
              onValueChange={setHighAccuracyScan}
              trackColor={{
                true: "rgba(0,0,0,0.25)",
                false: "rgba(0,0,0,0.15)",
              }}
              thumbColor={Colors.background}
            />
          }
        />

        <Row
          icon="sparkles-outline"
          title="Rewards"
          subtitle="Streaks + points for scanning (placeholder)"
          onPress={() =>
            Alert.alert("Rewards", "Rewards UI will live in Scan.")
          }
          right={
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.textLight}
            />
          }
        />
      </View>

      {/* Account / About */}
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
          subtitle="FAQ + contact (placeholder)"
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
          onPress={() => Alert.alert("About", "KitchenBuddy (placeholder).")}
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
