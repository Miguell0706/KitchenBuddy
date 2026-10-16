import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  appendPantryHistory,
  removePantryHistoryEntry,
} from "@/features/pantry/history";
import { usePantryStore } from "@/features/pantry/store";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";
import { RECIPES_URL } from "@/config/api";
import { useRecipesStore } from "@/features/recipes/store";

const P = {
  ivory: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  lightSlate: "#EEF1F1",
  warm: "#F2E9DC",
  brown: "#896E4B",
  red: "#A65E55",
  lightRed: "#F7EEEB",
  white: "#FFFFFF",
};

type RecipeItem = PantryItem & { categoryKey: CategoryKey };
type UndoState = {
  item: RecipeItem;
  index: number;
  action: "delete" | "used";
  wasSelected: boolean;
  historyEntryId?: string;
} | null;

function getExpiryLabel(value?: string | null): string {
  if (!value) return "No expiry date";
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return `Expires ${value}`;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "Expired";
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Expires tomorrow";
  return `Expires in ${diff} days`;
}

export default function ExpiringRecipesScreen() {
  const params = useLocalSearchParams<{ itemIds?: string | string[] }>();
  const rawItemIds = Array.isArray(params.itemIds)
    ? params.itemIds[0]
    : params.itemIds;
  const pantryByCategory = usePantryStore((s) => s.pantry);
  const setPantry = usePantryStore((s) => s.setPantry);
  const deleteItem = usePantryStore((s) => s.deleteItem);
  const markUsed = usePantryStore((s) => s.markUsed);
  const setResults = useRecipesStore((s) => s.setResults);
  const router = useRouter();

  const parsedIds = useMemo((): string[] => {
    if (!rawItemIds) return [];
    try {
      const parsed: unknown = JSON.parse(rawItemIds);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch (error) {
      console.log("Failed to parse itemIds param:", rawItemIds, error);
      return [];
    }
  }, [rawItemIds]);

  const selectedItems: RecipeItem[] = useMemo(() => {
    if (!parsedIds.length) return [];
    const result: RecipeItem[] = [];
    (Object.entries(pantryByCategory) as [CategoryKey, PantryItem[]][]).forEach(
      ([categoryKey, list]) => {
        for (const item of list) {
          if (parsedIds.includes(item.id))
            result.push({ ...item, categoryKey });
        }
      },
    );
    return result;
  }, [parsedIds, pantryByCategory]);

  const [recipeItemIds, setRecipeItemIds] = useState<string[]>([]);
  const [undo, setUndo] = useState<UndoState>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);
  const changingRef = useRef(false);
  const [isChanging, setIsChanging] = useState(false);

  const selectedRecipeItems = selectedItems.filter((item) =>
    recipeItemIds.includes(item.id),
  );
  const hasRecipeItems = selectedRecipeItems.length > 0;

  function toggleRecipeSelection(id: string) {
    if (isGenerating || isChanging) return;
    setRecipeItemIds((previous) =>
      previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id],
    );
  }

  async function changePantryItem(item: RecipeItem, action: "delete" | "used") {
    if (changingRef.current || generatingRef.current) return;
    const list = usePantryStore.getState().pantry[item.categoryKey] ?? [];
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index < 0) return;
    const wasSelected = recipeItemIds.includes(item.id);
    changingRef.current = true;
    setIsChanging(true);
    try {
      const historyEntryId = await appendPantryHistory(
        item,
        action === "delete" ? "removed" : "used",
      );
      setUndo({ item, index, action, wasSelected, historyEntryId });
      if (action === "delete") deleteItem(item.categoryKey, item.id);
      else markUsed(item.categoryKey, item.id);
      setRecipeItemIds((previous) => previous.filter((id) => id !== item.id));
    } catch (error) {
      console.warn("Unable to update expiring pantry item:", error);
      Alert.alert("Could not update item", "Please try again.");
    } finally {
      changingRef.current = false;
      setIsChanging(false);
    }
  }

  async function handleUndo() {
    if (!undo || changingRef.current || generatingRef.current) return;
    changingRef.current = true;
    setIsChanging(true);
    const current = undo;
    try {
      if (current.historyEntryId)
        await removePantryHistoryEntry(current.historyEntryId);
      setPantry((previous) => {
        const list = previous[current.item.categoryKey] ?? [];
        if (list.some((entry) => entry.id === current.item.id)) return previous;
        const nextList = [...list];
        const safeIndex = Math.min(Math.max(current.index, 0), nextList.length);
        nextList.splice(safeIndex, 0, current.item);
        return { ...previous, [current.item.categoryKey]: nextList };
      });
      if (current.wasSelected) {
        setRecipeItemIds((previous) =>
          previous.includes(current.item.id)
            ? previous
            : [...previous, current.item.id],
        );
      }
      setUndo(null);
    } catch (error) {
      console.warn("Could not undo expiring item action:", error);
      Alert.alert(
        "Undo failed",
        "The item could not be restored. Please try again.",
      );
    } finally {
      changingRef.current = false;
      setIsChanging(false);
    }
  }

  async function handleGenerateRecipes() {
    if (
      generatingRef.current ||
      changingRef.current ||
      selectedRecipeItems.length === 0
    )
      return;
    generatingRef.current = true;
    setIsGenerating(true);
    // Keep the current API contract: the query is based on the first selected item.
    const title =
      selectedRecipeItems[0].recipeSearchName?.trim() ||
      selectedRecipeItems[0].name;
    try {
      const url = `${RECIPES_URL}?title=${encodeURIComponent(title)}`;
      console.log("recipes fetch:", url);
      const response = await fetch(url);
      const raw = await response.text();
      if (!response.ok) {
        console.log("recipes non-200:", response.status, raw.slice(0, 200));
        Alert.alert(
          "Recipes unavailable",
          "Couldn't load recipes right now. Please try again.",
        );
        return;
      }
      const trimmed = raw.trim();
      if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
        console.log("recipes returned non-JSON:", trimmed.slice(0, 200));
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
        console.log("recipes error payload:", json);
        Alert.alert(
          "Recipes unavailable",
          "Couldn't generate recipes this time. Please try again.",
        );
        return;
      }
      const recipes = json.recipes ?? [];
      console.log("recipes:", recipes.length, "cached?", json.cached);
      setResults({ queryTitle: title, recipes, cached: !!json.cached });
      router.push("/recipes/results");
    } catch (error) {
      console.error("Recipe fetch failed:", error);
      Alert.alert(
        "Connection issue",
        "Couldn't load recipes. Check your connection and try again.",
      );
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ title: "Use Expiring Items", headerBackTitle: "Recipes" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="leaf-outline" size={22} color={P.paper} />
            </View>
            <Text style={styles.eyebrow}>RECIPES · USE WHAT YOU HAVE</Text>
          </View>
          <Text style={styles.heroTitle}>
            A little less waste. A lot more possibility.
          </Text>
          <Text style={styles.heroDescription}>
            Clean up your pantry, then select the ingredients you want to
            explore in recipes.
          </Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatNumber}>{selectedItems.length}</Text>
              <Text style={styles.heroStatLabel}>Available items</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View>
              <Text style={styles.heroStatNumber}>
                {selectedRecipeItems.length}
              </Text>
              <Text style={styles.heroStatLabel}>Selected</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR PANTRY</Text>
            <Text style={styles.sectionTitle}>Expiring ingredients</Text>
          </View>
          <Text style={styles.count}>{selectedItems.length} items</Text>
        </View>
        <Text style={styles.helper}>
          Tap an ingredient to include it. Used and Delete update your pantry
          and can be undone.
        </Text>

        {selectedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="basket-outline" size={29} color={P.slate} />
            </View>
            <Text style={styles.emptyTitle}>No items to review</Text>
            <Text style={styles.emptyDescription}>
              There are no matching pantry items here right now. Return to
              Recipes to explore more ideas.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.emptyButtonText}>Back to recipes</Text>
              <Ionicons name="arrow-forward" size={16} color={P.paper} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {selectedItems.map((item) => {
              const checked = recipeItemIds.includes(item.id);
              return (
                <View
                  key={`${item.categoryKey}:${item.id}`}
                  style={[styles.itemCard, checked && styles.itemCardSelected]}
                >
                  <View style={styles.itemMain}>
                    <Pressable
                      style={styles.itemSelection}
                      onPress={() => toggleRecipeSelection(item.id)}
                      disabled={isGenerating || isChanging}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked,
                        disabled: isGenerating || isChanging,
                      }}
                      accessibilityLabel={`Include ${item.name} in recipe search`}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={P.white}
                          />
                        )}
                      </View>
                      <View style={styles.itemPhoto}>
                        {item.ingredientImage?.url ? (
                          <Image
                            source={{ uri: item.ingredientImage.url }}
                            style={styles.photo}
                          />
                        ) : (
                          <Ionicons
                            name="nutrition-outline"
                            size={23}
                            color={P.slate}
                          />
                        )}
                      </View>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemQuantity} numberOfLines={1}>
                          {item.quantity || "Quantity not set"}
                        </Text>
                        <Text style={styles.itemExpiry}>
                          {getExpiryLabel(item.expiryDate)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                  <View style={styles.itemFooter}>
                    <Text style={styles.selectedLabel}>
                      {checked ? "INCLUDED IN SEARCH" : "TAP TO INCLUDE"}
                    </Text>
                    <View style={styles.actions}>
                      <Pressable
                        style={styles.usedButton}
                        onPress={() => void changePantryItem(item, "used")}
                        disabled={isGenerating || isChanging}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${item.name} used`}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={16}
                          color={P.slateDeep}
                        />
                        <Text style={styles.usedText}>Used</Text>
                      </Pressable>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => void changePantryItem(item, "delete")}
                        disabled={isGenerating || isChanging}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.name}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color={P.red}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {selectedItems.length > 0 && (
          <View style={styles.generateCard}>
            <View style={styles.generateHeading}>
              <View style={styles.generateIcon}>
                <Ionicons
                  name="sparkles-outline"
                  size={21}
                  color={P.slateDeep}
                />
              </View>
              <View style={styles.generateCopy}>
                <Text style={styles.generateTitle}>
                  Find something delicious
                </Text>
                <Text style={styles.generateDescription}>
                  {hasRecipeItems
                    ? `${selectedRecipeItems.length} ingredient${selectedRecipeItems.length === 1 ? "" : "s"} selected`
                    : "Select at least one ingredient to continue"}
                </Text>
              </View>
            </View>
            <Text style={styles.apiNote}>
              Recipe suggestions currently use the first selected ingredient as
              the search title.
            </Text>
            <Pressable
              style={[
                styles.generateButton,
                (!hasRecipeItems || isGenerating || isChanging) &&
                  styles.disabled,
              ]}
              disabled={!hasRecipeItems || isGenerating || isChanging}
              onPress={() => void handleGenerateRecipes()}
              accessibilityRole="button"
            >
              {isGenerating ? (
                <ActivityIndicator color={P.white} size="small" />
              ) : (
                <Ionicons name="restaurant-outline" size={19} color={P.white} />
              )}
              <Text style={styles.generateButtonText}>
                {isGenerating
                  ? "Finding recipes..."
                  : hasRecipeItems
                    ? "Get recipes for selected items"
                    : "Select an ingredient"}
              </Text>
              {!isGenerating && (
                <Ionicons name="arrow-forward" size={18} color={P.white} />
              )}
            </Pressable>
          </View>
        )}
        <Text style={styles.footer}>
          KITCHENBUDDY · MAKE MORE WITH WHAT YOU HAVE
        </Text>
      </ScrollView>

      {undo && !isGenerating && (
        <View style={styles.undoBar}>
          <Ionicons name="arrow-undo-outline" size={18} color={P.white} />
          <Text style={styles.undoText} numberOfLines={2}>
            {undo.action === "used" ? "Marked as used" : "Deleted"} “
            {undo.item.name}”
          </Text>
          <Pressable
            onPress={() => void handleUndo()}
            disabled={isChanging}
            accessibilityRole="button"
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>
              {isChanging ? "WAIT" : "UNDO"}
            </Text>
          </Pressable>
        </View>
      )}

      {isGenerating && (
        <View style={styles.loadingOverlay} accessibilityLiveRegion="polite">
          <View style={styles.loadingCard}>
            <View style={styles.loadingIcon}>
              <ActivityIndicator size="large" color={P.slateDeep} />
            </View>
            <Text style={styles.loadingTitle}>Finding your recipes...</Text>
            <Text style={styles.loadingSubtitle}>
              Please wait while we prepare your recipe suggestions.
            </Text>
            <View style={styles.loadingRule} />
            <Text style={styles.loadingFootnote}>
              A LITTLE INSPIRATION IS ON ITS WAY
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.ivory },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  hero: {
    backgroundColor: P.slate,
    borderRadius: 25,
    padding: 22,
    marginBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 17,
  },
  heroIcon: {
    height: 38,
    width: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#E5EBEB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    flex: 1,
  },
  heroTitle: {
    fontFamily: "serif",
    color: P.white,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "600",
    marginBottom: 10,
  },
  heroDescription: {
    color: "#EAF0F0",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 320,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 23,
    marginTop: 21,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.23)",
  },
  heroStatNumber: { fontFamily: "serif", color: P.white, fontSize: 26 },
  heroStatLabel: { color: "#E2E9E9", fontSize: 11, marginTop: 3 },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 1.7,
    color: P.slate,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionTitle: { fontFamily: "serif", fontSize: 23, color: P.ink },
  count: {
    color: P.slate,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: P.taupe,
    overflow: "hidden",
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  helper: {
    color: P.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 17,
  },
  list: { gap: 11 },
  itemCard: {
    backgroundColor: P.paper,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 19,
    padding: 13,
  },
  itemCardSelected: { borderColor: P.slate, backgroundColor: "#FBFCFB" },
  itemMain: { minHeight: 70 },
  itemSelection: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#B7B8B3",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: P.slateDeep, borderColor: P.slateDeep },
  itemPhoto: {
    height: 59,
    width: 59,
    borderRadius: 13,
    backgroundColor: P.lightSlate,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  itemCopy: { flex: 1, paddingVertical: 2 },
  itemName: { color: P.ink, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  itemQuantity: { color: P.muted, fontSize: 12, marginBottom: 5 },
  itemExpiry: { color: P.brown, fontSize: 11, fontWeight: "700" },
  itemFooter: {
    borderTopWidth: 1,
    borderTopColor: P.border,
    marginTop: 12,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectedLabel: {
    color: P.muted,
    letterSpacing: 1.1,
    fontSize: 9,
    fontWeight: "800",
    flexShrink: 1,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 7 },
  usedButton: {
    backgroundColor: P.lightSlate,
    paddingHorizontal: 12,
    minHeight: 35,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  usedText: { color: P.slateDeep, fontWeight: "700", fontSize: 12 },
  deleteButton: {
    backgroundColor: P.lightRed,
    height: 35,
    width: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  generateCard: {
    backgroundColor: P.paper,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: P.border,
    marginTop: 23,
    padding: 17,
  },
  generateHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  generateIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  generateCopy: { flex: 1 },
  generateTitle: { fontFamily: "serif", color: P.ink, fontSize: 20 },
  generateDescription: { color: P.muted, fontSize: 12, marginTop: 4 },
  apiNote: {
    color: P.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
    marginBottom: 13,
  },
  generateButton: {
    backgroundColor: P.slateDeep,
    minHeight: 53,
    paddingHorizontal: 13,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  generateButtonText: {
    color: P.white,
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
  },
  disabled: { opacity: 0.44 },
  emptyCard: {
    backgroundColor: P.paper,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 21,
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 62,
    height: 62,
    backgroundColor: P.lightSlate,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "serif",
    color: P.ink,
    fontSize: 23,
    marginBottom: 7,
  },
  emptyDescription: {
    color: P.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: P.slateDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyButtonText: { color: P.white, fontSize: 13, fontWeight: "700" },
  footer: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#A3A09A",
    textAlign: "center",
    marginTop: 27,
  },
  undoBar: {
    position: "absolute",
    bottom: 22,
    left: 16,
    right: 16,
    backgroundColor: P.ink,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    elevation: 5,
  },
  undoText: { color: P.white, flex: 1, fontSize: 12 },
  undoButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  undoButtonText: {
    color: P.white,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    backgroundColor: "rgba(31,39,41,0.60)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: P.paper,
    borderRadius: 23,
    alignItems: "center",
    padding: 25,
  },
  loadingIcon: {
    width: 65,
    height: 65,
    backgroundColor: P.lightSlate,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontFamily: "serif",
    color: P.ink,
    fontSize: 23,
    marginTop: 17,
    textAlign: "center",
  },
  loadingSubtitle: {
    color: P.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  loadingRule: {
    backgroundColor: P.border,
    height: 1,
    width: "100%",
    marginTop: 20,
    marginBottom: 14,
  },
  loadingFootnote: {
    color: P.slate,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "center",
  },
});
