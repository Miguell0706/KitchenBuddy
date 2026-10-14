import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  CATEGORIES,
  CATEGORY_DEFAULT_EXPIRY,
} from "@/features/pantry/constants";
import type { CategoryKey } from "@/features/pantry/types";
import { useSettingsStore } from "@/features/settings/store";

const MAX_EXPIRY_DAYS = 3650;

export default function DefaultExpirySettingsScreen() {
  const [hydrated, setHydrated] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<CategoryKey, string>>>(
    {},
  );

  const expiryOverrides = useSettingsStore((s) => s.expiryOverrides);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const setExpiryOverride = useSettingsStore((s) => s.setExpiryOverride);
  const resetExpiryOverride = useSettingsStore((s) => s.resetExpiryOverride);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        await hydrate();
      } catch (error) {
        console.warn("Failed to load expiry settings:", error);
        Alert.alert(
          "Settings unavailable",
          "Your saved expiry settings could not be loaded. Please try opening this screen again.",
        );
      } finally {
        if (active) setHydrated(true);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [hydrate]);

  const changeDraft = (key: CategoryKey, value: string) => {
    setDrafts((previous) => ({ ...previous, [key]: value }));
  };

  const clearDraft = (key: CategoryKey) => {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const saveDraft = (key: CategoryKey, currentValue: number | "none") => {
    const draft = drafts[key];
    if (draft === undefined) return;

    const trimmed = draft.trim();

    // Clearing a text field while editing is not the same as choosing No expiry.
    // To disable expiry, use the explicit No expiry button instead.
    if (!trimmed) {
      clearDraft(key);
      return;
    }

    const days = Number(trimmed);
    if (
      !/^\d+$/.test(trimmed) ||
      !Number.isSafeInteger(days) ||
      days < 1 ||
      days > MAX_EXPIRY_DAYS
    ) {
      clearDraft(key);
      Alert.alert(
        "Invalid expiry value",
        `Enter a whole number from 1 to ${MAX_EXPIRY_DAYS}, or tap No expiry.`,
      );
      return;
    }

    clearDraft(key);
    if (currentValue !== days) {
      setExpiryOverride(key, days);
    }
  };

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Default Expiry by Category</Text>
        <Text style={styles.subtitle}>
          When scanning an item, KitchenBuddy first tries to recommend an expiry
          date. If it cannot determine a recommendation, the category defaults
          below are used as a fallback. These settings are saved on this device
          and do not change expiry dates on items already in your pantry.
        </Text>

        {CATEGORIES.map((cat) => {
          const defaultVal = CATEGORY_DEFAULT_EXPIRY[cat.key];
          const override = expiryOverrides[cat.key];
          const effective = override ?? defaultVal;
          const isOverridden = override !== undefined;
          const draft = drafts[cat.key];
          const displayValue =
            draft !== undefined
              ? draft
              : effective === "none" || effective == null
                ? ""
                : String(effective);

          return (
            <View key={cat.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color="#666"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.cardTitle}>{cat.label}</Text>
                </View>

                {isOverridden && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Customized</Text>
                  </View>
                )}
              </View>

              <Text style={styles.defaultText}>
                KitchenBuddy default:{" "}
                <Text style={styles.defaultStrong}>
                  {defaultVal === "none"
                    ? "No automatic expiry"
                    : `${defaultVal} days`}
                </Text>
              </Text>

              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.label}>Fallback expiry (days)</Text>
                  <TextInput
                    keyboardType="number-pad"
                    returnKeyType="done"
                    style={styles.input}
                    value={displayValue}
                    placeholder={
                      defaultVal === "none" ? "No expiry" : String(defaultVal)
                    }
                    onChangeText={(value) => changeDraft(cat.key, value)}
                    onEndEditing={() => saveDraft(cat.key, effective)}
                    maxLength={5}
                    accessibilityLabel={`${cat.label} fallback expiry in days`}
                  />
                  <Text style={styles.helper}>
                    Enter 1–{MAX_EXPIRY_DAYS} whole days. Changes save when you
                    finish editing. Use No expiry to disable the fallback date.
                  </Text>
                </View>

                <View style={styles.buttonsCol}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      clearDraft(cat.key);
                      setExpiryOverride(cat.key, "none");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Disable automatic fallback expiry for ${cat.label}`}
                  >
                    <Text style={styles.secondaryButtonText}>No expiry</Text>
                  </Pressable>

                  <Pressable
                    style={styles.textButton}
                    onPress={() => {
                      clearDraft(cat.key);
                      resetExpiryOverride(cat.key);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Reset ${cat.label} to KitchenBuddy default`}
                  >
                    <Text style={styles.textButtonText}>Reset to default</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#444",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    color: "#111",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#666",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDD",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EEE",
  },
  badgeText: {
    fontSize: 11,
    color: "#555",
  },
  defaultText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 8,
  },
  defaultStrong: {
    fontWeight: "600",
    color: "#222",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 13,
    color: "#333",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#FFF",
  },
  helper: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: "#777",
  },
  buttonsCol: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CCC",
    marginBottom: 4,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: "#222",
  },
  textButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  textButtonText: {
    fontSize: 13,
    color: "#007AFF",
  },
});
