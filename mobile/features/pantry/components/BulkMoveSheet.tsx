import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CategoryKey } from "@/features/pantry/types";
import { CATEGORIES } from "@/features/pantry/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  onMoveTo: (dest: CategoryKey) => void;
};

const P = {
  ivory: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  line: "#E9E5DE",
  soft: "#F1EEE8",
};

export function BulkMoveSheet({ open, onClose, onMoveTo }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close move to category"
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 12 },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headingRow}>
            <View style={styles.headingIcon}>
              <Ionicons
                name="swap-horizontal-outline"
                size={22}
                color={P.slateDeep}
              />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>PANTRY · BULK ACTION</Text>
              <Text style={styles.title}>Move to category</Text>
              <Text style={styles.subtitle}>
                Choose a destination for your selected items.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={P.ink} />
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>DESTINATION</Text>
            <Text style={styles.sectionHint}>
              {CATEGORIES.length} categories
            </Text>
          </View>
          <ScrollView
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((category) => (
              <Pressable
                key={category.key}
                style={({ pressed }) => [
                  styles.categoryRow,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Move selected items to ${category.label}`}
                onPress={() => {
                  onMoveTo(category.key);
                  onClose();
                }}
              >
                <View style={styles.categoryIcon}>
                  <Ionicons
                    name={category.icon}
                    size={19}
                    color={P.slateDeep}
                  />
                </View>
                <Text style={styles.categoryName}>{category.label}</Text>
                <Ionicons name="arrow-forward" size={17} color={P.slate} />
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.footer}>KitchenBuddy · Pantry organization</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(31, 37, 37, 0.48)",
  },
  sheet: {
    backgroundColor: P.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "84%",
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#D2CCC3",
    marginBottom: 20,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 23,
  },
  headingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headingCopy: { flex: 1, paddingTop: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: P.slate,
    marginBottom: 5,
  },
  title: { fontFamily: "serif", fontSize: 25, fontWeight: "700", color: P.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: P.muted, marginTop: 6 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.soft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    color: P.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  sectionHint: { color: P.muted, fontSize: 11 },
  categoryScroll: { flexGrow: 0 },
  categoryList: { paddingBottom: 8 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    backgroundColor: P.soft,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryName: { flex: 1, fontSize: 14, fontWeight: "600", color: P.ink },
  cancelButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: P.line,
    backgroundColor: P.paper,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelText: { color: P.slateDeep, fontWeight: "700", fontSize: 14 },
  footer: { color: P.muted, fontSize: 10, textAlign: "center", marginTop: 14 },
  pressed: { opacity: 0.72 },
});
