/**
 * KitchenBuddy — Shopping Mode, Ivory / Slate edition.
 * Save as mobile/app/grocery/shopping.tsx.
 * Uses the same automatic image cache as Grocery List / Finish Shopping.
 * Preserves Phase 2 navigation to /grocery/finish.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
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
import { RECIPES_URL } from "@/config/api";
import {
  GROCERY_STORAGE_KEY,
  type GroceryItem,
  isGroceryItem,
  parseIngredient,
} from "@/features/grocery/groceryIngredients";
import { CATEGORIES } from "@/features/pantry/constants";
import { inferCategoryFromName } from "@/features/pantry/categoryInference";
import { loadPantry } from "@/features/pantry/storage";
import type {
  CategoryKey,
  IngredientImage,
  PantryItem,
} from "@/features/pantry/types";
import {
  ingredientImageOverrideKey,
  listIngredientImageOverrides,
  type IngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";

type Section = { key: CategoryKey; label: string; items: GroceryItem[] };
type ImageCacheEntry = { image: IngredientImage | null; expiresAt: number };
const P = {
  ivory: "#F5F2EC",
  white: "#FFFEFA",
  fog: "#E8E5E0",
  row: "#F1EFEB",
  slate: "#586D77",
  deepSlate: "#445A64",
  brown: "#786450",
  charcoal: "#2E2E2E",
  muted: "#79736F",
  pale: "#F3E5D0",
};
const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});
const IMAGE_ENDPOINT = RECIPES_URL.replace(
  /\/api\/recipes\/?$/,
  "/api/images/ingredient-image",
);
// Deliberately shared with the Grocery List and Finish Shopping screens.
const AUTO_IMAGE_CACHE_KEY = "@kb_finish_shopping_images_v1";
const IMAGE_TTL = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL = 24 * 60 * 60 * 1000;
const LOOKUP_TIMEOUT = 10000;
const MAX_LOOKUPS = 3;

const CATEGORY_ICONS: Record<CategoryKey, keyof typeof Ionicons.glyphMap> = {
  produce: "leaf-outline",
  meatSeafood: "fish-outline",
  dairyEggs: "nutrition-outline",
  bakery: "cafe-outline",
  pantry: "cube-outline",
  condiments: "water-outline",
  spices: "flame-outline",
  beverages: "cafe-outline",
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
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function displayName(item: GroceryItem): string {
  return parseIngredient(item.name).name || item.name;
}
function quantityLabel(item: GroceryItem): string | null {
  const parsed = parseIngredient(item.name);
  const quantity = item.quantity ?? parsed.quantity;
  if (quantity == null) return null;
  const unit = (item.unit ?? parsed.unit ?? "").trim();
  return `${quantity}${unit && unit.toLowerCase() !== "unit" ? ` ${unit}` : ""}`;
}
function imageKey(item: GroceryItem): string {
  return ingredientImageOverrideKey(displayName(item));
}
function isRemoteImage(value: unknown): value is IngredientImage {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { url?: unknown }).url === "string" &&
    /^https?:\/\//i.test((value as { url: string }).url)
  );
}
async function readImageCache(): Promise<Record<string, ImageCacheEntry>> {
  const raw = await AsyncStorage.getItem(AUTO_IMAGE_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const clean: Record<string, ImageCacheEntry> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Partial<ImageCacheEntry>;
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now())
        continue;
      if (entry.image !== null && !isRemoteImage(entry.image)) continue;
      clean[key] = { image: entry.image ?? null, expiresAt: entry.expiresAt };
    }
    return clean;
  } catch {
    return {};
  }
}
async function fetchAutomatic(name: string): Promise<IngredientImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT);
  try {
    // This endpoint first checks PostgreSQL, and only then calls Pexels on a DB miss.
    const response = await fetch(
      `${IMAGE_ENDPOINT}?name=${encodeURIComponent(name)}`,
      {
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(`Image endpoint returned HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object")
      throw new Error("Invalid image response");
    const result = body as { ok?: unknown; image?: unknown };
    if (result.ok !== true) throw new Error("Ingredient image lookup failed");
    if (result.image == null) return null;
    if (!isRemoteImage(result.image))
      throw new Error("Invalid ingredient image URL");
    return result.image;
  } finally {
    clearTimeout(timeout);
  }
}

export default function ShoppingModeScreen() {
  const router = useRouter();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [imageOverrides, setImageOverrides] = useState<
    Record<string, IngredientImageOverride>
  >({});
  const overridesRef = useRef<Record<string, IngredientImageOverride>>({});
  const pantryImagesRef = useRef<Record<string, IngredientImage>>({});
  const [automaticImages, setAutomaticImages] = useState<
    Record<string, IngredientImage | null>
  >({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const attemptedRef = useRef(new Set<string>());
  const focusTokenRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [showCollected, setShowCollected] = useState(false);
  const [addText, setAddText] = useState("");

  const hydrateImages = useCallback(
    async (
      list: GroceryItem[],
      preferences: Record<string, IngredientImageOverride>,
      pantryImages: Record<string, IngredientImage>,
      token: number,
    ) => {
      const active = () => focusTokenRef.current === token;
      let cache: Record<string, ImageCacheEntry> = {};
      try {
        cache = await readImageCache();
      } catch (error) {
        console.warn("Shopping Mode: image cache unavailable", error);
      }
      if (!active()) return;
      const initial: Record<string, IngredientImage | null> = {};
      const pending: { key: string; name: string }[] = [];
      for (const item of list) {
        const key = imageKey(item);
        if (
          !key ||
          preferences[key]?.image?.url ||
          attemptedRef.current.has(key)
        )
          continue;
        attemptedRef.current.add(key);
        if (pantryImages[key]) {
          initial[key] = pantryImages[key];
          continue;
        }
        if (cache[key]) {
          initial[key] = cache[key].image;
          continue;
        }
        pending.push({ key, name: displayName(item) });
      }
      if (!active()) return;
      if (Object.keys(initial).length)
        setAutomaticImages((prev) => ({ ...prev, ...initial }));
      if (!pending.length) return;
      setImageLoading((prev) => ({
        ...prev,
        ...Object.fromEntries(pending.map((x) => [x.key, true])),
      }));
      let cursor = 0;
      const fetched: Record<string, ImageCacheEntry> = {};
      async function worker() {
        while (cursor < pending.length && active()) {
          const task = pending[cursor++];
          try {
            const image = await fetchAutomatic(task.name);
            fetched[task.key] = {
              image,
              expiresAt: Date.now() + (image ? IMAGE_TTL : EMPTY_TTL),
            };
            if (active())
              setAutomaticImages((prev) => ({ ...prev, [task.key]: image }));
          } catch (error) {
            // Do not cache network failures (Render may be waking up).
            attemptedRef.current.delete(task.key);
            console.warn(
              `Shopping Mode: image lookup failed for ${task.name}`,
              error,
            );
          } finally {
            if (active())
              setImageLoading((prev) => ({ ...prev, [task.key]: false }));
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(MAX_LOOKUPS, pending.length) }, () =>
          worker(),
        ),
      );
      if (active() && Object.keys(fetched).length) {
        try {
          const latest = await readImageCache();
          await AsyncStorage.setItem(
            AUTO_IMAGE_CACHE_KEY,
            JSON.stringify({ ...latest, ...fetched }),
          );
        } catch (error) {
          console.warn("Shopping Mode: couldn't cache images", error);
        }
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const token = ++focusTokenRef.current;
      attemptedRef.current.clear();
      setLoading(true);
      setAutomaticImages({});
      setImageLoading({});
      (async () => {
        try {
          const list = await readGroceryList();
          // Image failure must not block shopping.
          const [preferences, pantry] = await Promise.all([
            listIngredientImageOverrides().catch((error) => {
              console.warn(
                "Shopping Mode: image preferences unavailable",
                error,
              );
              return {} as Record<string, IngredientImageOverride>;
            }),
            loadPantry().catch((error) => {
              console.warn(
                "Shopping Mode: Pantry image fallback unavailable",
                error,
              );
              return null;
            }),
          ]);
          if (!active) return;
          const pantryImages: Record<string, IngredientImage> = {};
          const pantryItems = pantry
            ? (Object.values(pantry).flat() as PantryItem[])
            : [];
          for (const item of pantryItems) {
            // Only reuse remote automatic images: a prior gallery override may have
            // been reset and its local file deleted.
            if (!isRemoteImage(item.ingredientImage)) continue;
            for (const name of [item.name, item.recipeSearchName]) {
              const key = name ? ingredientImageOverrideKey(name) : "";
              if (key && !pantryImages[key])
                pantryImages[key] = item.ingredientImage;
            }
          }
          overridesRef.current = preferences;
          pantryImagesRef.current = pantryImages;
          setImageOverrides(preferences);
          setItems(list);
          setLoading(false);
          void hydrateImages(list, preferences, pantryImages, token);
        } catch (error) {
          console.warn("Shopping Mode: unable to load list", error);
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
        focusTokenRef.current += 1;
      };
    }, [hydrateImages]),
  );

  const writeList = useCallback(
    async (change: (list: GroceryItem[]) => GroceryItem[]) => {
      if (loading || busyRef.current) return false;
      busyRef.current = true;
      setSaving(true);
      try {
        // Keep recipe metadata and any changes made elsewhere by reading fresh data.
        const latest = await readGroceryList();
        const updated = change(latest);
        await AsyncStorage.setItem(
          GROCERY_STORAGE_KEY,
          JSON.stringify(updated),
        );
        setItems(updated);
        // Runs in the background. Newly quick-added items get a lookup immediately.
        void hydrateImages(
          updated,
          overridesRef.current,
          pantryImagesRef.current,
          focusTokenRef.current,
        );
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
    [loading, hydrateImages],
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
      { id: newId(), name, checked: false, createdAt: Date.now() },
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
      const category = inferCategoryFromName(displayName(item));
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

  const showCredit = (image: IngredientImage | null | undefined) => {
    const credit = image?.credit;
    if (!credit || credit.provider.toLowerCase() !== "pexels") return;
    Alert.alert("Photo credit", `Photo by ${credit.photographer} on Pexels.`, [
      { text: "Close", style: "cancel" },
      {
        text: "View photo",
        onPress: () => {
          void Linking.openURL(credit.photoUrl).catch(() => {});
        },
      },
    ]);
  };

  const renderItem = (item: GroceryItem, checked: boolean) => {
    const key = imageKey(item);
    const category = inferCategoryFromName(displayName(item));
    const picture = imageOverrides[key]?.image ?? automaticImages[key] ?? null;
    const quantity = quantityLabel(item);
    return (
      <View
        key={item.id}
        style={[
          styles.item,
          checked && styles.collectedItem,
          saving && styles.dimmed,
        ]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${displayName(item)}, ${checked ? "collected" : "not collected"}. Tap to ${checked ? "undo" : "collect"}.`}
          accessibilityState={{ checked, disabled: loading || saving }}
          disabled={loading || saving}
          onPress={() => void toggleItem(item.id)}
          style={styles.itemPress}
        >
          {picture?.url ? (
            <Image
              source={{ uri: picture.url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              {imageLoading[key] ? (
                <ActivityIndicator color={P.slate} size="small" />
              ) : (
                <Ionicons
                  name={CATEGORY_ICONS[category]}
                  color={P.brown}
                  size={22}
                />
              )}
            </View>
          )}
          <View style={styles.itemBody}>
            <Text
              style={[styles.itemName, checked && styles.collectedName]}
              numberOfLines={2}
            >
              {displayName(item)}
            </Text>
            {!!quantity && <Text style={styles.itemSub}>{quantity}</Text>}
            {!!item.sourceRecipe && (
              <Text style={styles.itemSub} numberOfLines={1}>
                From {item.sourceRecipe}
              </Text>
            )}
          </View>
          <Ionicons
            name={checked ? "checkmark-circle" : "ellipse-outline"}
            color={checked ? P.slate : "#A39E96"}
            size={29}
          />
        </Pressable>
        {!!picture?.credit &&
          picture.credit.provider.toLowerCase() === "pexels" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Photo credit for ${displayName(item)}`}
              onPress={() => showCredit(picture)}
              style={styles.creditTouch}
            >
              <Ionicons
                name="information-circle-outline"
                color={P.muted}
                size={15}
              />
            </Pressable>
          )}
      </View>
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
          <Ionicons name="arrow-back" size={22} color={P.deepSlate} />
        </Pressable>
        <View style={styles.topName}>
          <Text style={styles.eyebrow}>YOUR SHOPPING COMPANION</Text>
          <Text style={styles.topTitle}>Shopping Mode</Text>
        </View>
        <View style={styles.basket}>
          <Ionicons name="basket-outline" size={23} color={P.deepSlate} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={P.slate} size="large" />
          <Text style={styles.help}>Loading your list...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressEyebrow}>SHOPPING PROGRESS</Text>
              <Ionicons name="bag-check-outline" size={24} color={P.pale} />
            </View>
            <Text style={styles.progressTitle}>
              {collected.length}{" "}
              <Text style={styles.progressOf}>of {items.length}</Text> collected
            </Text>
            <Text style={styles.progressHelp}>
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
              {percentage}% COMPLETE{saving ? " · SAVING..." : ""}
            </Text>
          </View>

          <View style={styles.quickAddCard}>
            <Text style={styles.quickTitle}>Forgot something?</Text>
            <View style={styles.quickAdd}>
              <TextInput
                value={addText}
                onChangeText={setAddText}
                placeholder="Add another grocery item"
                placeholderTextColor="#938D86"
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
                <Ionicons name="add" size={23} color={P.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>
              Still Need <Text style={styles.count}>({remaining.length})</Text>
            </Text>
            <View style={styles.categoryHint}>
              <Ionicons name="options-outline" color={P.brown} size={14} />
              <Text style={styles.sectionHint}>By category</Text>
            </View>
          </View>
          {remaining.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons
                name={
                  items.length ? "checkmark-circle-outline" : "basket-outline"
                }
                size={31}
                color={P.slate}
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
                <View style={styles.groupIcon}>
                  <Ionicons
                    name={CATEGORY_ICONS[section.key]}
                    size={16}
                    color={P.deepSlate}
                  />
                </View>
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
                onPress={() => setShowCollected((prev) => !prev)}
                style={styles.collectedHeader}
              >
                <Ionicons name="checkmark-circle" size={23} color={P.slate} />
                <Text style={styles.collectedHeaderTitle}>
                  Collected ({collected.length})
                </Text>
                <Ionicons
                  name={showCollected ? "chevron-up" : "chevron-down"}
                  size={19}
                  color={P.slate}
                />
              </Pressable>
              {showCollected ? (
                collected.map((item) => renderItem(item, true))
              ) : (
                <Text style={styles.collectedHint}>
                  Tap to view or undo collected items.
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
            <Ionicons name="checkmark-done-outline" size={21} color={P.white} />
            <Text style={styles.finishButtonText}>
              Finish Shopping ({collected.length})
            </Text>
            <Ionicons name="arrow-forward" size={19} color={P.white} />
          </Pressable>
          <View style={styles.footer}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={P.brown}
            />
            <Text style={styles.footerText}>
              Your progress saves automatically. Review collected groceries
              before adding them to Pantry. Uncollected items stay on your list.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void Linking.openURL("https://www.pexels.com").catch(() => {});
            }}
            accessibilityRole="link"
            style={styles.pexelsLink}
          >
            <Text style={styles.pexelsText}>Photos provided by Pexels</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ivory },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 17,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: P.ivory,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDD7D0",
    gap: 11,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: P.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: P.fog,
  },
  topName: { flex: 1 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.7,
    fontWeight: "700",
    color: P.brown,
    marginBottom: 2,
  },
  topTitle: {
    fontFamily: SERIF,
    color: P.charcoal,
    fontSize: 24,
    fontWeight: "600",
  },
  basket: {
    width: 41,
    height: 41,
    backgroundColor: P.fog,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { paddingHorizontal: 17, paddingTop: 20, paddingBottom: 65 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  help: {
    color: P.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 5,
  },
  progressCard: {
    padding: 21,
    backgroundColor: P.slate,
    borderRadius: 24,
    marginBottom: 17,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressEyebrow: {
    color: P.pale,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  progressTitle: {
    color: P.white,
    fontFamily: SERIF,
    fontSize: 31,
    fontWeight: "600",
    marginTop: 11,
  },
  progressOf: { color: "#D6DDDF", fontSize: 23 },
  progressHelp: { fontSize: 13, color: "#E5EAEB", marginTop: 6 },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "#84959A",
    overflow: "hidden",
    marginTop: 22,
  },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: P.pale },
  progressCaption: {
    color: "#E5EAEB",
    fontWeight: "800",
    letterSpacing: 1.1,
    fontSize: 10,
    marginTop: 10,
  },
  quickAddCard: {
    backgroundColor: P.white,
    borderRadius: 20,
    padding: 15,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EBE5DF",
  },
  quickTitle: {
    color: P.charcoal,
    fontFamily: SERIF,
    fontSize: 19,
    fontWeight: "600",
    marginBottom: 11,
  },
  quickAdd: {
    backgroundColor: P.row,
    padding: 5,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickInput: {
    flex: 1,
    minHeight: 42,
    color: P.charcoal,
    fontSize: 14,
    paddingHorizontal: 10,
  },
  quickButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: P.deepSlate,
  },
  dimmed: { opacity: 0.5 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
    marginBottom: 17,
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 23,
    fontWeight: "600",
    color: P.charcoal,
  },
  count: {
    fontFamily: undefined,
    fontSize: 15,
    fontWeight: "500",
    color: P.brown,
  },
  categoryHint: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionHint: { fontSize: 11, color: P.brown },
  group: { marginBottom: 18 },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  groupIcon: {
    width: 29,
    height: 29,
    backgroundColor: P.fog,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  groupTitle: { fontWeight: "700", fontSize: 14, color: P.deepSlate, flex: 1 },
  groupCount: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: P.fog,
    borderRadius: 20,
    color: P.brown,
    fontWeight: "700",
    fontSize: 12,
    overflow: "hidden",
  },
  item: {
    backgroundColor: P.white,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 73,
    borderWidth: 1,
    borderColor: "#EAE5DE",
  },
  collectedItem: { backgroundColor: "#EBEAE6", opacity: 0.85 },
  itemPress: {
    flex: 1,
    padding: 10,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 51,
    height: 51,
    borderRadius: 11,
    backgroundColor: P.row,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.fog,
  },
  itemBody: { flex: 1, gap: 4 },
  itemName: { fontSize: 15, color: P.charcoal, fontWeight: "600" },
  collectedName: { textDecorationLine: "line-through", color: P.muted },
  itemSub: { color: P.brown, fontSize: 12 },
  creditTouch: { paddingRight: 10, paddingLeft: 2, paddingVertical: 18 },
  collectedArea: { marginTop: 12, marginBottom: 18 },
  collectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 12,
    backgroundColor: P.fog,
    borderRadius: 14,
  },
  collectedHeaderTitle: {
    flex: 1,
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: "600",
    color: P.charcoal,
  },
  collectedHint: {
    fontSize: 12,
    color: P.muted,
    paddingTop: 10,
    paddingLeft: 10,
  },
  emptyCard: {
    padding: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: P.white,
    gap: 5,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: SERIF,
    fontWeight: "600",
    color: P.deepSlate,
    marginTop: 5,
  },
  finishButton: {
    backgroundColor: P.deepSlate,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 15,
    marginTop: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonText: {
    flex: 1,
    textAlign: "center",
    color: P.white,
    fontWeight: "800",
    fontSize: 15,
  },
  footer: {
    flexDirection: "row",
    gap: 9,
    marginTop: 13,
    padding: 14,
    borderRadius: 13,
    backgroundColor: P.fog,
    alignItems: "flex-start",
  },
  footerText: { flex: 1, fontSize: 12, lineHeight: 18, color: P.brown },
  pexelsLink: { alignSelf: "center", paddingVertical: 14 },
  pexelsText: { color: P.muted, fontSize: 11, textDecorationLine: "underline" },
});
