import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/theme";

export default function FoodExpirationInfoScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Food & Expiration",
          headerBackTitle: "About",
        }}
      />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="calendar-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>Food & Expiration Information</Text>

            <Text style={styles.subtitle}>
              Understanding the food information and expiration estimates shown
              in KitchenBuddy.
            </Text>
          </View>

          <InfoSection title="Expiration Dates Are Estimates">
            <Paragraph>
              KitchenBuddy may estimate how long a food item is likely to remain
              usable based on information such as the type of food and its
              expected storage conditions.
            </Paragraph>

            <Paragraph>
              These estimates are intended to help you organize your pantry and
              remember which foods may need to be used soon. They are not
              guarantees of freshness or food safety.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Why an Estimate May Be Different">
            <Paragraph>
              The actual shelf life of food can vary depending on factors
              KitchenBuddy may not know, including when the product was
              manufactured or opened, its condition when purchased, storage
              temperature, packaging, handling, and other conditions.
            </Paragraph>

            <Paragraph>
              Because of these differences, an estimated expiration date may be
              earlier or later than the date that applies to your specific
              product.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Receipt Scanning">
            <Paragraph>
              When groceries are added from a receipt, KitchenBuddy may use
              automated recognition to identify the item and determine
              information such as its food category, storage type, and estimated
              shelf life.
            </Paragraph>

            <Paragraph>
              Receipt text can be abbreviated, incomplete, or difficult to
              interpret. This means KitchenBuddy may occasionally identify an
              item incorrectly or assign inaccurate food information.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Check Your Items">
            <Paragraph>
              You should review automatically generated pantry information and
              correct it when necessary, especially when an item was identified
              incorrectly or has a known expiration or best-by date.
            </Paragraph>

            <Paragraph>
              When a manufacturer provides storage instructions or a date on the
              product, that information should generally be considered instead
              of KitchenBuddy's automated estimate.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Storage Matters">
            <Paragraph>
              Food shelf life can change significantly depending on how the food
              is stored. Refrigerated, frozen, opened, and unopened foods may
              have very different storage times.
            </Paragraph>

            <Paragraph>
              If KitchenBuddy assigns the wrong storage type to an item, its
              expiration estimate may also be incorrect.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Expiration Reminders">
            <Paragraph>
              KitchenBuddy can use estimated expiration dates to remind you that
              food may need to be used soon.
            </Paragraph>

            <Paragraph>
              A reminder does not mean that food is definitely spoiled, and the
              absence of a reminder does not mean that food is safe to eat.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Food Safety">
            <Paragraph>
              KitchenBuddy is a pantry organization tool and should not be used
              as the sole source for determining whether food is safe to eat.
            </Paragraph>

            <Paragraph>
              Always inspect food before consuming it and follow product labels,
              manufacturer instructions, storage requirements, recalls, and
              appropriate food-safety guidance.
            </Paragraph>

            <Paragraph>
              If you are uncertain whether a food is safe, do not rely only on
              the expiration estimate shown by KitchenBuddy.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Improving Your Pantry">
            <Paragraph>
              Correcting item names, storage information, and expiration
              information can help keep your KitchenBuddy pantry more accurate.
            </Paragraph>

            <Paragraph>
              KitchenBuddy's automated features are designed to reduce the
              amount of manual entry required, while still allowing you to
              review and correct your food information.
            </Paragraph>
          </InfoSection>

          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color={Colors.primary} />

            <View style={styles.warningText}>
              <Text style={styles.warningTitle}>Important</Text>

              <Text style={styles.warningDescription}>
                KitchenBuddy expiration dates are organizational estimates, not
                food-safety guarantees. When in doubt about the safety of a food
                item, use appropriate food-safety guidance rather than relying
                solely on the app.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>
            KitchenBuddy Food & Expiration Information
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

type InfoSectionProps = {
  title: string;
  children: React.ReactNode;
};

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
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
    paddingTop: 8,
    paddingBottom: 26,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    marginBottom: 12,
  },

  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },

  section: {
    marginBottom: 20,
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
    padding: 16,
  },

  paragraph: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555",
    marginBottom: 12,
  },

  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.07)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 24,
  },

  warningText: {
    flex: 1,
    marginLeft: 12,
  },

  warningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },

  warningDescription: {
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
