import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Shared visual language with KitchenBuddy's redesigned About and Settings pages.
const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  row: "#F2F0EC",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  ivory: "#F8F4ED",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function AIAutomatedResultsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "AI & Automated Results",
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
                <Ionicons name="sparkles-outline" size={29} color={C.slate} />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>GOOD TO KNOW</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>BEHIND THE EVERYDAY MAGIC</Text>
            <Text style={styles.heroTitle}>
              A little help, thoughtfully automated.
            </Text>
            <Text style={styles.heroSubtitle}>
              How KitchenBuddy uses automated systems to make managing your
              groceries easier.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={C.cream}
              />
              <Text style={styles.heroBottomText}>
                You stay in control of your pantry.
              </Text>
            </View>
          </View>

          <InfoSection
            eyebrow="THE BASICS"
            title="How KitchenBuddy uses automation"
            icon="hardware-chip-outline"
          >
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

          <InfoSection
            eyebrow="SCANNING"
            title="Receipt recognition"
            icon="scan-outline"
          >
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

          <InfoSection
            eyebrow="ORGANIZATION"
            title="Food classification"
            icon="grid-outline"
          >
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

          <InfoSection
            eyebrow="FRESHNESS"
            title="Expiration estimates"
            icon="calendar-outline"
          >
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

          <InfoSection
            eyebrow="INSPIRATION"
            title="Recipe features"
            icon="restaurant-outline"
          >
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

          <InfoSection
            eyebrow="LIMITATIONS"
            title="Automated results can be wrong"
            icon="alert-circle-outline"
          >
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

          <InfoSection
            eyebrow="YOUR CHOICE"
            title="You can correct results"
            icon="create-outline"
          >
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

          <InfoSection
            eyebrow="IMPROVEMENT"
            title="Learning from corrections"
            icon="refresh-outline"
          >
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

          <InfoSection
            eyebrow="DATA & SERVICES"
            title="Third-party processing"
            icon="shield-checkmark-outline"
          >
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

          <InfoSection
            eyebrow="OUR APPROACH"
            title="AI is an assistant"
            icon="people-outline"
          >
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
            <View style={styles.noticeIcon}>
              <Ionicons name="sparkles-outline" size={22} color={C.slate} />
            </View>
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
          <Text style={styles.footer}>
            Made with care · KitchenBuddy AI & Automated Results
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
  heroBottomText: { color: C.cream, fontSize: 12, letterSpacing: 0.2, flex: 1 },
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
  noticeTextContainer: { flex: 1 },
  noticeTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
    lineHeight: 20,
  },
  noticeText: { color: "#666B68", fontSize: 12, lineHeight: 19 },
  footer: {
    color: "#94918A",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 0.25,
  },
});
