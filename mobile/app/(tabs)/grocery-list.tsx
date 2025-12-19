import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import {
  ButtonStyles,
  CardStyles,
  Layout,
  TextStyles,
} from "@/constants/styles";

type GroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  createdAt: number;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function GroceryListScreen() {
  const [text, setText] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([
    { id: uid(), name: "Milk", checked: false, createdAt: Date.now() - 1000 },
    { id: uid(), name: "Bananas", checked: true, createdAt: Date.now() - 2000 },
  ]);

  const remaining = useMemo(
    () => items.filter((i) => !i.checked).length,
    [items]
  );

  const addItem = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setItems((prev) => [
      { id: uid(), name: trimmed, checked: false, createdAt: Date.now() },
      ...prev,
    ]);
    setText("");
  };

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearChecked = () => {
    setItems((prev) => prev.filter((i) => !i.checked));
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Spacing.xl,
        }}
      >
        {/* Header */}
        <View style={[Layout.rowBetween, { marginBottom: Spacing.md }]}>
          <View>
            <Text style={TextStyles.screenTitle}>Grocery List</Text>
            <Text style={TextStyles.bodyMuted}>{remaining} remaining</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert(
                "Premium (soon)",
                "Smart list automation will live here (e.g., add expiring items → grocery list)."
              )
            }
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.06)",
            }}
          >
            <Text style={TextStyles.small}>Premium</Text>
          </TouchableOpacity>
        </View>

        {/* Quick add */}
        <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
          <Text style={TextStyles.sectionTitle}>Add item</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g., Eggs"
              placeholderTextColor={Colors.textLight}
              returnKeyType="done"
              onSubmitEditing={addItem}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.05)",
                color: Colors.text,
              }}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={addItem}
              style={[
                ButtonStyles.primary,
                { paddingHorizontal: 14, justifyContent: "center" },
              ]}
            >
              <Ionicons name="add" size={18} color={Colors.background} />
            </TouchableOpacity>
          </View>

          {/* Premium upsell route (non-pushy) */}
          <Pressable
            onPress={() =>
              Alert.alert(
                "Smart List (Premium)",
                "Soon: 1-tap add expiring pantry items to your grocery list and smarter reorder suggestions."
              )
            }
            style={{
              marginTop: Spacing.md,
              padding: 12,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.04)",
            }}
          >
            <View style={[Layout.rowBetween]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={TextStyles.body}>Smart List automation</Text>
                <Text style={TextStyles.small}>
                  Add expiring items → grocery list (Premium)
                </Text>
              </View>
              <Ionicons name="sparkles-outline" size={18} color={Colors.text} />
            </View>
          </Pressable>
        </View>

        {/* List */}
        <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
          <View style={Layout.rowBetween}>
            <Text style={TextStyles.sectionTitle}>Items</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={clearChecked}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.05)",
              }}
            >
              <Text style={TextStyles.small}>Clear checked</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: Spacing.sm }}>
            {items.length === 0 ? (
              <Text style={TextStyles.bodyMuted}>
                Your list is empty. Add something above.
              </Text>
            ) : (
              items.map((i) => (
                <View
                  key={i.id}
                  style={[
                    Layout.rowBetween,
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: i.checked
                        ? "rgba(0,0,0,0.03)"
                        : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => toggle(i.id)}
                    style={[Layout.row, { flex: 1, paddingRight: 10 }]}
                  >
                    <Ionicons
                      name={i.checked ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={i.checked ? Colors.primary : Colors.textLight}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        TextStyles.body,
                        i.checked
                          ? {
                              opacity: 0.55,
                              textDecorationLine: "line-through",
                            }
                          : null,
                      ]}
                      numberOfLines={1}
                    >
                      {i.name}
                    </Text>
                  </Pressable>

                  <TouchableOpacity
                    onPress={() => remove(i.id)}
                    activeOpacity={0.8}
                    style={{
                      padding: 8,
                      borderRadius: 999,
                      backgroundColor: "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Colors.text}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
