import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { appendPantryHistory } from "@/features/pantry/history";
import { usePantryStore } from "@/features/pantry/store";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";
import { Colors, Spacing } from "@/constants/theme";
import { RECIPES_URL } from "@/config/api";

type RecipeItem = PantryItem & { categoryKey: CategoryKey };

type UndoState = {
  item: RecipeItem;
  index: number;
  action: "delete" | "used";
  wasSelected: boolean;
} | null;

const ExpiringRecipesScreen: React.FC = () => {
  const params = useLocalSearchParams<{ itemIds?: string }>();
  const rawItemIds = params.itemIds;

  const pantryByCategory = usePantryStore((s) => s.pantry);
  const setPantry = usePantryStore((s) => s.setPantry);

  const parsedIds = useMemo(() => {
    if (!rawItemIds) return [];
    try {
      return JSON.parse(rawItemIds) as string[];
    } catch (e) {
      console.log("❌ Failed to parse itemIds param:", rawItemIds, e);
      return [];
    }
  }, [rawItemIds]);

  // add categoryKey so we can mutate pantry correctly
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

  // which of these are included in recipe generation
  const [recipeItemIds, setRecipeItemIds] = useState<string[]>([]);
  // local undo state
  const [undo, setUndo] = useState<UndoState>(null);

  useEffect(() => {
    setRecipeItemIds(parsedIds);
  }, [parsedIds]);

  function toggleRecipeSelection(id: string) {
    setRecipeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function actuallyRemoveItem(item: RecipeItem) {
    setPantry((prev) => {
      const list = prev[item.categoryKey] ?? [];
      const nextList = list.filter((x) => x.id !== item.id);
      if (nextList.length === list.length) return prev;
      return { ...prev, [item.categoryKey]: nextList };
    });
  }

  function handleDeleteItem(item: RecipeItem) {
    const list = pantryByCategory[item.categoryKey] ?? [];
    const index = list.findIndex((x) => x.id === item.id);
    const wasSelected = recipeItemIds.includes(item.id);

    if (index !== -1) {
      setUndo({
        item,
        index,
        action: "delete",
        wasSelected,
      });
    }

    actuallyRemoveItem(item);
    setRecipeItemIds((prev) => prev.filter((x) => x !== item.id));
  }

  function handleUseItem(item: RecipeItem) {
    const list = pantryByCategory[item.categoryKey] ?? [];
    const index = list.findIndex((x) => x.id === item.id);
    const wasSelected = recipeItemIds.includes(item.id);

    if (index !== -1) {
      setUndo({
        item,
        index,
        action: "used",
        wasSelected,
      });
    }

    actuallyRemoveItem(item);
    setRecipeItemIds((prev) => prev.filter((x) => x !== item.id));
  }

  function handleUndo() {
    if (!undo) return;

    const { item, index, wasSelected } = undo;

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
    const itemsForRecipes = selectedItems.filter((it) =>
      recipeItemIds.includes(it.id),
    );
    if (itemsForRecipes.length === 0) return;

    const title = itemsForRecipes[0].name;

    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL; // e.g. https://receiptchef.onrender.com
      if (!baseUrl) throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");

      // Build the endpoint from baseUrl (don’t rely on RECIPES_URL unless you’re sure it’s right)
      const url = `${RECIPES_URL}?title=${encodeURIComponent(title)}`;

      console.log("🍳 recipes fetch:", url);

      const res = await fetch(url);
      const raw = await res.text(); // read as text first to avoid JSON parse crash

      // If server woke up slowly or returned an HTML error page, you'll see it here:
      if (!res.ok) {
        console.log("❌ recipes non-200:", res.status, raw.slice(0, 200));
        return;
      }

      // Only parse JSON if it looks like JSON
      const trimmed = raw.trim();
      if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
        console.log("❌ recipes returned non-JSON:", trimmed.slice(0, 200));
        return;
      }

      const json = JSON.parse(trimmed);

      if (!json.ok) {
        console.log("❌ recipes error payload:", json);
        return;
      }

      console.log("✅ recipes:", json.recipes, "cached?", json.cached);

      // TODO: set state / navigate
      // setRecipeResults(json.recipes)
      // router.push({ pathname: "/recipes/results", params: { title } })
    } catch (err) {
      console.error("❌ Recipe fetch failed:", err);
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
                !hasRecipeItems && styles.primaryButtonDisabled,
              ]}
              disabled={!hasRecipeItems}
              onPress={handleGenerateRecipes}
            >
              <Text style={styles.primaryButtonText}>
                {hasRecipeItems
                  ? "Get recipes for selected items"
                  : "Select at least one item"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {undo && (
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
