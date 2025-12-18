import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  TextStyles,
  ButtonStyles,
  Layout,
  CardStyles,
} from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";
import type { CategoryKey } from "@/features/pantry/types";
import { usePantryStore } from "@/features/pantry/store"; // adjust path

export default function EditItemScreen() {
  const { id, cat } = useLocalSearchParams<{ id: string; cat: CategoryKey }>();

  const categoryKey = cat as CategoryKey;

  const item = usePantryStore(
    useMemo(
      () => (s) => id && categoryKey ? s.getItem(categoryKey, id) : undefined,
      [categoryKey, id]
    )
  );

  const updateItem = usePantryStore((s) => s.updateItem);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");

  // ✅ Prefill when item loads
  useEffect(() => {
    if (!item) return;
    setName(item.name ?? "");
    setQuantity(item.quantity ?? "");
    setExpiresInDays(
      item.expiresInDays === undefined ? "" : String(item.expiresInDays)
    );
  }, [item]);

  // ✅ If someone navigates here with a bad id/cat
  useEffect(() => {
    if (!id || !categoryKey) return;
    if (item === undefined) {
      Alert.alert("Item not found", "This item may have been deleted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [id, categoryKey, item]);

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Missing name", "Please enter an item name.");
      return;
    }

    const d =
      expiresInDays.trim() === "" ? undefined : Number(expiresInDays.trim());

    if (d !== undefined && (!Number.isFinite(d) || d < 0)) {
      Alert.alert("Invalid expiry", "Expires in (days) must be 0 or more.");
      return;
    }

    updateItem(categoryKey, id, {
      name: trimmed,
      quantity: quantity.trim(),
      ...(d === undefined ? {} : { expiresInDays: d }),
    });

    router.back();
  };

  return (
    <View style={Screen.full}>
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
        <View style={[Layout.rowBetween, { marginBottom: Spacing.lg }]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <View style={Layout.rowCenter}>
              <Ionicons name="chevron-back" size={18} color={Colors.text} />
              <Text style={[TextStyles.body, { marginLeft: 4 }]}>Back</Text>
            </View>
          </TouchableOpacity>

          <Text style={TextStyles.sectionTitle}>Edit item</Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={[CardStyles.subtle, { padding: Spacing.md }]}>
          <Text style={TextStyles.small}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Milk"
            placeholderTextColor={Colors.textLight}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "rgba(120,120,120,0.18)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: Colors.text,
            }}
          />

          <View style={{ height: Spacing.md }} />

          <Text style={TextStyles.small}>Quantity</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g., 1 gallon"
            placeholderTextColor={Colors.textLight}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "rgba(120,120,120,0.18)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: Colors.text,
            }}
          />

          <View style={{ height: Spacing.md }} />

          <Text style={TextStyles.small}>Expires in (days)</Text>
          <TextInput
            value={expiresInDays}
            onChangeText={setExpiresInDays}
            keyboardType="number-pad"
            placeholder="e.g., 5"
            placeholderTextColor={Colors.textLight}
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: "rgba(120,120,120,0.18)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: Colors.text,
            }}
          />

          <View style={{ height: Spacing.lg }} />

          <TouchableOpacity
            activeOpacity={0.8}
            style={ButtonStyles.primary}
            onPress={onSave}
          >
            <Text style={ButtonStyles.primaryText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
