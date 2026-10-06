import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/theme";

export default function AIAutomatedResultsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "AI & Automated Results",
          headerBackTitle: "About",
        }}
      />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="sparkles-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>AI & Automated Results</Text>

            <Text style={styles.subtitle}>
              How KitchenBuddy uses automated systems to make managing your
              groceries easier.
            </Text>
          </View>

          <InfoSection title="How KitchenBuddy Uses Automation">
            <Paragraph>
              KitchenBuddy uses automated systems and artificial intelligence to
              reduce the amount of information you need to enter manually.
            </Paragraph>

            <Paragraph>
              These systems can help interpret grocery receipt text, recognize
              food items, clean up item names, organize pantry items, and
              estimate certain food information.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Receipt Recognition">
            <Paragraph>
              Grocery receipts often contain abbreviated, shortened, or unusual
              product names. KitchenBuddy may automatically interpret this text
              to determine what product was purchased.
            </Paragraph>

            <Paragraph>
              For example, receipt text may be cleaned up or converted into a
              more understandable food name before it is added to your pantry.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Food Classification">
            <Paragraph>
              KitchenBuddy may automatically determine whether scanned text
              represents a food item and may organize recognized foods into
              categories.
            </Paragraph>

            <Paragraph>
              It may also estimate information such as the appropriate storage
              type or a useful name for recipe searches.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Expiration Estimates">
            <Paragraph>
              Automated systems may help estimate how long certain foods
              typically last based on the recognized food and expected storage
              conditions.
            </Paragraph>

            <Paragraph>
              These results are estimates and should not be treated as
              guarantees of freshness or food safety.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Recipe Features">
            <Paragraph>
              KitchenBuddy may use food names and pantry information to help
              search for or recommend recipe ideas.
            </Paragraph>

            <Paragraph>
              Recipe results may also depend on information provided by
              third-party services and may not perfectly match the food you have
              available.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Automated Results Can Be Wrong">
            <Paragraph>
              Artificial intelligence and automated recognition systems are not
              perfect. KitchenBuddy may occasionally misunderstand receipt text,
              identify the wrong food, choose the wrong category, or provide an
              inaccurate estimate.
            </Paragraph>

            <Paragraph>
              Unclear, damaged, abbreviated, or unusual receipt text can make
              automated recognition more difficult.
            </Paragraph>
          </InfoSection>

          <InfoSection title="You Can Correct Results">
            <Paragraph>
              KitchenBuddy is designed to allow you to review and correct
              automatically generated information when something is wrong.
            </Paragraph>

            <Paragraph>
              You should review important information such as food names,
              storage information, and expiration dates rather than assuming
              every automated result is correct.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Learning From Corrections">
            <Paragraph>
              KitchenBuddy may use saved corrections to recognize the same or
              similar receipt items more accurately when they are encountered
              again.
            </Paragraph>

            <Paragraph>
              This can reduce repeated corrections and make receipt scanning
              more useful over time.
            </Paragraph>
          </InfoSection>

          <InfoSection title="Third-Party Processing">
            <Paragraph>
              Some automated features may rely on third-party technology or
              service providers. Information necessary to perform a feature may
              be processed by those services.
            </Paragraph>

            <Paragraph>
              More information about how data is handled is available in
              KitchenBuddy's Privacy Policy.
            </Paragraph>
          </InfoSection>

          <InfoSection title="AI Is an Assistant">
            <Paragraph>
              KitchenBuddy uses automation to make grocery management faster and
              more convenient, but automated results are intended to assist you
              rather than replace your judgment.
            </Paragraph>

            <Paragraph>
              When information is important, especially information involving
              food safety, you should verify it using the product label,
              manufacturer instructions, or appropriate food-safety guidance.
            </Paragraph>
          </InfoSection>

          <View style={styles.notice}>
            <Ionicons
              name="sparkles-outline"
              size={21}
              color={Colors.primary}
            />

            <View style={styles.noticeTextContainer}>
              <Text style={styles.noticeTitle}>
                Automated results are suggestions
              </Text>

              <Text style={styles.noticeText}>
                KitchenBuddy's AI and automated systems are designed to save
                time, but they can make mistakes. Review important information
                before relying on it.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>KitchenBuddy AI & Automated Results</Text>
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

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.07)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 24,
  },

  noticeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },

  noticeText: {
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
