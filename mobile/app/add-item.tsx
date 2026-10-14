import React, { useMemo, useState, useEffect } from "react";

import {
  Alert,
  Image,
  ActivityIndicator,
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
import * as ImagePicker from "expo-image-picker";

import { Colors, Spacing } from "@/constants/theme";

import {
  ButtonStyles,
  CardStyles,
  Layout,
  TextStyles,
} from "@/constants/styles";

import { router } from "expo-router";

import type {
  CategoryKey,
  IngredientImage,
  PantryItem,
} from "@/features/pantry/types";
import {
  getIngredientImageOverride,
  ingredientImageOverrideKey,
  saveIngredientImageOverride,
  type IngredientImageSource,
} from "@/features/pantry/ingredientImageOverrides";

import { useDefaultExpiry } from "@/features/pantry/useDefaultExpiry";

import { usePantryStore } from "@/features/pantry/store";

import * as Haptics from "expo-haptics";

import { savePantry } from "@/features/pantry/storage";

import { syncExpiryReminders } from "@/features/reminders/pantryReminderSync";

import { appendPantryHistory } from "@/features/pantry/history";

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

  d.setHours(0, 0, 0, 0);

  d.setDate(d.getDate() + days);

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  const [savedImage, setSavedImage] = useState<IngredientImage | null>(null);
  const [imageSelection, setImageSelection] = useState<{
    source: IngredientImageSource;
    image: IngredientImage;
    mimeType?: string | null;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [showImageUrl, setShowImageUrl] = useState(false);
  const [choosingImage, setChoosingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const imagePreview = imageSelection?.image ?? savedImage;

  const addItem = usePantryStore((s) => s.addItem);

  // 👇 this is the overridable default for the current category

  const defaultExpiry = useDefaultExpiry(category);

  // expiry selection

  const [expiryMode, setExpiryMode] = useState<
    "auto" | "preset" | "none" | "custom"
  >("auto");

  const [presetDays, setPresetDays] = useState<number>(7);

  const [customDays, setCustomDays] = useState<string>("");

  // Image preferences are keyed to the ingredient, not the individual pantry entry.
  // Cancel stale reads while the user is typing a new name.
  const nameKey = ingredientImageOverrideKey(name.trim());
  useEffect(() => {
    let cancelled = false;
    setSavedImage(null);
    if (!nameKey)
      return () => {
        cancelled = true;
      };

    const timer = setTimeout(() => {
      void getIngredientImageOverride(name.trim())
        .then((override) => {
          if (!cancelled) setSavedImage(override?.image ?? null);
        })
        .catch((error) => {
          if (!cancelled)
            console.warn("Could not load ingredient image preference:", error);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nameKey]);

  function onNameChange(nextName: string) {
    if (
      ingredientImageOverrideKey(nextName) !== ingredientImageOverrideKey(name)
    ) {
      // A draft image selected for one ingredient must not follow a rename.
      setImageSelection(null);
      setImageUrl("");
      setShowImageUrl(false);
    }
    setName(nextName);
  }

  async function chooseGalleryImage() {
    if (choosingImage || saving) return;
    setChoosingImage(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow access to photos to choose an ingredient image.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageSelection({
        source: "gallery",
        image: { url: asset.uri },
        mimeType: asset.mimeType,
      });
      setShowImageUrl(false);
    } catch (error) {
      console.warn("Could not select ingredient photo:", error);
      Alert.alert("Photo unavailable", "Please try choosing the photo again.");
    } finally {
      setChoosingImage(false);
    }
  }

  function useImageUrl() {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert(
        "Invalid image URL",
        "Paste a direct HTTP or HTTPS image URL.",
      );
      return;
    }
    setImageSelection({ source: "search", image: { url } });
    setShowImageUrl(false);
  }

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.key === category)?.label ?? "Category",

    [category],
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
    if (saving || choosingImage) return;

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

  const onSave = async () => {
    if (saving || choosingImage) return;

    const normalizedName = name.trim().slice(0, 40);

    if (!normalizedName) {
      Alert.alert("Name required", "Type an item name to continue.");

      return;
    }

    const quantity = qty.trim() || "1";

    const expiresInDays = computedExpiry === "none" ? 9999 : computedExpiry;

    const expiryDate =
      computedExpiry === "none" ? null : isoDateDaysFromNow(expiresInDays);

    setSaving(true);
    try {
      // Do not commit a photo override when the user merely picks a photo and cancels.
      // Commit it on Save, then put the persistent local URI on the pantry item.
      const resolvedImage: IngredientImage | null = imageSelection
        ? (
            await saveIngredientImageOverride(
              normalizedName,
              imageSelection.image,
              imageSelection.source,
              { mimeType: imageSelection.mimeType },
            )
          ).image
        : ((await getIngredientImageOverride(normalizedName))?.image ?? null);

      const newItem: PantryItem = {
        id: `${Date.now()}`,

        name: normalizedName,

        quantity,

        categoryKey: category,

        expiryDate,

        addedAt: Date.now(),
        ingredientImage: resolvedImage,
      };

      addItem(category, newItem);

      await appendPantryHistory(newItem, "added", "manual");

      const updatedPantry = usePantryStore.getState().pantry;

      await savePantry(updatedPantry);

      await syncExpiryReminders();

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Save is complete; bypass the modal's busy-state close guard.
      router.back();
    } catch (error) {
      console.error("Failed to add pantry item:", error);

      Alert.alert(
        "Save failed",

        error instanceof Error
          ? error.message
          : "The item could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
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

          {/* Optional image: reuses the persistent Scan Review / Pantry preference. */}
          <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
            <Text style={TextStyles.sectionTitle}>Image (optional)</Text>
            <Text
              style={[
                TextStyles.small,
                { marginTop: 5, marginBottom: Spacing.sm },
              ]}
            >
              Reuses a saved photo for this ingredient, if one exists.
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              {imagePreview?.url ? (
                <Image
                  source={{ uri: imagePreview.url }}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 12,
                    backgroundColor: "#eee",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.06)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color={Colors.textLight}
                  />
                </View>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => void chooseGalleryImage()}
                  disabled={saving || choosingImage}
                  style={{
                    padding: 10,
                    backgroundColor: "rgba(0,0,0,0.06)",
                    borderRadius: 10,
                  }}
                >
                  <Text style={TextStyles.body}>
                    {choosingImage
                      ? "Opening photos..."
                      : "Choose from gallery"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowImageUrl((value) => !value)}
                  disabled={saving || choosingImage}
                  style={{
                    padding: 10,
                    backgroundColor: "rgba(0,0,0,0.06)",
                    borderRadius: 10,
                  }}
                >
                  <Text style={TextStyles.body}>Use image URL</Text>
                </TouchableOpacity>
              </View>
            </View>
            {showImageUrl && (
              <View style={{ marginTop: Spacing.sm }}>
                <TextInput
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  editable={!saving}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://example.com/photo.jpg"
                  placeholderTextColor={Colors.textLight}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.05)",
                    color: Colors.text,
                  }}
                />
                <TouchableOpacity
                  onPress={useImageUrl}
                  disabled={saving || !imageUrl.trim()}
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: "rgba(0,0,0,0.08)",
                    opacity: imageUrl.trim() ? 1 : 0.5,
                  }}
                >
                  <Text style={TextStyles.body}>Use this image</Text>
                </TouchableOpacity>
              </View>
            )}
            {imageSelection && (
              <TouchableOpacity
                onPress={() => setImageSelection(null)}
                disabled={saving}
                style={{
                  marginTop: Spacing.sm,
                  alignSelf: "flex-start",
                  paddingVertical: 6,
                }}
              >
                <Text style={TextStyles.small}>
                  Cancel selected photo (use saved image instead)
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[TextStyles.small, { marginTop: 6 }]}>
              A new image preference is saved only when you tap Save.
            </Text>
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
