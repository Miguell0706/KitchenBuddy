import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getExpiryBadge } from "../utils";
import type { PantryItem } from "../types";

type Props = {
  item: PantryItem & { categoryLabel?: string };
  bulkMode: boolean;
  isSearching: boolean;
  checked: boolean;
  onPressUsed: () => void;
  onToggleSelect: () => void;
  onPressEdit: () => void;
  onPressDelete: () => void;
  onSwipeDelete: () => void;
};

const P = {
  paper: "#FFFEFB",
  ivory: "#F6F3EE",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  green: "#516D5A",
  greenWash: "#EAF1E9",
  red: "#9C5950",
  redWash: "#F7ECE8",
};

/**
 * A drop-in visual replacement for the Pantry screen's item rows.
 * All actions and the parent-owned bulk-selection state are unchanged.
 */
export function PantryRow({
  item,
  bulkMode,
  checked,
  onToggleSelect,
  onPressEdit,
  onPressDelete,
  onSwipeDelete,
  onPressUsed,
}: Props) {
  const badge = getExpiryBadge(item);
  const quantity = (item.quantity ?? "").trim();
  const secondary = item.categoryLabel
    ? [quantity, item.categoryLabel].filter(Boolean).join("  ·  ")
    : quantity;

  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        bulkMode
          ? `${checked ? "Deselect" : "Select"} ${item.name}`
          : `Edit ${item.name}`
      }
      accessibilityState={bulkMode ? { selected: checked } : undefined}
      onPress={bulkMode ? onToggleSelect : onPressEdit}
      style={({ pressed }) => [
        styles.card,
        bulkMode && checked && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.mainRow}>
        {bulkMode && <BulkCheckbox checked={checked} />}

        {item.ingredientImage?.url ? (
          <Image
            source={{ uri: item.ingredientImage.url }}
            style={[
              styles.image,
              {
                backgroundColor: item.ingredientImage.avgColor ?? P.ivory,
              },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="leaf-outline" size={23} color={P.slate} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {!!secondary && (
            <Text style={styles.secondary} numberOfLines={1}>
              {secondary}
            </Text>
          )}
          <View style={styles.badgeRow}>
            <View style={[styles.expiryBadge, badge.container]}>
              <Text style={[styles.expiryLabel, badge.text]} numberOfLines={1}>
                {badge.label}
              </Text>
            </View>
          </View>
        </View>

        {!bulkMode && (
          <View style={styles.actions}>
            <UsedButton
              onPress={() => {
                void Haptics.selectionAsync();
                onPressUsed();
              }}
            />
            <InlineDeleteButton onDelete={onPressDelete} />
          </View>
        )}
      </View>
    </Pressable>
  );

  if (bulkMode) return content;

  return (
    <Swipeable
      renderRightActions={() => (
        <DeleteAction
          onDelete={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSwipeDelete();
          }}
        />
      )}
      overshootRight={false}
      rightThreshold={40}
    >
      {content}
    </Swipeable>
  );
}

function UsedButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mark item as used"
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.usedButton,
        pressed && styles.actionPressed,
      ]}
    >
      <Ionicons name="checkmark-circle-outline" size={16} color={P.green} />
      <Text style={styles.usedLabel}>Used</Text>
    </Pressable>
  );
}

function BulkCheckbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Ionicons name="checkmark" size={16} color={P.paper} />}
    </View>
  );
}

function InlineDeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove item"
      onPress={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.inlineDelete,
        pressed && styles.actionPressed,
      ]}
    >
      <Ionicons name="trash-outline" size={17} color={P.red} />
    </Pressable>
  );
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <View style={styles.swipeContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete swiped item"
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [
          styles.swipeDelete,
          pressed && styles.actionPressed,
        ]}
      >
        <Ionicons name="trash-outline" size={20} color={P.red} />
        <Text style={styles.swipeLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 18,
    marginBottom: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardSelected: {
    borderColor: P.slate,
    backgroundColor: "#F0F2F0",
  },
  cardPressed: { opacity: 0.82 },
  mainRow: { flexDirection: "row", alignItems: "center" },
  image: {
    width: 54,
    height: 54,
    borderRadius: 14,
    marginRight: 11,
    backgroundColor: P.ivory,
  },
  imagePlaceholder: {
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0, justifyContent: "center" },
  name: {
    color: P.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  secondary: {
    color: P.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  expiryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: P.ivory,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  expiryLabel: { color: P.slateDeep, fontSize: 11, fontWeight: "700" },
  actions: {
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 7,
    marginLeft: 9,
  },
  usedButton: {
    minHeight: 31,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: P.greenWash,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  usedLabel: { fontSize: 11, color: P.green, fontWeight: "700" },
  inlineDelete: {
    width: 31,
    height: 29,
    borderRadius: 10,
    backgroundColor: P.redWash,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { opacity: 0.6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: P.slate,
    backgroundColor: P.paper,
    marginRight: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: P.slateDeep, borderColor: P.slateDeep },
  swipeContainer: {
    width: 85,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 7,
    marginBottom: 9,
  },
  swipeDelete: {
    width: 72,
    height: "100%",
    maxHeight: 91,
    borderRadius: 16,
    backgroundColor: P.redWash,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  swipeLabel: { color: P.red, fontSize: 11, fontWeight: "700" },
});
