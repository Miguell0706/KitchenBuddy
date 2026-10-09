import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  getPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";
import { loadPantry } from "@/features/pantry/storage";
import type { PantryItem } from "@/features/pantry/types";
import {
  getPantryItemStats,
  getPantryItemTimingStats,
  getPantryRepurchaseStats,
  type AnalyticsRange,
} from "@/features/pantry/analytics";
import { useRecipesStore } from "@/features/recipes/store"; // Adjust if your recipes store lives at another path.

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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function IngredientPage() {
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const router = useRouter();
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const ingredientName = (rawName ?? "Unknown Ingredient").replace(/_/g, " ");
  const key = normalize(ingredientName);

  const [range, setRange] = useState<AnalyticsRange>("all");
  const [history, setHistory] = useState<PantryHistoryEntry[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const savedRecipes = useRecipesStore((state) => state.saved);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        try {
          const [events, pantry] = await Promise.all([
            getPantryHistory(),
            loadPantry(),
          ]);
          if (!active) return;
          setHistory(events);
          setPantryItems(Object.values(pantry).flat() as PantryItem[]);
        } catch (error) {
          console.warn("Failed to load ingredient details", error);
        } finally {
          if (active) setLoading(false);
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, []),
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
  const timing = useMemo(
    () => getPantryItemTimingStats(ingredientEvents)[0],
    [ingredientEvents],
  );
  const repurchase = useMemo(
    () => getPantryRepurchaseStats(ingredientEvents)[0],
    [ingredientEvents],
  );
  const imageUrl = currentItems.find((item) => item.ingredientImage?.url)
    ?.ingredientImage?.url;
  const category =
    currentItems[0]?.categoryKey ?? ingredientEvents[0]?.categoryKey;

  const matchingRecipes = useMemo(
    () =>
      savedRecipes.filter((recipe) =>
        recipe.ingredients.some((line) => {
          const normalizedLine = normalize(line);
          // Whole-phrase matching avoids substring false positives such as "ham" in "chamomile".
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroImage, styles.imagePlaceholder]}>
              <Text style={styles.imageIcon}>🥬</Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.title}>{ingredientName}</Text>
            <Text style={styles.subtitle}>
              {category
                ? category.replace(/([A-Z])/g, " $1")
                : "Ingredient Insights"}
            </Text>
            <Text style={styles.status}>
              {currentItems.length
                ? `In pantry · ${currentItems.length} ${currentItems.length === 1 ? "entry" : "entries"}`
                : "Not currently in pantry"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Current Inventory</Text>
        <View style={styles.card}>
          {loading ? (
            <Text style={styles.muted}>Loading...</Text>
          ) : currentItems.length === 0 ? (
            <Text style={styles.muted}>No current pantry entries.</Text>
          ) : (
            currentItems.map((item) => (
              <View key={item.id} style={styles.inventoryRow}>
                <Text style={styles.inventoryName}>
                  {item.quantity || "Quantity not set"}
                </Text>
                <Text style={styles.muted}>
                  Expires: {formatDate(item.expiryDate)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Ingredient Analytics</Text>
        <View style={styles.rangeRow}>
          {RANGES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setRange(option.value)}
              style={[
                styles.rangeButton,
                range === option.value && styles.rangeSelected,
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  range === option.value && styles.rangeTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.statsGrid}>
          <Stat label="Times Added" value={stats?.entered ?? 0} />
          <Stat label="Times Used" value={stats?.used ?? 0} />
          <Stat label="Times Expired" value={stats?.expired ?? 0} />
          <Stat
            label="Utilization"
            value={stats?.resolved ? `${stats.utilizationRate}%` : "—"}
          />
          <Stat
            label="Waste Rate"
            value={stats?.resolved ? `${stats.wasteRate}%` : "—"}
          />
          <Stat label="Other Removals" value={stats?.removed ?? 0} />
        </View>
        <Text style={styles.note}>
          Counts reflect recorded pantry events, not quantities consumed.
        </Text>

        <Text style={styles.sectionTitle}>Purchase & Usage Patterns</Text>
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Average days before use</Text>
            <Text style={styles.detailValue}>
              {timing?.averageDaysBeforeUse ?? "—"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Average days before expiration</Text>
            <Text style={styles.detailValue}>
              {timing?.averageDaysBeforeExpiry ?? "—"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Average days between additions</Text>
            <Text style={styles.detailValue}>
              {repurchase?.averageDaysBetween ?? "—"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Typical days between additions</Text>
            <Text style={styles.detailValue}>
              {repurchase?.typicalDaysBetween ?? "—"}
            </Text>
          </View>
          <Text style={styles.note}>
            Patterns use all-time history, regardless of the selected date
            range.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Saved Recipes ({matchingRecipes.length})
        </Text>
        <View style={styles.card}>
          {matchingRecipes.length === 0 ? (
            <Text style={styles.muted}>
              No saved recipes containing this ingredient yet.
            </Text>
          ) : (
            matchingRecipes.map((recipe) => (
              <View key={recipe.title} style={styles.recipeRow}>
                {recipe.image?.url ? (
                  <Image
                    source={{ uri: recipe.image.url }}
                    style={styles.recipeImage}
                  />
                ) : (
                  <View style={[styles.recipeImage, styles.imagePlaceholder]}>
                    <Text>🍽️</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { padding: 20, paddingBottom: 48 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  heroImage: { width: 110, height: 110, borderRadius: 16 },
  imagePlaceholder: {
    backgroundColor: "#EAEDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  imageIcon: { fontSize: 42 },
  heroInfo: { flex: 1 },
  title: { fontSize: 26, fontWeight: "700", color: "#171717" },
  subtitle: {
    color: "#777",
    fontSize: 14,
    marginTop: 5,
    textTransform: "capitalize",
  },
  status: { fontSize: 13, color: "#3D7850", marginTop: 10 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  inventoryRow: {
    paddingVertical: 8,
    borderBottomColor: "#EEE",
    borderBottomWidth: 1,
  },
  inventoryName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 3,
  },
  muted: { color: "#777", fontSize: 13 },
  rangeRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  rangeButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 3,
    backgroundColor: "white",
    borderRadius: 9,
    alignItems: "center",
  },
  rangeSelected: { backgroundColor: "#171717" },
  rangeText: { color: "#666", fontSize: 11, fontWeight: "600" },
  rangeTextSelected: { color: "white" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    width: "48%",
    minHeight: 95,
    justifyContent: "center",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#171717" },
  statLabel: { color: "#777", fontSize: 12, marginTop: 5 },
  note: {
    color: "#888",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  detailValue: { color: "#171717", fontWeight: "700" },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
  },
  recipeImage: { width: 65, height: 65, borderRadius: 10 },
  recipeInfo: { flex: 1 },
  recipeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginBottom: 5,
  },
});
