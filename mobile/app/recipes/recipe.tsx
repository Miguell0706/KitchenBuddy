import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRecipesStore } from "@/features/recipes/store"; // adjust path

export default function RecipeScreen() {
  const recipe = useRecipesStore((s) => s.recipes[0]); // for now: first result
  const saveRecipe = useRecipesStore((s) => s.saveRecipe);

  if (!recipe) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No recipe selected</Text>
        <Text style={styles.emptyText}>
          Go back and tap a recipe to view it here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Image placeholder */}
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageText}>Recipe image</Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.servings ? (
          <Text style={styles.servings}>{recipe.servings}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => saveRecipe(recipe)}
        >
          <Text style={styles.saveText}>Save recipe</Text>
        </TouchableOpacity>
      </View>

      {/* Ingredients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {(Array.isArray(recipe.ingredients)
          ? recipe.ingredients
          : [String(recipe.ingredients)]
        ).map((ing, idx) => (
          <Text key={idx} style={styles.item}>
            • {ing}
          </Text>
        ))}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {(Array.isArray(recipe.instructions)
          ? recipe.instructions
          : [String(recipe.instructions)]
        ).map((step, idx) => (
          <Text key={idx} style={styles.step}>
            {idx + 1}. {step}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  empty: { flex: 1, padding: 16, justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { marginTop: 8, color: "#666" },

  imagePlaceholder: {
    height: 220,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  imageText: { color: "#999" },

  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  servings: { marginTop: 4, color: "#666" },

  saveButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  saveText: { color: "#fff", fontWeight: "600" },

  section: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  item: { marginBottom: 4, color: "#333" },
  step: { marginBottom: 8, color: "#333", lineHeight: 20 },
});
