import React, { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { usePantryStore } from "@/features/pantry/store";
import type { PantryItem } from "@/features/pantry/types";
import { useRecipesStore, type Recipe } from "@/features/recipes/store";
import {
  countPantryIngredients,
  getPantryIngredientKeys,
} from "@/features/recipes/pantryIngredientMatch";

const C = {
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  paper: "#FFFEFB",
  border: "#E9E5DE",
  pale: "#F2EDE6",
  ready: "#E6EFE7",
  readyText: "#3A6043",
};

type RankedRecipe = {
  recipe: Recipe;
  matched: number;
  total: number;
  missing: number;
  coverage: number;
};

/** Compare known recipes without making any additional recipe API requests. */
function rankRecipes(
  pantry: PantryItem[],
  saved: Recipe[],
  recent: Recipe[],
): RankedRecipe[] {
  const pantryKeys = getPantryIngredientKeys(pantry);

  // Keep just one copy of each title, preferring one with an existing photo.
  const known = new Map<string, Recipe>();
  for (const recipe of [...saved, ...recent]) {
    if (!recipe?.title?.trim() || !Array.isArray(recipe.ingredients)) continue;
    const titleKey = recipe.title.trim().toLowerCase();
    const existing = known.get(titleKey);
    if (!existing || (!existing.image?.url && recipe.image?.url)) {
      known.set(titleKey, recipe);
    }
  }

  const matches: RankedRecipe[] = [];
  for (const recipe of known.values()) {
    const { matched, total } = countPantryIngredients(
      recipe.ingredients,
      pantryKeys,
    );
    if (matched === 0) continue;

    matches.push({
      recipe,
      matched,
      total,
      missing: total - matched,
      coverage: matched / total,
    });
  }

  return matches
    .sort(
      (a, b) =>
        b.coverage - a.coverage ||
        b.matched - a.matched ||
        a.missing - b.missing ||
        a.recipe.title.localeCompare(b.recipe.title),
    )
    .slice(0, 8);
}

export default function PantryRecipeMatches() {
  const pantryByCategory = usePantryStore((s) => s.pantry);
  const pantryHydrated = usePantryStore((s) => s.hydrated);
  const saved = useRecipesStore((s) => s.saved);
  const recent = useRecipesStore((s) => s.recipes);
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);

  const ranked = useMemo(
    () => rankRecipes(Object.values(pantryByCategory).flat(), saved, recent),
    [pantryByCategory, saved, recent],
  );
  const hasPantryItems = Object.values(pantryByCategory).some(
    (items) => items.length > 0,
  );
  const hasKnownRecipes = saved.length + recent.length > 0;

  function openRecipe(title: string) {
    selectRecipe(title);
    router.push("/recipes/recipe");
  }

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>COOK FROM YOUR PANTRY</Text>
      <Text style={styles.heading}>Closest recipe matches</Text>
      <Text style={styles.description}>
        Recipes you can make with the ingredients you already have.
      </Text>

      {ranked.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {ranked.map(({ recipe, matched, total, missing, coverage }) => (
            <Pressable
              key={recipe.title.toLowerCase()}
              accessibilityRole="button"
              accessibilityLabel={`View ${recipe.title}; ${matched} of ${total} ingredients in your pantry`}
              onPress={() => openRecipe(recipe.title)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.photoWrap}>
                {recipe.image?.url ? (
                  <Image
                    source={{ uri: recipe.image.url }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoFallback}>
                    <Ionicons
                      name="restaurant-outline"
                      size={34}
                      color={C.slate}
                    />
                  </View>
                )}
                <View style={styles.photoPill}>
                  <Ionicons name="checkmark-circle" size={12} color={C.paper} />
                  <Text style={styles.photoPillText}>
                    {matched} of {total} in pantry
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text numberOfLines={2} style={styles.recipeTitle}>
                  {recipe.title}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${coverage * 100}%` },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.missingText,
                    missing === 0 && styles.readyText,
                  ]}
                >
                  {missing === 0
                    ? "All ingredients on hand"
                    : `${missing} ingredient${missing === 1 ? "" : "s"} missing`}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="basket-outline" size={23} color={C.slate} />
          <View style={styles.emptyTextWrap}>
            <Text style={styles.emptyTitle}>
              {!pantryHydrated
                ? "Checking your pantry..."
                : !hasPantryItems
                  ? "Add food to your pantry"
                  : !hasKnownRecipes
                    ? "Discover or save some recipes"
                    : "No close matches yet"}
            </Text>
            <Text style={styles.emptyDescription}>
              {!pantryHydrated
                ? "Your recommendations will appear after your pantry loads."
                : "We'll compare recipes you've saved or recently viewed against your pantry."}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 30 },
  eyebrow: {
    color: C.slate,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 5,
  },
  heading: {
    fontFamily: "serif",
    color: C.ink,
    fontSize: 25,
    lineHeight: 30,
    marginBottom: 8,
  },
  description: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  row: { paddingRight: 18, gap: 12, paddingBottom: 3 },
  card: {
    width: 176,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    overflow: "hidden",
  },
  pressed: { opacity: 0.75 },
  photoWrap: { height: 118, backgroundColor: C.pale },
  photo: { width: "100%", height: "100%" },
  photoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(41,45,44,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
  },
  photoPillText: { color: C.paper, fontSize: 10, fontWeight: "700" },
  cardBody: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12 },
  recipeTitle: { color: C.ink, fontSize: 14, fontWeight: "700", minHeight: 37 },
  progressTrack: {
    height: 5,
    borderRadius: 10,
    backgroundColor: C.pale,
    marginTop: 9,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.slateDark,
    borderRadius: 10,
  },
  missingText: { color: C.muted, fontSize: 11, marginTop: 7 },
  readyText: { color: C.readyText, fontWeight: "700" },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    padding: 16,
  },
  emptyTextWrap: { flex: 1 },
  emptyTitle: { color: C.ink, fontSize: 14, fontWeight: "700" },
  emptyDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
