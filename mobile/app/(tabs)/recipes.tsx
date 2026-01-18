import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Colors, Spacing } from "@/constants/theme";
import { useRecipesStore } from "@/features/recipes/store";
import { usePantryStore } from "@/features/pantry/store";
import { usePremiumStore } from "@/features/premium/store";
import type { PantryItem } from "@/features/pantry/types";

const EXPIRING_SOON_DAYS = 7;

function isExpiringSoon(item: PantryItem): boolean {
  if (!item.expiryDate) return false;
  const now = new Date();
  const expiry = new Date(item.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= EXPIRING_SOON_DAYS;
}

const RecipesScreen: React.FC = () => {
  const recipes = useRecipesStore((s) => s.saved);
  const pantryByCategory = usePantryStore((s) => s.pantry);

  const pantryItems = useMemo(
    () => Object.values(pantryByCategory).flat(),
    [pantryByCategory]
  );
  const isPremium = usePremiumStore((s) => s.isPremium);

  const expiringSoon = useMemo(
    () => pantryItems.filter(isExpiringSoon),
    [pantryItems]
  );

  function handleOpenSaved() {
    router.push("/recipes/saved");
  }

  function handleExpiringSoon() {
    const ids = expiringSoon.map((it) => it.id);
    console.log("🔥 handleUseExpiring ids:", ids);
    router.push({
      pathname: "/recipes/expiring",
      params: { itemIds: JSON.stringify(ids) },
    });
  }

  function handleQuickMeals() {
    router.push("/recipes/quick");
  }

  function handleIngredientBuilder() {
    if (!isPremium) {
      router.push("/");
      return;
    }
    router.push("/recipes/builder");
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Recipes & Ideas</Text>
        <Text style={styles.subtitle}>
          Turn what you already have into meals. Saved recipes and simple ideas
          are free. Advanced ingredient magic is premium.
        </Text>

        {/* Saved recipes */}
        <TouchableOpacity style={styles.section} onPress={handleOpenSaved}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved recipes</Text>
            <Text style={styles.link}>See all</Text>
          </View>

          <View style={[styles.cardBase, styles.emptyCard]}>
            {recipes.length === 0 ? (
              <>
                <Ionicons name="bookmark-outline" size={24} />
                <Text style={styles.emptyTitle}>No recipes saved yet</Text>
                <Text style={styles.emptyText}>
                  When you like a recipe, save it and it will show up here.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="book-outline" size={24} />
                <Text style={styles.emptyTitle}>
                  {recipes.length} recipe{recipes.length > 1 ? "s" : ""} saved
                </Text>
                <Text style={styles.emptyText}>
                  Tap to view all your saved recipes.
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Easy ideas (free) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Easy ideas</Text>
          </View>

          <View style={styles.cardRow}>
            <TouchableOpacity
              style={[
                styles.cardBase,
                styles.bigCard,
                { marginRight: Spacing.sm },
              ]}
              onPress={handleExpiringSoon}
              disabled={expiringSoon.length === 0}
            >
              <View style={styles.cardHeaderRow}>
                <Ionicons name="alert-circle-outline" size={22} />
                <Text style={styles.cardTitle}>Use expiring soon</Text>
              </View>
              <Text style={styles.cardText}>
                Build recipes from items expiring in the next{" "}
                {EXPIRING_SOON_DAYS} days.
              </Text>
              <Text style={styles.cardBadge}>
                {expiringSoon.length === 0
                  ? "No items expiring soon 🎉"
                  : `${expiringSoon.length} items ready to use`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardBase, styles.bigCard]}
              onPress={handleQuickMeals}
            >
              <View style={styles.cardHeaderRow}>
                <Ionicons name="flash-outline" size={22} />
                <Text style={styles.cardTitle}>Quick meals</Text>
              </View>
              <Text style={styles.cardText}>
                Fast recipes for busy nights, focused on fewer ingredients and
                short prep time.
              </Text>
              <Text style={styles.cardBadge}>Under ~30 minutes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium ingredient builder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Build with ingredients</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.cardBase,
              styles.premiumCard,
              !isPremium && styles.premiumLockedCard,
            ]}
            onPress={handleIngredientBuilder}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons
                name={isPremium ? "star-outline" : "lock-closed"}
                size={22}
              />
              <Text style={styles.cardTitle}>
                Ingredient-based recipe creator
              </Text>
            </View>
            <Text style={styles.cardText}>
              Pick ingredients from your pantry and get tailored recipes that
              match exactly what you have.
            </Text>

            {!isPremium ? (
              <View style={styles.premiumFooter}>
                <Text style={styles.premiumText}>
                  Premium feature – tap to unlock
                </Text>
                <Ionicons name="chevron-forward" size={18} />
              </View>
            ) : (
              <View style={styles.premiumFooter}>
                <Text style={styles.premiumText}>Included in Premium</Text>
                <Ionicons name="chevron-forward" size={18} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default RecipesScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  link: {
    color: Colors.primary,
    fontWeight: "500",
  },
  cardBase: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: Spacing.xs,
    textAlign: "center",
    color: "#666",
  },
  savedList: {
    paddingVertical: Spacing.xs,
  },
  recipeCard: {
    width: 160,
    marginRight: Spacing.sm,
    padding: Spacing.sm,
  },
  recipeImageStub: {
    height: 80,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#666",
    marginBottom: Spacing.sm,
  },
  recipeTitle: {
    fontWeight: "600",
  },
  recipeMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#666",
  },
  cardRow: {
    flexDirection: "row",
  },
  bigCard: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontWeight: "600",
    marginLeft: 6,
  },
  cardText: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  cardBadge: {
    fontSize: 12,
    fontWeight: "500",
  },
  premiumCard: {},
  premiumLockedCard: {
    opacity: 0.9,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  premiumFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  premiumText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
