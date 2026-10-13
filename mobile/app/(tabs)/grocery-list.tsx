import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { usePremium } from "@/context/PremiumContext";
import { Colors, Spacing } from "@/constants/theme";
import {
  ButtonStyles,
  CardStyles,
  Layout,
  TextStyles,
} from "@/constants/styles";
import {
  getPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";
import { loadPantry } from "@/features/pantry/storage";
import type { PantryItem } from "@/features/pantry/types";
import {
  getPantryRepurchaseStats,
  getPantryLifecycles,
} from "@/features/pantry/analytics";
import {
  GROCERY_STORAGE_KEY as STORAGE_KEY,
  type GroceryItem,
  isGroceryItem,
  ingredientKey,
} from "@/features/grocery/groceryIngredients";
type Suggestion = {
  name: string;
  reason: string;
  priority: number;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function GroceryListScreen() {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const router = useRouter();
  const [text, setText] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [history, setHistory] = useState<PantryHistoryEntry[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Read the list when the screen opens, and refresh pantry-based suggestions.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        try {
          // Grocery list is free. Only Premium loads recommendation inputs.
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const premiumData =
            isPremium && !premiumLoading
              ? await Promise.all([getPantryHistory(), loadPantry()])
              : null;
          if (!active) return;
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            setItems(Array.isArray(parsed) ? parsed.filter(isGroceryItem) : []);
          } else {
            setItems([]);
          }

          setHistory(premiumData ? premiumData[0] : []);
          setPantryItems(
            premiumData
              ? (Object.values(premiumData[1]).flat() as PantryItem[])
              : [],
          );
        } catch (error) {
          console.warn("Unable to load grocery list", error);
          if (active)
            Alert.alert(
              "Loading error",
              "Some grocery information could not be loaded.",
            );
        } finally {
          if (active) setLoading(false);
        }
      }

      void load();
      return () => {
        active = false;
      };
    }, [isPremium, premiumLoading]),
  );

  // Persist each change before reflecting it in the list. This avoids an
  // initial empty state accidentally overwriting a previously saved list.
  const updateItems = useCallback(
    async (updater: (previous: GroceryItem[]) => GroceryItem[]) => {
      if (loading || saving) return;
      setSaving(true);
      try {
        // Read the latest stored list to keep sequential actions consistent.
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const previous = Array.isArray(parsed)
          ? parsed.filter(isGroceryItem)
          : [];
        const next = updater(previous);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setItems(next);
      } catch (error) {
        console.warn("Unable to save grocery list", error);
        Alert.alert(
          "Save failed",
          "Your grocery list change could not be saved. Please try again.",
        );
      } finally {
        setSaving(false);
      }
    },
    [loading, saving],
  );

  // Manual entries are free text: save exactly what the user types (apart from outer whitespace).
  const addByName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || loading || saving) return;
      void updateItems((previous) => [
        {
          id: uid(),
          name: trimmed,
          checked: false, // Kept for compatibility with the existing GroceryItem type.
          createdAt: Date.now(),
        },
        ...previous,
      ]);
      setText("");
    },
    [loading, saving, updateItems],
  );

  const toggle = (id: string) => {
    void updateItems((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const remove = (id: string) => {
    void updateItems((previous) => previous.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    if (loading || saving || items.length === 0) return;
    Alert.alert(
      "Clear entire grocery list?",
      "Delete every item? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void updateItems(() => []);
          },
        },
      ],
    );
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const clearChecked = () => {
    if (loading || saving || checkedCount === 0) return;
    Alert.alert(
      "Clear checked items?",
      `Delete ${checkedCount} checked item${checkedCount === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear checked",
          style: "destructive",
          onPress: () => {
            void updateItems((previous) =>
              previous.filter((item) => !item.checked),
            );
          },
        },
      ],
    );
  };

  const suggestions = useMemo((): Suggestion[] => {
    if (!isPremium || premiumLoading || loading || history.length === 0)
      return [];
    const listNames = new Set(items.map((item) => ingredientKey(item.name)));
    const pantryNames = new Set<string>();
    for (const item of pantryItems) {
      pantryNames.add(ingredientKey(item.name));
      if (item.recipeSearchName)
        pantryNames.add(ingredientKey(item.recipeSearchName));
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const recentUseWindow = 14 * dayMs;
    // Reuse the existing analytics lifecycle calculation. A removed/corrected
    // item is not counted as either consumed or wasted.
    const outcomes = new Map<string, { used: number; expired: number }>();
    for (const lifecycle of getPantryLifecycles(history)) {
      const key = ingredientKey(lifecycle.name);
      if (!key) continue;
      const current = outcomes.get(key) ?? { used: 0, expired: 0 };
      if (lifecycle.outcome === "used") current.used += 1;
      if (lifecycle.outcome === "expired") current.expired += 1;
      outcomes.set(key, current);
    }

    const lastUsed = new Map<string, number>();
    for (const event of history) {
      if (event.action !== "used") continue;
      const key = ingredientKey(event.recipeSearchName || event.name);
      if (!key) continue;
      lastUsed.set(key, Math.max(lastUsed.get(key) ?? 0, event.at));
    }

    const result: Suggestion[] = [];
    const seen = new Set<string>();
    for (const entry of getPantryRepurchaseStats(history)) {
      const name = entry.name?.trim();
      if (!name) continue;
      const key = ingredientKey(name);
      if (!key || seen.has(key) || listNames.has(key) || pantryNames.has(key))
        continue;
      seen.add(key);
      const counts = outcomes.get(key) ?? { used: 0, expired: 0 };
      const resolved = counts.used + counts.expired;
      const wasteRate = resolved > 0 ? counts.expired / resolved : 0;
      const frequentWaste =
        resolved >= 3 && counts.expired >= 2 && wasteRate >= 0.4;
      const usedAt = lastUsed.get(key);
      const recentlyUsed =
        usedAt != null && usedAt <= now && now - usedAt <= recentUseWindow;
      // One-off items should not become suggestions just because they were used.
      if (entry.timesEntered < 2 && counts.used < 2) continue;
      const interval = entry.typicalDaysBetween ?? entry.averageDaysBetween;
      const elapsed =
        entry.lastEnteredAt != null
          ? (now - entry.lastEnteredAt) / dayMs
          : null;
      const due =
        interval != null &&
        interval > 0 &&
        elapsed != null &&
        elapsed >= interval;
      const frequentlyAdded =
        entry.timesEntered >= 3 && elapsed != null && elapsed >= 3;
      if (!due && !recentlyUsed && !frequentlyAdded) continue;
      let priority =
        due && interval != null && elapsed != null
          ? elapsed / interval
          : recentlyUsed
            ? 0.9
            : 0.5;
      let reason =
        due && interval != null
          ? `Usually added about every ${Math.round(interval)} days · Not in pantry`
          : recentlyUsed
            ? "Recently used · Not currently in pantry"
            : "Frequently added · Not currently in pantry";
      if (recentlyUsed && due) reason = `Recently used · ${reason}`;
      if (frequentWaste) {
        // Don't suppress the information; simply avoid pushing frequently
        // wasted food above stronger restock candidates.
        priority *= 0.35;
        reason += " · Often expires; consider buying less";
      }
      result.push({ name, reason, priority });
    }

    return result.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [history, pantryItems, items, loading, isPremium, premiumLoading]);
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[Layout.rowBetween, { marginBottom: Spacing.md }]}>
          <View>
            <Text style={TextStyles.screenTitle}>Grocery List</Text>
            <Text style={TextStyles.bodyMuted}>
              {loading
                ? "Loading..."
                : `${items.length} item${items.length === 1 ? "" : "s"}${saving ? " · Saving..." : ""}`}
            </Text>
          </View>
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.06)",
            }}
          >
            <Text style={TextStyles.small}>Smart List</Text>
          </View>
        </View>
        <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
          <Text style={TextStyles.sectionTitle}>Add item</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g., Eggs"
              placeholderTextColor={Colors.textLight}
              returnKeyType="done"
              onSubmitEditing={() => addByName(text)}
              editable={!loading && !saving}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.05)",
                color: Colors.text,
              }}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => addByName(text)}
              disabled={loading || saving}
              style={[
                ButtonStyles.primary,
                {
                  paddingHorizontal: 14,
                  justifyContent: "center",
                  opacity: loading || saving ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={18} color={Colors.background} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
          <View style={[Layout.rowBetween, { marginBottom: Spacing.sm }]}>
            <View style={[Layout.row, { alignItems: "center", gap: 8 }]}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={TextStyles.sectionTitle}>Smart Suggestions</Text>
            </View>
          </View>
          <Text style={[TextStyles.small, { marginBottom: Spacing.sm }]}>
            Based on your pantry history. Nothing is added automatically.
          </Text>
          {premiumLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : !isPremium ? (
            <View
              style={{ alignItems: "center", paddingVertical: 14, gap: 10 }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={27}
                color={Colors.primary}
              />
              <Text style={[TextStyles.bodyMuted, { textAlign: "center" }]}>
                Unlock personalized restock suggestions based on your pantry
                habits with KitchenBuddy Premium.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Unlock KitchenBuddy Premium"
                onPress={() => router.push("/settings/premium")}
                style={[
                  ButtonStyles.primary,
                  {
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 12,
                    marginTop: 4,
                  },
                ]}
              >
                <Text style={{ color: Colors.background, fontWeight: "700" }}>
                  Unlock Premium
                </Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : suggestions.length === 0 ? (
            <Text style={TextStyles.bodyMuted}>
              No restock suggestions yet. As you track purchases and pantry use,
              suggestions will appear here.
            </Text>
          ) : (
            suggestions.map((suggestion) => (
              <View
                key={ingredientKey(suggestion.name)}
                style={[Layout.rowBetween, { paddingVertical: 10, gap: 12 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={TextStyles.body}>{suggestion.name}</Text>
                  <Text style={TextStyles.small}>{suggestion.reason}</Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel={`Add ${suggestion.name} to grocery list`}
                  onPress={() => addByName(suggestion.name)}
                  disabled={loading || saving}
                  style={{ padding: 8, opacity: saving ? 0.5 : 1 }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={25}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
          <View style={[Layout.rowBetween, { gap: 8 }]}>
            <Text style={TextStyles.sectionTitle}>Items</Text>
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={clearChecked}
                disabled={loading || saving || checkedCount === 0}
                accessibilityLabel="Clear checked grocery items"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(0,0,0,0.05)",
                  opacity: loading || saving || checkedCount === 0 ? 0.5 : 1,
                }}
              >
                <Text style={TextStyles.small}>Clear checked</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={clearAll}
                disabled={loading || saving || items.length === 0}
                accessibilityLabel="Clear all grocery items"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(0,0,0,0.05)",
                  opacity: loading || saving || items.length === 0 ? 0.5 : 1,
                }}
              >
                <Text style={TextStyles.small}>Clear all</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ marginTop: Spacing.sm }}>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : items.length === 0 ? (
              <Text style={TextStyles.bodyMuted}>
                Your list is empty. Add something above.
              </Text>
            ) : (
              items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    Layout.rowBetween,
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: "rgba(0,0,0,0.05)",
                      gap: 8,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: item.checked,
                      disabled: saving,
                    }}
                    accessibilityLabel={`Mark ${item.name} as ${item.checked ? "not purchased" : "purchased"}`}
                    onPress={() => toggle(item.id)}
                    disabled={saving}
                    style={[
                      Layout.row,
                      { flex: 1, alignItems: "center", gap: 10 },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.checked ? "checkmark-circle" : "ellipse-outline"
                      }
                      size={20}
                      color={item.checked ? Colors.primary : Colors.textLight}
                    />
                    <Text
                      style={[
                        TextStyles.body,
                        { flex: 1 },
                        item.checked
                          ? {
                              opacity: 0.55,
                              textDecorationLine: "line-through",
                            }
                          : null,
                      ]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                  <TouchableOpacity
                    onPress={() => remove(item.id)}
                    disabled={saving}
                    activeOpacity={0.8}
                    accessibilityLabel={`Remove ${item.name}`}
                    style={{
                      padding: 8,
                      borderRadius: 999,
                      backgroundColor: "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Colors.text}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
