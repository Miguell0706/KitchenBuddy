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

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Privacy Policy",
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
                  name="shield-checkmark-outline"
                  size={29}
                  color={C.slate}
                />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>YOUR PRIVACY MATTERS</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>
              KITCHENBUDDY · YOUR INFORMATION
            </Text>
            <Text style={styles.heroTitle}>
              A clearer look at your privacy.
            </Text>
            <Text style={styles.heroSubtitle}>
              This Privacy Policy explains how KitchenBuddy handles information
              when you use the app.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons name="calendar-outline" size={17} color={C.cream} />
              <Text style={styles.heroBottomText}>
                Last updated: October 6, 2026
              </Text>
            </View>
          </View>

          <PolicySection
            eyebrow="YOUR INFORMATION"
            title="1. Information You Provide"
            icon="create-outline"
          >
            <Paragraph>
              KitchenBuddy may process information that you provide while using
              the app, including grocery and pantry information, receipt
              information, food names, expiration information, and changes you
              make to scanned items.
            </Paragraph>
            <Paragraph>
              If you contact support, report a problem, or send feedback,
              KitchenBuddy may also process the information you submit, such as
              your email address, selected support category, problem
              description, expected result, or feedback message.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="RECEIPT PROCESSING"
            title="2. Receipt Scanning and Food Recognition"
            icon="scan-outline"
          >
            <Paragraph>
              KitchenBuddy allows you to scan grocery receipts to help identify
              food and add items to your pantry.
            </Paragraph>
            <Paragraph>
              Receipt text and item information may be processed by automated
              systems to clean up item names, determine whether an item is food,
              organize items into categories, and estimate information such as
              storage type and expiration time.
            </Paragraph>
            <Paragraph>
              Automated results may be inaccurate. You should review scanned
              items and make corrections when necessary.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="PANTRY DATA"
            title="3. Pantry and Food Information"
            icon="basket-outline"
          >
            <Paragraph>
              KitchenBuddy may store or process information about the food you
              add to your pantry. This can include item names, categories,
              storage information, expiration dates, and other information
              needed to provide pantry features.
            </Paragraph>
            <Paragraph>
              Some information may be generated automatically from scanned
              receipt text or other information available to KitchenBuddy.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="SMART FEATURES"
            title="4. Automated and AI Processing"
            icon="sparkles-outline"
          >
            <Paragraph>
              KitchenBuddy uses automated systems and artificial intelligence to
              provide certain features. These systems may be used to interpret
              receipt text, recognize grocery items, clean up item names,
              organize pantry items, estimate food information, and assist with
              recipe-related features.
            </Paragraph>
            <Paragraph>
              Information needed to perform these features may be sent to
              service providers that perform processing on behalf of
              KitchenBuddy.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="RECIPE RESULTS"
            title="5. Recipes"
            icon="restaurant-outline"
          >
            <Paragraph>
              KitchenBuddy may use pantry item names or food search terms to
              retrieve recipe information from third-party recipe services.
            </Paragraph>
            <Paragraph>
              These services may receive the search information needed to
              provide recipe results.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="REMINDERS"
            title="6. Notifications"
            icon="notifications-outline"
          >
            <Paragraph>
              If you enable notifications, KitchenBuddy may use pantry and
              expiration information to schedule reminders, such as alerts for
              food approaching its estimated expiration date.
            </Paragraph>
            <Paragraph>
              Notification preferences and scheduled reminders may be stored on
              your device as necessary to provide these features.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="GETTING IN TOUCH"
            title="7. Support, Feedback, and Problem Reports"
            icon="chatbubble-ellipses-outline"
          >
            <Paragraph>
              When you contact KitchenBuddy support, send feedback, or report a
              problem, the information you submit may be sent to KitchenBuddy's
              backend services and email service provider so that the message
              can be received and reviewed.
            </Paragraph>
            <Paragraph>
              If you provide an email address, it may be used to respond to your
              request.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="EXTERNAL SERVICES"
            title="8. Service Providers"
            icon="cloud-outline"
          >
            <Paragraph>
              KitchenBuddy relies on third-party services to provide certain
              functionality. These may include cloud hosting, database,
              artificial intelligence, recipe information, email delivery, and
              other technical services.
            </Paragraph>
            <Paragraph>
              These providers may process information only as needed to provide
              the relevant service, subject to their own terms and privacy
              practices.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="STORAGE & CACHING"
            title="9. Data Retention"
            icon="time-outline"
          >
            <Paragraph>
              Information may be retained for as long as reasonably necessary to
              provide KitchenBuddy's features, maintain the service,
              troubleshoot problems, improve functionality, and comply with
              applicable obligations.
            </Paragraph>
            <Paragraph>
              Some temporary or cached information may be retained to improve
              performance and reduce repeated processing.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="KEEPING DATA SAFE"
            title="10. Data Security"
            icon="lock-closed-outline"
          >
            <Paragraph>
              Reasonable technical measures are used to protect information
              processed by KitchenBuddy. However, no method of electronic
              storage or transmission can be guaranteed to be completely secure.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="YOUNG USERS"
            title="11. Children's Privacy"
            icon="people-outline"
          >
            <Paragraph>
              KitchenBuddy is not intended to knowingly collect personal
              information directly from children without appropriate
              authorization. If KitchenBuddy becomes aware that personal
              information from a child has been collected inappropriately,
              reasonable steps may be taken to address the information.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="POLICY UPDATES"
            title="12. Changes to This Policy"
            icon="refresh-outline"
          >
            <Paragraph>
              This Privacy Policy may be updated as KitchenBuddy changes,
              including when new features, services, or data practices are
              introduced.
            </Paragraph>
            <Paragraph>
              The date at the top of this page will be updated when material
              changes are made.
            </Paragraph>
          </PolicySection>

          <PolicySection
            eyebrow="QUESTIONS"
            title="13. Contact"
            icon="mail-outline"
          >
            <Paragraph>
              If you have questions about this Privacy Policy or how
              KitchenBuddy handles information, you can contact KitchenBuddy
              through the Contact Support option available in the app.
            </Paragraph>
          </PolicySection>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={C.slate}
              />
            </View>
            <View style={styles.noticeBody}>
              <Text style={styles.noticeTitle}>A note while we build</Text>
              <Text style={styles.noticeText}>
                KitchenBuddy is currently in development. This policy may be
                updated as the app's features and services change.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>KitchenBuddy Privacy Policy</Text>
        </ScrollView>
      </View>
    </>
  );
}

type PolicySectionProps = {
  eyebrow: string;
  title: string;
  icon: IconName;
  children: React.ReactNode;
};

function PolicySection({ eyebrow, title, icon, children }: PolicySectionProps) {
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
