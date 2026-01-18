import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors, Spacing } from "@/constants/theme";
import {
  CardStyles,
  Layout,
  TextStyles,
  ButtonStyles,
} from "@/constants/styles";
import type { CategoryKey } from "@/features/pantry/types";
import { usePantryStore } from "@/features/pantry/store";
import { getExpiresInDays } from "@/features/pantry/utils"; // adjust path

type Props = {
  open: boolean;
  onClose: () => void;
  target: { id: string; categoryKey: CategoryKey } | null;
};

export function EditItemSheet({ open, onClose, target }: Props) {
  const updateItem = usePantryStore((s) => s.updateItem);

  // ✅ subscribe to item changes (no useMemo)
  const item = usePantryStore((s) => {
    if (!target) return undefined;
    return s.getItem(target.categoryKey, target.id);
  });

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!item) return;

    setName(item.name ?? "");
    setQuantity(item.quantity ?? "");

    const d = getExpiresInDays(item);
    setExpiresInDays(d >= 9999 ? "" : String(d));
  }, [open, item]);

  // If bad target (deleted item)
  useEffect(() => {
    if (!open) return;
    if (!target) return;
    if (item === undefined) {
      Alert.alert("Item not found", "It may have been deleted.", [
        { text: "OK", onPress: onClose },
      ]);
    }
  }, [open, target, item, onClose]);

  const save = () => {
    if (!target) return;

    const normalizedName = name.trim().slice(0, 40);
    if (!normalizedName) {
      Alert.alert("Missing name", "Please enter an item name.");
      return;
    }

    const expStr = expiresInDays.trim();
    let nextExpiryDate: string | null | undefined;

    if (expStr === "") {
      nextExpiryDate = null; // blank = "No expiry"
      // nextExpiryDate = undefined; // blank = keep existing
    } else {
      const d = Number(expStr);

      if (!Number.isFinite(d) || d < 0) {
        Alert.alert("Invalid expiry", "Expires in (days) must be 0 or more.");
        return;
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight
      today.setDate(today.getDate() + d);

      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      nextExpiryDate = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
    }

    updateItem(target.categoryKey, target.id, {
      name: normalizedName,
      quantity: quantity.trim(),
      ...(nextExpiryDate === undefined ? {} : { expiryDate: nextExpiryDate }),
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
        {/* Stop bubbling */}
        <Pressable
          onPress={(e) => {
            // @ts-ignore
            e?.stopPropagation?.();
          }}
        >
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
                <Text style={TextStyles.sectionTitle}>Edit item</Text>

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

              {/* Quantity */}
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

              {/* Expiry */}
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
                activeOpacity={0.85}
                style={ButtonStyles.primary}
                onPress={save}
              >
                <Text style={ButtonStyles.primaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
