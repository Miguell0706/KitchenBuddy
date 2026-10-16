/**
 * KitchenBuddy Grocery List — Ivory / Slate editorial redesign.
 * Replace your current Grocery List screen with this file.
 * Bundle grocery-suggestions.png at mobile/assets/images/grocery-suggestions.png.
 * Shares the same manual image overrides and automatic image cache as Finish Shopping.
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
import { useFocusEffect, useRouter } from "expo-router";
import { usePremium } from "@/context/PremiumContext";
import {
  getPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";
import { loadPantry } from "@/features/pantry/storage";
import type { IngredientImage, PantryItem } from "@/features/pantry/types";
import {
  getPantryRepurchaseStats,
  getPantryLifecycles,
} from "@/features/pantry/analytics";
import {
  GROCERY_STORAGE_KEY as STORAGE_KEY,
  type GroceryItem,
  isGroceryItem,
  ingredientKey,
  parseIngredient,
} from "@/features/grocery/groceryIngredients";
import {
  ingredientImageOverrideKey,
  listIngredientImageOverrides,
  type IngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";
import { RECIPES_URL } from "@/config/api";

const P = {
  ivory: "#F5F2EC",
  card: "#FFFEFA",
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
const SUGGESTION_ART = require("@/assets/images/grocery-suggestions.png");

const IMAGE_ENDPOINT = RECIPES_URL.replace(
  /\/api\/recipes\/?$/,
  "/api/images/ingredient-image",
);
// Exact same device cache key and data shape used by Finish Shopping.
const AUTO_IMAGE_CACHE_KEY = "@kb_finish_shopping_images_v1";
const IMAGE_TTL = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10000;
const CONCURRENT_LOOKUPS = 3;

type CacheEntry = { image: IngredientImage | null; expiresAt: number };
type Suggestion = { name: string; reason: string; priority: number };
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function remoteImage(value: unknown): value is IngredientImage {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { url?: unknown }).url === "string" &&
    /^https?:\/\//i.test((value as { url: string }).url)
  );
}
async function readCache(): Promise<Record<string, CacheEntry>> {
  const raw = await AsyncStorage.getItem(AUTO_IMAGE_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      return {};
    const next: Record<string, CacheEntry> = {};
    for (const [key, row] of Object.entries(parsed)) {
      if (!row || typeof row !== "object") continue;
      const entry = row as Partial<CacheEntry>;
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now())
        continue;
      if (entry.image !== null && !remoteImage(entry.image)) continue;
      next[key] = { image: entry.image ?? null, expiresAt: entry.expiresAt };
    }
    return next;
  } catch {
    return {};
  }
}
async function fetchAutomatic(name: string): Promise<IngredientImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${IMAGE_ENDPOINT}?name=${encodeURIComponent(name)}`,
      { signal: controller.signal },
    );
    if (!response.ok)
      throw new Error(`Ingredient image HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object")
      throw new Error("Invalid image response");
    const parsed = body as { ok?: unknown; image?: unknown };
    if (parsed.ok !== true) throw new Error("Ingredient image request failed");
    if (parsed.image == null) return null;
    if (!remoteImage(parsed.image)) throw new Error("Invalid image URL");
    return parsed.image;
  } finally {
    clearTimeout(timeout);
  }
}
function displayName(item: GroceryItem): string {
  // Older recipe-generated entries sometimes store the amount in the name.
  return parseIngredient(item.name).name || item.name;
}
function quantitySubtitle(item: GroceryItem): string | null {
  const parsed = parseIngredient(item.name);
  const quantity = item.quantity ?? parsed.quantity;
  if (quantity == null) return null;
  const unit = (item.unit ?? parsed.unit ?? "").trim();
  return `${quantity}${unit && unit.toLowerCase() !== "unit" ? ` ${unit}` : ""}`;
}
function imageKey(item: GroceryItem): string {
  return ingredientImageOverrideKey(displayName(item));
}

export default function GroceryListScreen() {
  const router = useRouter();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [text, setText] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [history, setHistory] = useState<PantryHistoryEntry[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [overrides, setOverrides] = useState<
    Record<string, IngredientImageOverride>
  >({});
  const overridesRef = useRef<Record<string, IngredientImageOverride>>({});
  const pantryImagesRef = useRef<Record<string, IngredientImage>>({});
  const [automatic, setAutomatic] = useState<
    Record<string, IngredientImage | null>
  >({});
  const [imageBusy, setImageBusy] = useState<Record<string, boolean>>({});
  const attemptedRef = useRef(new Set<string>());
  const focusTokenRef = useRef(0);

  const hydrateImages = useCallback(
    async (
      list: GroceryItem[],
      preferences: Record<string, IngredientImageOverride>,
      pantryImages: Record<string, IngredientImage>,
      session: number,
    ) => {
      const active = () => focusTokenRef.current === session;
      let cache: Record<string, CacheEntry> = {};
      try {
        cache = await readCache();
      } catch (error) {
        console.warn("Grocery: image cache unavailable", error);
      }
      if (!active()) return;
      const initial: Record<string, IngredientImage | null> = {};
      const pending: { key: string; name: string }[] = [];
      for (const item of list) {
        const name = displayName(item);
        const key = ingredientImageOverrideKey(name);
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
        pending.push({ key, name });
      }
      if (!active()) return;
      if (Object.keys(initial).length)
        setAutomatic((prev) => ({ ...prev, ...initial }));
      if (!pending.length) return;
      setImageBusy((prev) => ({
        ...prev,
        ...Object.fromEntries(pending.map((row) => [row.key, true])),
      }));
      let cursor = 0;
      const fetched: Record<string, CacheEntry> = {};
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
              setAutomatic((prev) => ({ ...prev, [task.key]: image }));
          } catch (error) {
            // A failed Render request should not be cached as an empty image.
            attemptedRef.current.delete(task.key);
            console.warn(
              `Grocery: unable to fetch image for ${task.name}`,
              error,
            );
          } finally {
            if (active())
              setImageBusy((prev) => ({ ...prev, [task.key]: false }));
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENT_LOOKUPS, pending.length) },
          () => worker(),
        ),
      );
      if (active() && Object.keys(fetched).length) {
        try {
          const latest = await readCache();
          await AsyncStorage.setItem(
            AUTO_IMAGE_CACHE_KEY,
            JSON.stringify({ ...latest, ...fetched }),
          );
        } catch (error) {
          console.warn("Grocery: couldn't cache images", error);
        }
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const session = ++focusTokenRef.current;
      attemptedRef.current.clear();
      setLoading(true);
      setAutomatic({});
      setImageBusy({});
      (async () => {
        try {
          // The grocery list stays free. Pantry images can be reused by everyone;
          // purchase history is loaded only for Premium recommendations.
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(parsed))
            throw new Error("Invalid grocery list data");
          const list = parsed.filter(isGroceryItem);
          const [pantryResult, preferenceResult, historyResult] =
            await Promise.all([
              loadPantry().catch((error) => {
                console.warn("Grocery: pantry image lookup unavailable", error);
                return null;
              }),
              listIngredientImageOverrides().catch((error) => {
                console.warn("Grocery: image overrides unavailable", error);
                return {};
              }),
              isPremium && !premiumLoading
                ? getPantryHistory().catch((error) => {
                    console.warn("Grocery: history unavailable", error);
                    return [] as PantryHistoryEntry[];
                  })
                : Promise.resolve([] as PantryHistoryEntry[]),
            ]);
          if (!active) return;
          const pantry = pantryResult
            ? (Object.values(pantryResult).flat() as PantryItem[])
            : [];
          const pantryImages: Record<string, IngredientImage> = {};
          for (const p of pantry) {
            // An old local override file might have since been removed. Only
            // remote images are safe automatic fallbacks from Pantry records.
            if (!remoteImage(p.ingredientImage)) continue;
            for (const n of [p.name, p.recipeSearchName]) {
              const key = n ? ingredientImageOverrideKey(n) : "";
              if (key && !pantryImages[key])
                pantryImages[key] = p.ingredientImage;
            }
          }
          overridesRef.current = preferenceResult;
          pantryImagesRef.current = pantryImages;
          setItems(list);
          setOverrides(preferenceResult);
          setHistory(historyResult);
          setPantryItems(isPremium && !premiumLoading ? pantry : []);
          setLoading(false);
          void hydrateImages(list, preferenceResult, pantryImages, session);
        } catch (error) {
          console.warn("Unable to load grocery list", error);
          if (active)
            Alert.alert(
              "Loading error",
              "The grocery list could not be loaded.",
            );
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
        focusTokenRef.current += 1;
      };
    }, [isPremium, premiumLoading, hydrateImages]),
  );

  const updateItems = useCallback(
    async (updater: (before: GroceryItem[]) => GroceryItem[]) => {
      if (loading || savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed))
          throw new Error("Invalid saved grocery list");
        const previous = parsed.filter(isGroceryItem);
        const next = updater(previous);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setItems(next);
        void hydrateImages(
          next,
          overridesRef.current,
          pantryImagesRef.current,
          focusTokenRef.current,
        );
        return true;
      } catch (error) {
        console.warn("Unable to save grocery list", error);
        Alert.alert(
          "Save failed",
          "Your grocery list change could not be saved. Please try again.",
        );
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [loading, hydrateImages],
  );

  const addByName = useCallback(
    (value: string) => {
      const name = value.trim();
      if (!name || loading || savingRef.current) return;
      void updateItems((before) => [
        { id: uid(), name, checked: false, createdAt: Date.now() },
        ...before,
      ]).then((saved) => {
        if (saved) setText("");
      });
    },
    [loading, updateItems],
  );
  const toggle = (id: string) =>
    void updateItems((before) =>
      before.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  const remove = (id: string) =>
    void updateItems((before) => before.filter((item) => item.id !== id));
  const checkedCount = items.filter((item) => item.checked).length;
  const clearAll = () => {
    if (loading || saving || !items.length) return;
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
  const clearChecked = () => {
    if (loading || saving || !checkedCount) return;
    Alert.alert(
      "Clear checked items?",
      `Delete ${checkedCount} checked item${checkedCount === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear checked",
          style: "destructive",
          onPress: () => {
            void updateItems((before) =>
              before.filter((item) => !item.checked),
            );
          },
        },
      ],
    );
  };

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
  const displayedImage = (item: GroceryItem): IngredientImage | null => {
    const key = imageKey(item);
    return overrides[key]?.image ?? automatic[key] ?? null;
  };

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleArea}>
            <Text
              style={styles.screenTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Grocery List
            </Text>
            <Text style={styles.countText}>
              {loading
                ? "Loading..."
                : `${items.length} item${items.length === 1 ? "" : "s"}${saving ? " · Saving..." : ""}`}
            </Text>
          </View>
          <View style={styles.smartPill}>
            <Ionicons name="sparkles-outline" size={17} color={P.pale} />
            <Text style={styles.smartPillText}>Smart List</Text>
          </View>
        </View>

        <View style={[styles.card, styles.addCard]}>
          <Text style={styles.sectionHeading}>Add item</Text>
          <View style={styles.addRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g., Eggs"
              placeholderTextColor="#8F8A84"
              returnKeyType="done"
              onSubmitEditing={() => addByName(text)}
              editable={!loading && !saving}
              style={styles.addInput}
              accessibilityLabel="Add grocery item name"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add item to grocery list"
              onPress={() => addByName(text)}
              disabled={loading || saving || !text.trim()}
              style={({ pressed }) => [
                styles.addButton,
                (loading || saving || !text.trim()) && { opacity: 0.6 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="add" size={29} color={P.card} />
            </Pressable>
          </View>
        </View>

        {!loading && items.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${checkedCount ? "Resume" : "Start"} Shopping Mode`}
            disabled={saving}
            onPress={() => router.push("/grocery/shopping")}
            style={({ pressed }) => [
              styles.shopCard,
              pressed && { opacity: 0.87 },
              saving && { opacity: 0.55 },
            ]}
          >
            <View style={styles.shopTop}>
              <View style={styles.shopIcon}>
                <Ionicons name="basket-outline" size={24} color={P.pale} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopTitle}>
                  {checkedCount ? "Resume Shopping" : "Start Shopping"}
                </Text>
                <Text style={styles.shopCaption}>
                  {checkedCount} of {items.length} collected ·{" "}
                  {items.length - checkedCount} remaining
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={P.card} />
            </View>
            <View style={styles.shopProgress}>
              <View
                style={[
                  styles.shopProgressFill,
                  {
                    width: `${Math.min(100, (checkedCount / items.length) * 100)}%`,
                  },
                ]}
              />
            </View>
          </Pressable>
        )}

        <View style={styles.suggestionsCard}>
          {(!isPremium || suggestions.length === 0) && (
            <Image
              source={SUGGESTION_ART}
              style={styles.suggestionArt}
              resizeMode="cover"
              accessible={false}
            />
          )}
          <View style={styles.suggestionContent}>
            <View style={styles.suggestionHeadingRow}>
              <Ionicons name="sparkles-outline" color={P.pale} size={25} />
              <Text style={styles.suggestionHeading}>Smart Suggestions</Text>
            </View>
            <Text style={styles.suggestionSubtitle}>
              Based on your pantry history. Nothing is added automatically.
            </Text>
            {premiumLoading ? (
              <ActivityIndicator
                style={{ alignSelf: "flex-start", marginTop: 14 }}
                color={P.card}
              />
            ) : !isPremium ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.suggestionEmpty}>
                  Unlock personalized restock suggestions with KitchenBuddy
                  Premium.
                </Text>
                <Pressable
                  onPress={() => router.push("/settings/premium")}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock KitchenBuddy Premium"
                  style={styles.premiumButton}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={14}
                    color={P.deepSlate}
                  />
                  <Text style={styles.premiumButtonText}>Unlock Premium</Text>
                </Pressable>
              </View>
            ) : loading ? (
              <ActivityIndicator
                color={P.card}
                style={{ marginTop: 14, alignSelf: "flex-start" }}
              />
            ) : suggestions.length === 0 ? (
              <Text style={styles.suggestionEmpty}>
                No restock suggestions yet. As you track purchases and pantry
                use, suggestions will appear here.
              </Text>
            ) : (
              <View style={styles.suggestionList}>
                {suggestions.map((suggestion) => (
                  <View
                    key={ingredientKey(suggestion.name)}
                    style={styles.suggestionRow}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.suggestionName}>
                        {suggestion.name}
                      </Text>
                      <Text style={styles.suggestionReason}>
                        {suggestion.reason}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => addByName(suggestion.name)}
                      disabled={saving || loading}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${suggestion.name} to grocery list`}
                      style={styles.suggestionAdd}
                    >
                      <Ionicons name="add" size={21} color={P.deepSlate} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, styles.itemsCard]}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionHeading}>Items</Text>
            <View style={styles.clearActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear checked grocery items"
                onPress={clearChecked}
                disabled={loading || saving || checkedCount === 0}
                style={[
                  styles.clearPill,
                  (loading || saving || checkedCount === 0) && styles.disabled,
                ]}
              >
                <Text style={styles.clearText}>Clear checked</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all grocery items"
                onPress={clearAll}
                disabled={loading || saving || items.length === 0}
                style={[
                  styles.clearPill,
                  styles.clearAllPill,
                  (loading || saving || items.length === 0) && styles.disabled,
                ]}
              >
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator color={P.slate} style={{ marginVertical: 18 }} />
          ) : items.length === 0 ? (
            <Text style={styles.emptyItems}>
              Your list is empty. Add something above.
            </Text>
          ) : (
            items.map((item) => {
              const picture = displayedImage(item);
              const label = displayName(item);
              const quantity = quantitySubtitle(item);
              const key = imageKey(item);
              return (
                <View key={item.id} style={styles.itemRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Mark ${label} as ${item.checked ? "not purchased" : "purchased"}`}
                    accessibilityState={{
                      checked: item.checked,
                      disabled: saving,
                    }}
                    onPress={() => toggle(item.id)}
                    disabled={saving}
                    style={styles.checkboxArea}
                    hitSlop={5}
                  >
                    <Ionicons
                      name={
                        item.checked ? "checkmark-circle" : "ellipse-outline"
                      }
                      size={26}
                      color={item.checked ? P.slate : P.charcoal}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole={
                      picture?.credit?.provider === "pexels"
                        ? "button"
                        : "image"
                    }
                    accessibilityLabel={
                      picture?.credit?.provider === "pexels"
                        ? `Photo credit for ${label}`
                        : `Image for ${label}`
                    }
                    onPress={() => showCredit(picture)}
                    disabled={picture?.credit?.provider !== "pexels"}
                  >
                    {picture?.url ? (
                      <Image
                        source={{ uri: picture.url }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        {imageBusy[key] ? (
                          <ActivityIndicator size="small" color={P.slate} />
                        ) : (
                          <Ionicons
                            name="nutrition-outline"
                            size={23}
                            color={P.brown}
                          />
                        )}
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.rowDivider} />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: item.checked,
                      disabled: saving,
                    }}
                    accessibilityLabel={`${label}, ${item.checked ? "collected" : "not collected"}`}
                    onPress={() => toggle(item.id)}
                    disabled={saving}
                    style={styles.itemLabelArea}
                  >
                    <Text
                      style={[
                        styles.itemName,
                        item.checked && styles.itemChecked,
                      ]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                    {!!quantity && (
                      <Text style={styles.itemQuantity}>{quantity}</Text>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${label}`}
                    onPress={() => remove(item.id)}
                    disabled={saving}
                    style={styles.deleteButton}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={P.charcoal}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Photos provided by Pexels"
            onPress={() => {
              void Linking.openURL("https://www.pexels.com").catch(() => {});
            }}
            style={styles.photoFooter}
          >
            <Text style={styles.photoFooterText}>
              Photos provided by Pexels ↗
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ivory },
  content: { paddingHorizontal: 16, paddingTop: 19, paddingBottom: 45 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 22,
  },
  headerTitleArea: { flex: 1, minWidth: 0 },
  screenTitle: {
    fontFamily: SERIF,
    color: P.charcoal,
    fontSize: 38,
    letterSpacing: -1.2,
  },
  countText: { fontFamily: SERIF, color: P.muted, fontSize: 17, marginTop: 1 },
  smartPill: {
    backgroundColor: P.slate,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  smartPillText: { color: P.card, fontSize: 13, fontFamily: SERIF },
  card: {
    backgroundColor: P.card,
    borderRadius: 21,
    padding: 16,
    marginBottom: 16,
    shadowColor: P.charcoal,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
  },
  addCard: { paddingVertical: 18 },
  sectionHeading: {
    fontFamily: SERIF,
    fontSize: 28,
    color: P.charcoal,
    fontWeight: "600",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 13,
  },
  addInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: P.fog,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    color: P.charcoal,
    fontSize: 16,
  },
  addButton: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: P.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  shopCard: {
    backgroundColor: P.deepSlate,
    borderRadius: 18,
    padding: 15,
    marginBottom: 16,
    shadowColor: P.charcoal,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  shopTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  shopIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  shopTitle: {
    color: P.card,
    fontFamily: SERIF,
    fontSize: 19,
    fontWeight: "600",
  },
  shopCaption: { color: "#E2E7E7", fontSize: 12, marginTop: 3 },
  shopProgress: {
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
    marginTop: 13,
  },
  shopProgressFill: {
    height: "100%",
    backgroundColor: P.pale,
    borderRadius: 99,
  },
  suggestionsCard: {
    backgroundColor: P.slate,
    borderRadius: 21,
    overflow: "hidden",
    marginBottom: 16,
    minHeight: 180,
    shadowColor: P.charcoal,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 2,
  },
  suggestionArt: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 143,
    height: 176,
    opacity: 0.91,
  },
  suggestionContent: { paddingHorizontal: 18, paddingVertical: 19 },
  suggestionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 5,
  },
  suggestionHeading: {
    fontFamily: SERIF,
    color: P.card,
    fontSize: 24,
    fontWeight: "500",
    flexShrink: 1,
  },
  suggestionSubtitle: {
    fontSize: 12.5,
    color: "#F3F3EF",
    lineHeight: 19,
    marginTop: 11,
    maxWidth: "78%",
  },
  suggestionEmpty: {
    fontFamily: SERIF,
    fontSize: 15.5,
    color: P.card,
    lineHeight: 22,
    marginTop: 13,
    maxWidth: "78%",
  },
  suggestionList: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomColor: "rgba(255,255,255,0.15)",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionName: { fontSize: 15, fontWeight: "600", color: P.card },
  suggestionReason: {
    fontSize: 11.5,
    color: "#E6E9E9",
    lineHeight: 16,
    marginTop: 3,
  },
  suggestionAdd: {
    backgroundColor: P.card,
    borderRadius: 99,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 5,
    backgroundColor: P.card,
    borderRadius: 99,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 11,
  },
  premiumButtonText: { color: P.deepSlate, fontSize: 12, fontWeight: "700" },
  itemsCard: { paddingHorizontal: 13, paddingTop: 17 },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 16,
  },
  clearActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  clearPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: P.fog,
  },
  clearAllPill: { backgroundColor: P.slate },
  clearText: { color: P.charcoal, fontSize: 11.5, fontWeight: "500" },
  clearAllText: { color: P.card, fontSize: 11.5, fontWeight: "600" },
  disabled: { opacity: 0.38 },
  emptyItems: { fontSize: 14, color: P.muted, paddingVertical: 12 },
  itemRow: {
    backgroundColor: P.row,
    borderRadius: 17,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 65,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  checkboxArea: {
    width: 27,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabelArea: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    minHeight: 44,
  },
  thumb: { width: 42, height: 42, borderRadius: 10, backgroundColor: P.fog },
  thumbPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: P.fog,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDivider: {
    width: 1,
    height: 31,
    backgroundColor: "#D7D2CA",
    marginHorizontal: 1,
  },
  itemName: {
    color: P.charcoal,
    fontFamily: SERIF,
    fontSize: 17,
    flexShrink: 1,
  },
  itemQuantity: { fontSize: 11.5, color: P.muted, marginTop: 2 },
  itemChecked: { color: P.muted, textDecorationLine: "line-through" },
  deleteButton: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: P.fog,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFooter: { alignSelf: "center", paddingTop: 7, paddingBottom: 1 },
  photoFooterText: {
    color: P.muted,
    fontSize: 11,
    textDecorationLine: "underline",
  },
});
