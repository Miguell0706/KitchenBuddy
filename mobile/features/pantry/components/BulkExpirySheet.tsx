import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { CardStyles, Layout, TextStyles } from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddDays: (delta: number) => void;
  onSetDays: (value: number) => void;
};

export function BulkExpirySheet({
  open,
  onClose,
  onAddDays,
  onSetDays,
}: Props) {
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
          }}
        >
          <Text style={TextStyles.sectionTitle}>Change expiry</Text>
          <Text
            style={[
              TextStyles.small,
              { color: Colors.textLight, marginTop: 4 },
            ]}
          >
            Apply to selected items
          </Text>

          <View style={{ marginTop: Spacing.md, gap: 10 }}>
            <Pressable
              onPress={() => {
                onAddDays(1);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>+1 day</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onAddDays(3);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>+3 days</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onAddDays(7);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>+7 days</Text>
            </Pressable>

            <View style={{ height: 6 }} />

            <Pressable
              onPress={() => {
                onSetDays(1);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>Set to 1 day left</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onSetDays(3);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>Set to 3 days left</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onSetDays(7);
                onClose();
              }}
              style={[CardStyles.subtle, { paddingVertical: 12 }]}
            >
              <Text style={TextStyles.body}>Set to 7 days left</Text>
            </Pressable>

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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
