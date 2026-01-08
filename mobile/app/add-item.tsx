import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { router } from "expo-router";
import type { CategoryKey } from "@/features/pantry/types";
import { useDefaultExpiry } from "@/features/pantry/useDefaultExpiry";
import { usePantryStore } from "@/features/pantry/store";
import * as Haptics from "expo-haptics";

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "produce", label: "Produce", icon: "leaf-outline" },
  { key: "meatSeafood", label: "Meat & Seafood", icon: "restaurant-outline" },
  { key: "dairyEggs", label: "Dairy & Eggs", icon: "ice-cream-outline" },
  { key: "bakery", label: "Bakery / Bread", icon: "nutrition-outline" },
  { key: "pantry", label: "Pantry (Dry Goods)", icon: "cube-outline" },
  { key: "condiments", label: "Condiments & Sauces", icon: "water-outline" },
  { key: "spices", label: "Spices & Seasonings", icon: "flame-outline" },
  { key: "beverages", label: "Beverages", icon: "cafe-outline" },
  { key: "frozen", label: "Frozen", icon: "snow-outline" },
  { key: "snacks", label: "Snacks & Sweets", icon: "ice-cream-outline" },
  { key: "pet", label: "Pet Food", icon: "paw-outline" },
  { key: "household", label: "Household (Non-food)", icon: "home-outline" },
  {
    key: "supplements",
    label: "Supplements / Vitamins",
    icon: "medkit-outline",
  },
];
// Reasonable defaults if user doesn’t choose anything

type ExpiryPreset =
  | { key: "1"; label: "1d"; value: 1 }
  | { key: "3"; label: "3d"; value: 3 }
  | { key: "7"; label: "7d"; value: 7 }
  | { key: "14"; label: "14d"; value: 14 }
  | { key: "30"; label: "30d"; value: 30 }
  | { key: "none"; label: "No expiry"; value: "none" }
  | { key: "custom"; label: "Custom"; value: "custom" };

const EXPIRY_PRESETS: ExpiryPreset[] = [
  { key: "1", label: "1d", value: 1 },
  { key: "3", label: "3d", value: 3 },
  { key: "7", label: "7d", value: 7 },
  { key: "14", label: "14d", value: 14 },
  { key: "30", label: "30d", value: 30 },
  { key: "none", label: "No expiry", value: "none" },
  { key: "custom", label: "Custom", value: "custom" },
];
function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: selected ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.05)",
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? "rgba(0,0,0,0.20)" : "transparent",
      }}
    >
      <Text style={selected ? TextStyles.body : TextStyles.small}>{label}</Text>
    </Pressable>
  );
}

export default function AddItemModal() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(""); // optional
  const [category, setCategory] = useState<CategoryKey>("produce");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const addItem = usePantryStore((s) => s.addItem);

  // 👇 this is the overridable default for the current category
  const defaultExpiry = useDefaultExpiry(category);

  // expiry selection
  const [expiryMode, setExpiryMode] = useState<
    "auto" | "preset" | "none" | "custom"
  >("auto");
  const [presetDays, setPresetDays] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>("");

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.key === category)?.label ?? "Category",
    [category]
  );
  useEffect(() => {
    if (expiryMode !== "auto") return;
    if (typeof defaultExpiry === "number") {
      setPresetDays(defaultExpiry);
    } else {
      // defaultExpiry === "none" or undefined, fall back to 7 just for UI
      setPresetDays(7);
    }
  }, [defaultExpiry, expiryMode]);

  const close = () => {
    // avoid GO_BACK warning when no history (fast refresh / deep link)
    // @ts-ignore
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.back();
    }
  };

  const computedExpiry = useMemo((): number | "none" => {
    if (expiryMode === "none") return "none";

    if (expiryMode === "preset") {
      return presetDays;
    }

    if (expiryMode === "custom") {
      const n = parseInt(customDays, 10);
      if (!Number.isFinite(n) || n <= 0) {
        // invalid custom → fall back to the default for this category
        return defaultExpiry === "none"
          ? "none"
          : typeof defaultExpiry === "number"
          ? defaultExpiry
          : 7; // extra safety fallback
      }
      return n;
    }

    // "auto" → use overridable default
    return defaultExpiry;
  }, [expiryMode, presetDays, customDays, defaultExpiry]);
  const onSave = () => {
    const normalizedName = name.trim().slice(0, 40);

    if (!normalizedName) {
      Alert.alert("Name required", "Type an item name to continue.");
      return;
    }

    const quantity = qty.trim() || "1";
    const expiresInDays = computedExpiry === "none" ? 9999 : computedExpiry;
    const expiryDate =
      computedExpiry === "none" ? null : isoDateDaysFromNow(expiresInDays);

    addItem(category, {
      id: `${Date.now()}`,
      name: normalizedName,
      quantity,
      categoryKey: category,
      expiryDate,
      expiresInDays,
      // 🔧 add any other required fields if TS still complains
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    close();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      {/* Dim overlay (tap outside to close) */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        onPress={close}
      />

      {/* Bottom sheet */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "95%",
          backgroundColor: Colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: Spacing.md,
          overflow: "hidden",
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
          <View
            style={{
              width: 44,
              height: 5,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.18)",
            }}
          />
        </View>

        {/* Header */}
        <View
          style={[
            Layout.rowBetween,
            {
              paddingHorizontal: Spacing.lg,
              paddingRight: Spacing.lg + Spacing.sm, // optional extra breathing room
              marginBottom: Spacing.md,
              alignItems: "center",
              minHeight: 52,
            },
          ]}
        >
          <View style={{ flex: 1, paddingRight: Spacing.md }}>
            <Text style={TextStyles.screenTitle}>Add item</Text>
            <Text style={TextStyles.bodyMuted}>
              Only the name is required. Defaults to produce.
            </Text>
          </View>

          <TouchableOpacity
            onPress={close}
            activeOpacity={0.7}
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

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Item */}
          <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
            <Text style={TextStyles.sectionTitle}>Item</Text>

            <Text style={[TextStyles.small, { marginTop: Spacing.sm }]}>
              Name (required)
            </Text>
            <TextInput
              value={name}
              maxLength={40}
              onChangeText={setName}
              placeholder="e.g., Spinach"
              placeholderTextColor={Colors.textLight}
              autoFocus
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.05)",
                color: Colors.text,
              }}
            />

            <Text style={[TextStyles.small, { marginTop: Spacing.md }]}>
              Quantity (optional)
            </Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              placeholder="e.g., 1 bag"
              placeholderTextColor={Colors.textLight}
              style={{
                marginTop: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.05)",
                color: Colors.text,
              }}
            />
          </View>

          {/* Expiry */}
          <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
            <View style={Layout.rowBetween}>
              <Text style={TextStyles.sectionTitle}>Expiry</Text>
              <Text style={TextStyles.small}>
                {expiryMode === "auto"
                  ? "Auto"
                  : computedExpiry === "none"
                  ? "No expiry"
                  : `${computedExpiry} days`}
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}
            >
              {EXPIRY_PRESETS.map((p) => {
                const selected =
                  (p.value === "custom" && expiryMode === "custom") ||
                  (p.value === "none" && expiryMode === "none") ||
                  (typeof p.value === "number" &&
                    expiryMode === "preset" &&
                    presetDays === p.value);

                return (
                  <Chip
                    key={p.key}
                    label={p.label}
                    selected={selected}
                    onPress={() => {
                      if (p.value === "custom") {
                        setExpiryMode("custom");
                      } else if (p.value === "none") {
                        setExpiryMode("none");
                      } else {
                        setPresetDays(p.value);
                        setExpiryMode("preset");
                      }
                    }}
                  />
                );
              })}

              {/* Auto chip */}
              <Chip
                label="Auto"
                selected={expiryMode === "auto"}
                onPress={() => setExpiryMode("auto")}
              />
            </View>

            {expiryMode === "custom" && (
              <View style={{ marginTop: Spacing.sm }}>
                <Text style={TextStyles.small}>Custom days</Text>
                <TextInput
                  value={customDays}
                  onChangeText={setCustomDays}
                  keyboardType="number-pad"
                  placeholder="e.g., 5"
                  placeholderTextColor={Colors.textLight}
                  style={{
                    marginTop: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.05)",
                    color: Colors.text,
                  }}
                />
                <Text style={[TextStyles.small, { marginTop: 6 }]}>
                  Tip: leave blank to fall back to auto.
                </Text>
              </View>
            )}
          </View>
          {/* Category (collapsible) */}
          <View style={[CardStyles.subtle, { marginBottom: Spacing.lg }]}>
            <Pressable
              onPress={() => setCategoryOpen((v) => !v)}
              style={[Layout.rowBetween, { paddingVertical: 6 }]}
            >
              <View>
                <Text style={TextStyles.sectionTitle}>Category (optional)</Text>
                <Text style={TextStyles.small}>{categoryLabel}</Text>
              </View>

              <Ionicons
                name={categoryOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.textLight}
              />
            </Pressable>

            {categoryOpen && (
              <View style={{ marginTop: Spacing.sm }}>
                {CATEGORIES.map((c) => {
                  const selected = c.key === category;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => {
                        setCategory(c.key);
                        setExpiryMode("auto");
                        setCategoryOpen(false); // auto-collapse after pick
                      }}
                      style={[
                        Layout.rowBetween,
                        {
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 14,
                          marginBottom: 8,
                          backgroundColor: selected
                            ? "rgba(0,0,0,0.08)"
                            : "rgba(0,0,0,0.03)",
                        },
                      ]}
                    >
                      <View style={Layout.row}>
                        <Ionicons
                          name={c.icon}
                          size={18}
                          color={Colors.text}
                          style={{ marginRight: Spacing.sm }}
                        />
                        <Text style={TextStyles.body}>{c.label}</Text>
                      </View>

                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={Colors.primary}
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={18}
                          color={Colors.textLight}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={[Layout.rowBetween, { columnGap: Spacing.md }]}>
            <TouchableOpacity
              style={[
                ButtonStyles.ghost,
                { flex: 1, justifyContent: "center" },
              ]}
              activeOpacity={0.8}
              onPress={close}
            >
              <Text style={ButtonStyles.ghostText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                ButtonStyles.primary,
                { flex: 1, justifyContent: "center" },
              ]}
              activeOpacity={0.8}
              onPress={onSave}
            >
              <Text style={ButtonStyles.primaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
