import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

const IngredientBuilderScreen: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ingredient-based recipes</Text>
      <Text style={styles.subtitle}>
        Here we’ll let you pick pantry items and generate tailored recipes.
      </Text>
      {/* Later: ingredient selector UI + API call */}
    </ScrollView>
  );
};

export default IngredientBuilderScreen;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
});
