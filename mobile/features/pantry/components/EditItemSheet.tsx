import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

import type { CategoryKey, PantryItem } from "@/features/pantry/types";
import { CATEGORIES } from "@/features/pantry/constants";
import { usePantryStore } from "@/features/pantry/store";
import { getExpiresInDays } from "@/features/pantry/utils";
import { BulkMoveSheet } from "@/features/pantry/components/BulkMoveSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  target: {
    id: string;
    categoryKey: CategoryKey;
  } | null;
};

export function EditItemSheet({ open, onClose, target }: Props) {
  const updateItem = usePantryStore((state) => state.updateItem);
  const setPantry = usePantryStore((state) => state.setPantry);

  const item = usePantryStore((state) => {
    if (!target) return undefined;

    return state.getItem(target.categoryKey, target.id);
  });

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [categoryKey, setCategoryKey] = useState<CategoryKey | null>(null);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);

  const selectedCategory = CATEGORIES.find(
    (category) => category.key === categoryKey,
  );

  useEffect(() => {
    if (!open || !item || !target) return;

    setName(item.name ?? "");
    setQuantity(item.quantity ?? "");

    const days = getExpiresInDays(item);

    setExpiresInDays(days >= 9999 ? "" : String(days));

    setCategoryKey(target.categoryKey);
    setMoveSheetOpen(false);
  }, [open, item, target]);

  useEffect(() => {
    if (!open || !target) return;

    if (item === undefined) {
      Alert.alert("Item not found", "It may have been deleted.", [
        {
          text: "OK",
          onPress: onClose,
        },
      ]);
    }
  }, [open, target, item, onClose]);

  const save = () => {
    if (!target || !item) return;

    const normalizedName = name.trim().slice(0, 40);

    if (!normalizedName) {
      Alert.alert("Missing name", "Please enter an item name.");
      return;
    }

    const expiryInput = expiresInDays.trim();

    let nextExpiryDate: string | null;

    if (expiryInput === "") {
      nextExpiryDate = null;
    } else {
      const days = Number(expiryInput);

      if (!Number.isInteger(days) || days < 0) {
        Alert.alert(
          "Invalid expiry",
          "Expires in days must be a whole number of 0 or more.",
        );
        return;
      }

      const now = new Date();

      const expiryDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      expiryDate.setDate(expiryDate.getDate() + days);

      const yyyy = expiryDate.getFullYear();
      const mm = String(expiryDate.getMonth() + 1).padStart(2, "0");
      const dd = String(expiryDate.getDate()).padStart(2, "0");

      nextExpiryDate = `${yyyy}-${mm}-${dd}`;
    }

    const patch: Partial<PantryItem> = {
      name: normalizedName,
      quantity: quantity.trim(),
      expiryDate: nextExpiryDate,
    };

    const destinationCategory = categoryKey ?? target.categoryKey;

    if (destinationCategory === target.categoryKey) {
      updateItem(target.categoryKey, target.id, patch);
    } else {
      setPantry((previousPantry) => {
        const existingItem = previousPantry[target.categoryKey].find(
          (pantryItem) => pantryItem.id === target.id,
        );

        if (!existingItem) {
          return previousPantry;
        }

        const movedItem: PantryItem = {
          ...existingItem,
          ...patch,
        };

        return {
          ...previousPantry,

          [target.categoryKey]: previousPantry[target.categoryKey].filter(
            (pantryItem) => pantryItem.id !== target.id,
          ),

          [destinationCategory]: [
            movedItem,
            ...(previousPantry[destinationCategory] ?? []).filter(
              (pantryItem) => pantryItem.id !== target.id,
            ),
          ],
        };
      });
    }

    onClose();
  };

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
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
                <View
                  style={[
                    Layout.rowBetween,
                    {
                      marginBottom: Spacing.md,
                    },
                  ]}
                >
                  <Text style={TextStyles.sectionTitle}>Edit item</Text>

                  <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.8}
                    hitSlop={{
                      top: 10,
                      bottom: 10,
                      left: 10,
                      right: 10,
                    }}
                    style={{
                      padding: Spacing.sm,
                      borderRadius: 999,
                      backgroundColor: "rgba(0,0,0,0.06)",
                    }}
                  >
                    <Ionicons name="close" size={18} color={Colors.text} />
                  </TouchableOpacity>
                </View>

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

                <View
                  style={{
                    height: Spacing.md,
                  }}
                />

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

                <View
                  style={{
                    height: Spacing.md,
                  }}
                />

                <Text style={TextStyles.small}>Category</Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setMoveSheetOpen(true)}
                  style={{
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: "rgba(120,120,120,0.18)",
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: Colors.text,
                    }}
                  >
                    {selectedCategory?.label ?? "Choose category"}
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textLight}
                  />
                </TouchableOpacity>

                <View
                  style={{
                    height: Spacing.md,
                  }}
                />

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

                <View
                  style={{
                    height: Spacing.lg,
                  }}
                />

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

      <BulkMoveSheet
        open={moveSheetOpen}
        onClose={() => setMoveSheetOpen(false)}
        onMoveTo={(destination) => {
          setCategoryKey(destination);
        }}
      />
    </>
  );
}
