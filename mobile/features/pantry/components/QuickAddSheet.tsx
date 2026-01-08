import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { nanoid } from "nanoid/non-secure";

import { Colors, Spacing } from "@/constants/theme";
import {
  CardStyles,
  Layout,
  TextStyles,
  ButtonStyles,
} from "@/constants/styles";
import type { CategoryKey } from "@/features/pantry/types";
import { usePantryStore } from "@/features/pantry/store"; // adjust path
import { useDefaultExpiry } from "@/features/pantry/useDefaultExpiry";

type Props = {
  open: boolean;
  onClose: () => void;
};
// If you already have a CATEGORIES constant elsewhere, import it instead.
const CATEGORY_OPTIONS: {
  key: CategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "produce", label: "Produce", icon: "leaf-outline" },
  { key: "meatSeafood", label: "Meat & Seafood", icon: "fish-outline" },
  { key: "dairyEggs", label: "Dairy & Eggs", icon: "egg-outline" },
  { key: "bakery", label: "Bakery", icon: "restaurant-outline" },
  { key: "pantry", label: "Pantry", icon: "cube-outline" },
  { key: "condiments", label: "Condiments", icon: "water-outline" },
  { key: "spices", label: "Spices", icon: "flame-outline" },
  { key: "beverages", label: "Beverages", icon: "cafe-outline" },
  { key: "frozen", label: "Frozen", icon: "snow-outline" },
  { key: "snacks", label: "Snacks", icon: "pizza-outline" },
  { key: "pet", label: "Pet", icon: "paw-outline" },
  { key: "household", label: "Household", icon: "home-outline" },
  { key: "supplements", label: "Supplements", icon: "medkit-outline" },
];
function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function QuickAddSheet({ open, onClose }: Props) {
  const quickAddItem = usePantryStore((s) => s.addItem);

  const [name, setName] = useState("");
  const [categoryKey, setCategoryKey] = useState<CategoryKey>("produce");
  const [catOpen, setCatOpen] = useState(false);

  // 👇 call hook here, using the current categoryKey
  const defaultExpiry = useDefaultExpiry(categoryKey);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategoryKey("produce");
    setCatOpen(false);
  }, [open]);

  const selected = useMemo(
    () => CATEGORY_OPTIONS.find((c) => c.key === categoryKey),
    [categoryKey]
  );

  const save = () => {
    const normalizedName = name.trim().slice(0, 40);
    if (!normalizedName) return;

    const d = defaultExpiry; // number | "none"

    const expiresInDays = d === "none" ? 9999 : d;
    const expiryDate = d === "none" ? null : isoDateDaysFromNow(expiresInDays);

    quickAddItem(categoryKey, {
      id: nanoid(),
      name: normalizedName,
      quantity: "",
      categoryKey,
      expiryDate,
      expiresInDays,
    });

    onClose();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "flex-end",
        }}
      >
        {/* Stop press bubbling so taps inside sheet don't close it */}
        <Pressable onPress={() => {}} style={{ width: "100%" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                CardStyles.subtle,
                {
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  padding: Spacing.lg,
                  paddingBottom: Spacing.lg + Spacing.sm,
                  backgroundColor: Colors.card,
                },
              ]}
            >
              {/* Header */}
              <View style={[Layout.rowBetween, { marginBottom: Spacing.md }]}>
                <Text style={TextStyles.sectionTitle}>Quick add</Text>

                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.8}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    padding: Spacing.sm,
                    borderRadius: 999,
                    backgroundColor: "rgba(0,0,0,0.06)",
                  }}
                >
                  <Ionicons name="close" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Name */}
              <Text style={TextStyles.small}>Name</Text>
              <TextInput
                value={name}
                maxLength={40}
                onChangeText={setName}
                placeholder="e.g., Apples"
                placeholderTextColor={Colors.textLight}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={save}
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

              {/* Category */}
              <Text style={TextStyles.small}>Category (optional)</Text>

              {/* Dropdown header */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setCatOpen((v) => !v)}
                style={[
                  Layout.rowBetween,
                  {
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: "rgba(120,120,120,0.18)",
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: "rgba(120,120,120,0.06)",
                  },
                ]}
              >
                <View style={[Layout.rowCenter, { flex: 1 }]}>
                  <Ionicons
                    name={selected?.icon ?? "leaf-outline"}
                    size={18}
                    color={Colors.text}
                  />
                  <Text
                    style={[TextStyles.body, { marginLeft: 8 }]}
                    numberOfLines={1}
                  >
                    {selected?.label ?? "Produce"}
                  </Text>
                </View>

                <Ionicons
                  name={catOpen ? "chevron-up-outline" : "chevron-down-outline"}
                  size={18}
                  color={Colors.textLight}
                />
              </TouchableOpacity>

              {/* Dropdown options */}
              {catOpen && (
                <View
                  style={{
                    marginTop: Spacing.sm,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {CATEGORY_OPTIONS.map((c) => {
                    const active = c.key === categoryKey;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        activeOpacity={0.85}
                        onPress={() => {
                          setCategoryKey(c.key);
                          setCatOpen(false);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active
                            ? "rgba(60,60,60,0.35)"
                            : "rgba(120,120,120,0.18)",
                          backgroundColor: active
                            ? "rgba(0,0,0,0.06)"
                            : "transparent",
                          marginRight: 8,
                          marginTop: 8,
                        }}
                      >
                        <Ionicons name={c.icon} size={16} color={Colors.text} />
                        <Text style={[TextStyles.small, { marginLeft: 6 }]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ height: Spacing.lg }} />

              {/* Save */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  ButtonStyles.primary,
                  { opacity: name.trim() ? 1 : 0.5 },
                ]}
                disabled={!name.trim()}
                onPress={save}
              >
                <Text style={ButtonStyles.primaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
