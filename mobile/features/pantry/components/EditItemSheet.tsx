import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import * as ImagePicker from "expo-image-picker";

import { StyleSheet } from "react-native";

import type {
  CategoryKey,
  PantryItem,
  IngredientImage,
} from "@/features/pantry/types";

import {
  ingredientImageOverrideKey,
  getIngredientImageOverride,
  removeIngredientImageOverride,
  saveIngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";

import { CATEGORIES } from "@/features/pantry/constants";

import { usePantryStore } from "@/features/pantry/store";

import { getExpiresInDays } from "@/features/pantry/utils";

import { BulkMoveSheet } from "@/features/pantry/components/BulkMoveSheet";

type Props = {
  open: boolean;

  onClose: () => void;

  target: {
    id: string;

    categoryKey: CategoryKey;
  } | null;
};

export function EditItemSheet({ open, onClose, target }: Props) {
  const { height: windowHeight } = useWindowDimensions();

  const updateItem = usePantryStore((state) => state.updateItem);

  const setPantry = usePantryStore((state) => state.setPantry);

  const item = usePantryStore((state) => {
    if (!target) return undefined;

    return state.getItem(target.categoryKey, target.id);
  });

  const [name, setName] = useState("");

  const [quantity, setQuantity] = useState("");

  const [expiresInDays, setExpiresInDays] = useState("");

  const [categoryKey, setCategoryKey] = useState<CategoryKey | null>(null);

  const [moveSheetOpen, setMoveSheetOpen] = useState(false);

  const [imageActionsOpen, setImageActionsOpen] = useState(false);

  const [imageUrlText, setImageUrlText] = useState("");

  const [imagePreview, setImagePreview] = useState<IngredientImage | null>(
    null,
  );

  const [hasImageOverride, setHasImageOverride] = useState(false);

  const [imageLoading, setImageLoading] = useState(false);

  const [imageSaving, setImageSaving] = useState(false);

  const imageActionBusyRef = React.useRef(false);

  const galleryPickerOpenRef = React.useRef(false);

  const selectedCategory = CATEGORIES.find(
    (category) => category.key === categoryKey,
  );

  // Initialize editable form values when opening an item, not on each store update.
  // Image changes update Zustand immediately and must not erase unsaved form edits.
  useEffect(() => {
    if (!open || !target) return;

    const current = usePantryStore

      .getState()

      .getItem(target.categoryKey, target.id);

    if (!current) return;

    setName(current.name ?? "");

    setQuantity(current.quantity ?? "");

    const days = getExpiresInDays(current);

    setExpiresInDays(days >= 9999 ? "" : String(days));

    setCategoryKey(target.categoryKey);

    setMoveSheetOpen(false);

    setImageActionsOpen(false);

    setImageUrlText("");

    setImagePreview(current.ingredientImage ?? null);

    setHasImageOverride(false);

    let cancelled = false;

    setImageLoading(true);

    void getIngredientImageOverride(current.name)
      .then((override) => {
        if (cancelled) return;

        setHasImageOverride(!!override);

        if (override) setImagePreview(override.image);
      })

      .catch((error) => {
        if (!cancelled)
          console.warn("Could not load preferred ingredient image:", error);
      })

      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target?.id, target?.categoryKey]);

  useEffect(() => {
    if (!open || !target || item !== undefined) return;

    Alert.alert("Item not found", "It may have been deleted.", [
      { text: "OK", onPress: onClose },
    ]);
  }, [open, target?.id, target?.categoryKey, item, onClose]);

  const closeIfIdle = () => {
    if (imageActionBusyRef.current || galleryPickerOpenRef.current) return;

    onClose();
  };

  // Updating every matching PantryItem prevents a replaced/deleted local image
  // from leaving stale file:// references on other copies of that ingredient.
  const updateMatchingImages = (
    ingredientName: string,

    image: IngredientImage | null,

    oldOverrideUrl?: string,
  ) => {
    const key = ingredientImageOverrideKey(ingredientName);

    if (!key) return;

    setPantry((previous) => {
      let changed = false;

      const next = { ...previous };

      for (const category of CATEGORIES) {
        const rows = previous[category.key] ?? [];

        const updated = rows.map((row) => {
          if (ingredientImageOverrideKey(row.name) !== key) return row;

          // Reset only rows using the removed override, preserving distinct images.
          if (oldOverrideUrl && row.ingredientImage?.url !== oldOverrideUrl)
            return row;

          if ((row.ingredientImage?.url ?? null) === (image?.url ?? null))
            return row;

          changed = true;

          return { ...row, ingredientImage: image };
        });

        if (updated.some((row, index) => row !== rows[index]))
          next[category.key] = updated;
      }

      return changed ? next : previous;
    });
  };

  const canEditImage = () => {
    if (!item) return false;

    if (name.trim() !== item.name.trim()) {
      Alert.alert(
        "Save the name first",

        "Save your renamed item, then reopen it to choose an image for the new name.",
      );

      return false;
    }

    if (!item.name.trim()) {
      Alert.alert(
        "Name required",

        "Enter an ingredient name before choosing an image.",
      );

      return false;
    }

    return true;
  };

  const saveChosenImage = async (
    image: IngredientImage,

    source: "gallery" | "search",

    mimeType?: string | null,
  ) => {
    if (!item || imageActionBusyRef.current || !canEditImage()) return;

    const ingredientName = item.name.trim();

    imageActionBusyRef.current = true;

    setImageSaving(true);

    try {
      const saved = await saveIngredientImageOverride(
        ingredientName,

        image,

        source,

        { mimeType },
      );

      updateMatchingImages(ingredientName, saved.image);

      setImagePreview(saved.image);

      setHasImageOverride(true);

      setImageActionsOpen(false);

      setImageUrlText("");
    } catch (error) {
      console.warn("Unable to save ingredient image:", error);

      Alert.alert(
        "Image not saved",

        error instanceof Error ? error.message : "Please try another image.",
      );
    } finally {
      imageActionBusyRef.current = false;

      setImageSaving(false);
    }
  };

  const chooseGalleryImage = async () => {
    if (
      galleryPickerOpenRef.current ||
      imageActionBusyRef.current ||
      !canEditImage()
    )
      return;

    galleryPickerOpenRef.current = true;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",

          "Allow photo access to select an ingredient picture.",
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

      await saveChosenImage({ url: asset.uri }, "gallery", asset.mimeType);
    } catch (error) {
      console.warn("Gallery image selection failed:", error);

      Alert.alert("Couldn't select image", "Please try again.");
    } finally {
      galleryPickerOpenRef.current = false;
    }
  };

  const saveImageUrl = async () => {
    const url = imageUrlText.trim();

    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("Invalid image URL", "Paste a direct HTTP(S) image URL.");

      return;
    }

    await saveChosenImage({ url }, "search");
  };

  const resetSavedImage = async () => {
    if (!item || imageActionBusyRef.current || !canEditImage()) return;

    const ingredientName = item.name.trim();

    imageActionBusyRef.current = true;

    setImageSaving(true);

    try {
      const prior = await getIngredientImageOverride(ingredientName);

      if (!prior) {
        setHasImageOverride(false);

        Alert.alert(
          "No override",

          "There isn't a saved image preference for this ingredient.",
        );

        return;
      }

      await removeIngredientImageOverride(ingredientName);

      // The old automatic lookup image is not retained by PantryItem. Use the
      // placeholder until a future scan provides a fresh automatic picture.
      updateMatchingImages(ingredientName, null, prior.image.url);

      setImagePreview(null);

      setHasImageOverride(false);

      setImageActionsOpen(false);

      setImageUrlText("");
    } catch (error) {
      console.warn("Unable to reset ingredient image:", error);

      Alert.alert(
        "Reset failed",

        "The saved image preference could not be removed.",
      );
    } finally {
      imageActionBusyRef.current = false;

      setImageSaving(false);
    }
  };

  const save = () => {
    if (!target || !item || imageActionBusyRef.current || imageLoading) return;

    const normalizedName = name.trim().slice(0, 40);

    if (!normalizedName) {
      Alert.alert("Missing name", "Please enter an item name.");

      return;
    }

    const expiryInput = expiresInDays.trim();

    let nextExpiryDate: string | null;

    if (expiryInput === "") {
      nextExpiryDate = null;
    } else {
      const days = Number(expiryInput);

      if (!Number.isInteger(days) || days < 0) {
        Alert.alert(
          "Invalid expiry",

          "Expires in days must be a whole number of 0 or more.",
        );

        return;
      }

      const now = new Date();

      const expiryDate = new Date(
        now.getFullYear(),

        now.getMonth(),

        now.getDate(),
      );

      expiryDate.setDate(expiryDate.getDate() + days);

      const yyyy = expiryDate.getFullYear();

      const mm = String(expiryDate.getMonth() + 1).padStart(2, "0");

      const dd = String(expiryDate.getDate()).padStart(2, "0");

      nextExpiryDate = `${yyyy}-${mm}-${dd}`;
    }

    const patch: Partial<PantryItem> = {
      name: normalizedName,

      quantity: quantity.trim(),

      expiryDate: nextExpiryDate,

      // An image for the former ingredient name should not follow a rename.
      ingredientImage:
        ingredientImageOverrideKey(normalizedName) ===
        ingredientImageOverrideKey(item.name)
          ? imagePreview
          : null,
    };

    const destinationCategory = categoryKey ?? target.categoryKey;

    if (destinationCategory === target.categoryKey) {
      updateItem(target.categoryKey, target.id, patch);
    } else {
      setPantry((previousPantry) => {
        const existingItem = previousPantry[target.categoryKey].find(
          (pantryItem) => pantryItem.id === target.id,
        );

        if (!existingItem) {
          return previousPantry;
        }

        const movedItem: PantryItem = {
          ...existingItem,

          ...patch,
        };

        return {
          ...previousPantry,

          [target.categoryKey]: previousPantry[target.categoryKey].filter(
            (pantryItem) => pantryItem.id !== target.id,
          ),

          [destinationCategory]: [
            movedItem,

            ...(previousPantry[destinationCategory] ?? []).filter(
              (pantryItem) => pantryItem.id !== target.id,
            ),
          ],
        };
      });
    }

    closeIfIdle();
  };

  const busy = imageSaving || imageLoading;

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeIfIdle}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={closeIfIdle}
            accessibilityLabel="Close edit item"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                styles.sheet,
                { maxHeight: Math.round(windowHeight * 0.9) },
              ]}
            >
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={styles.headerText}>
                  <Text style={styles.eyebrow}>PANTRY · ITEM DETAILS</Text>
                  <Text style={styles.heading}>Edit item</Text>
                  <Text style={styles.subheading}>
                    Update what you have on hand.
                  </Text>
                </View>
                <Pressable
                  onPress={closeIfIdle}
                  disabled={imageSaving || galleryPickerOpenRef.current}
                  style={styles.closeButton}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close edit item"
                >
                  <Ionicons name="close" size={20} color={P.ink} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionSymbol}>
                      <Ionicons
                        name="image-outline"
                        size={18}
                        color={P.slate}
                      />
                    </View>
                    <View style={styles.sectionText}>
                      <Text style={styles.sectionTitle}>Ingredient image</Text>
                      <Text style={styles.sectionDescription}>
                        Personalize this ingredient’s picture.
                      </Text>
                    </View>
                    {hasImageOverride ? (
                      <Text style={styles.savedTag}>SAVED</Text>
                    ) : null}
                  </View>
                  <View style={styles.photoRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change ingredient image"
                      disabled={busy}
                      onPress={() => {
                        if (!canEditImage()) return;
                        setImageActionsOpen((old) => !old);
                      }}
                      style={styles.photoFrame}
                    >
                      {imageLoading ? (
                        <ActivityIndicator color={P.slate} />
                      ) : imagePreview?.url ? (
                        <Image
                          source={{ uri: imagePreview.url }}
                          style={styles.photo}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color={P.slate}
                        />
                      )}
                    </Pressable>
                    <View style={styles.photoDetails}>
                      <Pressable
                        onPress={() => {
                          if (!canEditImage()) return;
                          setImageActionsOpen((old) => !old);
                        }}
                        disabled={busy}
                        style={styles.changeImageButton}
                        accessibilityRole="button"
                      >
                        <Text style={styles.changeImageText}>
                          {imageActionsOpen
                            ? "Hide image options"
                            : "Change image"}
                        </Text>
                        <Ionicons
                          name={
                            imageActionsOpen ? "chevron-up" : "chevron-forward"
                          }
                          size={16}
                          color={P.slate}
                        />
                      </Pressable>
                      <Text style={styles.imageCaption}>
                        {hasImageOverride
                          ? "Your saved picture is used for this ingredient."
                          : "Uses an automatic picture or a placeholder."}
                      </Text>
                    </View>
                  </View>
                  {imageActionsOpen && (
                    <View style={styles.imageOptions}>
                      <Text style={styles.helperText}>
                        Image changes save immediately and apply to matching
                        pantry items and future scans.
                      </Text>
                      <Pressable
                        onPress={() => void chooseGalleryImage()}
                        disabled={imageSaving}
                        style={[
                          styles.galleryButton,
                          imageSaving && styles.disabled,
                        ]}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="images-outline"
                          size={19}
                          color={P.white}
                        />
                        <Text style={styles.galleryText}>
                          Choose from gallery
                        </Text>
                      </Pressable>
                      <Text style={styles.fieldLabel}>OR USE AN IMAGE URL</Text>
                      <TextInput
                        value={imageUrlText}
                        onChangeText={setImageUrlText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        placeholder="https://example.com/photo.jpg"
                        placeholderTextColor={P.placeholder}
                        editable={!imageSaving}
                        style={styles.field}
                      />
                      <Pressable
                        disabled={imageSaving || !imageUrlText.trim()}
                        onPress={() => void saveImageUrl()}
                        style={[
                          styles.outlineAction,
                          (imageSaving || !imageUrlText.trim()) &&
                            styles.disabled,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.outlineActionText}>
                          Save image URL
                        </Text>
                      </Pressable>
                      {hasImageOverride && (
                        <Pressable
                          disabled={imageSaving}
                          onPress={() => void resetSavedImage()}
                          style={styles.resetAction}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={16}
                            color={P.muted}
                          />
                          <Text style={styles.resetText}>
                            Reset saved image
                          </Text>
                        </Pressable>
                      )}
                      {imageSaving && <ActivityIndicator color={P.slate} />}
                    </View>
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionSymbol}>
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={P.slate}
                      />
                    </View>
                    <View style={styles.sectionText}>
                      <Text style={styles.sectionTitle}>Item information</Text>
                      <Text style={styles.sectionDescription}>
                        The essentials for your pantry.
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>NAME</Text>
                  <TextInput
                    value={name}
                    maxLength={40}
                    onChangeText={setName}
                    placeholder="e.g., Milk"
                    placeholderTextColor={P.placeholder}
                    style={styles.field}
                  />
                  <Text style={[styles.fieldLabel, styles.nextField]}>
                    QUANTITY
                  </Text>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="e.g., 1 gallon"
                    placeholderTextColor={P.placeholder}
                    style={styles.field}
                  />
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeadingRow}>
                    <View style={styles.sectionSymbol}>
                      <Ionicons
                        name="options-outline"
                        size={18}
                        color={P.slate}
                      />
                    </View>
                    <View style={styles.sectionText}>
                      <Text style={styles.sectionTitle}>
                        Organization & expiry
                      </Text>
                      <Text style={styles.sectionDescription}>
                        Where it belongs and when to use it.
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>CATEGORY</Text>
                  <Pressable
                    onPress={() => setMoveSheetOpen(true)}
                    style={styles.categoryField}
                    accessibilityRole="button"
                    accessibilityLabel="Choose category"
                  >
                    <View style={styles.categoryName}>
                      <Ionicons name="grid-outline" size={18} color={P.slate} />
                      <Text style={styles.categoryText}>
                        {selectedCategory?.label ?? "Choose category"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={P.muted} />
                  </Pressable>
                  <Text style={[styles.fieldLabel, styles.nextField]}>
                    EXPIRES IN (DAYS)
                  </Text>
                  <TextInput
                    value={expiresInDays}
                    onChangeText={setExpiresInDays}
                    keyboardType="number-pad"
                    placeholder="e.g., 5"
                    placeholderTextColor={P.placeholder}
                    style={styles.field}
                  />
                  <Text style={styles.helperText}>
                    Leave blank for no expiration. Enter 0 for today.
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={closeIfIdle}
                    disabled={imageSaving}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, busy && styles.disabled]}
                    onPress={save}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Ionicons name="checkmark" color={P.white} size={19} />
                    <Text style={styles.saveText}>Save changes</Text>
                  </Pressable>
                </View>
                <Text style={styles.footer}>
                  KITCHENBUDDY · KEEP YOUR PANTRY CURRENT
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <BulkMoveSheet
        open={moveSheetOpen}
        onClose={() => setMoveSheetOpen(false)}
        onMoveTo={(destination) => {
          setCategoryKey(destination);
        }}
      />
    </>
  );
}

const P = {
  bg: "#F6F3EE",
  white: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  placeholder: "#A2A19A",
};

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,31,34,0.48)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: P.bg,
    paddingTop: 10,
    overflow: "hidden",
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 9,
    backgroundColor: "#D4CEC5",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 22,
    marginBottom: 18,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: P.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heading: {
    color: P.ink,
    fontSize: 30,
    fontFamily: "serif",
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  subheading: { color: P.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 30, gap: 13 },
  sectionCard: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 21,
    padding: 17,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
    gap: 10,
  },
  sectionSymbol: {
    backgroundColor: P.taupe,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionText: { flex: 1 },
  sectionTitle: {
    color: P.ink,
    fontSize: 17,
    fontFamily: "serif",
    fontWeight: "600",
  },
  sectionDescription: {
    color: P.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  savedTag: {
    color: P.slate,
    backgroundColor: P.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
    borderRadius: 8,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  photoFrame: {
    width: 80,
    height: 80,
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  photoDetails: { flex: 1 },
  changeImageButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
  },
  changeImageText: { color: P.slateDeep, fontWeight: "700", fontSize: 13 },
  imageCaption: { color: P.muted, fontSize: 11, lineHeight: 17 },
  imageOptions: {
    backgroundColor: P.bg,
    borderRadius: 15,
    padding: 12,
    marginTop: 14,
    gap: 9,
  },
  helperText: { color: P.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  galleryButton: {
    minHeight: 44,
    backgroundColor: P.slate,
    borderRadius: 12,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  galleryText: { color: P.white, fontSize: 13, fontWeight: "700" },
  fieldLabel: {
    color: P.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  field: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    paddingVertical: 10,
    paddingHorizontal: 13,
    color: P.ink,
    fontSize: 14,
  },
  nextField: { marginTop: 16 },
  outlineAction: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineActionText: { color: P.slateDeep, fontSize: 13, fontWeight: "700" },
  resetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 9,
  },
  resetText: { color: P.muted, fontSize: 12, fontWeight: "600" },
  categoryField: {
    minHeight: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  categoryText: {
    fontSize: 13,
    color: P.ink,
    fontWeight: "600",
    flexShrink: 1,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 3 },
  cancelButton: {
    flex: 0.9,
    minHeight: 52,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.white,
  },
  cancelText: { color: P.ink, fontSize: 14, fontWeight: "700" },
  saveButton: {
    flex: 1.3,
    minHeight: 52,
    backgroundColor: P.slateDeep,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: P.white, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  footer: {
    textAlign: "center",
    color: P.placeholder,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 8,
  },
});
