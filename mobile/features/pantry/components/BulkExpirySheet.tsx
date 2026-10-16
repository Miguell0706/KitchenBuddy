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

type Props = {
  open: boolean;
  onClose: () => void;
  onAddDays: (delta: number) => void;
  onSetDays: (value: number) => void;
};

const P = {
  ivory: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  backdrop: "rgba(24,30,31,0.48)",
};

type ExpiryOptionProps = {
  label: string;
  description: string;
  days: number;
  mode: "add" | "set";
  onPress: () => void;
};

function ExpiryOption({
  label,
  description,
  days,
  mode,
  onPress,
}: ExpiryOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <View style={[styles.optionIcon, mode === "set" && styles.optionIconSet]}>
        <Ionicons
          name={mode === "add" ? "add" : "calendar-outline"}
          size={20}
          color={P.slateDeep}
        />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <Text style={styles.daysCaption}>{days}d</Text>
      <Ionicons name="chevron-forward" size={16} color={P.muted} />
    </Pressable>
  );
}

export function BulkExpirySheet({
  open,
  onClose,
  onAddDays,
  onSetDays,
}: Props) {
  const insets = useSafeAreaInsets();

  const applyAdd = (days: number) => {
    onAddDays(days);
    onClose();
  };
  const applySet = (days: number) => {
    onSetDays(days);
    onClose();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close expiry settings"
          onPress={onClose}
          style={styles.backdrop}
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
              <Ionicons name="calendar-outline" size={22} color={P.slateDeep} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>BULK EDIT · EXPIRY</Text>
              <Text style={styles.title}>Change expiry</Text>
              <Text style={styles.subtitle}>
                Apply one change to all selected pantry items.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={19} color={P.ink} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            style={styles.scroll}
          >
            <Text style={styles.sectionLabel}>EXTEND CURRENT DATES</Text>
            <Text style={styles.sectionHelp}>
              Add time to each item’s existing expiry date.
            </Text>
            <View style={styles.group}>
              <ExpiryOption
                label="Add 1 day"
                description="A little extra time"
                days={1}
                mode="add"
                onPress={() => applyAdd(1)}
              />
              <View style={styles.divider} />
              <ExpiryOption
                label="Add 3 days"
                description="Extend by three days"
                days={3}
                mode="add"
                onPress={() => applyAdd(3)}
              />
              <View style={styles.divider} />
              <ExpiryOption
                label="Add 7 days"
                description="Extend by one week"
                days={7}
                mode="add"
                onPress={() => applyAdd(7)}
              />
            </View>

            <Text style={[styles.sectionLabel, styles.secondSection]}>
              SET DAYS REMAINING
            </Text>
            <Text style={styles.sectionHelp}>
              Set expiry relative to today for selected items.
            </Text>
            <View style={styles.group}>
              <ExpiryOption
                label="Set to 1 day left"
                description="Expires tomorrow"
                days={1}
                mode="set"
                onPress={() => applySet(1)}
              />
              <View style={styles.divider} />
              <ExpiryOption
                label="Set to 3 days left"
                description="Expires in three days"
                days={3}
                mode="set"
                onPress={() => applySet(3)}
              />
              <View style={styles.divider} />
              <ExpiryOption
                label="Set to 7 days left"
                description="Expires in one week"
                days={7}
                mode="set"
                onPress={() => applySet(7)}
              />
            </View>
            <View style={styles.noteRow}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={P.slate}
              />
              <Text style={styles.note}>
                Items without an expiry keep that setting when using “Set days
                remaining,” matching your existing Pantry behavior.
              </Text>
            </View>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: P.backdrop },
  sheet: {
    backgroundColor: P.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "90%",
    overflow: "hidden",
  },
  handle: {
    width: 42,
    height: 5,
    alignSelf: "center",
    borderRadius: 99,
    backgroundColor: "#D4CFC8",
    marginBottom: 22,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 22,
  },
  headingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: P.slate,
    marginBottom: 4,
  },
  title: { fontSize: 27, lineHeight: 32, fontFamily: "serif", color: P.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: P.muted, marginTop: 5 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 99,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 18 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: P.slateDeep,
    marginBottom: 5,
  },
  sectionHelp: {
    fontSize: 12,
    lineHeight: 18,
    color: P.muted,
    marginBottom: 10,
  },
  secondSection: { marginTop: 22 },
  group: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 66,
    gap: 10,
  },
  pressed: { opacity: 0.68 },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconSet: { backgroundColor: "#EBEFF0" },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: "700", color: P.ink },
  optionDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: P.muted,
    marginTop: 3,
  },
  daysCaption: { fontSize: 12, fontWeight: "700", color: P.slateDeep },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.border,
    marginLeft: 56,
  },
  noteRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 14,
    paddingHorizontal: 3,
  },
  note: { flex: 1, fontSize: 11, lineHeight: 17, color: P.muted },
  cancelButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.taupe,
    borderRadius: 15,
    marginTop: 6,
  },
  cancelText: { color: P.ink, fontWeight: "700", fontSize: 14 },
});
