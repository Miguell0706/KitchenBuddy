/**
 * KitchenBuddy — Default Expiry by Category, editorial edition.
 * Replace mobile/app/settings/category-settings.tsx with this file.
 * Preserves useSettingsStore persistence, validation and per-category fallback behavior.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
const P = {
  ivory: "#F5F2EC",
  paper: "#FFFEFA",
  fog: "#F1EFEB",
  slate: "#586D77",
  deepSlate: "#445A64",
  charcoal: "#2E2E2E",
  muted: "#79736F",
  taupe: "#786450",
  line: "#E3DED7",
  pale: "#F3E5D0",
};
const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

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
    // Empty input cancels the draft; only the explicit button selects No expiry.
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
    if (currentValue !== days) setExpiryOverride(key, days);
  };

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={P.slate} />
        <Text style={styles.loadingText}>Loading your expiry settings…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>PANTRY PREFERENCES</Text>
          <Text style={styles.title}>Default expiry{`\n`}by category.</Text>
          <Text style={styles.introText}>
            A thoughtful fallback for the foods you bring home.
          </Text>
        </View>

        <View style={styles.explainer}>
          <View style={styles.explainerIcon}>
            <Ionicons name="calendar-outline" size={23} color={P.pale} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.explainerTitle}>How these defaults work</Text>
            <Text style={styles.explainerText}>
              KitchenBuddy first tries to recommend an expiry date for each
              scanned item. When it cannot, the category setting below is used
              instead.
            </Text>
            <Text style={styles.explainerFoot}>
              Saved on this device · Existing pantry dates won't change
            </Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Your categories</Text>
          <Text style={styles.listCaption}>Changes save when editing ends</Text>
        </View>

        {CATEGORIES.map((cat) => {
          const defaultVal = CATEGORY_DEFAULT_EXPIRY[cat.key];
          const override = expiryOverrides[cat.key];
          const effective = override ?? defaultVal;
          const isOverridden = override !== undefined;
          const noExpiry = effective === "none" || effective == null;
          const draft = drafts[cat.key];
          const displayValue =
            draft !== undefined ? draft : noExpiry ? "" : String(effective);

          return (
            <View key={cat.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.categoryIcon}>
                  <Ionicons name={cat.icon} size={21} color={P.deepSlate} />
                </View>
                <View style={styles.categoryText}>
                  <Text style={styles.categoryTitle}>{cat.label}</Text>
                  <Text style={styles.categoryDefault}>
                    KitchenBuddy default:{" "}
                    {defaultVal === "none"
                      ? "No automatic expiry"
                      : `${defaultVal} days`}
                  </Text>
                </View>
                {isOverridden ? (
                  <View style={styles.customTag}>
                    <Text style={styles.customTagText}>Custom</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>FALLBACK EXPIRY</Text>
              <View style={styles.inputLine}>
                <View
                  style={[styles.inputShell, noExpiry && styles.inputShellNone]}
                >
                  <TextInput
                    keyboardType="number-pad"
                    returnKeyType="done"
                    style={styles.input}
                    value={displayValue}
                    placeholder={
                      defaultVal === "none" ? "No expiry" : String(defaultVal)
                    }
                    placeholderTextColor={P.muted}
                    onChangeText={(value) => changeDraft(cat.key, value)}
                    onEndEditing={() => saveDraft(cat.key, effective)}
                    maxLength={5}
                    selectTextOnFocus
                    accessibilityLabel={`${cat.label} fallback expiry in days`}
                  />
                  <Text style={styles.unit}>
                    {noExpiry && draft === undefined ? "disabled" : "days"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Disable automatic fallback expiry for ${cat.label}`}
                  accessibilityState={{ selected: noExpiry }}
                  onPress={() => {
                    clearDraft(cat.key);
                    setExpiryOverride(cat.key, "none");
                  }}
                  style={({ pressed }) => [
                    styles.noExpiryButton,
                    noExpiry && styles.noExpiryActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={
                      noExpiry ? "checkmark-circle" : "close-circle-outline"
                    }
                    color={noExpiry ? P.paper : P.deepSlate}
                    size={17}
                  />
                  <Text
                    style={[
                      styles.noExpiryText,
                      noExpiry && styles.noExpiryTextActive,
                    ]}
                  >
                    No expiry
                  </Text>
                </Pressable>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.helper}>
                  Enter 1–{MAX_EXPIRY_DAYS} whole days.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reset ${cat.label} to KitchenBuddy default`}
                  onPress={() => {
                    clearDraft(cat.key);
                    resetExpiryOverride(cat.key);
                  }}
                  style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={14}
                    color={P.deepSlate}
                  />
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.bottomNote}>
          <Ionicons
            name="information-circle-outline"
            size={19}
            color={P.taupe}
          />
          <Text style={styles.bottomNoteText}>
            These dates are estimates, not a guarantee of freshness or food
            safety. Always check the product label and condition of your food.
          </Text>
        </View>
        <Text style={styles.footer}>
          KITCHENBUDDY · A LITTLE MORE ORGANIZED
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.ivory },
  loadingContainer: {
    flex: 1,
    backgroundColor: P.ivory,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: P.muted, fontSize: 14 },
  content: { paddingHorizontal: 19, paddingTop: 19, paddingBottom: 54 },
  intro: { paddingHorizontal: 5, paddingBottom: 20 },
  eyebrow: {
    color: P.taupe,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.1,
    marginBottom: 9,
  },
  title: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, color: P.charcoal },
  introText: { color: P.muted, fontSize: 14, lineHeight: 21, marginTop: 9 },
  explainer: {
    backgroundColor: P.slate,
    borderRadius: 23,
    padding: 20,
    flexDirection: "row",
    gap: 14,
    marginBottom: 26,
  },
  explainerIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.11)",
    alignItems: "center",
    justifyContent: "center",
  },
  explainerTitle: {
    color: P.paper,
    fontFamily: SERIF,
    fontSize: 21,
    marginBottom: 7,
  },
  explainerText: { color: "#F0EFEB", fontSize: 13, lineHeight: 20 },
  explainerFoot: { color: P.pale, fontSize: 11, marginTop: 11, lineHeight: 16 },
  listHeader: {
    paddingHorizontal: 4,
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  listTitle: { fontFamily: SERIF, fontSize: 25, color: P.charcoal },
  listCaption: { fontSize: 11, color: P.muted },
  card: {
    backgroundColor: P.paper,
    borderRadius: 22,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: P.line,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: P.fog,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: { flex: 1, minWidth: 0 },
  categoryTitle: { color: P.charcoal, fontSize: 16, fontWeight: "700" },
  categoryDefault: {
    fontSize: 11,
    lineHeight: 16,
    color: P.muted,
    marginTop: 3,
  },
  customTag: {
    backgroundColor: P.pale,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  customTagText: { color: P.taupe, fontSize: 10, fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: P.line,
    marginTop: 14,
    marginBottom: 14,
  },
  fieldLabel: {
    color: P.taupe,
    letterSpacing: 1.2,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
  },
  inputLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  inputShell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    backgroundColor: P.fog,
    borderWidth: 1,
    borderColor: P.line,
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  inputShellNone: { backgroundColor: "#F5F3EF" },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: "600",
    color: P.charcoal,
  },
  unit: { color: P.muted, fontSize: 12, marginLeft: 5 },
  noExpiryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: P.fog,
    borderRadius: 12,
    minHeight: 47,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: P.line,
  },
  noExpiryActive: { backgroundColor: P.slate, borderColor: P.slate },
  noExpiryText: { color: P.deepSlate, fontSize: 12, fontWeight: "700" },
  noExpiryTextActive: { color: P.paper },
  cardBottom: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  helper: { flex: 1, fontSize: 11, color: P.muted, lineHeight: 16 },
  resetButton: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  resetText: { color: P.deepSlate, fontWeight: "700", fontSize: 12 },
  pressed: { opacity: 0.66 },
  bottomNote: {
    marginTop: 8,
    borderRadius: 17,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: "#EBE5DB",
  },
  bottomNoteText: { flex: 1, color: P.taupe, fontSize: 12, lineHeight: 18 },
  footer: {
    textAlign: "center",
    color: P.muted,
    fontSize: 10,
    letterSpacing: 1.1,
    marginTop: 26,
  },
});
