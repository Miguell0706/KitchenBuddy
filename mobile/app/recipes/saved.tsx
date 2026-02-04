import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useRecipesStore } from "@/features/recipes/store";

const SavedRecipesScreen: React.FC = () => {
  const router = useRouter();

  const saved = useRecipesStore((s) => s.saved);
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);
  const unsaveRecipe = useRecipesStore((s) => s.unsaveRecipe);

  if (saved.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Saved recipes</Text>
        <Text style={styles.subtitle}>You haven’t saved any recipes yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Saved recipes</Text>

      {saved.map((item) => {
        const imgUrl = item.image?.url;
        const avgColor = item.image?.avgColor ?? "#eee";

        return (
          <TouchableOpacity
            key={item.title}
            activeOpacity={0.88}
            style={styles.card}
            onPress={() => {
              selectRecipe(item.title);
              router.push("/recipes/recipe");
            }}
          >
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

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>

              {!!item.servings && (
                <Text style={styles.cardMeta}>{item.servings}</Text>
              )}

              <View style={styles.row}>
                <Text style={styles.cardLink}>View</Text>

                <TouchableOpacity
                  onPress={() => unsaveRecipe(item.title)}
                  hitSlop={10}
                >
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export default SavedRecipesScreen;

const styles = StyleSheet.create({
  content: {
    padding: 16,
    backgroundColor: "#fafafa",
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fafafa",
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 14,
    color: "#666",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    height: 110,
    marginBottom: 10,
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

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  cardMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  cardLink: {
    fontSize: 13,
    fontWeight: "700",
  },

  remove: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b00020",
  },
});
