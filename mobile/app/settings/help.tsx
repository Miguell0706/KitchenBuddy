import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Shared KitchenBuddy editorial palette.
const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  row: "#F2F0EC",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type HelpItem = {
  id: string;

  title: string;

  description: string;

  icon: IoniconName;

  content: string[];
};

type HelpSection = {
  title: string;

  items: HelpItem[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Using KitchenBuddy",

    items: [
      {
        id: "getting-started",

        title: "Getting Started",

        description: "Learn the basics of KitchenBuddy",

        icon: "rocket-outline",

        content: [
          "Scan a grocery receipt to quickly add purchased food to your pantry.",

          "Review the scanned items before saving and correct anything KitchenBuddy did not recognize correctly.",

          "KitchenBuddy organizes saved food in your pantry and can estimate expiration dates.",

          "Use expiry reminders to help keep track of food before it goes bad.",

          "You can also use pantry items to find recipe ideas.",
        ],
      },

      {
        id: "scanning",

        title: "Scanning Receipts",

        description: "Tips for accurate receipt scans",

        icon: "scan-outline",

        content: [
          "Keep the entire receipt visible and make sure the text is in focus.",

          "Use good lighting and avoid strong shadows or glare across the receipt.",

          "Try to keep the receipt as flat and straight as possible.",

          "KitchenBuddy automatically removes many prices, totals, store information, and other receipt details.",

          "Always review the results before saving. Receipt abbreviations and damaged text can sometimes cause an item to be recognized incorrectly.",
        ],
      },

      {
        id: "scan-corrections",

        title: "Correcting Scan Results",

        description: "Fix items KitchenBuddy gets wrong",

        icon: "create-outline",

        content: [
          "You can edit scanned items before adding them to your pantry.",

          "Correct the item name, category, storage information, or expiration information when necessary.",

          "KitchenBuddy may use saved corrections to better handle the same receipt item when it appears again.",

          "If an item is not food or was scanned accidentally, remove it before saving.",
        ],
      },

      {
        id: "pantry",

        title: "Pantry & Expiration Dates",

        description: "Manage food and expiry information",

        icon: "basket-outline",

        content: [
          "Your pantry contains the food items you have saved in KitchenBuddy.",

          "KitchenBuddy may estimate an expiration date based on the type of food and how it is normally stored.",

          "Estimated expiration dates are not the same as manufacturer expiration or safety dates.",

          "You can change an expiration date if the package provides a more accurate date.",

          "When you finish an item, mark it as used. You can also delete items you no longer want to track.",
        ],
      },

      {
        id: "recipes",

        title: "Recipes",

        description: "Find ideas using pantry food",

        icon: "restaurant-outline",

        content: [
          "KitchenBuddy can suggest recipes based on food in your pantry.",

          "When viewing expiring items, select the foods you are interested in using.",

          "Recipe availability and matching can vary depending on the ingredient and available recipe data.",

          "Always check the full recipe and ingredient list before cooking.",
        ],
      },

      {
        id: "notifications",

        title: "Notifications",

        description: "Expiry reminders and notification settings",

        icon: "notifications-outline",

        content: [
          "KitchenBuddy can schedule reminders before tracked food reaches its expiration date.",

          "Reminder timing can be changed from Settings.",

          "Notifications must also be allowed in your device's system settings.",

          "If reminders stop appearing, verify that KitchenBuddy still has notification permission.",
        ],
      },
    ],
  },

  {
    title: "Problems & Questions",

    items: [
      {
        id: "scan-problems",

        title: "Receipt Isn't Scanning Correctly",

        description: "Fix common scanning problems",

        icon: "camera-outline",

        content: [
          "Make sure the receipt is clearly visible and the text is readable.",

          "Move to an area with better lighting if the receipt is blurry or dark.",

          "Avoid folding or covering product descriptions.",

          "If only a few products are wrong, correct them from the review screen instead of rescanning the entire receipt.",

          "Receipt formats vary between stores, so some receipts may require more corrections than others.",
        ],
      },

      {
        id: "missing-items",

        title: "An Item Is Missing",

        description: "What to do when food isn't detected",

        icon: "help-circle-outline",

        content: [
          "KitchenBuddy filters receipt text before identifying food products.",

          "Occasionally a valid product may not be recognized.",

          "Try rescanning the receipt if several items are missing.",

          "You can manually add missing food to your pantry when necessary.",
        ],
      },

      {
        id: "wrong-expiry",

        title: "Expiration Date Looks Wrong",

        description: "Understanding estimated expiry dates",

        icon: "calendar-outline",

        content: [
          "Some expiration dates are estimates rather than dates read directly from packaging.",

          "Storage conditions, whether a package has been opened, and the exact product can change how long food lasts.",

          "If you know the correct date, edit the pantry item and replace the estimate.",

          "Do not rely on KitchenBuddy alone to determine whether food is safe to eat.",
        ],
      },

      {
        id: "notification-problems",

        title: "Notifications Aren't Working",

        description: "Troubleshoot missing reminders",

        icon: "notifications-off-outline",

        content: [
          "Make sure expiry reminders are enabled inside KitchenBuddy.",

          "Check your device settings and confirm KitchenBuddy has permission to send notifications.",

          "Verify that the pantry item has an expiration date.",

          "If notification permissions were recently changed, reopening KitchenBuddy may help refresh scheduled reminders.",
        ],
      },

      {
        id: "recipe-problems",

        title: "Recipe Search Isn't Working",

        description: "Troubleshoot recipe results",

        icon: "restaurant-outline",

        content: [
          "Recipe searches require an internet connection.",

          "Some ingredients may have fewer matching recipes than others.",

          "Try selecting a different pantry ingredient if no useful recipes appear.",

          "Temporary recipe service problems can also prevent results from loading.",
        ],
      },
    ],
  },

  {
    title: "Privacy & Information",

    items: [
      {
        id: "privacy",

        title: "Privacy & Data",

        description: "How KitchenBuddy uses app data",

        icon: "shield-checkmark-outline",

        content: [
          "KitchenBuddy uses information you provide to power features such as pantry management, receipt scanning, and recipe suggestions.",

          "Receipt information may be processed to identify purchased food and remove unrelated receipt text.",

          "Some features may use external services to process information or provide results.",

          "More detailed information should be provided in KitchenBuddy's Privacy Policy before public release.",
        ],
      },

      {
        id: "accuracy",

        title: "AI & Accuracy",

        description: "Understanding automatic suggestions",

        icon: "sparkles-outline",

        content: [
          "KitchenBuddy uses automated systems to help interpret receipt text and food information.",

          "Automatic results can be incorrect, especially when receipt text is abbreviated, blurry, or incomplete.",

          "Review important information before saving it.",

          "Expiration estimates and food classifications should be treated as helpful suggestions rather than guarantees.",
        ],
      },

      {
        id: "premium",

        title: "Premium",

        description: "Information about upcoming features",

        icon: "star-outline",

        content: [
          "KitchenBuddy Premium is still being developed.",

          "Premium features and pricing may change before subscriptions become available.",

          "More information will appear in the app when Premium is ready.",
        ],
      },
    ],
  },
];

export default function HelpScreen() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return HELP_SECTIONS;
    return HELP_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        [item.title, item.description, ...item.content]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    })).filter((section) => section.items.length > 0);
  }, [search]);

  const hasResults = filteredSections.some(
    (section) => section.items.length > 0,
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Help & Support",
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons
                  name="help-circle-outline"
                  size={29}
                  color={C.slate}
                />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>HERE TO HELP</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>KITCHENBUDDY SUPPORT</Text>
            <Text style={styles.heroTitle}>
              A little help, whenever you need it.
            </Text>
            <Text style={styles.heroSubtitle}>
              Find answers about scanning, your pantry, recipes, notifications,
              and more.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons name="book-outline" size={17} color={C.cream} />
              <Text style={styles.heroBottomText}>
                Browse the guide or search for a quick answer.
              </Text>
            </View>
          </View>

          <View style={styles.searchCard}>
            <Text style={styles.searchEyebrow}>FIND AN ANSWER</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={C.slate} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search help topics..."
                placeholderTextColor="#9C9D98"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search help topics"
              />
              {!!search && (
                <Pressable
                  onPress={() => setSearch("")}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Clear help search"
                >
                  <Ionicons name="close-circle" size={20} color={C.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {!hasResults ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={27} color={C.slate} />
              </View>
              <Text style={styles.emptyTitle}>No help topics found</Text>
              <Text style={styles.emptyText}>
                Try searching for something else.
              </Text>
              <Pressable
                onPress={() => setSearch("")}
                style={styles.clearSearch}
              >
                <Text style={styles.clearSearchText}>Clear search</Text>
              </Pressable>
            </View>
          ) : (
            filteredSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionEyebrow}>
                  {section.title === "Using KitchenBuddy"
                    ? "YOUR GUIDE"
                    : section.title === "Problems & Questions"
                      ? "MORE ANSWERS"
                      : "USEFUL INFORMATION"}
                </Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.card}>
                  {section.items.map((item, index) => {
                    const expanded = expandedId === item.id;
                    return (
                      <View key={item.id}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.row,
                            expanded && styles.rowExpanded,
                            pressed && styles.rowPressed,
                          ]}
                          onPress={() =>
                            setExpandedId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          accessibilityLabel={`${item.title}. ${item.description}`}
                        >
                          <View style={styles.rowIcon}>
                            <Ionicons
                              name={item.icon}
                              size={21}
                              color={C.slate}
                            />
                          </View>
                          <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{item.title}</Text>
                            <Text style={styles.rowSubtitle}>
                              {item.description}
                            </Text>
                          </View>
                          <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={C.slate}
                          />
                        </Pressable>
                        {expanded && (
                          <View style={styles.answer}>
                            {item.content.map((paragraph, paragraphIndex) => (
                              <View
                                key={paragraphIndex}
                                style={styles.answerRow}
                              >
                                <View style={styles.bullet} />
                                <Text style={styles.answerText}>
                                  {paragraph}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {index !== section.items.length - 1 && (
                          <View style={styles.divider} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {!search && (
            <View style={styles.supportPanel}>
              <Text style={styles.supportEyebrow}>STILL NEED A HAND?</Text>
              <Text style={styles.supportTitle}>We're here to help.</Text>
              <Text style={styles.supportSubtitle}>
                Have a question, found something that isn't working, or have an
                idea? Reach out below.
              </Text>
              <ActionRow
                icon="bug-outline"
                title="Report a Problem"
                subtitle="Tell us when something isn't working"
                onPress={() => router.push("/settings/report-problem")}
              />
              <ActionRow
                icon="chatbubble-ellipses-outline"
                title="Send Feedback"
                subtitle="Suggest an improvement or new feature"
                onPress={() => router.push("/settings/send-feedback")}
              />
              <ActionRow
                icon="mail-outline"
                title="Contact Support"
                subtitle="Get help with KitchenBuddy"
                onPress={() => router.push("/settings/contact-support")}
                last
              />
            </View>
          )}
          <Text style={styles.footer}>KitchenBuddy Help & Support</Text>
        </ScrollView>
      </View>
    </>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        !last && styles.actionDivider,
        pressed && styles.actionPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={21} color={C.slate} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 55 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 27,
    padding: 22,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 99,
  },
  heroPillText: {
    color: C.cream,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  heroEyebrow: {
    color: C.cream,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 39,
    fontFamily: "serif",
    color: C.paper,
    maxWidth: 310,
  },
  heroSubtitle: {
    color: "#E7E8E4",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  heroBottom: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.19)",
    marginTop: 21,
    paddingTop: 15,
  },
  heroBottomText: { color: C.cream, flex: 1, fontSize: 12, lineHeight: 18 },
  searchCard: {
    backgroundColor: C.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 15,
    marginBottom: 27,
  },
  searchEyebrow: {
    color: C.slate,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    marginBottom: 10,
  },
  searchContainer: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: C.row,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.ink, paddingVertical: 10 },
  section: { marginBottom: 27 },
  sectionEyebrow: {
    color: C.slate,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
    marginLeft: 3,
    marginBottom: 7,
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 31,
    color: C.ink,
    marginLeft: 2,
    marginBottom: 13,
  },
  card: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 75,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
  },
  rowExpanded: { backgroundColor: "#F7F5F1" },
  rowPressed: { backgroundColor: C.row },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  rowSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 67,
    marginRight: 15,
  },
  answer: {
    paddingHorizontal: 17,
    paddingTop: 1,
    paddingBottom: 17,
    backgroundColor: "#F7F5F1",
  },
  answerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 99,
    marginTop: 7,
    backgroundColor: C.slate,
  },
  answerText: { color: "#585E5C", fontSize: 13, lineHeight: 20, flex: 1 },
  emptyState: {
    alignItems: "center",
    padding: 30,
    paddingVertical: 35,
    backgroundColor: C.paper,
    borderRadius: 22,
    marginBottom: 25,
    borderColor: C.border,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: C.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: C.ink,
    fontFamily: "serif",
    fontSize: 23,
    marginTop: 13,
  },
  emptyText: { color: C.muted, fontSize: 13, marginTop: 6 },
  clearSearch: {
    paddingHorizontal: 17,
    paddingVertical: 11,
    backgroundColor: C.slate,
    borderRadius: 12,
    marginTop: 19,
  },
  clearSearchText: { color: C.paper, fontWeight: "700", fontSize: 13 },
  supportPanel: {
    backgroundColor: C.taupe,
    borderRadius: 23,
    padding: 17,
    marginTop: 2,
    marginBottom: 25,
  },
  supportEyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  supportTitle: { fontFamily: "serif", fontSize: 27, color: C.ink },
  supportSubtitle: {
    color: "#666B68",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 17,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: C.paper,
    gap: 11,
  },
  actionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  actionPressed: { backgroundColor: C.row },
  actionIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: C.row,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  actionSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 },
  footer: {
    fontSize: 11,
    color: "#94918A",
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
