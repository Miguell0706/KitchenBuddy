import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// KitchenBuddy's shared editorial palette: ivory, slate-blue, taupe and charcoal.
const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  ivory: "#F8F4ED",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function FoodExpirationInfoScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Food & Expiration",
          headerBackTitle: "About",
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="calendar-outline" size={29} color={C.slate} />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>GOOD TO KNOW</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>UNDERSTANDING YOUR PANTRY</Text>
            <Text style={styles.heroTitle}>
              A thoughtful guide to freshness.
            </Text>
            <Text style={styles.heroSubtitle}>
              Understanding the food information and expiration estimates shown
              in KitchenBuddy.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={C.cream}
              />
              <Text style={styles.heroBottomText}>
                Estimated dates help you plan — they do not guarantee food
                safety.
              </Text>
            </View>
          </View>

          <InfoSection
            eyebrow="THE BASICS"
            title="Expiration dates are estimates"
            icon="calendar-number-outline"
          >
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

          <InfoSection
            eyebrow="WHY DATES VARY"
            title="Why an estimate may be different"
            icon="time-outline"
          >
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

          <InfoSection
            eyebrow="AUTOMATIC RECOGNITION"
            title="Receipt scanning"
            icon="scan-outline"
          >
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

          <InfoSection
            eyebrow="YOUR CONTROL"
            title="Check your items"
            icon="checkmark-circle-outline"
          >
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

          <InfoSection
            eyebrow="KEEPING FOOD WELL"
            title="Storage matters"
            icon="snow-outline"
          >
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

          <InfoSection
            eyebrow="GENTLE NUDGES"
            title="Expiration reminders"
            icon="notifications-outline"
          >
            <Paragraph>
              KitchenBuddy can use estimated expiration dates to remind you that
              food may need to be used soon.
            </Paragraph>
            <Paragraph>
              A reminder does not mean that food is definitely spoiled, and the
              absence of a reminder does not mean that food is safe to eat.
            </Paragraph>
          </InfoSection>

          <InfoSection
            eyebrow="IMPORTANT GUIDANCE"
            title="Food safety"
            icon="shield-checkmark-outline"
          >
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

          <InfoSection
            eyebrow="A BETTER ORGANIZED KITCHEN"
            title="Improving your pantry"
            icon="create-outline"
          >
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
            <View style={styles.warningIcon}>
              <Ionicons name="warning-outline" size={22} color={C.slate} />
            </View>
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
            Made with care · KitchenBuddy Food & Expiration Information
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

type InfoSectionProps = {
  eyebrow: string;
  title: string;
  icon: IoniconName;
  children: React.ReactNode;
};

function InfoSection({ eyebrow, title, icon, children }: InfoSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={19} color={C.slate} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 19, paddingTop: 12, paddingBottom: 55 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 27,
    paddingHorizontal: 25,
    paddingTop: 22,
    paddingBottom: 23,
    marginBottom: 33,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  heroIcon: {
    width: 57,
    height: 57,
    backgroundColor: C.ivory,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: C.ivory,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  heroEyebrow: {
    color: C.cream,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  heroTitle: {
    color: C.paper,
    fontSize: 35,
    lineHeight: 43,
    fontFamily: "serif",
    marginBottom: 10,
  },
  heroSubtitle: { color: "#F0EFEB", fontSize: 14, lineHeight: 22 },
  heroBottom: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.19)",
    paddingTop: 16,
    marginTop: 24,
  },
  heroBottomText: {
    color: C.cream,
    fontSize: 12,
    letterSpacing: 0.2,
    flex: 1,
    lineHeight: 18,
  },
  section: { marginBottom: 27 },
  sectionEyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginLeft: 4,
    marginBottom: 8,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: C.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: C.ink,
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "serif",
  },
  card: {
    backgroundColor: C.paper,
    borderRadius: 23,
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 23,
    color: "#585E5C",
    marginBottom: 14,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.taupe,
    borderRadius: 21,
    padding: 18,
    marginTop: 3,
    marginBottom: 28,
  },
  warningIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  warningText: { flex: 1 },
  warningTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
    lineHeight: 20,
  },
  warningDescription: { color: "#666B68", fontSize: 12, lineHeight: 19 },
  footer: {
    color: "#94918A",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 0.25,
  },
});
