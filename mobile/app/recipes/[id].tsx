import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";

const RecipeDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Recipe detail</Text>
      <Text style={styles.subtitle}>ID: {id}</Text>
      {/* Later: look up recipe from store by id and render full details */}
    </ScrollView>
  );
};

export default RecipeDetailScreen;

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
