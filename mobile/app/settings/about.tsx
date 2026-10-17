import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// Matches the ivory / slate-blue / taupe KitchenBuddy Grocery and Settings redesign.
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

export default function AboutScreen() {
  const router = useRouter();
  const [acknowledgementsVisible, setAcknowledgementsVisible] = useState(false);

  return (
    <>
      <Stack.Screen
        options={{
          title: "About",
          headerBackTitle: "Settings",
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
              <View style={styles.logo}>
                <Ionicons name="restaurant-outline" size={29} color={C.slate} />
              </View>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>VERSION 0.1</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>A LITTLE MORE ABOUT US</Text>
            <Text style={styles.appName}>KitchenBuddy.</Text>
            <Text style={styles.tagline}>
              A smarter, simpler way to care for the food in your kitchen.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons name="leaf-outline" size={17} color={C.cream} />
              <Text style={styles.heroBottomText}>
                Less waste. More good food.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>OUR PURPOSE</Text>
            <Text style={styles.sectionTitle}>A little help, every day.</Text>
            <View style={styles.card}>
              <Text style={styles.aboutText}>
                KitchenBuddy helps you keep track of the food you already have,
                reduce waste, and make better use of your groceries.
              </Text>
              <Text style={styles.aboutText}>
                Scan grocery receipts to add food to your pantry, keep track of
                expiration dates, receive reminders, and discover recipe ideas
                using the ingredients you have available.
              </Text>
              <Text style={[styles.aboutText, styles.lastParagraph]}>
                KitchenBuddy is still being developed and will continue
                improving as new features are added.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>THE EVERYDAY ESSENTIALS</Text>
            <Text style={styles.sectionTitle}>What KitchenBuddy does</Text>
            <View style={styles.card}>
              <FeatureRow
                icon="scan-outline"
                title="Receipt Scanning"
                description="Turn grocery receipts into pantry items."
              />
              <Divider />
              <FeatureRow
                icon="basket-outline"
                title="Smart Pantry"
                description="Keep your groceries organized in one place."
              />
              <Divider />
              <FeatureRow
                icon="calendar-outline"
                title="Expiration Tracking"
                description="Keep track of food before it goes bad."
              />
              <Divider />
              <FeatureRow
                icon="notifications-outline"
                title="Expiry Reminders"
                description="Get reminders when food is approaching its expiration date."
              />
              <Divider />
              <FeatureRow
                icon="restaurant-outline"
                title="Recipe Ideas"
                description="Find ways to use food already in your pantry."
              />
              <Divider />
              <FeatureRow
                icon="sparkles-outline"
                title="Smart Recognition"
                description="Automatically clean up and understand receipt item names."
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>GOOD TO KNOW</Text>
            <Text style={styles.sectionTitle}>Important information</Text>
            <View style={styles.card}>
              <InfoRow
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                subtitle="Learn how KitchenBuddy handles your data"
                onPress={() => router.push("/settings/privacy-policy")}
              />
              <Divider />
              <InfoRow
                icon="document-text-outline"
                title="Terms of Use"
                subtitle="Terms for using KitchenBuddy"
                onPress={() => router.push("/settings/terms-of-use")}
              />
              <Divider />
              <InfoRow
                icon="information-circle-outline"
                title="Food & Expiration Information"
                subtitle="About KitchenBuddy's food estimates"
                onPress={() => router.push("/settings/food-expiration-info")}
              />
              <Divider />
              <InfoRow
                icon="sparkles-outline"
                title="AI & Automated Results"
                subtitle="About automatic food recognition"
                onPress={() => router.push("/settings/ai-automated-results")}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>WE'RE HERE TO HELP</Text>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.card}>
              <InfoRow
                icon="mail-outline"
                title="Contact"
                subtitle="Get in touch with KitchenBuddy"
                onPress={() => router.push("/settings/contact-support")}
              />
              <Divider />
              <InfoRow
                icon="chatbubble-ellipses-outline"
                title="Send Feedback"
                subtitle="Help make KitchenBuddy better"
                onPress={() => router.push("/settings/send-feedback")}
              />
              <Divider />
              <InfoRow
                icon="heart-outline"
                title="Acknowledgements"
                subtitle="Services and technology used by KitchenBuddy"
                onPress={() => setAcknowledgementsVisible(true)}
              />
            </View>
          </View>

          <View style={styles.developmentCard}>
            <View style={styles.developmentIcon}>
              <Ionicons name="construct-outline" size={20} color={C.slate} />
            </View>
            <View style={styles.developmentText}>
              <Text style={styles.developmentTitle}>Growing with you</Text>
              <Text style={styles.developmentDescription}>
                KitchenBuddy is in development. Features, appearance, and
                functionality may change as the app continues to improve.
              </Text>
            </View>
          </View>
          <Text style={styles.footer}>Made with care · KitchenBuddy v0.1</Text>
        </ScrollView>
      </View>

      <Modal
        visible={acknowledgementsVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setAcknowledgementsVisible(false)}
      >
        <View style={styles.dialogRoot}>
          <Pressable
            style={styles.dialogScrim}
            onPress={() => setAcknowledgementsVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close acknowledgements"
          />
          <View style={styles.dialogSheet}>
            <View style={styles.dialogGrabber} />
            <View style={styles.dialogHeader}>
              <View style={styles.dialogIcon}>
                <Ionicons name="heart-outline" size={23} color={C.slateDark} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close acknowledgements"
                onPress={() => setAcknowledgementsVisible(false)}
                style={styles.dialogClose}
              >
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>
            <Text style={styles.dialogEyebrow}>WITH APPRECIATION</Text>
            <Text style={styles.dialogTitle}>Acknowledgements</Text>
            <Text style={styles.dialogDescription}>
              KitchenBuddy uses third-party services and open-source software to
              provide certain features.
            </Text>
            <View style={styles.dialogNotice}>
              <Ionicons
                name="information-circle-outline"
                size={19}
                color={C.slate}
              />
              <Text style={styles.dialogNoticeText}>
                A complete acknowledgements list will be added before release.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAcknowledgementsVisible(false)}
              style={({ pressed }) => [
                styles.dialogButton,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.dialogButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

type FeatureRowProps = {
  icon: IoniconName;
  title: string;
  description: string;
};

function Divider() {
  return <View style={styles.divider} />;
}

function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.slate} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{description}</Text>
      </View>
    </View>
  );
}

type InfoRowProps = FeatureRowProps & { onPress: () => void; subtitle: string };

function InfoRow({
  icon,
  title,
  subtitle,
  onPress,
}: Omit<InfoRowProps, "description">) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.slate} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={C.muted} />
    </Pressable>
  );
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
    marginBottom: 32,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  logo: {
    width: 57,
    height: 57,
    backgroundColor: C.ivory,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  versionPill: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  versionPillText: {
    color: C.ivory,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  heroEyebrow: {
    color: C.cream,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 8,
  },
  appName: {
    color: C.paper,
    fontSize: 38,
    lineHeight: 45,
    fontFamily: "serif",
    marginBottom: 8,
  },
  tagline: { color: "#F0EFEB", fontSize: 15, lineHeight: 23, maxWidth: 275 },
  heroBottom: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.19)",
    paddingTop: 16,
    marginTop: 24,
  },
  heroBottomText: { color: C.cream, fontSize: 12, letterSpacing: 0.3 },
  section: { marginBottom: 29 },
  sectionEyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginLeft: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 27,
    fontFamily: "serif",
    marginLeft: 3,
    marginBottom: 13,
  },
  card: {
    backgroundColor: C.paper,
    borderRadius: 23,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 23,
    color: "#585E5C",
    marginHorizontal: 8,
    marginTop: 9,
    marginBottom: 9,
  },
  lastParagraph: { marginBottom: 12 },
  row: {
    minHeight: 73,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  rowPressed: { backgroundColor: C.row, borderRadius: 14 },
  rowIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: C.row,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },
  rowText: { flex: 1, paddingRight: 7 },
  rowTitle: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  rowSubtitle: { color: C.muted, fontSize: 12, lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 65,
    marginRight: 8,
  },
  developmentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.taupe,
    borderRadius: 21,
    padding: 18,
    marginBottom: 28,
  },
  developmentIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  developmentText: { flex: 1 },
  developmentTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },
  developmentDescription: { color: "#666B68", fontSize: 12, lineHeight: 19 },
  footer: {
    color: "#94918A",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dialogRoot: { flex: 1, justifyContent: "flex-end" },
  dialogScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,36,38,0.48)",
  },
  dialogSheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 23,
    paddingTop: 11,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: C.border,
  },
  dialogGrabber: {
    width: 39,
    height: 4,
    borderRadius: 3,
    backgroundColor: C.taupe,
    alignSelf: "center",
    marginBottom: 20,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 19,
  },
  dialogIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    backgroundColor: C.row,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogClose: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogEyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  dialogTitle: {
    color: C.ink,
    fontFamily: "serif",
    fontSize: 29,
    marginBottom: 12,
  },
  dialogDescription: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  dialogNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.background,
    borderRadius: 15,
    padding: 14,
    marginBottom: 21,
  },
  dialogNoticeText: {
    color: C.slateDark,
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
  },
  dialogButton: {
    backgroundColor: C.slate,
    minHeight: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogButtonText: { color: C.paper, fontSize: 14, fontWeight: "800" },
});
