import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/theme";

export default function TermsOfUseScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Terms of Use",
          headerBackTitle: "About",
        }}
      />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="document-text-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>Terms of Use</Text>

            <Text style={styles.updated}>Last updated: October 6, 2026</Text>

            <Text style={styles.intro}>
              These Terms of Use describe the rules and conditions for using
              KitchenBuddy.
            </Text>
          </View>

          <TermsSection title="1. Acceptance of These Terms">
            <Paragraph>
              By using KitchenBuddy, you agree to these Terms of Use. If you do
              not agree with these terms, you should not use the app.
            </Paragraph>

            <Paragraph>
              These terms may be updated as KitchenBuddy develops and new
              features or services are introduced.
            </Paragraph>
          </TermsSection>

          <TermsSection title="2. About KitchenBuddy">
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

          <TermsSection title="3. Receipt Scanning and Automated Results">
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

          <TermsSection title="4. Food and Expiration Information">
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

          <TermsSection title="5. Recipe Information">
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

          <TermsSection title="6. Notifications and Reminders">
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

          <TermsSection title="7. Your Responsibilities">
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

          <TermsSection title="8. Third-Party Services">
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

          <TermsSection title="9. Availability and Changes">
            <Paragraph>
              KitchenBuddy is under active development. Features may be added,
              modified, limited, suspended, or removed as the app develops.
            </Paragraph>

            <Paragraph>
              KitchenBuddy does not guarantee that every feature will always be
              available, uninterrupted, or free from errors.
            </Paragraph>
          </TermsSection>

          <TermsSection title="10. Intellectual Property">
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

          <TermsSection title="11. Disclaimer of Warranties">
            <Paragraph>
              KitchenBuddy is provided on an "as is" and "as available" basis to
              the extent permitted by applicable law.
            </Paragraph>

            <Paragraph>
              No guarantee is made that KitchenBuddy will always be accurate,
              complete, available, secure, or error-free.
            </Paragraph>
          </TermsSection>

          <TermsSection title="12. Limitation of Liability">
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

          <TermsSection title="13. Changes to These Terms">
            <Paragraph>
              These Terms of Use may be updated when KitchenBuddy's features,
              services, or legal requirements change.
            </Paragraph>

            <Paragraph>
              The date displayed at the top of this page will be updated when
              material changes are made.
            </Paragraph>
          </TermsSection>

          <TermsSection title="14. Contact">
            <Paragraph>
              If you have questions about these Terms of Use, you can contact
              KitchenBuddy through the Contact Support option available in the
              app.
            </Paragraph>
          </TermsSection>

          <View style={styles.notice}>
            <Ionicons
              name="construct-outline"
              size={20}
              color={Colors.primary}
            />

            <Text style={styles.noticeText}>
              KitchenBuddy is currently in development. These terms may be
              revised as the app's features and services are finalized.
            </Text>
          </View>

          <Text style={styles.footer}>KitchenBuddy Terms of Use</Text>
        </ScrollView>
      </View>
    </>
  );
}

type TermsSectionProps = {
  title: string;
  children: React.ReactNode;
};

function TermsSection({ title, children }: TermsSectionProps) {
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
