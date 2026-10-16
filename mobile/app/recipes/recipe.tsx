import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const P = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  line: "#E9E5DE",
  soft: "#F2EEE8",
  white: "#FFFFFF",
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
  if (typeof value === "string") return value.trim() || null;
  if (!isStructuredIngredient(value)) return null;
  const name = value.name.trim();
  if (!name) return null;
  const quantity = value.quantity == null ? "" : String(value.quantity);
  const unit = (value.unit ?? "").trim();
  const unitText = unit && unit.toLowerCase() !== "unit" ? unit : "";
  return [quantity, unitText, name].filter(Boolean).join(" ");
}

const nutritionFields: { key: keyof Nutrition; label: string; unit: string }[] =
  [
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

function SectionHeading({
  icon,
  eyebrow,
  title,
  count,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  eyebrow: string;
  title: string;
  count?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingLeft}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={19} color={P.slateDeep} />
        </View>
        <View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

export default function RecipeScreen() {
  const recipe = useRecipesStore((s) => s.selectedRecipe);
  const saveRecipe = useRecipesStore((s) => s.saveRecipe);

  if (!recipe) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="book-outline" size={30} color={P.slate} />
        </View>
        <Text style={styles.emptyEyebrow}>KITCHENBUDDY · RECIPES</Text>
        <Text style={styles.emptyTitle}>No recipe selected</Text>
        <Text style={styles.emptyText}>
          Go back and tap a recipe to view it here.
        </Text>
      </View>
    );
  }

  // Supports both existing string[] and structured API ingredients.
  const rawIngredients: unknown = recipe.ingredients;
  const ingredients: string[] = Array.isArray(rawIngredients)
    ? rawIngredients
        .map(formatIngredient)
        .filter((item): item is string => item !== null)
    : [];

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : [String(recipe.instructions ?? "")];

  // Nutrition can be an object, JSON string, or unstructured text.
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
      // Preserve non-JSON nutrition text for display below.
    }
  }
  const nutritionRows = nutrition
    ? nutritionFields.filter(
        ({ key }) =>
          typeof nutrition?.[key] === "number" &&
          Number.isFinite(nutrition[key]),
      )
    : [];

  const save = () => {
    saveRecipe(recipe);
    Toast.show({
      type: "success",
      text1: "Recipe saved",
      text2: recipe.title,
      position: "bottom",
      visibilityTime: 2500,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        {recipe.image?.url ? (
          <Image
            source={{ uri: recipe.image.url }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <View style={styles.placeholderCircle}>
              <Ionicons name="restaurant-outline" size={37} color={P.slate} />
            </View>
            <Text style={styles.imageText}>
              A LITTLE INSPIRATION FOR YOUR TABLE
            </Text>
          </View>
        )}
        <View style={styles.heroBody}>
          <Text style={styles.heroEyebrow}>
            KITCHENBUDDY · RECIPE COLLECTION
          </Text>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.servings ? (
            <View style={styles.servingsRow}>
              <Ionicons name="people-outline" size={16} color={P.white} />
              <Text style={styles.servings}>{recipe.servings}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={save}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save recipe"
          >
            <Ionicons name="bookmark-outline" size={18} color={P.slateDeep} />
            <Text style={styles.saveText}>Save recipe</Text>
            <Ionicons name="arrow-forward" size={17} color={P.slateDeep} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          icon="basket-outline"
          eyebrow="WHAT YOU'LL NEED"
          title="Ingredients"
          count={ingredients.length ? `${ingredients.length} items` : undefined}
        />
        <View style={styles.card}>
          {ingredients.length === 0 ? (
            <Text style={styles.placeholderText}>
              No ingredient list available.
            </Text>
          ) : (
            ingredients.map((ingredient, index) => (
              <View
                key={index}
                style={[
                  styles.ingredientRow,
                  index === ingredients.length - 1 && styles.lastRow,
                ]}
              >
                <View style={styles.ingredientBullet}>
                  <Ionicons name="checkmark" size={13} color={P.slateDeep} />
                </View>
                <Text style={styles.ingredientText}>{ingredient}</Text>
              </View>
            ))
          )}
          {ingredients.length > 0 && (
            <View style={styles.groceryAction}>
              <Text style={styles.groceryEyebrow}>MAKE SHOPPING EASIER</Text>
              <AddRecipeToGroceryButton
                ingredients={ingredients}
                recipeTitle={recipe.title}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          icon="list-outline"
          eyebrow="LET'S GET COOKING"
          title="Instructions"
          count={`${instructions.length} ${instructions.length === 1 ? "step" : "steps"}`}
        />
        <View style={styles.card}>
          {instructions.map((step, index) => (
            <View
              key={index}
              style={[
                styles.stepRow,
                index === instructions.length - 1 && styles.lastRow,
              ]}
            >
              <View style={styles.stepNumberWrap}>
                <Text style={styles.stepNumber}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>
              <Text style={styles.stepText}>{String(step)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          icon="nutrition-outline"
          eyebrow="THE DETAILS"
          title="Nutrition"
        />
        <View style={styles.card}>
          {nutritionRows.length > 0 && nutrition ? (
            nutritionRows.map(({ key, label, unit }, index) => (
              <View
                key={key}
                style={[
                  styles.nutritionRow,
                  index === nutritionRows.length - 1 && styles.lastRow,
                ]}
              >
                <Text style={styles.nutritionLabel}>{label}</Text>
                <Text style={styles.nutritionValue}>
                  {Number(nutrition[key]).toFixed(1)}{" "}
                  <Text style={styles.nutritionUnit}>{unit}</Text>
                </Text>
              </View>
            ))
          ) : typeof rawNutrition === "string" &&
            rawNutrition.trim() &&
            !nutrition ? (
            <Text style={styles.placeholderText}>{rawNutrition}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              Nutrition information not available.
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.footer}>
        KITCHENBUDDY · MADE FOR EVERYDAY COOKING
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  content: { padding: 16, paddingBottom: 52 },
  hero: {
    backgroundColor: P.slate,
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 29,
  },
  recipeImage: { height: 230, width: "100%" },
  imagePlaceholder: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.taupe,
    gap: 13,
  },
  placeholderCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: P.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  imageText: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: P.slateDeep,
    fontWeight: "700",
  },
  heroBody: { paddingHorizontal: 22, paddingTop: 21, paddingBottom: 22 },
  heroEyebrow: {
    color: "#DCE5E5",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.7,
    marginBottom: 9,
  },
  title: {
    fontFamily: "serif",
    fontSize: 30,
    lineHeight: 37,
    color: P.white,
    fontWeight: "700",
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },
  servings: { fontSize: 13, color: "#ECF0EF" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 15,
    minHeight: 49,
    backgroundColor: P.paper,
    marginTop: 20,
    paddingHorizontal: 15,
  },
  saveText: { flex: 1, color: P.slateDeep, fontSize: 14, fontWeight: "700" },
  section: { marginBottom: 27 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeadingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionIcon: {
    height: 39,
    width: 39,
    borderRadius: 13,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: "700",
    color: P.slate,
    marginBottom: 3,
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "700",
    color: P.ink,
  },
  sectionCount: { color: P.muted, fontSize: 12, marginLeft: 8 },
  card: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    gap: 12,
  },
  ingredientBullet: {
    width: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: P.soft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ingredientText: { color: P.ink, fontSize: 14, lineHeight: 23, flex: 1 },
  lastRow: { borderBottomWidth: 0 },
  groceryAction: {
    borderTopWidth: 1,
    borderTopColor: P.line,
    paddingTop: 15,
    paddingBottom: 13,
    marginTop: 5,
  },
  groceryEyebrow: {
    color: P.muted,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontSize: 10,
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 17,
    borderBottomColor: P.line,
    borderBottomWidth: 1,
  },
  stepNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: P.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { fontSize: 12, fontWeight: "800", color: P.slateDeep },
  stepText: {
    color: P.ink,
    fontSize: 14,
    lineHeight: 23,
    flex: 1,
    paddingTop: 3,
  },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    gap: 12,
  },
  nutritionLabel: { color: P.muted, fontSize: 13, flex: 1 },
  nutritionValue: { color: P.ink, fontSize: 15, fontWeight: "700" },
  nutritionUnit: { color: P.muted, fontWeight: "400", fontSize: 12 },
  placeholderText: {
    color: P.muted,
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 13,
  },
  empty: {
    flex: 1,
    padding: 24,
    backgroundColor: P.background,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 21,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 19,
  },
  emptyEyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: P.slate,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 26,
    fontWeight: "700",
    color: P.ink,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 10,
    color: P.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  footer: {
    fontSize: 9,
    letterSpacing: 1.25,
    fontWeight: "700",
    textAlign: "center",
    color: P.muted,
    marginTop: 2,
  },
});
