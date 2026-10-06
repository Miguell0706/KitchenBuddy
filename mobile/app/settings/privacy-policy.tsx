import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Privacy Policy",
          headerBackTitle: "About",
        }}
      />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>Privacy Policy</Text>

            <Text style={styles.updated}>Last updated: October 6, 2026</Text>

            <Text style={styles.intro}>
              This Privacy Policy explains how KitchenBuddy handles information
              when you use the app.
            </Text>
          </View>

          <PolicySection title="1. Information You Provide">
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

          <PolicySection title="2. Receipt Scanning and Food Recognition">
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

          <PolicySection title="3. Pantry and Food Information">
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

          <PolicySection title="4. Automated and AI Processing">
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

          <PolicySection title="5. Recipes">
            <Paragraph>
              KitchenBuddy may use pantry item names or food search terms to
              retrieve recipe information from third-party recipe services.
            </Paragraph>

            <Paragraph>
              These services may receive the search information needed to
              provide recipe results.
            </Paragraph>
          </PolicySection>

          <PolicySection title="6. Notifications">
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

          <PolicySection title="7. Support, Feedback, and Problem Reports">
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

          <PolicySection title="8. Service Providers">
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

          <PolicySection title="9. Data Retention">
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

          <PolicySection title="10. Data Security">
            <Paragraph>
              Reasonable technical measures are used to protect information
              processed by KitchenBuddy. However, no method of electronic
              storage or transmission can be guaranteed to be completely secure.
            </Paragraph>
          </PolicySection>

          <PolicySection title="11. Children's Privacy">
            <Paragraph>
              KitchenBuddy is not intended to knowingly collect personal
              information directly from children without appropriate
              authorization. If KitchenBuddy becomes aware that personal
              information from a child has been collected inappropriately,
              reasonable steps may be taken to address the information.
            </Paragraph>
          </PolicySection>

          <PolicySection title="12. Changes to This Policy">
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

          <PolicySection title="13. Contact">
            <Paragraph>
              If you have questions about this Privacy Policy or how
              KitchenBuddy handles information, you can contact KitchenBuddy
              through the Contact Support option available in the app.
            </Paragraph>
          </PolicySection>

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={Colors.primary}
            />

            <Text style={styles.noticeText}>
              KitchenBuddy is currently in development. This policy may be
              updated as the app's features and services change.
            </Text>
          </View>

          <Text style={styles.footer}>KitchenBuddy Privacy Policy</Text>
        </ScrollView>
      </View>
    </>
  );
}

type PolicySectionProps = {
  title: string;
  children: React.ReactNode;
};

function PolicySection({ title, children }: PolicySectionProps) {
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
    fontSize: 24,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },

  updated: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
  },

  intro: {
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
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

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.07)",
    borderRadius: 16,
    padding: 15,
    marginTop: 2,
    marginBottom: 24,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    marginLeft: 10,
  },

  footer: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 12,
  },
});
