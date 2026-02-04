import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useRecipesStore } from "@/features/recipes/store";
import { Ionicons } from "@expo/vector-icons";

export default function RecipeResultsScreen() {
  const router = useRouter();
  const { queryTitle, recipes, cached } = useRecipesStore();
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Recipes{queryTitle ? ` for “${queryTitle}”` : ""}
          </Text>
          <Text style={styles.subtitle}>
            {recipes.length} result{recipes.length === 1 ? "" : "s"}{" "}
            {cached ? "• cached" : ""}
          </Text>
        </View>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No recipes found</Text>
          <Text style={styles.emptyText}>
            Try a different item name (or later we’ll switch to ingredient-based
            search).
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item, idx) => `${item.title}-${idx}`}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const imgUrl = item.image?.url ?? "";
            const avgColor = item.image?.avgColor ?? "#eee";

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.card}
                onPress={() => {
                  selectRecipe(item.title);
                  router.push("/recipes/recipe");
                }}
              >
                {/* Left: full-height thumbnail */}
                <View style={[styles.thumbWrap, { backgroundColor: avgColor }]}>
                  {imgUrl ? (
                    <Image
                      source={{ uri: imgUrl }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Text style={styles.thumbPlaceholderText}>Recipe</Text>
                    </View>
                  )}
                </View>

                {/* Right: content */}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {!!item.servings && (
                    <Text style={styles.cardMeta}>{item.servings}</Text>
                  )}

                  <Text style={styles.cardBody} numberOfLines={3}>
                    {Array.isArray(item.ingredients)
                      ? item.ingredients.join(", ")
                      : String(item.ingredients)}
                  </Text>

                  <Text style={styles.cardLink}>View</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: { padding: 8, marginRight: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12, color: "#666", marginTop: 2 },

  empty: { padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 13, color: "#666", marginTop: 6 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    overflow: "hidden",

    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 104, // gives the image some nice presence
  },

  thumbWrap: {
    width: 110,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  thumbPlaceholderText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },

  cardContent: {
    flex: 1,
    padding: 12,
  },

  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  cardBody: { fontSize: 13, color: "#444", marginTop: 6, lineHeight: 18 },
  cardLink: { marginTop: 8, fontSize: 13, fontWeight: "700" },
});
