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

import { Colors } from "@/constants/theme";
import { usePremium } from "@/context/PremiumContext";

export default function PremiumScreen() {
  const router = useRouter();

  const { isPremium, isLoading, activatePremium, deactivatePremium } =
    usePremium();

  async function handlePremium() {
    if (isPremium) {
      Alert.alert("Premium Active", "KitchenBuddy Premium is already active.");
      return;
    }

    try {
      await activatePremium();

      Alert.alert(
        "Premium Activated",
        "KitchenBuddy Premium is now active for testing.",
      );
    } catch (error) {
      console.error("Premium activation error:", error);

      Alert.alert(
        "Couldn't Activate Premium",
        "Something went wrong while activating Premium.",
      );
    }
  }

  async function handleResetPremium() {
    try {
      await deactivatePremium();

      Alert.alert(
        "Premium Reset",
        "KitchenBuddy has been returned to the Free version.",
      );
    } catch (error) {
      console.error("Premium reset error:", error);

      Alert.alert(
        "Couldn't Reset Premium",
        "Something went wrong while resetting Premium.",
      );
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "KitchenBuddy Premium",
          headerBackTitle: "Settings",
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.crown}>
              <Ionicons name="star" size={34} color={Colors.primary} />
            </View>

            <View style={styles.premiumBadge}>
              <Ionicons name="sparkles" size={13} color={Colors.primary} />

              <Text style={styles.premiumBadgeText}>KITCHENBUDDY PREMIUM</Text>
            </View>

            <Text style={styles.title}>
              Get more from the food you already have.
            </Text>

            <Text style={styles.subtitle}>
              Smarter recipes, smarter shopping, and a better understanding of
              your pantry.
            </Text>
          </View>

          {/* Current Premium Status */}
          {!isLoading && (
            <View
              style={[styles.statusCard, isPremium && styles.statusCardPremium]}
            >
              <View
                style={[
                  styles.statusIcon,
                  isPremium && styles.statusIconPremium,
                ]}
              >
                <Ionicons
                  name={isPremium ? "checkmark-circle" : "person-outline"}
                  size={24}
                  color={isPremium ? Colors.primary : "#777"}
                />
              </View>

              <View style={styles.statusContent}>
                <Text style={styles.statusLabel}>CURRENT PLAN</Text>

                <Text style={styles.statusTitle}>
                  {isPremium ? "KitchenBuddy Premium" : "KitchenBuddy Free"}
                </Text>

                <Text style={styles.statusDescription}>
                  {isPremium
                    ? "Premium features are unlocked."
                    : "Upgrade to unlock all Premium features."}
                </Text>
              </View>
            </View>
          )}

          {/* Premium Features */}
          <View style={styles.features}>
            <PremiumFeature
              icon="restaurant-outline"
              title="Advanced Recipes"
              description="Get better recipe ideas built around the food you already have, including ingredients that need to be used soon."
            />

            <PremiumFeature
              icon="cart-outline"
              title="Smart Grocery List"
              description="Build smarter shopping lists using your pantry and recipes, so you know what you have and what you're missing."
            />

            <PremiumFeature
              icon="analytics-outline"
              title="Pantry Analytics"
              description="See useful insights about your pantry, food usage, expiration patterns, and grocery habits over time."
            />
          </View>

          {/* Free Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Everything you already use stays free
            </Text>

            <View style={styles.freeCard}>
              <FreeFeature text="Receipt scanning" />
              <FreeFeature text="Pantry management" />
              <FreeFeature text="Expiration tracking" />
              <FreeFeature text="Expiration reminders" />
              <FreeFeature text="Basic recipe search" />
            </View>
          </View>

          {/* Premium CTA */}
          {!isLoading && !isPremium && (
            <>
              <Pressable
                onPress={handlePremium}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="star" size={18} color="#fff" />

                <Text style={styles.primaryButtonText}>Get Premium</Text>
              </Pressable>

              <Text style={styles.noChargeText}>
                Development mode — no purchase will be made.
              </Text>
            </>
          )}

          {/* Active Premium */}
          {!isLoading && isPremium && (
            <View style={styles.activeCard}>
              <Ionicons
                name="checkmark-circle"
                size={25}
                color={Colors.primary}
              />

              <View style={styles.activeContent}>
                <Text style={styles.activeTitle}>Premium is active</Text>

                <Text style={styles.activeDescription}>
                  Advanced Recipes, Smart Grocery List, and Pantry Analytics are
                  unlocked.
                </Text>
              </View>
            </View>
          )}

          {/* Development Reset */}
          {__DEV__ && !isLoading && isPremium && (
            <Pressable
              onPress={handleResetPremium}
              style={({ pressed }) => [
                styles.resetButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color="#777" />

              <Text style={styles.resetButtonText}>
                Reset Premium for Testing
              </Text>
            </Pressable>
          )}

          {/* Purchase / Legal Links */}
          <View style={styles.purchaseLinks}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Restore Purchase",
                  "Premium subscriptions are not available yet.",
                )
              }
            >
              <Text style={styles.link}>Restore Purchase</Text>
            </Pressable>

            <Text style={styles.dot}>•</Text>

            <Pressable onPress={() => router.push("/settings/terms-of-use")}>
              <Text style={styles.link}>Terms</Text>
            </Pressable>

            <Text style={styles.dot}>•</Text>

            <Pressable onPress={() => router.push("/settings/privacy-policy")}>
              <Text style={styles.link}>Privacy</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

type PremiumFeatureProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

function PremiumFeature({ icon, title, description }: PremiumFeatureProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={25} color={Colors.primary} />
      </View>

      <View style={styles.featureContent}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{title}</Text>

          <View style={styles.premiumPill}>
            <Text style={styles.premiumPillText}>PREMIUM</Text>
          </View>
        </View>

        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function FreeFeature({ text }: { text: string }) {
  return (
    <View style={styles.freeFeature}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={13} color={Colors.primary} />
      </View>

      <Text style={styles.freeFeatureText}>{text}</Text>
    </View>
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
    paddingTop: 18,
    paddingBottom: 28,
  },

  crown: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 14,
  },

  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: Colors.primary,
    marginLeft: 5,
  },

  title: {
    maxWidth: 350,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: "#222",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 21,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    padding: 15,
    marginBottom: 20,
  },

  statusCardPremium: {
    backgroundColor: "rgba(80, 140, 90, 0.06)",
    borderColor: "rgba(80, 140, 90, 0.25)",
  },

  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  statusIconPremium: {
    backgroundColor: "rgba(80, 140, 90, 0.10)",
  },

  statusContent: {
    flex: 1,
  },

  statusLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: "#999",
    marginBottom: 3,
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  statusDescription: {
    fontSize: 12,
    color: "#777",
    marginTop: 3,
  },

  features: {
    gap: 12,
    marginBottom: 30,
  },

  featureCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    padding: 16,
  },

  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(80, 140, 90, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  featureContent: {
    flex: 1,
  },

  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
  },

  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginRight: 8,
  },

  premiumPill: {
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  premiumPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: Colors.primary,
  },

  featureDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666",
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },

  freeCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    padding: 16,
  },

  freeFeature: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },

  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  freeFeatureText: {
    fontSize: 14,
    color: "#444",
  },

  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonPressed: {
    opacity: 0.85,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 8,
  },

  noChargeText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 9,
  },

  activeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.08)",
    borderRadius: 18,
    padding: 16,
  },

  activeContent: {
    flex: 1,
    marginLeft: 12,
  },

  activeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },

  activeDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    marginTop: 4,
  },

  resetButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  resetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#777",
    marginLeft: 7,
  },

  purchaseLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 22,
  },

  link: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: "600",
  },

  dot: {
    color: "#bbb",
    marginHorizontal: 9,
  },
});
