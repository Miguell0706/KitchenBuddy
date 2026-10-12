import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useRecipesStore } from "@/features/recipes/store";
import AddRecipeToGroceryButton from "@/features/grocery/AddRecipeToGroceryButton";
import Toast from "react-native-toast-message";

type StructuredIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
};

type Nutrition = {
  calories?: number;
  total_fat?: number;
  saturated_fat?: number;
  protein?: number;
  sodium?: number;
  potassium?: number;
  dietary_fiber?: number;
  cholesterol?: number;
  sugars?: number;
  total_carbohydrate?: number;
};

function isStructuredIngredient(value: unknown): value is StructuredIngredient {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<StructuredIngredient>;

  return (
    typeof item.name === "string" &&
    (item.quantity === undefined ||
      (typeof item.quantity === "number" && Number.isFinite(item.quantity))) &&
    (item.unit === undefined || typeof item.unit === "string")
  );
}

function formatIngredient(value: unknown): string | null {
  // Existing recipe-store format.
  if (typeof value === "string") {
    return value.trim() || null;
  }

  // Structured API format.
  if (!isStructuredIngredient(value)) {
    return null;
  }

  const name = value.name.trim();
  if (!name) return null;

  const quantity = value.quantity == null ? "" : String(value.quantity);

  const unit = (value.unit ?? "").trim();
  const unitText = unit && unit.toLowerCase() !== "unit" ? unit : "";

  return [quantity, unitText, name].filter(Boolean).join(" ");
}

const nutritionFields: {
  key: keyof Nutrition;
  label: string;
  unit: string;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "total_carbohydrate", label: "Carbohydrates", unit: "g" },
  { key: "total_fat", label: "Total fat", unit: "g" },
  { key: "saturated_fat", label: "Saturated fat", unit: "g" },
  { key: "dietary_fiber", label: "Dietary fiber", unit: "g" },
  { key: "sugars", label: "Sugars", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
];

export default function RecipeScreen() {
  const recipe = useRecipesStore((s) => s.selectedRecipe);
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

  // Supports both string[] and structured API ingredients.
  const rawIngredients: unknown = recipe.ingredients;

  const ingredients: string[] = Array.isArray(rawIngredients)
    ? rawIngredients
        .map(formatIngredient)
        .filter((item): item is string => item !== null)
    : [];

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : [String(recipe.instructions ?? "")];

  // Read nutrition safely, whether it is an object or JSON string.
  const rawNutrition: unknown = recipe.nutrition;

  let nutrition: Nutrition | null = null;

  if (rawNutrition && typeof rawNutrition === "object") {
    nutrition = rawNutrition as Nutrition;
  } else if (typeof rawNutrition === "string") {
    try {
      const parsed: unknown = JSON.parse(rawNutrition);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        nutrition = parsed as Nutrition;
      }
    } catch {
      // Ignore non-JSON nutrition text.
    }
  }

  const nutritionRows = nutrition
    ? nutritionFields.filter(
        ({ key }) =>
          typeof nutrition?.[key] === "number" &&
          Number.isFinite(nutrition[key]),
      )
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {recipe.image?.url ? (
        <Image
          source={{ uri: recipe.image.url }}
          style={styles.recipeImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageText}>Recipe image</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>{recipe.title}</Text>

        {recipe.servings ? (
          <Text style={styles.servings}>{recipe.servings}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => {
            saveRecipe(recipe);

            Toast.show({
              type: "success",
              text1: "Recipe saved",
              text2: recipe.title,
              position: "bottom",
              visibilityTime: 2500,
            });
          }}
        >
          <Text style={styles.saveText}>Save recipe</Text>
        </TouchableOpacity>
      </View>

      {/* INGREDIENTS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>

        {ingredients.length === 0 ? (
          <Text style={styles.item}>No ingredient list available.</Text>
        ) : (
          ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.item}>
              {"\u2022 "} {ingredient}
            </Text>
          ))
        )}

        {ingredients.length > 0 && (
          <View style={styles.groceryAction}>
            <AddRecipeToGroceryButton
              ingredients={ingredients}
              recipeTitle={recipe.title}
            />
          </View>
        )}
      </View>

      {/* INSTRUCTIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>

        {instructions.map((step, index) => (
          <Text key={index} style={styles.step}>
            {index + 1}. {String(step)}
          </Text>
        ))}
      </View>

      {/* NUTRITION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nutrition</Text>

        {nutritionRows.length > 0 && nutrition ? (
          <View style={styles.nutritionCard}>
            {nutritionRows.map(({ key, label, unit }) => (
              <View key={key} style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>{label}</Text>
                <Text style={styles.nutritionValue}>
                  {Number(nutrition[key]).toFixed(1)} {unit}
                </Text>
              </View>
            ))}
          </View>
        ) : typeof rawNutrition === "string" &&
          rawNutrition.trim() &&
          !nutrition ? (
          <Text style={styles.item}>{rawNutrition}</Text>
        ) : (
          <Text style={styles.item}>Nutrition information not available.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 8,
    color: "#666",
  },
  recipeImage: {
    height: 220,
    width: "100%",
  },
  imagePlaceholder: {
    height: 220,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  imageText: {
    color: "#999",
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  servings: {
    marginTop: 4,
    color: "#666",
  },
  saveButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  saveText: {
    color: "#fff",
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  item: {
    marginBottom: 6,
    color: "#333",
    lineHeight: 21,
  },
  groceryAction: {
    marginTop: 16,
    marginBottom: 8,
  },
  step: {
    marginBottom: 10,
    color: "#333",
    lineHeight: 21,
  },
  nutritionCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  nutritionLabel: {
    color: "#444",
    fontSize: 14,
    flex: 1,
  },
  nutritionValue: {
    color: "#111",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
});
