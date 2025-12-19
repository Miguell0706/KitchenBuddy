import React from "react";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { CardStyles, TextStyles } from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";
import type { CategoryKey } from "@/features/pantry/types";
import { CATEGORIES } from "@/features/pantry/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  onMoveTo: (dest: CategoryKey) => void;
};

export function BulkMoveSheet({ open, onClose, onMoveTo }: Props) {
  return (
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
          onPress={() => {}}
          style={{
            padding: Spacing.lg,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            backgroundColor: "#fff",
            maxHeight: "70%",
          }}
        >
          <Text style={TextStyles.sectionTitle}>Move to category</Text>
          <Text
            style={[
              TextStyles.small,
              { color: Colors.textLight, marginTop: 4 },
            ]}
          >
            Choose destination
          </Text>

          <ScrollView
            style={{ marginTop: Spacing.md }}
            contentContainerStyle={{ gap: 10 }}
          >
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => {
                  onMoveTo(c.key);
                  onClose();
                }}
                style={[CardStyles.subtle, { paddingVertical: 12 }]}
              >
                <Text style={TextStyles.body}>{c.label}</Text>
              </Pressable>
            ))}

            <Pressable onPress={onClose} style={{ paddingVertical: 12 }}>
              <Text
                style={[
                  TextStyles.body,
                  { textAlign: "center", color: Colors.textLight },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
