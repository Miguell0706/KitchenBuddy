import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  appendPantryHistory,
  removePantryHistoryEntry,
} from "@/features/pantry/history";
import { usePantryStore } from "@/features/pantry/store";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";
import { Colors, Spacing } from "@/constants/theme";
import { RECIPES_URL } from "@/config/api";
import { useRouter } from "expo-router";
import { useRecipesStore } from "@/features/recipes/store";

type RecipeItem = PantryItem & { categoryKey: CategoryKey };

type UndoState = {
  item: RecipeItem;
  index: number;
  action: "delete" | "used";
  wasSelected: boolean;
  historyEntryId?: string;
} | null;

const ExpiringRecipesScreen: React.FC = () => {
  const params = useLocalSearchParams<{ itemIds?: string }>();
  const rawItemIds = params.itemIds;

  const pantryByCategory = usePantryStore((s) => s.pantry);
  const setPantry = usePantryStore((s) => s.setPantry);

  const router = useRouter();
  const setResults = useRecipesStore((s) => s.setResults);
  const deleteItem = usePantryStore((s) => s.deleteItem);
  const markUsed = usePantryStore((s) => s.markUsed);
  const parsedIds = useMemo(() => {
    if (!rawItemIds) return [];
    try {
      return JSON.parse(rawItemIds) as string[];
    } catch (e) {
      console.log("❌ Failed to parse itemIds param:", rawItemIds, e);
      return [];
    }
  }, [rawItemIds]);

  // add categoryKey so we can mutate pantry correctly*
  const selectedItems: RecipeItem[] = useMemo(() => {
    if (!parsedIds.length) return [];

    const result: RecipeItem[] = [];
    (Object.entries(pantryByCategory) as [CategoryKey, PantryItem[]][]).forEach(
      ([categoryKey, list]) => {
        for (const item of list) {
          if (parsedIds.includes(item.id)) {
            result.push({ ...item, categoryKey });
          }
        }
      },
    );

    return result;
  }, [parsedIds, pantryByCategory]);

  // which of these are included in recipe generation*
  const [recipeItemIds, setRecipeItemIds] = useState<string[]>([]);
  // local undo state*
  const [undo, setUndo] = useState<UndoState>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);

  function toggleRecipeSelection(id: string) {
    setRecipeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleDeleteItem(item: RecipeItem) {
    const list = pantryByCategory[item.categoryKey] ?? [];
    const index = list.findIndex((x) => x.id === item.id);
    const wasSelected = recipeItemIds.includes(item.id);

    // ✅ create history entry you can undo*
    const historyEntryId = await appendPantryHistory(item, "removed");

    if (index !== -1) {
      setUndo({
        item,
        index,
        action: "delete",
        wasSelected,
        historyEntryId,
      });
    }

    // ✅ only delete (do NOT call markUsed here)*
    deleteItem(item.categoryKey, item.id);

    setRecipeItemIds((prev) => prev.filter((x) => x !== item.id));
  }

  async function handleUseItem(item: RecipeItem) {
    const list = pantryByCategory[item.categoryKey] ?? [];
    const index = list.findIndex((x) => x.id === item.id);
    const wasSelected = recipeItemIds.includes(item.id);

    const historyEntryId = await appendPantryHistory(item, "used");

    if (index !== -1) {
      setUndo({
        item,
        index,
        action: "used",
        wasSelected,
        historyEntryId,
      });
    }

    // ✅ only markUsed*
    markUsed(item.categoryKey, item.id);

    setRecipeItemIds((prev) => prev.filter((x) => x !== item.id));
  }

  async function handleUndo() {
    if (!undo) return;

    const { item, index, wasSelected, historyEntryId } = undo;

    // ✅ remove the history record created by delete/use*
    if (historyEntryId) {
      await removePantryHistoryEntry(historyEntryId);
    }

    // ✅ restore item at original index*
    setPantry((prev) => {
      const list = prev[item.categoryKey] ?? [];
      const nextList = [...list];
      const safeIndex = Math.min(Math.max(index, 0), nextList.length);
      nextList.splice(safeIndex, 0, item);
      return { ...prev, [item.categoryKey]: nextList };
    });

    if (wasSelected) {
      setRecipeItemIds((prev) =>
        prev.includes(item.id) ? prev : [...prev, item.id],
      );
    }

    setUndo(null);
  }
  async function handleGenerateRecipes() {
    // A ref blocks double taps even before React updates the disabled button.
    if (generatingRef.current) return;

    const itemsForRecipes = selectedItems.filter((it) =>
      recipeItemIds.includes(it.id),
    );
    if (itemsForRecipes.length === 0) return;

    generatingRef.current = true;
    setIsGenerating(true);

    const title =
      itemsForRecipes[0].recipeSearchName?.trim() || itemsForRecipes[0].name;

    try {
      const url = `${RECIPES_URL}?title=${encodeURIComponent(title)}`;
      console.log("🍳 recipes fetch:", url);

      const res = await fetch(url);
      const raw = await res.text();

      if (!res.ok) {
        console.log("❌ recipes non-200:", res.status, raw.slice(0, 200));
        Alert.alert(
          "Recipes unavailable",
          "Couldn't load recipes right now. Please try again.",
        );
        return;
      }

      const trimmed = raw.trim();
      if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
        console.log("❌ recipes returned non-JSON:", trimmed.slice(0, 200));
        Alert.alert(
          "Unexpected response",
          "Couldn't read the recipe results. Please try again.",
        );
        return;
      }

      const json = JSON.parse(trimmed) as {
        ok: boolean;
        cached?: boolean;
        recipes?: any[];
        error?: string;
      };

      if (!json.ok) {
        console.log("❌ recipes error payload:", json);
        Alert.alert(
          "Recipes unavailable",
          "Couldn't generate recipes this time. Please try again.",
        );
        return;
      }

      const recipes = json.recipes ?? [];
      console.log("✅ recipes:", recipes.length, "cached?", json.cached);
      setResults({
        queryTitle: title,
        recipes,
        cached: !!json.cached,
      });

      router.push("/recipes/results");
    } catch (err) {
      console.error("❌ Recipe fetch failed:", err);
      Alert.alert(
        "Connection issue",
        "Couldn't load recipes. Check your connection and try again.",
      );
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }

  const hasRecipeItems = recipeItemIds.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#fafafa" }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Use expiring items</Text>
        <Text style={styles.subtitle}>
          Clean up your pantry, then choose items to use in recipes.
        </Text>

        {selectedItems.length === 0 ? (
          <Text style={styles.subtitle}>No items passed in.</Text>
        ) : (
          <>
            {selectedItems.map((it) => {
              const checked = recipeItemIds.includes(it.id);
              return (
                <View key={it.id} style={styles.itemRow}>
                  <Pressable
                    style={styles.left}
                    onPress={() => toggleRecipeSelection(it.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                      ]}
                    >
                      {checked && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.itemName}>{it.name}</Text>
                      {it.expiryDate && (
                        <Text style={styles.itemExpiry}>
                          Expires {it.expiryDate}
                        </Text>
                      )}
                    </View>
                  </Pressable>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.usedButton}
                      onPress={() => handleUseItem(it)}
                    >
                      <Text style={styles.usedText}>Used</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDeleteItem(it)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="rgb(170, 20, 20)"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Pressable
              style={[
                styles.primaryButton,
                (!hasRecipeItems || isGenerating) &&
                  styles.primaryButtonDisabled,
              ]}
              disabled={!hasRecipeItems || isGenerating}
              onPress={handleGenerateRecipes}
            >
              {isGenerating ? (
                <View style={styles.loadingButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>
                    Finding recipes...
                  </Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>
                  {hasRecipeItems
                    ? "Get recipes for selected items"
                    : "Select at least one item"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      {undo && !isGenerating && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>
            {undo.action === "used" ? "Marked as used" : "Deleted"} “
            {undo.item.name}”
          </Text>
          <Pressable onPress={handleUndo}>
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </View>
      )}

      {isGenerating && (
        <View style={styles.loadingOverlay} accessibilityLiveRegion="polite">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>Finding your recipes...</Text>
            <Text style={styles.loadingSubtitle}>
              Please wait while we prepare your recipe suggestions.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default ExpiringRecipesScreen;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 80,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.35)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  itemExpiry: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  usedButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(76, 175, 80, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.22)",
    marginRight: Spacing.sm,
  },
  usedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(30, 90, 35, 0.95)",
  },
  deleteButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 59, 48, 0.10)",
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 10,
    elevation: 10,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 30,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
    textAlign: "center",
  },
  loadingSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 19,
  },
  undoBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,20,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoText: {
    color: "#fff",
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  undoButtonText: {
    color: "#ffd966",
    fontSize: 13,
    fontWeight: "600",
  },
});
