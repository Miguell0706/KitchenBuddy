import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { usePantryStore } from "@/features/pantry/store";

const ExpiringRecipesScreen: React.FC = () => {
  const { itemIds } = useLocalSearchParams<{ itemIds?: string }>();
  const pantryByCategory = usePantryStore((s) => s.pantry);
  const pantryItems = useMemo(
    () => Object.values(pantryByCategory).flat(),
    [pantryByCategory]
  );

  const selectedItems = useMemo(() => {
    if (!itemIds) return [];
    try {
      const ids = JSON.parse(itemIds) as string[];
      return pantryItems.filter((it) => ids.includes(it.id));
    } catch {
      return [];
    }
  }, [itemIds, pantryItems]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Use expiring soon</Text>
      <Text style={styles.subtitle}>
        We’ll later fetch recipes based on these items:
      </Text>

      {selectedItems.length === 0 ? (
        <Text style={styles.subtitle}>No items passed in.</Text>
      ) : (
        selectedItems.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{it.name}</Text>
            {it.expiryDate && (
              <Text style={styles.itemExpiry}>Expires {it.expiryDate}</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default ExpiringRecipesScreen;

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
    marginBottom: 12,
  },
  itemRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  itemExpiry: {
    fontSize: 12,
    color: "#666",
  },
});
