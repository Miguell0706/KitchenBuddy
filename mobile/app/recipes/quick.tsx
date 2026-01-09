import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

const QuickMealsScreen: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quick meals</Text>
      <Text style={styles.subtitle}>
        Later we’ll show fast recipes (≈ under 30 minutes) here.
      </Text>
    </ScrollView>
  );
};

export default QuickMealsScreen;

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
