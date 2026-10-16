import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useRecipesStore } from "@/features/recipes/store";
import { usePantryStore } from "@/features/pantry/store";
import { usePremiumStore } from "@/features/premium/store";
import type { PantryItem } from "@/features/pantry/types";

const PALETTE = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  taupeLight: "#F2EDE6",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  white: "#FFFFFF",
};

const EXPIRING_SOON_DAYS = 7;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

function isExpiringSoon(item: PantryItem): boolean {
  if (!item.expiryDate) return false;
  const now = new Date();
  const expiry = new Date(item.expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= EXPIRING_SOON_DAYS;
}

function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={14} color={PALETTE.slateDark} />
        </Pressable>
      ) : null}
    </View>
  );
}

function IconTile({ icon, dark = false }: { icon: IconName; dark?: boolean }) {
  return (
    <View style={[styles.iconTile, dark && styles.iconTileDark]}>
      <Ionicons
        name={icon}
        size={22}
        color={dark ? PALETTE.paper : PALETTE.slateDark}
      />
    </View>
  );
}

const RecipesScreen: React.FC = () => {
  const recipes = useRecipesStore((s) => s.saved);
  const pantryByCategory = usePantryStore((s) => s.pantry);
  const isPremium = usePremiumStore((s) => s.isPremium);

  const pantryItems = useMemo(
    () => Object.values(pantryByCategory).flat(),
    [pantryByCategory],
  );
  const expiringSoon = useMemo(
    () => pantryItems.filter(isExpiringSoon),
    [pantryItems],
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
      // Direct locked users to the existing Premium information / test-access page.
      router.push("/settings/premium");
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
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="restaurant-outline"
                size={25}
                color={PALETTE.slateDark}
              />
            </View>
            <Text style={styles.heroEyebrow}>THE KITCHEN EDIT</Text>
          </View>
          <Text style={styles.heroTitle}>Recipes & Ideas</Text>
          <Text style={styles.heroDescription}>
            Make more with what you have. Find everyday inspiration, save the
            recipes you love, and make the most of your pantry.
          </Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroBottom}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{recipes.length}</Text>
              <Text style={styles.heroMetricLabel}>SAVED RECIPES</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{expiringSoon.length}</Text>
              <Text style={styles.heroMetricLabel}>TO USE SOON</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            eyebrow="YOUR COLLECTION"
            title="Saved recipes"
            action="See all"
            onAction={handleOpenSaved}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View saved recipes"
            onPress={handleOpenSaved}
            style={({ pressed }) => [
              styles.savedCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.savedArt}>
              <Ionicons
                name={
                  recipes.length === 0 ? "bookmark-outline" : "book-outline"
                }
                size={27}
                color={PALETTE.slateDark}
              />
            </View>
            <View style={styles.savedCopy}>
              <Text style={styles.cardTitle}>
                {recipes.length === 0
                  ? "Your collection starts here"
                  : `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} saved`}
              </Text>
              <Text style={styles.cardDescription}>
                {recipes.length === 0
                  ? "Save a recipe you love and it will be waiting here."
                  : "All your favorites, together in one place."}
              </Text>
              <Text style={styles.cardLink}>
                {recipes.length === 0
                  ? "Explore your collection"
                  : "Open collection"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={17}
              color={PALETTE.slateDark}
            />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="EVERYDAY COOKING" title="Easy ideas" />
          <Text style={styles.sectionDescription}>
            A little inspiration for tonight’s table.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use ingredients expiring soon"
            accessibilityState={{ disabled: expiringSoon.length === 0 }}
            disabled={expiringSoon.length === 0}
            onPress={handleExpiringSoon}
            style={({ pressed }) => [
              styles.ideaCard,
              expiringSoon.length === 0 && styles.ideaCardUnavailable,
              pressed && styles.pressed,
            ]}
          >
            <IconTile icon="time-outline" />
            <View style={styles.ideaCopy}>
              <Text style={styles.cardTitle}>Use expiring soon</Text>
              <Text style={styles.cardDescription}>
                Build recipes around ingredients expiring in the next{" "}
                {EXPIRING_SOON_DAYS} days.
              </Text>
              <View style={styles.smallPill}>
                <Text style={styles.smallPillText}>
                  {expiringSoon.length === 0
                    ? "Nothing expiring soon"
                    : `${expiringSoon.length} item${expiringSoon.length === 1 ? "" : "s"} ready to use`}
                </Text>
              </View>
            </View>
            <Ionicons
              name={
                expiringSoon.length === 0
                  ? "checkmark-circle-outline"
                  : "arrow-forward"
              }
              size={19}
              color={PALETTE.slateDark}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore quick meals"
            onPress={handleQuickMeals}
            style={({ pressed }) => [
              styles.ideaCard,
              pressed && styles.pressed,
            ]}
          >
            <IconTile icon="flash-outline" />
            <View style={styles.ideaCopy}>
              <Text style={styles.cardTitle}>Quick meals</Text>
              <Text style={styles.cardDescription}>
                Simple meal ideas for busy nights, with fewer ingredients and
                less prep.
              </Text>
              <View style={styles.smallPill}>
                <Text style={styles.smallPillText}>
                  Around 30 minutes or less
                </Text>
              </View>
            </View>
            <Ionicons
              name="arrow-forward"
              size={19}
              color={PALETTE.slateDark}
            />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeading
            eyebrow="A LITTLE MORE MAGIC"
            title="Made for your pantry"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isPremium
                ? "Open ingredient-based recipe creator"
                : "Explore KitchenBuddy Premium"
            }
            onPress={handleIngredientBuilder}
            style={({ pressed }) => [
              styles.premiumCard,
              pressed && styles.premiumPressed,
            ]}
          >
            <View style={styles.premiumTop}>
              <IconTile
                icon={isPremium ? "sparkles-outline" : "lock-closed-outline"}
                dark
              />
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={11} color={PALETTE.cream} />
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            </View>
            <Text style={styles.premiumTitle}>
              Ingredient-based recipe creator
            </Text>
            <Text style={styles.premiumDescription}>
              Choose ingredients from your pantry and discover tailored recipes
              that make the most of what you have.
            </Text>
            <View style={styles.premiumFooter}>
              <Text style={styles.premiumFooterText}>
                {isPremium
                  ? "Included in your Premium plan"
                  : "Explore Premium to unlock"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={PALETTE.paper} />
            </View>
          </Pressable>
        </View>

        <Text style={styles.footer}>GOOD FOOD, LESS WASTE · KITCHENBUDDY</Text>
      </ScrollView>
    </View>
  );
};

export default RecipesScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 64 },
  hero: {
    borderRadius: 25,
    backgroundColor: PALETTE.slate,
    padding: 23,
    marginBottom: 31,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 17 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: PALETTE.paper,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroEyebrow: {
    color: PALETTE.cream,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heroTitle: {
    fontFamily: "serif",
    color: PALETTE.paper,
    fontSize: 34,
    lineHeight: 41,
    marginBottom: 9,
  },
  heroDescription: {
    color: "#F1F1ED",
    fontSize: 13,
    lineHeight: 21,
    maxWidth: 350,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.23)",
    marginTop: 21,
    marginBottom: 14,
  },
  heroBottom: { flexDirection: "row", alignItems: "center" },
  heroMetric: { flex: 1 },
  heroMetricDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.23)",
    marginHorizontal: 18,
  },
  heroMetricValue: {
    fontFamily: "serif",
    fontSize: 25,
    color: PALETTE.paper,
    marginBottom: 3,
  },
  heroMetricLabel: {
    color: "#E7EAE8",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  section: { marginBottom: 28 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeadingCopy: { flex: 1 },
  eyebrow: {
    color: PALETTE.slate,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 5,
  },
  sectionTitle: {
    fontFamily: "serif",
    color: PALETTE.ink,
    fontSize: 25,
    lineHeight: 30,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
    paddingLeft: 12,
  },
  sectionActionText: {
    color: PALETTE.slateDark,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionDescription: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 13,
    marginTop: -4,
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PALETTE.paper,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 19,
    padding: 13,
    minHeight: 113,
  },
  savedArt: {
    width: 75,
    height: 82,
    borderRadius: 13,
    backgroundColor: PALETTE.taupeLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  savedCopy: { flex: 1, paddingRight: 5 },
  cardTitle: {
    color: PALETTE.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardDescription: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  cardLink: {
    color: PALETTE.slateDark,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  ideaCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: PALETTE.paper,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 19,
    padding: 15,
    marginBottom: 11,
    gap: 11,
  },
  ideaCardUnavailable: { opacity: 0.78 },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: PALETTE.taupeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileDark: { backgroundColor: "rgba(255,255,255,0.15)" },
  ideaCopy: { flex: 1, minWidth: 0 },
  smallPill: {
    borderRadius: 30,
    backgroundColor: PALETTE.taupeLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: 11,
  },
  smallPillText: { color: PALETTE.slateDark, fontSize: 10, fontWeight: "700" },
  premiumCard: {
    backgroundColor: PALETTE.slateDark,
    borderRadius: 21,
    padding: 19,
    overflow: "hidden",
  },
  premiumTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  premiumBadgeText: {
    color: PALETTE.paper,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "800",
  },
  premiumTitle: {
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 30,
    color: PALETTE.paper,
    marginBottom: 9,
  },
  premiumDescription: { color: "#EBEEEC", fontSize: 12, lineHeight: 20 },
  premiumFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 14,
    marginTop: 18,
  },
  premiumFooterText: { color: PALETTE.paper, fontSize: 12, fontWeight: "700" },
  footer: {
    color: PALETTE.muted,
    textAlign: "center",
    letterSpacing: 1.35,
    fontSize: 9,
    fontWeight: "700",
    paddingTop: 3,
  },
  pressed: { opacity: 0.73 },
  premiumPressed: { opacity: 0.86 },
});
