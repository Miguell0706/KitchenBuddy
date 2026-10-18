import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  getPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";
import { loadPantry } from "@/features/pantry/storage";
import type { IngredientImage, PantryItem } from "@/features/pantry/types";
import { getIngredientImageOverride } from "@/features/pantry/ingredientImageOverrides";
import {
  getPantryItemStats,
  getPantryItemTimingStats,
  getPantryRepurchaseStats,
  type AnalyticsRange,
} from "@/features/pantry/analytics";
import { useRecipesStore } from "@/features/recipes/store";

const IMAGE_ENDPOINT =
  "https://receiptchef.onrender.com/api/images/ingredient-image";

const PALETTE = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  line: "#E9E5DE",
  cream: "#EDE6DA",
  heroText: "#F9F6F0",
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const RANGES: { label: string; value: AnalyticsRange }[] = [
  { label: "30 Days", value: "30d" },
  { label: "3 Months", value: "3m" },
  { label: "6 Months", value: "6m" },
  { label: "All Time", value: "all" },
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatCategory(value: string) {
  if (value === "meatSeafood") return "Meat & Seafood";
  if (value === "dairyEggs") return "Dairy & Eggs";
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

function SectionHeading({
  icon,
  title,
  caption,
}: {
  icon: IconName;
  title: string;
  caption?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={PALETTE.slateDark} />
      </View>
      <View style={styles.sectionHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: IconName;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={PALETTE.slate} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** The backend checks ingredient_image_cache first; Pexels is only a cache miss. */
async function fetchIngredientImage(
  name: string,
): Promise<IngredientImage | null> {
  const response = await fetch(
    `${IMAGE_ENDPOINT}?name=${encodeURIComponent(name)}`,
  );
  if (!response.ok) throw new Error(`Image lookup failed (${response.status})`);
  const result: { ok?: boolean; image?: IngredientImage | null } =
    await response.json();
  if (!result.ok || !result.image || typeof result.image.url !== "string")
    return null;
  if (!/^https?:\/\//i.test(result.image.url)) return null;
  return result.image;
}

export default function IngredientPage() {
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const ingredientName = (rawName ?? "Unknown Ingredient").replace(/_/g, " ");
  const key = normalize(ingredientName);

  const [range, setRange] = useState<AnalyticsRange>("all");
  const [history, setHistory] = useState<PantryHistoryEntry[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [preferredImage, setPreferredImage] = useState<IngredientImage | null>(
    null,
  );
  const [cachedImage, setCachedImage] = useState<IngredientImage | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const savedRecipes = useRecipesStore((state) => state.saved);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        // Recheck the shared image override on focus: Scan Review and Pantry can change it.
        try {
          const [events, pantry, override] = await Promise.all([
            getPantryHistory(),
            loadPantry(),
            getIngredientImageOverride(ingredientName).catch((error) => {
              console.warn("Failed to load preferred ingredient image", error);
              return null;
            }),
          ]);
          if (!active) return;
          const matchingPantry = Object.values(pantry).flat() as PantryItem[];
          setHistory(events);
          setPantryItems(matchingPantry);
          setPreferredImage(override?.image ?? null);
          setCachedImage(null);
          setFailedImageUrl(null);

          const matches = (value: {
            name: string;
            recipeSearchName?: string;
          }) =>
            normalize(value.name) === key ||
            Boolean(
              value.recipeSearchName &&
              normalize(value.recipeSearchName) === key,
            );
          const matchingItems = matchingPantry.filter(matches);
          const matchingEvents = events.filter(matches);
          const hasImage = Boolean(
            override?.image?.url ||
            matchingItems.some((item) => item.ingredientImage?.url) ||
            matchingEvents.some((event) => event.ingredientImage?.url),
          );
          // Existing history without a snapshot uses the Postgres/Pexels cache.
          if (!hasImage) {
            const lookupName =
              matchingEvents.find((event) => event.recipeSearchName?.trim())
                ?.recipeSearchName ||
              matchingItems.find((item) => item.recipeSearchName?.trim())
                ?.recipeSearchName ||
              ingredientName;
            void fetchIngredientImage(lookupName)
              .then((image) => {
                if (active) setCachedImage(image);
              })
              .catch((error) =>
                console.warn(
                  "Historical ingredient image lookup failed",
                  error,
                ),
              );
          }
        } catch (error) {
          console.warn("Failed to load ingredient details", error);
          if (active) setPreferredImage(null);
        } finally {
          if (active) setLoading(false);
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, [ingredientName]),
  );

  const currentItems = useMemo(
    () =>
      pantryItems.filter(
        (item) =>
          normalize(item.name) === key ||
          (item.recipeSearchName && normalize(item.recipeSearchName) === key),
      ),
    [pantryItems, key],
  );
  const ingredientEvents = useMemo(
    () =>
      history.filter(
        (event) =>
          normalize(event.name) === key ||
          (event.recipeSearchName && normalize(event.recipeSearchName) === key),
      ),
    [history, key],
  );
  const stats = useMemo(
    () => getPantryItemStats(ingredientEvents, range)[0],
    [ingredientEvents, range],
  );
  // These two metrics are intentionally all-time, independent of the selected range.
  const timing = useMemo(
    () => getPantryItemTimingStats(ingredientEvents)[0],
    [ingredientEvents],
  );
  const repurchase = useMemo(
    () => getPantryRepurchaseStats(ingredientEvents)[0],
    [ingredientEvents],
  );

  // Keep manual choices first; history snapshots survive Pantry removal.
  // Legacy history can use the shared backend Postgres/Pexels cache.
  const resolvedImageUrl =
    preferredImage?.url ||
    currentItems.find((item) => item.ingredientImage?.url)?.ingredientImage
      ?.url ||
    ingredientEvents.find((event) => event.ingredientImage?.url)
      ?.ingredientImage?.url ||
    cachedImage?.url ||
    null;
  const imageUrl =
    resolvedImageUrl !== failedImageUrl
      ? resolvedImageUrl
      : cachedImage?.url && cachedImage.url !== failedImageUrl
        ? cachedImage.url
        : null;
  const category =
    currentItems[0]?.categoryKey ?? ingredientEvents[0]?.categoryKey;

  const matchingRecipes = useMemo(
    () =>
      savedRecipes.filter((recipe) =>
        recipe.ingredients.some((line) => {
          const normalizedLine = normalize(line);
          // Whole-phrase match: e.g. "ham" must not match "chamomile".
          const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return (
            Boolean(key) &&
            new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(
              normalizedLine,
            )
          );
        }),
      ),
    [savedRecipes, key],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: ingredientName, headerBackTitle: "Back" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>YOUR INGREDIENT JOURNAL</Text>
            <View style={styles.heroMark}>
              <Ionicons
                name="leaf-outline"
                size={20}
                color={PALETTE.slateDark}
              />
            </View>
          </View>
          <View style={styles.heroBody}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.heroImage}
                resizeMode="cover"
                onError={() => {
                  setFailedImageUrl(imageUrl);
                  // If an older saved URL has gone stale, retry through Postgres.
                  if (!cachedImage?.url) {
                    const lookupName =
                      ingredientEvents.find((event) =>
                        event.recipeSearchName?.trim(),
                      )?.recipeSearchName ||
                      currentItems.find((item) => item.recipeSearchName?.trim())
                        ?.recipeSearchName ||
                      ingredientName;
                    void fetchIngredientImage(lookupName)
                      .then(setCachedImage)
                      .catch((error) =>
                        console.warn("Ingredient image recovery failed", error),
                      );
                  }
                }}
              />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Ionicons
                  name="nutrition-outline"
                  size={36}
                  color={PALETTE.slateDark}
                />
              </View>
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {ingredientName}
              </Text>
              <Text style={styles.heroCategory}>
                {category
                  ? formatCategory(String(category))
                  : "Ingredient Insights"}
              </Text>
              <View style={styles.heroStatus}>
                <Ionicons
                  name={
                    currentItems.length
                      ? "checkmark-circle-outline"
                      : "archive-outline"
                  }
                  size={14}
                  color={PALETTE.heroText}
                />
                <Text style={styles.heroStatusText}>
                  {currentItems.length
                    ? `In pantry · ${currentItems.length} ${currentItems.length === 1 ? "entry" : "entries"}`
                    : "Not currently in pantry"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="basket-outline"
            title="Current inventory"
            caption="What's in your pantry right now"
          />
          <View style={styles.card}>
            {loading ? (
              <View style={styles.stateRow}>
                <ActivityIndicator color={PALETTE.slate} />
                <Text style={styles.muted}>Loading inventory…</Text>
              </View>
            ) : currentItems.length === 0 ? (
              <View style={styles.emptyRow}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="archive-outline"
                    size={22}
                    color={PALETTE.slate}
                  />
                </View>
                <Text style={styles.emptyTitle}>No current pantry entries</Text>
                <Text style={styles.emptyText}>
                  This ingredient isn't currently saved in your pantry.
                </Text>
              </View>
            ) : (
              currentItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.inventoryRow, index > 0 && styles.rowDivider]}
                >
                  <View style={styles.inventoryIcon}>
                    <Ionicons
                      name="cube-outline"
                      size={17}
                      color={PALETTE.slate}
                    />
                  </View>
                  <View style={styles.inventoryInfo}>
                    <Text style={styles.inventoryName}>
                      {item.quantity || "Quantity not set"}
                    </Text>
                    <Text style={styles.muted}>
                      Expires: {formatDate(item.expiryDate)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="analytics-outline"
            title="Ingredient analytics"
            caption="How this ingredient moves through your pantry"
          />
          <View style={styles.rangeRow}>
            {RANGES.map((option) => {
              const active = range === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setRange(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.rangeButton,
                    active && styles.rangeSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rangeText,
                      active && styles.rangeTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.statsGrid}>
            <Stat
              label="Times added"
              value={stats?.entered ?? 0}
              icon="add-circle-outline"
            />
            <Stat
              label="Times used"
              value={stats?.used ?? 0}
              icon="checkmark-done-outline"
            />
            <Stat
              label="Times expired"
              value={stats?.expired ?? 0}
              icon="time-outline"
            />
            <Stat
              label="Utilization"
              value={stats?.resolved ? `${stats.utilizationRate}%` : "—"}
              icon="trending-up-outline"
            />
            <Stat
              label="Waste rate"
              value={stats?.resolved ? `${stats.wasteRate}%` : "—"}
              icon="stats-chart-outline"
            />
            <Stat
              label="Other removals"
              value={stats?.removed ?? 0}
              icon="remove-circle-outline"
            />
          </View>
          <View style={styles.noteRow}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={PALETTE.slate}
            />
            <Text style={styles.noteText}>
              Counts reflect recorded pantry events, not quantities consumed.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="repeat-outline"
            title="Purchase & usage patterns"
            caption="The rhythms of your pantry habits"
          />
          <View style={styles.scopeRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={PALETTE.slateDark}
            />
            <Text style={styles.scopeText}>ALL-TIME HISTORY</Text>
          </View>
          <View style={styles.card}>
            {(
              [
                [
                  "Average days before use",
                  timing?.averageDaysBeforeUse ?? "—",
                ],
                [
                  "Average days before expiration",
                  timing?.averageDaysBeforeExpiry ?? "—",
                ],
                [
                  "Average days between additions",
                  repurchase?.averageDaysBetween ?? "—",
                ],
                [
                  "Typical days between additions",
                  repurchase?.typicalDaysBetween ?? "—",
                ],
              ] as [string, string | number][]
            ).map(([label, value], index) => (
              <View
                key={label}
                style={[styles.detailRow, index > 0 && styles.rowDivider]}
              >
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
            <View style={styles.cardNote}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={PALETTE.slate}
              />
              <Text style={styles.noteText}>
                Patterns use all-time history, regardless of the selected date
                range.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            icon="book-outline"
            title={`Saved recipes (${matchingRecipes.length})`}
            caption="Recipes in your collection that use this ingredient"
          />
          <View style={styles.card}>
            {matchingRecipes.length === 0 ? (
              <View style={styles.emptyRow}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="bookmark-outline"
                    size={22}
                    color={PALETTE.slate}
                  />
                </View>
                <Text style={styles.emptyTitle}>No matching saved recipes</Text>
                <Text style={styles.emptyText}>
                  No saved recipes containing this ingredient yet.
                </Text>
              </View>
            ) : (
              matchingRecipes.map((recipe, index) => (
                <View
                  key={recipe.title}
                  style={[styles.recipeRow, index > 0 && styles.rowDivider]}
                >
                  {recipe.image?.url ? (
                    <Image
                      source={{ uri: recipe.image.url }}
                      style={styles.recipeImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[styles.recipeImage, styles.recipePlaceholder]}
                    >
                      <Ionicons
                        name="restaurant-outline"
                        size={23}
                        color={PALETTE.slate}
                      />
                    </View>
                  )}
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text style={styles.muted}>
                      {recipe.ingredients.length} ingredients
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
        <Text style={styles.footer}>KITCHENBUDDY · INGREDIENT JOURNAL</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 56 },
  hero: {
    backgroundColor: PALETTE.slateDark,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#E4E8E6",
    fontWeight: "700",
  },
  heroMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: PALETTE.heroText,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBody: { flexDirection: "row", gap: 15, alignItems: "center" },
  heroImage: {
    width: 103,
    height: 113,
    borderRadius: 16,
    backgroundColor: PALETTE.cream,
  },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroInfo: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 27,
    lineHeight: 32,
    color: PALETTE.heroText,
    fontWeight: "600",
  },
  heroCategory: { color: "#E7E9E5", fontSize: 12, marginTop: 6 },
  heroStatus: {
    marginTop: 11,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroStatusText: {
    color: PALETTE.heroText,
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },
  section: { marginBottom: 25 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: PALETTE.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeadingText: { flex: 1 },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "600",
    color: PALETTE.ink,
  },
  sectionCaption: {
    fontSize: 11,
    color: PALETTE.muted,
    marginTop: 3,
    lineHeight: 16,
  },
  card: {
    backgroundColor: PALETTE.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 15,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
  },
  inventoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 11,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: PALETTE.line },
  inventoryIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: PALETTE.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryInfo: { flex: 1 },
  inventoryName: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.ink,
    marginBottom: 4,
  },
  muted: { fontSize: 12, color: PALETTE.muted, lineHeight: 18 },
  emptyRow: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: PALETTE.cream,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: PALETTE.ink,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
    textAlign: "center",
  },
  rangeRow: {
    flexDirection: "row",
    backgroundColor: PALETTE.taupe,
    padding: 4,
    borderRadius: 14,
    gap: 3,
    marginBottom: 13,
  },
  rangeButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 39,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  rangeSelected: { backgroundColor: PALETTE.paper },
  rangeText: { fontSize: 11, color: PALETTE.muted, fontWeight: "600" },
  rangeTextSelected: { color: PALETTE.slateDark, fontWeight: "800" },
  pressed: { opacity: 0.76 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 114,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.paper,
    padding: 14,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  statValue: {
    fontFamily: "serif",
    fontWeight: "600",
    fontSize: 28,
    color: PALETTE.ink,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: PALETTE.muted,
    marginTop: 3,
  },
  noteRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 11,
    paddingHorizontal: 4,
  },
  noteText: { flex: 1, color: PALETTE.muted, lineHeight: 17, fontSize: 11 },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PALETTE.cream,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 11,
  },
  scopeText: {
    fontSize: 10,
    letterSpacing: 0.7,
    color: PALETTE.slateDark,
    fontWeight: "800",
  },
  detailRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    justifyContent: "space-between",
  },
  detailLabel: { fontSize: 12, lineHeight: 18, color: PALETTE.muted, flex: 1 },
  detailValue: {
    fontFamily: "serif",
    fontSize: 19,
    fontWeight: "600",
    color: PALETTE.ink,
    textAlign: "right",
  },
  cardNote: {
    marginTop: 8,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: PALETTE.line,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  recipeImage: {
    width: 65,
    height: 65,
    borderRadius: 11,
    backgroundColor: PALETTE.cream,
  },
  recipePlaceholder: { alignItems: "center", justifyContent: "center" },
  recipeInfo: { flex: 1 },
  recipeTitle: {
    color: PALETTE.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 4,
  },
  footer: {
    fontSize: 10,
    color: "#A09D97",
    textAlign: "center",
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
