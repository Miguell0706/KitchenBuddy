import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

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
import { savePantry } from "@/features/pantry/storage";
import { syncExpiryReminders } from "@/features/reminders/pantryReminderSync";
import { appendPantryHistory } from "@/features/pantry/history";

const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  ivory: "#F8F4ED",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  soft: "#F2F0EC",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const CATEGORIES: { key: CategoryKey; label: string; icon: IoniconName }[] = [
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

function SectionHeader({
  icon,
  number,
  title,
  subtitle,
}: {
  icon: IoniconName;
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={19} color={C.slate} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionEyebrow}>SECTION {number}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AddItemModal() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
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
  const [expiryMode, setExpiryMode] = useState<
    "auto" | "preset" | "none" | "custom"
  >("auto");
  const [presetDays, setPresetDays] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>("");
  const imagePreview = imageSelection?.image ?? savedImage;
  const addItem = usePantryStore((s) => s.addItem);
  const defaultExpiry = useDefaultExpiry(category);
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

  // Never let a draft image selected for one ingredient follow a different name.
  function onNameChange(nextName: string) {
    if (
      ingredientImageOverrideKey(nextName) !== ingredientImageOverrideKey(name)
    ) {
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
    if (typeof defaultExpiry === "number") setPresetDays(defaultExpiry);
    else setPresetDays(7);
  }, [defaultExpiry, expiryMode]);

  const computedExpiry = useMemo((): number | "none" => {
    if (expiryMode === "none") return "none";
    if (expiryMode === "preset") return presetDays;
    if (expiryMode === "custom") {
      const n = parseInt(customDays, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return defaultExpiry === "none"
          ? "none"
          : typeof defaultExpiry === "number"
            ? defaultExpiry
            : 7;
      }
      return n;
    }
    return defaultExpiry;
  }, [expiryMode, presetDays, customDays, defaultExpiry]);

  const close = () => {
    if (saving || choosingImage) return;
    router.back();
  };

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
      // A newly selected photo becomes a persistent preference only on Save.
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
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityLabel="Close add item"
      />
      <View style={styles.sheet}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.sheetHeading}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headingEyebrow}>YOUR PANTRY / NEW ENTRY</Text>
            <Text style={styles.headingTitle}>Add an item</Text>
            <Text style={styles.headingDescription}>
              Just a name to get started. Make the rest yours.
            </Text>
          </View>
          <Pressable
            onPress={close}
            disabled={saving || choosingImage}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={C.ink} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={23} color={C.slateDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>A LITTLE LESS TO REMEMBER</Text>
              <Text style={styles.heroTitle}>
                Keep your pantry in the know.
              </Text>
              <Text style={styles.heroDescription}>
                Add food, choose an expiry, and KitchenBuddy will help you keep
                track.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="create-outline"
              number="01"
              title="The essentials"
              subtitle="What are you adding today?"
            />
            <Text style={styles.label}>
              ITEM NAME <Text style={styles.required}> · REQUIRED</Text>
            </Text>
            <TextInput
              value={name}
              maxLength={40}
              onChangeText={onNameChange}
              placeholder="e.g., Spinach"
              placeholderTextColor={C.muted}
              autoFocus
              style={styles.input}
              accessibilityLabel="Item name"
            />
            <View style={styles.inputMeta}>
              <Text style={styles.helper}>
                Name your item as it appears in your pantry.
              </Text>
              <Text style={styles.helper}>{name.length}/40</Text>
            </View>
            <Text style={[styles.label, { marginTop: 17 }]}>
              QUANTITY <Text style={styles.optional}> · OPTIONAL</Text>
            </Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              placeholder="e.g., 1 bag"
              placeholderTextColor={C.muted}
              style={styles.input}
              accessibilityLabel="Quantity"
            />
            <Text style={styles.helperBelow}>
              If left blank, quantity defaults to 1.
            </Text>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="image-outline"
              number="02"
              title="Ingredient photo"
              subtitle="A familiar image makes everything easier to find."
            />
            <View style={styles.imageRow}>
              <View style={styles.imageBox}>
                {imagePreview?.url ? (
                  <Image
                    source={{ uri: imagePreview.url }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="image-outline" size={28} color={C.slate} />
                )}
              </View>
              <View style={{ flex: 1, gap: 9 }}>
                <Pressable
                  onPress={() => void chooseGalleryImage()}
                  disabled={saving || choosingImage}
                  style={({ pressed }) => [
                    styles.imageAction,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {choosingImage ? (
                    <ActivityIndicator color={C.slate} size="small" />
                  ) : (
                    <Ionicons name="images-outline" color={C.slate} size={17} />
                  )}
                  <Text style={styles.imageActionText}>
                    {choosingImage
                      ? "Opening photos..."
                      : "Choose from gallery"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowImageUrl((value) => !value)}
                  disabled={saving || choosingImage}
                  style={({ pressed }) => [
                    styles.imageAction,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons name="link-outline" color={C.slate} size={17} />
                  <Text style={styles.imageActionText}>Use image URL</Text>
                </Pressable>
              </View>
            </View>
            {showImageUrl && (
              <View style={styles.urlPanel}>
                <Text style={styles.label}>DIRECT IMAGE LINK</Text>
                <TextInput
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  editable={!saving}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://example.com/photo.jpg"
                  placeholderTextColor={C.muted}
                  style={styles.input}
                  accessibilityLabel="Image URL"
                />
                <Pressable
                  onPress={useImageUrl}
                  disabled={saving || !imageUrl.trim()}
                  style={[
                    styles.useUrl,
                    (saving || !imageUrl.trim()) && styles.disabled,
                  ]}
                >
                  <Text style={styles.useUrlText}>Use this image</Text>
                  <Ionicons name="arrow-forward" size={17} color={C.ivory} />
                </Pressable>
              </View>
            )}
            {imageSelection && (
              <Pressable
                onPress={() => setImageSelection(null)}
                disabled={saving}
                style={styles.clearImage}
                accessibilityRole="button"
              >
                <Ionicons name="refresh-outline" size={15} color={C.slate} />
                <Text style={styles.clearImageText}>
                  Cancel selection · use saved image instead
                </Text>
              </Pressable>
            )}
            <View style={styles.imageNote}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={C.slate}
              />
              <Text style={styles.imageNoteText}>
                Saved photos are reused for this ingredient. A new photo
                preference is saved only when you tap Save.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="calendar-outline"
              number="03"
              title="Expiry preference"
              subtitle="Choose a timeline or use your category default."
            />
            <View style={styles.expirySummary}>
              <View style={styles.expirySummaryIcon}>
                <Ionicons name="time-outline" size={19} color={C.slate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expiryEyebrow}>CURRENT SELECTION</Text>
                <Text style={styles.expiryValue}>
                  {expiryMode === "auto"
                    ? "Auto · category default"
                    : computedExpiry === "none"
                      ? "No expiry"
                      : `${computedExpiry} day${computedExpiry === 1 ? "" : "s"}`}
                </Text>
              </View>
            </View>
            <View style={styles.chips}>
              <Chip
                label="Auto"
                selected={expiryMode === "auto"}
                onPress={() => setExpiryMode("auto")}
              />
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
                      if (p.value === "custom") setExpiryMode("custom");
                      else if (p.value === "none") setExpiryMode("none");
                      else {
                        setPresetDays(p.value);
                        setExpiryMode("preset");
                      }
                    }}
                  />
                );
              })}
            </View>
            {expiryMode === "custom" && (
              <View style={styles.customBlock}>
                <Text style={styles.label}>CUSTOM DAYS</Text>
                <TextInput
                  value={customDays}
                  onChangeText={setCustomDays}
                  keyboardType="number-pad"
                  placeholder="e.g., 5"
                  placeholderTextColor={C.muted}
                  style={styles.input}
                  accessibilityLabel="Custom expiry days"
                />
                <Text style={styles.helperBelow}>
                  Leave blank or enter an invalid number to fall back to auto.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Pressable
              onPress={() => setCategoryOpen((v) => !v)}
              style={styles.categoryToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: categoryOpen }}
            >
              <View style={[styles.sectionIcon, { marginRight: 13 }]}>
                <Ionicons name="layers-outline" size={19} color={C.slate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionEyebrow}>SECTION 04 · OPTIONAL</Text>
                <Text style={styles.sectionTitle}>Food category</Text>
                <Text style={styles.sectionSubtitle}>{categoryLabel}</Text>
              </View>
              <Ionicons
                name={categoryOpen ? "chevron-up" : "chevron-down"}
                size={19}
                color={C.slate}
              />
            </Pressable>
            {categoryOpen && (
              <View style={styles.categoryList}>
                {CATEGORIES.map((c, index) => {
                  const selected = c.key === category;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => {
                        setCategory(c.key);
                        setExpiryMode("auto");
                        setCategoryOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.categoryRow,
                        selected && styles.categoryRowSelected,
                        index === CATEGORIES.length - 1 && { marginBottom: 0 },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.categoryIcon}>
                        <Ionicons name={c.icon} size={18} color={C.slate} />
                      </View>
                      <Text
                        style={[
                          styles.categoryName,
                          selected && styles.categoryNameSelected,
                        ]}
                      >
                        {c.label}
                      </Text>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={19}
                        color={selected ? C.slateDark : "#C8C4BD"}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!categoryOpen && (
              <Text style={styles.categoryHint}>
                Changing category also refreshes the automatic expiry setting.
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={close}
              disabled={saving || choosingImage}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void onSave()}
              disabled={saving || choosingImage}
              style={({ pressed }) => [
                styles.saveButton,
                (saving || choosingImage) && styles.disabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color={C.ivory} size="small" />
              ) : (
                <Ionicons name="checkmark" size={19} color={C.ivory} />
              )}
              <Text style={styles.saveText}>
                {saving ? "Saving..." : "Save item"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>
            YOUR KITCHEN, A LITTLE MORE ORGANIZED. · KITCHENBUDDY
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 38, 40, 0.45)",
  },
  sheet: {
    height: "95%",
    backgroundColor: C.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#CDC8C0",
  },
  sheetHeading: {
    flexDirection: "row",
    paddingHorizontal: 22,
    paddingTop: 11,
    paddingBottom: 18,
    alignItems: "center",
  },
  headingEyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.slate,
    fontWeight: "800",
    marginBottom: 5,
  },
  headingTitle: {
    fontFamily: "serif",
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "600",
    color: C.ink,
  },
  headingDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
    marginTop: 5,
  },
  closeButton: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.cream,
    marginLeft: 9,
  },
  content: { paddingHorizontal: 18, paddingBottom: 45 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    gap: 13,
    marginBottom: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.ivory,
    justifyContent: "center",
    alignItems: "center",
  },
  heroEyebrow: {
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: "800",
    color: "#E8E0D5",
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 20,
    lineHeight: 25,
    color: "#FFFEFB",
    marginBottom: 5,
  },
  heroDescription: { fontSize: 12, lineHeight: 18, color: "#EAE5DD" },
  card: {
    backgroundColor: C.paper,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 13,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 19,
  },
  sectionIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionEyebrow: {
    fontSize: 9,
    color: C.slate,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 20,
    color: C.ink,
    fontWeight: "600",
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  label: {
    color: C.ink,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  required: { color: C.slate },
  optional: { color: C.muted, fontWeight: "600" },
  input: {
    backgroundColor: "#F8F7F4",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    color: C.ink,
    fontSize: 14,
  },
  inputMeta: {
    marginTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  helper: { fontSize: 10, color: C.muted, lineHeight: 15, flexShrink: 1 },
  helperBelow: { marginTop: 7, color: C.muted, fontSize: 11, lineHeight: 17 },
  imageRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  imageBox: {
    width: 91,
    height: 91,
    borderRadius: 15,
    backgroundColor: C.soft,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  preview: { width: "100%", height: "100%" },
  imageAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    backgroundColor: C.soft,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  imageActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.ink,
    flexShrink: 1,
  },
  urlPanel: {
    backgroundColor: C.soft,
    borderRadius: 13,
    padding: 12,
    marginTop: 13,
  },
  useUrl: {
    minHeight: 41,
    marginTop: 9,
    backgroundColor: C.slate,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  useUrlText: { color: C.ivory, fontWeight: "700", fontSize: 12 },
  clearImage: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
  },
  clearImageText: { fontSize: 11, color: C.slate, fontWeight: "700" },
  imageNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.ivory,
    padding: 11,
    borderRadius: 11,
    marginTop: 13,
    gap: 8,
  },
  imageNoteText: { flex: 1, fontSize: 11, lineHeight: 16, color: C.muted },
  expirySummary: {
    backgroundColor: C.ivory,
    padding: 12,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  expirySummaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: C.muted,
    marginBottom: 4,
  },
  expiryValue: { color: C.ink, fontWeight: "700", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.soft,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 99,
    minHeight: 35,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: C.slateDark, borderColor: C.slateDark },
  chipText: { color: C.ink, fontWeight: "600", fontSize: 12 },
  chipTextSelected: { color: C.ivory },
  customBlock: { paddingTop: 14 },
  categoryToggle: { flexDirection: "row", alignItems: "center" },
  categoryList: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    marginTop: 14,
  },
  categoryRow: {
    flexDirection: "row",
    minHeight: 47,
    alignItems: "center",
    backgroundColor: C.soft,
    paddingHorizontal: 11,
    borderRadius: 11,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  categoryRowSelected: { backgroundColor: C.ivory, borderColor: C.slate },
  categoryIcon: {
    width: 29,
    height: 29,
    borderRadius: 9,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  categoryName: { color: C.ink, fontSize: 13, flex: 1 },
  categoryNameSelected: { fontWeight: "700", color: C.slateDark },
  categoryHint: { marginTop: 14, fontSize: 11, lineHeight: 17, color: C.muted },
  actions: { flexDirection: "row", gap: 11, marginTop: 6 },
  cancelButton: {
    minHeight: 51,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: C.ink, fontWeight: "700", fontSize: 14 },
  saveButton: {
    minHeight: 51,
    flex: 1.3,
    borderRadius: 14,
    backgroundColor: C.slateDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: C.ivory, fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  footer: {
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 1.1,
    fontWeight: "700",
    color: C.muted,
    marginTop: 22,
  },
});
