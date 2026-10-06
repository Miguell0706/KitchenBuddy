import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors, Spacing } from "@/constants/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function AboutScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen
        options={{
          title: "About",
          headerBackTitle: "Settings",
        }}
      />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* App header */}
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons
                name="restaurant-outline"
                size={38}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.appName}>KitchenBuddy</Text>

            <Text style={styles.version}>Version 0.1</Text>

            <Text style={styles.tagline}>
              A smarter way to keep track of your food.
            </Text>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About KitchenBuddy</Text>

            <View style={styles.card}>
              <View style={styles.aboutContent}>
                <Text style={styles.aboutText}>
                  KitchenBuddy helps you keep track of the food you already
                  have, reduce waste, and make better use of your groceries.
                </Text>

                <Text style={styles.aboutText}>
                  Scan grocery receipts to add food to your pantry, keep track
                  of expiration dates, receive reminders, and discover recipe
                  ideas using the ingredients you have available.
                </Text>

                <Text style={styles.aboutText}>
                  KitchenBuddy is still being developed and will continue
                  improving as new features are added.
                </Text>
              </View>
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What KitchenBuddy Does</Text>

            <View style={styles.card}>
              <FeatureRow
                icon="scan-outline"
                title="Receipt Scanning"
                description="Turn grocery receipts into pantry items."
              />

              <View style={styles.divider} />

              <FeatureRow
                icon="basket-outline"
                title="Smart Pantry"
                description="Keep your groceries organized in one place."
              />

              <View style={styles.divider} />

              <FeatureRow
                icon="calendar-outline"
                title="Expiration Tracking"
                description="Keep track of food before it goes bad."
              />

              <View style={styles.divider} />

              <FeatureRow
                icon="notifications-outline"
                title="Expiry Reminders"
                description="Get reminders when food is approaching its expiration date."
              />

              <View style={styles.divider} />

              <FeatureRow
                icon="restaurant-outline"
                title="Recipe Ideas"
                description="Find ways to use food already in your pantry."
              />

              <View style={styles.divider} />

              <FeatureRow
                icon="sparkles-outline"
                title="Smart Recognition"
                description="Automatically clean up and understand receipt item names."
              />
            </View>
          </View>

          {/* Important information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Important Information</Text>

            <View style={styles.card}>
              <InfoRow
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                subtitle="Learn how KitchenBuddy handles your data"
                onPress={() => router.push("/settings/privacy-policy")}
              />

              <View style={styles.divider} />

              <InfoRow
                icon="document-text-outline"
                title="Terms of Use"
                subtitle="Terms for using KitchenBuddy"
                onPress={() => router.push("/settings/terms-of-use")}
              />

              <View style={styles.divider} />

              <InfoRow
                icon="information-circle-outline"
                title="Food & Expiration Information"
                subtitle="About KitchenBuddy's food estimates"
                onPress={() => router.push("/settings/food-expiration-info")}
              />

              <View style={styles.divider} />

              <InfoRow
                icon="sparkles-outline"
                title="AI & Automated Results"
                subtitle="About automatic food recognition"
                onPress={() => router.push("/settings/ai-automated-results")}
              />
            </View>
          </View>

          {/* Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>

            <View style={styles.card}>
              <InfoRow
                icon="mail-outline"
                title="Contact"
                subtitle="Get in touch with KitchenBuddy"
                onPress={() => router.push("/settings/contact-support")}
              />

              <View style={styles.divider} />

              <InfoRow
                icon="chatbubble-ellipses-outline"
                title="Send Feedback"
                subtitle="Help make KitchenBuddy better"
                onPress={() => router.push("/settings/send-feedback")}
              />

              <View style={styles.divider} />

              <InfoRow
                icon="heart-outline"
                title="Acknowledgements"
                subtitle="Services and technology used by KitchenBuddy"
                onPress={() =>
                  Alert.alert(
                    "Acknowledgements",
                    "KitchenBuddy uses third-party services and open-source software to provide certain features.\n\nA complete acknowledgements list will be added before release.",
                  )
                }
              />
            </View>
          </View>

          {/* Development status */}
          <View style={styles.developmentCard}>
            <Ionicons
              name="construct-outline"
              size={22}
              color={Colors.primary}
            />

            <View style={styles.developmentText}>
              <Text style={styles.developmentTitle}>
                KitchenBuddy is in development
              </Text>

              <Text style={styles.developmentDescription}>
                Features, appearance, and functionality may change as the app
                continues to improve.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>KitchenBuddy v0.1</Text>
        </ScrollView>
      </View>
    </>
  );
}

type FeatureRowProps = {
  icon: IoniconName;
  title: string;
  description: string;
};

function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={21} color={Colors.primary} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{description}</Text>
      </View>
    </View>
  );
}

type InfoRowProps = {
  icon: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function InfoRow({ icon, title, subtitle, onPress }: InfoRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={21} color={Colors.primary} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#888" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  hero: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 26,
  },

  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    marginBottom: 14,
  },

  appName: {
    fontSize: 27,
    fontWeight: "700",
    color: "#222",
  },

  version: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },

  tagline: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginLeft: 4,
    marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    overflow: "hidden",
  },

  aboutContent: {
    padding: 16,
  },

  aboutText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555",
    marginBottom: 12,
  },

  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  rowPressed: {
    backgroundColor: "rgba(0,0,0,0.025)",
  },

  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(80, 140, 90, 0.08)",
    marginRight: 12,
  },

  rowText: {
    flex: 1,
    paddingRight: 8,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 3,
  },

  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#777",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5e5",
    marginLeft: 64,
  },

  developmentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.07)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 24,
  },

  developmentText: {
    flex: 1,
    marginLeft: 12,
  },

  developmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },

  developmentDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
  },

  footer: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 12,
  },
});
