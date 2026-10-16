/**
 * KitchenBuddy - Shopping Mode (Phase 1)
 * Save as app/grocery/shopping.tsx.
 * Shares the Grocery tab's existing GROCERY_STORAGE_KEY and checked flags.
 * Phase 2 adds a separate confirmation screen for transferring checked items.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import {
  GROCERY_STORAGE_KEY,
  type GroceryItem,
  displayGroceryItem,
  isGroceryItem,
} from "@/features/grocery/groceryIngredients";
import { CATEGORIES } from "@/features/pantry/constants";
import { inferCategoryFromName } from "@/features/pantry/categoryInference";
import type { CategoryKey } from "@/features/pantry/types";
import {
  ingredientImageOverrideKey,
  listIngredientImageOverrides,
  type IngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";

type Section = { key: CategoryKey; label: string; items: GroceryItem[] };

const CATEGORY_ICONS: Record<CategoryKey, keyof typeof Ionicons.glyphMap> = {
  produce: "leaf-outline",
  meatSeafood: "fish-outline",
  dairyEggs: "nutrition-outline",
  bakery: "cafe-outline",
  pantry: "cube-outline",
  condiments: "water-outline",
  spices: "flame-outline",
  beverages: "beer-outline",
  frozen: "snow-outline",
  snacks: "ice-cream-outline",
  pet: "paw-outline",
};

async function readGroceryList(): Promise<GroceryItem[]> {
  const raw = await AsyncStorage.getItem(GROCERY_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Saved grocery list is invalid.");
  return parsed.filter(isGroceryItem);
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ShoppingModeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [imageOverrides, setImageOverrides] = useState<
    Record<string, IngredientImageOverride>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [showCollected, setShowCollected] = useState(false);
  const [addText, setAddText] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        try {
          const list = await readGroceryList();
          // Image preferences are optional. A damaged/unavailable image store
          // should never prevent shopping with the grocery list.
          let images: Record<string, IngredientImageOverride> = {};
          try {
            images = await listIngredientImageOverrides();
          } catch (error) {
            console.warn(
              "Shopping Mode: unable to load image preferences",
              error,
            );
          }
          if (!active) return;
          setItems(list);
          setImageOverrides(images);
        } catch (error) {
          console.warn("Shopping Mode: unable to load grocery list", error);
          if (active)
            Alert.alert(
              "Unable to load list",
              "Please try opening Shopping Mode again.",
            );
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const writeList = useCallback(
    async (change: (list: GroceryItem[]) => GroceryItem[]) => {
      if (loading || busyRef.current) return false;
      busyRef.current = true;
      setSaving(true);
      try {
        // Read latest persisted list to retain recipe metadata and edits from
        // elsewhere; do not overwrite it with a stale screen snapshot.
        const latest = await readGroceryList();
        const updated = change(latest);
        await AsyncStorage.setItem(
          GROCERY_STORAGE_KEY,
          JSON.stringify(updated),
        );
        setItems(updated);
        return true;
      } catch (error) {
        console.warn("Shopping Mode: unable to save", error);
        Alert.alert(
          "Couldn't save change",
          "Please try again. Your previous list is still saved.",
        );
        return false;
      } finally {
        busyRef.current = false;
        setSaving(false);
      }
    },
    [loading],
  );

  const toggleItem = useCallback(
    async (id: string) => {
      const changed = await writeList((list) =>
        list.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item,
        ),
      );
      if (changed) void Haptics.selectionAsync().catch(() => undefined);
    },
    [writeList],
  );

  const addItem = useCallback(async () => {
    const name = addText.trim();
    if (!name) return;
    const changed = await writeList((list) => [
      {
        id: newId(),
        name,
        checked: false,
        createdAt: Date.now(),
      },
      ...list,
    ]);
    if (changed) {
      setAddText("");
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [addText, writeList]);

  const collected = useMemo(
    () => items.filter((item) => item.checked),
    [items],
  );
  const remaining = useMemo(
    () => items.filter((item) => !item.checked),
    [items],
  );
  const percentage = items.length
    ? Math.round((collected.length / items.length) * 100)
    : 0;

  const sections = useMemo((): Section[] => {
    const byCategory = new Map<CategoryKey, GroceryItem[]>();
    for (const item of remaining) {
      const category = inferCategoryFromName(item.name);
      const group = byCategory.get(category) ?? [];
      group.push(item);
      byCategory.set(category, group);
    }
    return CATEGORIES.filter((category) => byCategory.has(category.key)).map(
      (category) => ({
        key: category.key,
        label: category.label,
        items: byCategory.get(category.key) ?? [],
      }),
    );
  }, [remaining]);

  const renderItem = (item: GroceryItem, checked: boolean) => {
    const override = imageOverrides[ingredientImageOverrideKey(item.name)];
    const category = inferCategoryFromName(item.name);
    return (
      <Pressable
        key={item.id}
        accessibilityRole="checkbox"
        accessibilityLabel={`${item.name}, ${checked ? "collected" : "not collected"}. Tap to ${checked ? "undo" : "collect"}.`}
        accessibilityState={{ checked, disabled: loading || saving }}
        disabled={loading || saving}
        onPress={() => void toggleItem(item.id)}
        style={[
          styles.item,
          checked && styles.collectedItem,
          saving && styles.dimmed,
        ]}
      >
        {override?.image?.url ? (
          <Image
            source={{ uri: override.image.url }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons
              name={CATEGORY_ICONS[category]}
              color="#6B987B"
              size={23}
            />
          </View>
        )}
        <View style={styles.itemBody}>
          <Text
            style={[styles.itemName, checked && styles.collectedName]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {item.quantity != null && (
            <Text style={styles.itemSub}>
              {displayGroceryItem(item).replace(item.name, "").trim()}
            </Text>
          )}
          {!!item.sourceRecipe && (
            <Text style={styles.itemSub} numberOfLines={1}>
              From {item.sourceRecipe}
            </Text>
          )}
        </View>
        <Ionicons
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          color={checked ? "#367A57" : "#9CA6A0"}
          size={30}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Grocery List"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={23} color="#26392E" />
        </Pressable>
        <Text style={styles.topTitle}>Shopping Mode</Text>
        <Ionicons name="basket-outline" size={23} color="#367A57" />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#367A57" size="large" />
          <Text style={styles.help}>Loading your list...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              {collected.length} of {items.length} collected
            </Text>
            <Text style={styles.help}>
              {items.length === 0
                ? "Add your first item to get started."
                : remaining.length
                  ? `${remaining.length} more item${remaining.length === 1 ? "" : "s"} to go`
                  : "Everything on your list is collected!"}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${percentage}%` }]}
              />
            </View>
            <Text style={styles.progressCaption}>
              {percentage}% complete{saving ? " · Saving..." : ""}
            </Text>
          </View>

          <View style={styles.quickAdd}>
            <TextInput
              value={addText}
              onChangeText={setAddText}
              placeholder="Forgot something? Add it here"
              placeholderTextColor="#929A94"
              style={styles.quickInput}
              returnKeyType="done"
              editable={!saving}
              onSubmitEditing={() => void addItem()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add grocery item"
              disabled={saving || !addText.trim()}
              onPress={() => void addItem()}
              style={[
                styles.quickButton,
                (saving || !addText.trim()) && styles.dimmed,
              ]}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>
              Still Need ({remaining.length})
            </Text>
            <Text style={styles.sectionHint}>Grouped by category</Text>
          </View>

          {remaining.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons
                name={
                  items.length ? "checkmark-circle-outline" : "basket-outline"
                }
                size={31}
                color="#367A57"
              />
              <Text style={styles.emptyTitle}>
                {items.length ? "All items collected" : "Your list is empty"}
              </Text>
              <Text style={styles.help}>
                {items.length
                  ? "You can undo any item below or return to your grocery list."
                  : "Add an item above, or return to Grocery List to plan your shopping."}
              </Text>
            </View>
          )}

          {sections.map((section) => (
            <View key={section.key} style={styles.group}>
              <View style={styles.groupTitleRow}>
                <Ionicons
                  name={CATEGORY_ICONS[section.key]}
                  size={19}
                  color="#367A57"
                />
                <Text style={styles.groupTitle}>{section.label}</Text>
                <Text style={styles.groupCount}>{section.items.length}</Text>
              </View>
              {section.items.map((item) => renderItem(item, false))}
            </View>
          ))}

          {collected.length > 0 && (
            <View style={styles.collectedArea}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${showCollected ? "Hide" : "Show"} ${collected.length} collected items`}
                onPress={() => setShowCollected((previous) => !previous)}
                style={styles.collectedHeader}
              >
                <Ionicons name="checkmark-circle" size={22} color="#367A57" />
                <Text style={styles.collectedHeaderTitle}>
                  Collected ({collected.length})
                </Text>
                <Ionicons
                  name={showCollected ? "chevron-up" : "chevron-down"}
                  size={19}
                  color="#657368"
                />
              </Pressable>
              {showCollected ? (
                collected.map((item) => renderItem(item, true))
              ) : (
                <Text style={styles.collectedHint}>
                  Tap to view or undo collected items
                </Text>
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Finish shopping with ${collected.length} collected items`}
            disabled={saving || collected.length === 0}
            onPress={() => router.push("/grocery/finish")}
            style={[
              styles.finishButton,
              (saving || collected.length === 0) && styles.dimmed,
            ]}
          >
            <Ionicons name="checkmark-done-outline" size={21} color="#FFFFFF" />
            <Text style={styles.finishButtonText}>
              Finish Shopping ({collected.length})
            </Text>
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </Pressable>
          <View style={styles.footer}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#69766C"
            />
            <Text style={styles.footerText}>
              Your progress is saved automatically. Review collected items
              before adding them to Pantry. Uncollected items will stay on your
              list.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8F6" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F0F3EF",
  },
  topTitle: { flex: 1, color: "#26392E", fontWeight: "800", fontSize: 19 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 65 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  progressCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 15,
  },
  progressTitle: { fontSize: 25, color: "#26392E", fontWeight: "800" },
  help: { color: "#68746B", fontSize: 14, marginTop: 5, lineHeight: 20 },
  progressTrack: {
    height: 9,
    borderRadius: 99,
    backgroundColor: "#E8EFEB",
    overflow: "hidden",
    marginTop: 17,
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#367A57",
  },
  progressCaption: {
    color: "#52705C",
    fontSize: 12,
    marginTop: 9,
    fontWeight: "700",
  },
  quickAdd: {
    backgroundColor: "#FFFFFF",
    padding: 9,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 19,
  },
  quickInput: {
    flex: 1,
    minHeight: 43,
    color: "#26392E",
    fontSize: 14,
    paddingHorizontal: 9,
  },
  quickButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#367A57",
  },
  dimmed: { opacity: 0.55 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 13,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#26392E" },
  sectionHint: { fontSize: 12, color: "#869087" },
  group: { marginBottom: 16 },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 3,
  },
  groupTitle: { fontSize: 14, color: "#385946", fontWeight: "800", flex: 1 },
  groupCount: { fontSize: 12, color: "#7B897E", fontWeight: "700" },
  item: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 12,
    marginBottom: 8,
    minHeight: 67,
  },
  collectedItem: { backgroundColor: "#F0F4F0" },
  thumbnail: { width: 46, height: 46, borderRadius: 10 },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF3EC",
  },
  itemBody: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, color: "#26392E", fontWeight: "600" },
  collectedName: { textDecorationLine: "line-through", color: "#87928A" },
  itemSub: { color: "#7E8880", fontSize: 12 },
  collectedArea: { marginTop: 12, marginBottom: 20 },
  collectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "#DFE6DF",
  },
  collectedHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#385946",
  },
  collectedHint: { fontSize: 12, color: "#778279", paddingBottom: 12 },
  emptyCard: {
    padding: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    gap: 5,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#385946",
    marginTop: 5,
  },
  finishButton: {
    backgroundColor: "#367A57",
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 15,
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonText: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#EBF0EB",
    alignItems: "flex-start",
  },
  footerText: { flex: 1, fontSize: 12, lineHeight: 18, color: "#69766C" },
});
