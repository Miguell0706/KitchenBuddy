import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

const SavedRecipesScreen: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Saved recipes</Text>
      <Text style={styles.subtitle}>
        We’ll list all your saved recipes here.
      </Text>
    </ScrollView>
  );
};

export default SavedRecipesScreen;

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
