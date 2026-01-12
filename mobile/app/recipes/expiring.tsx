import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { usePantryStore } from "@/features/pantry/store";

const ExpiringRecipesScreen: React.FC = () => {
  const params = useLocalSearchParams<{ itemIds?: string }>();
  const rawItemIds = params.itemIds;

  const pantryByCategory = usePantryStore((s) => s.pantry);
  const pantryItems = useMemo(
    () => Object.values(pantryByCategory).flat(),
    [pantryByCategory]
  );

  const parsedIds = useMemo(() => {
    if (!rawItemIds) return [];
    try {
      const ids = JSON.parse(rawItemIds) as string[];
      console.log("🧪 ExpiringRecipesScreen parsedIds:", ids);
      return ids;
    } catch (e) {
      console.log("❌ Failed to parse itemIds param:", rawItemIds, e);
      return [];
    }
  }, [rawItemIds]);

  const selectedItems = useMemo(
    () => pantryItems.filter((it) => parsedIds.includes(it.id)),
    [parsedIds, pantryItems]
  );

  console.log(
    "🧪 pantryItems:",
    pantryItems.map((it) => ({ id: it.id, name: it.name }))
  );
  console.log(
    "🧪 selectedItems:",
    selectedItems.map((it) => ({ id: it.id, name: it.name }))
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Use expiring soon</Text>
      <Text style={styles.subtitle}>
        We’ll later fetch recipes based on these items:
      </Text>

      {/* Debug block – you can delete this later */}
      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>Debug</Text>
        <Text style={styles.debugText}>rawItemIds: {String(rawItemIds)}</Text>
        <Text style={styles.debugText}>
          parsedIds: {JSON.stringify(parsedIds)}
        </Text>
        <Text style={styles.debugText}>
          selectedItems: {selectedItems.length}
        </Text>
      </View>

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
  debugBox: {
    marginBottom: 16,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  debugTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    color: "#555",
  },
});
