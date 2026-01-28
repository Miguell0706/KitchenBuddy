import React from "react";
import { View, Text } from "react-native";

export default function RecipeScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Recipe</Text>
      <Text style={{ marginTop: 8, color: "#666" }}>
        Next step: show ingredients + instructions + big image + save button.
      </Text>
    </View>
  );
}
