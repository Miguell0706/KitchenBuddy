import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  danger: "#9A5149",
  dangerSoft: "#F7EDE9",
  heroText: "#FDFBF7",
  heroMuted: "#DBE3E4",
};

const SavedRecipesScreen: React.FC = () => {
  const router = useRouter();
  const saved = useRecipesStore((s) => s.saved);
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);
  const unsaveRecipe = useRecipesStore((s) => s.unsaveRecipe);

  function openRecipe(title: string) {
    selectRecipe(title);
    router.push("/recipes/recipe");
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="bookmark-outline" size={23} color={P.heroText} />
            </View>
            <Text style={styles.eyebrow}>YOUR RECIPE COLLECTION</Text>
          </View>
          <Text style={styles.heroTitle}>Saved recipes</Text>
          <Text style={styles.heroSubtitle}>
            Keep your favorites close, ready whenever inspiration strikes.
          </Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatRow}>
            <Text style={styles.heroCount}>{saved.length}</Text>
            <Text style={styles.heroCountLabel}>
              {saved.length === 1 ? "recipe saved" : "recipes saved"}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR FAVORITES</Text>
            <Text style={styles.sectionTitle}>Recipe library</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{saved.length}</Text>
          </View>
        </View>

        {saved.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmarks-outline" size={29} color={P.slate} />
            </View>
            <Text style={styles.emptyTitle}>Your collection starts here</Text>
            <Text style={styles.emptyText}>
              You haven’t saved any recipes yet. Find a recipe you love and tap
              Save recipe to keep it here.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to recipes"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emptyButtonText}>Explore recipes</Text>
              <Ionicons name="arrow-forward" size={17} color={P.heroText} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {saved.map((item) => {
              const imgUrl = item.image?.url;
              const avgColor = item.image?.avgColor ?? P.taupe;
              return (
                <View key={item.title} style={styles.recipeCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View recipe ${item.title}`}
                    onPress={() => openRecipe(item.title)}
                    style={({ pressed }) => [
                      styles.recipeMain,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[styles.thumbWrap, { backgroundColor: avgColor }]}
                    >
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={styles.thumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons
                            name="restaurant-outline"
                            size={27}
                            color={P.slate}
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardEyebrow}>SAVED RECIPE</Text>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!!item.servings && (
                        <View style={styles.servingsRow}>
                          <Ionicons
                            name="people-outline"
                            size={13}
                            color={P.muted}
                          />
                          <Text style={styles.cardMeta} numberOfLines={1}>
                            {item.servings}
                          </Text>
                        </View>
                      )}
                      <View style={styles.viewRow}>
                        <Text style={styles.viewText}>View recipe</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={15}
                          color={P.slateDeep}
                        />
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.cardFooter}>
                    <View style={styles.savedLabel}>
                      <Ionicons name="bookmark" size={13} color={P.slate} />
                      <Text style={styles.savedLabelText}>
                        Saved to your collection
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.title} from saved recipes`}
                      hitSlop={8}
                      onPress={() => unsaveRecipe(item.title)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={P.danger}
                      />
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footer}>KITCHENBUDDY · COOK SOMETHING GOOD</Text>
      </ScrollView>
    </View>
  );
};

export default SavedRecipesScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.background },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 52 },
  hero: {
    backgroundColor: P.slateDeep,
    borderRadius: 26,
    padding: 22,
    marginBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  heroIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: P.heroMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    flexShrink: 1,
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "700",
    color: P.heroText,
  },
  heroSubtitle: {
    color: P.heroMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 310,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 22,
    marginBottom: 16,
  },
  heroStatRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  heroCount: {
    fontFamily: "serif",
    fontSize: 30,
    color: P.heroText,
    fontWeight: "700",
  },
  heroCountLabel: { color: P.heroMuted, fontSize: 12, fontWeight: "600" },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: P.slate,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "serif",
    fontWeight: "700",
    color: P.ink,
  },
  countPill: {
    minWidth: 31,
    height: 31,
    borderRadius: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.taupe,
  },
  countPillText: { fontSize: 12, fontWeight: "800", color: P.slateDeep },
  list: { gap: 13 },
  recipeCard: {
    backgroundColor: P.paper,
    borderRadius: 19,
    borderColor: P.border,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 128,
  },
  recipeMain: { flexDirection: "row", minHeight: 128 },
  thumbWrap: { width: 112, minHeight: 128 },
  thumbImage: { width: "100%", height: "100%" },
  thumbPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: P.taupe,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 15,
    justifyContent: "center",
    minWidth: 0,
  },
  cardEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: P.slate,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: P.ink, lineHeight: 22 },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  cardMeta: { fontSize: 12, color: P.muted, flexShrink: 1 },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 11,
  },
  viewText: { color: P.slateDeep, fontSize: 12, fontWeight: "800" },
  cardFooter: {
    borderTopWidth: 1,
    borderColor: P.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 8,
  },
  savedLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  savedLabelText: { color: P.muted, fontSize: 11, flexShrink: 1 },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: P.dangerSoft,
  },
  removeText: { fontSize: 12, color: P.danger, fontWeight: "700" },
  emptyCard: {
    paddingHorizontal: 22,
    paddingVertical: 32,
    borderRadius: 21,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 23,
    color: P.ink,
    textAlign: "center",
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: P.muted,
    marginTop: 9,
    maxWidth: 295,
  },
  emptyButton: {
    marginTop: 22,
    minHeight: 45,
    paddingHorizontal: 19,
    borderRadius: 13,
    backgroundColor: P.slateDeep,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: { color: P.heroText, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  footer: {
    marginTop: 29,
    textAlign: "center",
    color: P.muted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
});
