import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors, Spacing } from "@/constants/theme";

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

    if (!query) {
      return HELP_SECTIONS;
    }

    return HELP_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const searchableText = [item.title, item.description, ...item.content]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      }),
    })).filter((section) => section.items.length > 0);
  }, [search]);

  const hasResults = filteredSections.some(
    (section) => section.items.length > 0,
  );

  function toggleItem(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleContactSupport() {
    router.push("/settings/contact-support");
  }

  function handleReportProblem() {
    router.push("/settings/report-problem");
  }

  function handleFeedback() {
    router.push("/settings/send-feedback");
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Help & Support",
          headerBackTitle: "Settings",
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="help-circle-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>How can we help?</Text>

            <Text style={styles.subtitle}>
              Find answers about scanning, your pantry, recipes, notifications,
              and more.
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#777" />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search help"
              placeholderTextColor="#999"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!!search && (
              <Pressable onPress={() => setSearch("")} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </Pressable>
            )}
          </View>

          {!hasResults ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={34} color="#999" />

              <Text style={styles.emptyTitle}>No help topics found</Text>

              <Text style={styles.emptyText}>
                Try searching for something else.
              </Text>
            </View>
          ) : (
            filteredSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>

                <View style={styles.card}>
                  {section.items.map((item, index) => {
                    const expanded = expandedId === item.id;
                    const isLast = index === section.items.length - 1;

                    return (
                      <View key={item.id}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.row,
                            pressed && styles.rowPressed,
                          ]}
                          onPress={() => toggleItem(item.id)}
                        >
                          <View style={styles.rowIcon}>
                            <Ionicons
                              name={item.icon}
                              size={21}
                              color={Colors.primary}
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
                            color="#888"
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

                        {!isLast && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {!search && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Still need help?</Text>

                <View style={styles.card}>
                  <ActionRow
                    icon="bug-outline"
                    title="Report a Problem"
                    subtitle="Tell us when something isn't working"
                    onPress={handleReportProblem}
                  />

                  <View style={styles.divider} />

                  <ActionRow
                    icon="chatbubble-ellipses-outline"
                    title="Send Feedback"
                    subtitle="Suggest an improvement or new feature"
                    onPress={handleFeedback}
                  />

                  <View style={styles.divider} />

                  <ActionRow
                    icon="mail-outline"
                    title="Contact Support"
                    subtitle="Get help with KitchenBuddy"
                    onPress={handleContactSupport}
                  />
                </View>
              </View>

              <Text style={styles.footer}>KitchenBuddy Help & Support</Text>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

type ActionRowProps = {
  icon: IoniconName;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ActionRow({ icon, title, subtitle, onPress }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={21} color={Colors.primary} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#888" />
    </Pressable>
  );
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
    paddingBottom: 18,
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
    marginBottom: 6,
  },

  subtitle: {
    maxWidth: 340,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
  },

  searchContainer: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 22,
  },

  searchInput: {
    flex: 1,
    marginLeft: 9,
    fontSize: 15,
    color: "#222",
    paddingVertical: 10,
  },

  section: {
    marginBottom: 22,
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
    overflow: "hidden",
  },

  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  rowPressed: {
    backgroundColor: "rgba(0,0,0,0.025)",
  },

  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(80, 140, 90, 0.08)",
    marginRight: 12,
  },

  rowText: {
    flex: 1,
    paddingRight: 8,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 3,
  },

  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#777",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e5e5",
    marginLeft: 64,
  },

  answer: {
    paddingLeft: 64,
    paddingRight: 18,
    paddingTop: 2,
    paddingBottom: 14,
  },

  answerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
  },

  bullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    marginTop: 7,
    marginRight: 9,
  },

  answerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#555",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
  },

  emptyText: {
    fontSize: 13,
    color: "#777",
    marginTop: 5,
  },

  footer: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
});
