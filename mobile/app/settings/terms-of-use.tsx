import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Consistent with KitchenBuddy's redesigned Settings / About information pages.
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

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TermsOfUseScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Terms of Use",
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
                <Ionicons
                  name="document-text-outline"
                  size={29}
                  color={C.slate}
                />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>THOUGHTFULLY MADE</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>KITCHENBUDDY · THE AGREEMENT</Text>
            <Text style={styles.heroTitle}>
              The important details, made clear.
            </Text>
            <Text style={styles.heroSubtitle}>
              These Terms of Use describe the rules and conditions for using
              KitchenBuddy.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons name="calendar-outline" size={17} color={C.cream} />
              <Text style={styles.heroBottomText}>
                Last updated: October 6, 2026
              </Text>
            </View>
          </View>

          <TermsSection
            eyebrow="AGREEMENT"
            title="1. Acceptance of These Terms"
            icon="checkmark-circle-outline"
          >
            <Paragraph>
              By using KitchenBuddy, you agree to these Terms of Use. If you do
              not agree with these terms, you should not use the app.
            </Paragraph>
            <Paragraph>
              These terms may be updated as KitchenBuddy develops and new
              features or services are introduced.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="THE APP"
            title="2. About KitchenBuddy"
            icon="restaurant-outline"
          >
            <Paragraph>
              KitchenBuddy is designed to help users organize groceries, manage
              pantry items, track estimated expiration dates, receive reminders,
              and discover recipe ideas.
            </Paragraph>
            <Paragraph>
              Some KitchenBuddy features use automated systems and artificial
              intelligence to interpret receipt information and provide
              estimates or suggestions.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="AUTOMATION"
            title="3. Receipt Scanning and Automated Results"
            icon="scan-outline"
          >
            <Paragraph>
              KitchenBuddy may use receipt scanning, text recognition, automated
              processing, and artificial intelligence to identify grocery items
              and organize information.
            </Paragraph>
            <Paragraph>
              Automated results are not guaranteed to be accurate. Item names,
              categories, quantities, storage types, expiration estimates, and
              other automatically generated information may contain errors.
            </Paragraph>
            <Paragraph>
              You are responsible for reviewing information produced by the app
              and correcting it when necessary.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="FOOD INFORMATION"
            title="4. Food and Expiration Information"
            icon="calendar-outline"
          >
            <Paragraph>
              Expiration dates, storage recommendations, and other food
              information provided by KitchenBuddy may be estimates based on
              typical food characteristics and storage conditions.
            </Paragraph>
            <Paragraph>
              KitchenBuddy does not guarantee that food is safe to eat until an
              estimated expiration date or unsafe after that date.
            </Paragraph>
            <Paragraph>
              Always inspect food before consuming it and follow packaging,
              manufacturer instructions, storage requirements, recalls, and
              applicable food-safety guidance.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="RECIPE CONTENT"
            title="5. Recipe Information"
            icon="book-outline"
          >
            <Paragraph>
              Recipes and recipe-related information may come from third-party
              services or automated systems.
            </Paragraph>
            <Paragraph>
              You are responsible for checking ingredients, preparation
              instructions, cooking requirements, dietary restrictions,
              allergies, and other relevant information before preparing or
              consuming food.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="REMINDERS"
            title="6. Notifications and Reminders"
            icon="notifications-outline"
          >
            <Paragraph>
              KitchenBuddy may provide optional reminders, including
              notifications related to estimated food expiration dates.
            </Paragraph>
            <Paragraph>
              Notifications may be delayed, missed, disabled, or otherwise
              unavailable because of device settings, operating system behavior,
              technical problems, or other circumstances.
            </Paragraph>
            <Paragraph>
              Notifications should not be relied upon as the sole method of
              determining food freshness or safety.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="YOUR ROLE"
            title="7. Your Responsibilities"
            icon="person-outline"
          >
            <Paragraph>
              You agree to use KitchenBuddy responsibly and only for lawful
              purposes.
            </Paragraph>
            <Paragraph>
              You are responsible for the information you enter into the app,
              decisions you make using information provided by KitchenBuddy, and
              maintaining appropriate security for your device and account if
              account features are provided.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="EXTERNAL SERVICES"
            title="8. Third-Party Services"
            icon="cloud-outline"
          >
            <Paragraph>
              KitchenBuddy may rely on third-party services to provide features
              such as cloud hosting, artificial intelligence, recipes, email
              delivery, and other technical functionality.
            </Paragraph>
            <Paragraph>
              Third-party services may be governed by their own terms, policies,
              availability, and limitations. KitchenBuddy is not responsible for
              services operated independently by third parties.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="DEVELOPMENT"
            title="9. Availability and Changes"
            icon="construct-outline"
          >
            <Paragraph>
              KitchenBuddy is under active development. Features may be added,
              modified, limited, suspended, or removed as the app develops.
            </Paragraph>
            <Paragraph>
              KitchenBuddy does not guarantee that every feature will always be
              available, uninterrupted, or free from errors.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="OWNERSHIP"
            title="10. Intellectual Property"
            icon="ribbon-outline"
          >
            <Paragraph>
              KitchenBuddy's original software, branding, interface, graphics,
              and other original content are protected by applicable
              intellectual property laws.
            </Paragraph>
            <Paragraph>
              Third-party names, content, software, recipes, trademarks, and
              other materials remain the property of their respective owners.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="WARRANTIES"
            title="11. Disclaimer of Warranties"
            icon="alert-circle-outline"
          >
            <Paragraph>
              KitchenBuddy is provided on an "as is" and "as available" basis to
              the extent permitted by applicable law.
            </Paragraph>
            <Paragraph>
              No guarantee is made that KitchenBuddy will always be accurate,
              complete, available, secure, or error-free.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="LIABILITY"
            title="12. Limitation of Liability"
            icon="shield-outline"
          >
            <Paragraph>
              To the extent permitted by applicable law, KitchenBuddy and its
              operators will not be liable for indirect, incidental,
              consequential, special, or similar damages resulting from use of
              or inability to use the app.
            </Paragraph>
            <Paragraph>
              This includes decisions made based on automated results,
              expiration estimates, recipe information, reminders, or other
              information provided through KitchenBuddy.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="UPDATES"
            title="13. Changes to These Terms"
            icon="refresh-outline"
          >
            <Paragraph>
              These Terms of Use may be updated when KitchenBuddy's features,
              services, or legal requirements change.
            </Paragraph>
            <Paragraph>
              The date displayed at the top of this page will be updated when
              material changes are made.
            </Paragraph>
          </TermsSection>

          <TermsSection
            eyebrow="QUESTIONS"
            title="14. Contact"
            icon="mail-outline"
          >
            <Paragraph>
              If you have questions about these Terms of Use, you can contact
              KitchenBuddy through the Contact Support option available in the
              app.
            </Paragraph>
          </TermsSection>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Ionicons name="construct-outline" size={21} color={C.slate} />
            </View>
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>A note while we build</Text>
              <Text style={styles.noticeText}>
                KitchenBuddy is currently in development. These terms may be
                revised as the app's features and services are finalized.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>KitchenBuddy Terms of Use</Text>
        </ScrollView>
      </View>
    </>
  );
}

type TermsSectionProps = {
  eyebrow: string;
  title: string;
  icon: IconName;
  children: React.ReactNode;
};

function TermsSection({ eyebrow, title, icon, children }: TermsSectionProps) {
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
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 62 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 27,
    paddingHorizontal: 23,
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
    gap: 8,
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
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  heroEyebrow: {
    color: C.cream,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
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
  heroBottomText: { color: C.cream, fontSize: 12, flex: 1, lineHeight: 18 },
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
    fontSize: 23,
    lineHeight: 29,
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
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.taupe,
    borderRadius: 21,
    padding: 18,
    marginTop: 3,
    marginBottom: 28,
  },
  noticeIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  noticeBody: { flex: 1 },
  noticeTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },
  noticeText: { color: "#666B68", fontSize: 12, lineHeight: 19 },
  footer: {
    color: "#94918A",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 0.25,
  },
});
