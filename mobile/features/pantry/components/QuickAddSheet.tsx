import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { nanoid } from "nanoid/non-secure";

import type { CategoryKey } from "@/features/pantry/types";
import { usePantryStore } from "@/features/pantry/store";
import { useDefaultExpiry } from "@/features/pantry/useDefaultExpiry";
import { appendPantryHistory } from "@/features/pantry/history";

type Props = {
  open: boolean;
  onClose: () => void;
};

const P = {
  bg: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  line: "#E9E5DE",
  tint: "#F3EFE8",
  white: "#FFFFFF",
};

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
];

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function QuickAddSheet({ open, onClose }: Props) {
  const quickAddItem = usePantryStore((s) => s.addItem);
  const [name, setName] = useState("");
  const [categoryKey, setCategoryKey] = useState<CategoryKey>("produce");
  const [catOpen, setCatOpen] = useState(false);
  const defaultExpiry = useDefaultExpiry(categoryKey);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategoryKey("produce");
    setCatOpen(false);
  }, [open]);

  const selected = useMemo(
    () => CATEGORY_OPTIONS.find((c) => c.key === categoryKey),
    [categoryKey],
  );

  const save = () => {
    const normalizedName = name.trim().slice(0, 40);
    if (!normalizedName) return;
    const d = defaultExpiry;
    const expiresInDays = d === "none" ? 9999 : d;
    const expiryDate = d === "none" ? null : isoDateDaysFromNow(expiresInDays);
    const newItem = {
      id: nanoid(),
      name: normalizedName,
      quantity: "",
      categoryKey,
      expiryDate,
      addedAt: Date.now(),
    };
    quickAddItem(categoryKey, newItem);
    void appendPantryHistory(newItem, "added", "quickAdd");
    onClose();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close quick add"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>YOUR PANTRY / QUICK ENTRY</Text>
                <Text style={styles.title}>Quick add</Text>
                <Text style={styles.subtitle}>
                  Add an ingredient in just a few taps.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={P.ink} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled
            >
              <View style={styles.formCard}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Ingredient name</Text>
                  <Text style={styles.required}>REQUIRED</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="basket-outline" size={19} color={P.slate} />
                  <TextInput
                    value={name}
                    maxLength={40}
                    onChangeText={setName}
                    placeholder="e.g., Apples"
                    placeholderTextColor={P.muted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={save}
                    style={styles.input}
                    accessibilityLabel="Ingredient name"
                  />
                </View>
                <Text style={styles.helper}>
                  Only the name is required · {name.length}/40
                </Text>
              </View>

              <View style={styles.formCard}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Category</Text>
                  <Text style={styles.optional}>OPTIONAL</Text>
                </View>
                <Pressable
                  onPress={() => setCatOpen((v) => !v)}
                  style={styles.categoryTrigger}
                  accessibilityRole="button"
                  accessibilityLabel={`Category: ${selected?.label ?? "Produce"}`}
                  accessibilityState={{ expanded: catOpen }}
                >
                  <View style={styles.categoryIcon}>
                    <Ionicons
                      name={selected?.icon ?? "leaf-outline"}
                      size={20}
                      color={P.slateDeep}
                    />
                  </View>
                  <View style={styles.categoryTriggerText}>
                    <Text style={styles.categoryName}>
                      {selected?.label ?? "Produce"}
                    </Text>
                    <Text style={styles.categorySub}>
                      Uses your category's default expiry
                    </Text>
                  </View>
                  <Ionicons
                    name={catOpen ? "chevron-up" : "chevron-down"}
                    size={19}
                    color={P.slate}
                  />
                </Pressable>

                {catOpen && (
                  <View style={styles.optionGrid}>
                    {CATEGORY_OPTIONS.map((c) => {
                      const active = c.key === categoryKey;
                      return (
                        <Pressable
                          key={c.key}
                          onPress={() => {
                            setCategoryKey(c.key);
                            setCatOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.categoryOption,
                            active && styles.categoryOptionActive,
                          ]}
                        >
                          <Ionicons
                            name={c.icon}
                            size={17}
                            color={active ? P.white : P.slate}
                          />
                          <Text
                            style={[
                              styles.optionText,
                              active && styles.optionTextActive,
                            ]}
                          >
                            {c.label}
                          </Text>
                          {active && (
                            <Ionicons
                              name="checkmark"
                              size={15}
                              color={P.white}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.noteRow}>
                <Ionicons name="time-outline" size={18} color={P.slate} />
                <Text style={styles.note}>
                  The expiry date will be assigned automatically using your
                  current default for {selected?.label ?? "Produce"}.
                </Text>
              </View>

              <Pressable
                onPress={save}
                disabled={!name.trim()}
                style={({ pressed }) => [
                  styles.saveButton,
                  !name.trim() && styles.disabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add to pantry"
              >
                <Ionicons name="add-circle-outline" size={20} color={P.white} />
                <Text style={styles.saveText}>Add to pantry</Text>
                <Ionicons name="arrow-forward" size={17} color={P.white} />
              </Pressable>
              <Pressable
                onPress={onClose}
                style={styles.cancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(25,31,33,0.48)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: P.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#C7C1B8",
    alignSelf: "center",
    marginBottom: 19,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 14,
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: P.slate,
    marginBottom: 6,
  },
  title: {
    fontFamily: "serif",
    fontSize: 30,
    fontWeight: "700",
    color: P.ink,
    lineHeight: 37,
  },
  subtitle: { fontSize: 13, color: P.muted, lineHeight: 19, marginTop: 4 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.taupe,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 32 },
  formCard: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 19,
    padding: 16,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 11,
  },
  label: { color: P.ink, fontSize: 14, fontWeight: "700" },
  required: {
    color: P.slate,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  optional: {
    color: P.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: P.line,
    backgroundColor: P.bg,
    paddingHorizontal: 13,
    minHeight: 51,
  },
  input: { flex: 1, color: P.ink, fontSize: 15, paddingVertical: 10 },
  helper: { marginTop: 9, color: P.muted, fontSize: 11, lineHeight: 16 },
  categoryTrigger: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: P.tint,
    borderWidth: 1,
    borderColor: P.line,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTriggerText: { flex: 1 },
  categoryName: { color: P.ink, fontSize: 14, fontWeight: "700" },
  categorySub: { color: P.muted, fontSize: 11, marginTop: 3 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  categoryOption: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: P.tint,
    borderColor: P.line,
    borderWidth: 1,
  },
  categoryOptionActive: { backgroundColor: P.slate, borderColor: P.slate },
  optionText: { color: P.ink, fontSize: 12, fontWeight: "600" },
  optionTextActive: { color: P.white },
  noteRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: P.taupe,
    borderRadius: 14,
    padding: 13,
    marginTop: 3,
    marginBottom: 19,
  },
  note: { color: P.slateDeep, flex: 1, fontSize: 12, lineHeight: 18 },
  saveButton: {
    backgroundColor: P.slateDeep,
    minHeight: 53,
    borderRadius: 15,
    paddingHorizontal: 17,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: P.white,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.83 },
  cancelButton: { alignItems: "center", padding: 15, marginTop: 5 },
  cancelText: { color: P.muted, fontSize: 13, fontWeight: "700" },
});
