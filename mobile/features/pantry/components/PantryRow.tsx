import React from "react";
import { View, Text, Pressable } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { CardStyles, Layout, TextStyles } from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";
import { getExpiryBadge } from "../utils";
import type { PantryItem } from "../types";

type Props = {
  item: PantryItem & { categoryLabel?: string };
  bulkMode: boolean;
  isSearching: boolean;
  checked: boolean;

  onToggleSelect: () => void; // bulk only
  onPressEdit: () => void; // normal tap

  onPressDelete: () => void; // confirm
  onSwipeDelete: () => void; // instant
};

export function PantryRow({
  item,
  bulkMode,
  isSearching,
  checked,
  onToggleSelect,
  onPressEdit,
  onPressDelete,
  onSwipeDelete,
}: Props) {
  const badge = getExpiryBadge(item);

  const content = (
    <Pressable
      onPress={() => {
        if (bulkMode) onToggleSelect();
        else onPressEdit();
      }}
    >
      <View style={CardStyles.pantryItem}>
        <View style={Layout.rowBetween}>
          <View style={[Layout.row, { flex: 1, paddingRight: Spacing.md }]}>
            {bulkMode && <BulkCheckbox checked={checked} />}

            <View style={{ flex: 1 }}>
              <Text style={TextStyles.body}>{item.name}</Text>
              <Text style={TextStyles.small}>
                {item.categoryLabel
                  ? `${item.quantity} • ${item.categoryLabel}`
                  : item.quantity}
              </Text>
            </View>
          </View>

          <View style={Layout.row}>
            <View style={badge.container as any}>
              <Text style={badge.text as any}>{badge.label}</Text>
            </View>

            {!bulkMode && <InlineDeleteButton onDelete={onPressDelete} />}
          </View>
        </View>
      </View>
    </Pressable>
  );

  // no swipe while bulk-selecting or searching
  if (bulkMode) return content;

  return (
    <Swipeable
      renderRightActions={() => (
        <DeleteAction
          onDelete={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

/* ───────────────── helpers ───────────────── */

function BulkCheckbox({ checked }: { checked: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: checked ? "rgba(20,20,20,0.35)" : "rgba(120,120,120,0.35)",
        backgroundColor: checked ? "rgba(20,20,20,0.10)" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        marginRight: Spacing.sm,
      }}
    >
      {checked && <Ionicons name="checkmark" size={16} color={Colors.text} />}
    </View>
  );
}

function InlineDeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Pressable
      onPress={(e) => {
        // prevent also triggering the row Pressable (edit/select)
        // @ts-ignore
        e?.stopPropagation?.();
        onDelete();
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        marginLeft: Spacing.sm,
        padding: 6,
        borderRadius: 10,
        backgroundColor: pressed
          ? "rgba(255, 59, 48, 0.18)"
          : "rgba(255, 59, 48, 0.10)",
        justifyContent: "center",
        alignItems: "center",
      })}
    >
      <Ionicons name="trash-outline" size={16} color={"rgb(170, 20, 20)"} />
    </Pressable>
  );
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <View
      style={{
        width: 86,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: Spacing.sm,
      }}
    >
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={{
          width: 66,
          height: 44,
          borderRadius: 14,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(255, 59, 48, 0.12)",
          borderWidth: 1,
          borderColor: "rgba(170, 20, 20, 0.20)",
        }}
      >
        <Ionicons name="trash-outline" size={20} color={"rgb(170, 20, 20)"} />
        <Text
          style={[
            TextStyles.small,
            { color: "rgb(170, 20, 20)", marginTop: 2 },
          ]}
        >
          Delete
        </Text>
      </Pressable>
    </View>
  );
}
