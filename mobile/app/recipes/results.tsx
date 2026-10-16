import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRecipesStore } from "@/features/recipes/store";

const P = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  pale: "#F1EDE6",
  white: "#FFFFFF",
};

/** Preview both the older string[] and newer structured ingredient responses. */
function ingredientPreview(value: unknown): string {
  if (!Array.isArray(value)) return typeof value === "string" ? value : "";
  return value
    .map((part: unknown) => {
      if (typeof part === "string") return part.trim();
      if (!part || typeof part !== "object") return "";
      const ingredient = part as {
        name?: unknown;
        quantity?: unknown;
        unit?: unknown;
      };
      if (typeof ingredient.name !== "string") return "";
      const name = ingredient.name.trim();
      if (!name) return "";
      const quantity =
        typeof ingredient.quantity === "number" &&
        Number.isFinite(ingredient.quantity)
          ? String(ingredient.quantity)
          : "";
      const unit =
        typeof ingredient.unit === "string" ? ingredient.unit.trim() : "";
      return [quantity, unit && unit.toLowerCase() !== "unit" ? unit : "", name]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join(" · ");
}

export default function RecipeResultsScreen() {
  const router = useRouter();
  const { queryTitle, recipes, cached } = useRecipesStore();
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(item, idx) => `${item.title}-${idx}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.navigation}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.back,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={21} color={P.ink} />
              </Pressable>
              <Text style={styles.navigationLabel}>KITCHENBUDDY / RECIPES</Text>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  <Ionicons
                    name="restaurant-outline"
                    size={22}
                    color={P.white}
                  />
                </View>
                <Text style={styles.heroEyebrow}>DISCOVER SOMETHING GOOD</Text>
              </View>
              <Text style={styles.heroTitle}>Recipe results</Text>
              <Text style={styles.heroDescription}>
                {queryTitle
                  ? `A little inspiration for ${queryTitle}. Find something worth making.`
                  : "A little inspiration for your next meal. Find something worth making."}
              </Text>
              <View style={styles.heroDivider} />
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNumber}>{recipes.length}</Text>
                  <Text style={styles.heroStatLabel}>
                    {recipes.length === 1 ? "RECIPE FOUND" : "RECIPES FOUND"}
                  </Text>
                </View>
                {cached ? (
                  <View style={styles.cachedPill}>
                    <Ionicons name="flash-outline" size={13} color={P.white} />
                    <Text style={styles.cachedText}>Saved result</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
                <Text style={styles.sectionTitle}>Explore recipes</Text>
              </View>
              <Text style={styles.resultCount}>{recipes.length} results</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={27} color={P.slate} />
            </View>
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptyText}>
              Try a different item name. Ingredient-based search may be
              available in a future update.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back-outline" size={16} color={P.white} />
              <Text style={styles.emptyButtonText}>Go back</Text>
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const imgUrl = item.image?.url ?? "";
          const avgColor = item.image?.avgColor ?? P.pale;
          const preview = ingredientPreview(item.ingredients);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => {
                selectRecipe(item.title);
                router.push("/recipes/recipe");
              }}
              accessibilityRole="button"
              accessibilityLabel={`View recipe ${item.title}`}
            >
              <View style={[styles.thumbnail, { backgroundColor: avgColor }]}>
                {imgUrl ? (
                  <Image
                    source={{ uri: imgUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons
                      name="restaurant-outline"
                      size={31}
                      color={P.slate}
                    />
                  </View>
                )}
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardEyebrow}>RECIPE IDEA</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {!!item.servings && (
                  <View style={styles.servingsRow}>
                    <Ionicons name="people-outline" size={13} color={P.muted} />
                    <Text style={styles.cardMeta}>{String(item.servings)}</Text>
                  </View>
                )}
                {preview ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {preview}
                  </Text>
                ) : null}
                <View style={styles.cardLinkRow}>
                  <Text style={styles.cardLink}>View recipe</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={P.slateDeep}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Text style={styles.footer}>
            MADE FOR YOUR KITCHEN · KITCHENBUDDY
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
    flexGrow: 1,
  },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navigationLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.7,
    color: P.muted,
  },
  hero: {
    borderRadius: 25,
    backgroundColor: P.slate,
    padding: 22,
    marginBottom: 26,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  heroIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    color: "#E5EDF0",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    flexShrink: 1,
  },
  heroTitle: {
    fontSize: 31,
    lineHeight: 37,
    fontFamily: "serif",
    color: P.white,
    fontWeight: "700",
  },
  heroDescription: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: "#EDF2F3",
    maxWidth: 340,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginTop: 21,
    marginBottom: 14,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroStat: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  heroStatNumber: {
    fontSize: 25,
    color: P.white,
    fontWeight: "700",
    fontFamily: "serif",
  },
  heroStatLabel: {
    color: "#E5EDF0",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  cachedPill: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  cachedText: { color: P.white, fontSize: 11, fontWeight: "600" },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  eyebrow: {
    color: P.slate,
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1.7,
    marginBottom: 4,
  },
  sectionTitle: {
    color: P.ink,
    fontFamily: "serif",
    fontWeight: "700",
    fontSize: 23,
  },
  resultCount: { color: P.muted, fontSize: 12, marginBottom: 3 },
  separator: { height: 12 },
  card: {
    flexDirection: "row",
    backgroundColor: P.paper,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: P.border,
    overflow: "hidden",
    minHeight: 159,
    maxHeight: 159,
  },
  thumbnail: { width: 112, alignSelf: "stretch", minHeight: 159 },
  thumbnailImage: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardContent: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  cardEyebrow: {
    color: P.slate,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  cardTitle: {
    color: P.ink,
    fontSize: 17,
    lineHeight: 21,
    fontFamily: "serif",
    fontWeight: "700",
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  cardMeta: { color: P.muted, fontSize: 11 },
  cardDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: P.muted,
    marginTop: 7,
  },
  cardLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 11,
  },
  cardLink: { fontSize: 12, fontWeight: "700", color: P.slateDeep },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.pale,
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "serif",
    color: P.ink,
    fontSize: 22,
    fontWeight: "700",
  },
  emptyText: {
    color: P.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: P.slateDeep,
    paddingHorizontal: 19,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  emptyButtonText: { color: P.white, fontWeight: "700", fontSize: 13 },
  pressed: { opacity: 0.75 },
  footer: {
    fontSize: 9,
    color: P.muted,
    letterSpacing: 1.4,
    textAlign: "center",
    marginTop: 28,
  },
});
