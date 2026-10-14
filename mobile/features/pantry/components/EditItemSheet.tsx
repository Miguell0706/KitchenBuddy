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

import { Colors, Spacing } from "@/constants/theme";

import {
  ButtonStyles,
  CardStyles,
  Layout,
  TextStyles,
} from "@/constants/styles";

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

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeIfIdle}
      >
        <Pressable
          onPress={closeIfIdle}
          style={{
            flex: 1,

            backgroundColor: "rgba(0,0,0,0.35)",

            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View
                style={[
                  CardStyles.subtle,

                  {
                    borderTopLeftRadius: 22,

                    borderTopRightRadius: 22,

                    padding: Spacing.lg,

                    paddingBottom: Spacing.lg + Spacing.sm,

                    backgroundColor: Colors.card,
                    maxHeight: Math.round(windowHeight * 0.86),
                  },
                ]}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={[
                      Layout.rowBetween,

                      {
                        marginBottom: Spacing.md,
                      },
                    ]}
                  >
                    <Text style={TextStyles.sectionTitle}>Edit item</Text>

                    <TouchableOpacity
                      onPress={closeIfIdle}
                      activeOpacity={0.8}
                      hitSlop={{
                        top: 10,

                        bottom: 10,

                        left: 10,

                        right: 10,
                      }}
                      style={{
                        padding: Spacing.sm,

                        borderRadius: 999,

                        backgroundColor: "rgba(0,0,0,0.06)",
                      }}
                    >
                      <Ionicons name="close" size={18} color={Colors.text} />
                    </TouchableOpacity>
                  </View>

                  <Text style={TextStyles.small}>Ingredient image</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginTop: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change ingredient image"
                      disabled={imageLoading || imageSaving}
                      onPress={() => {
                        if (!canEditImage()) return;
                        setImageActionsOpen((old) => !old);
                      }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        backgroundColor: "rgba(0,0,0,0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {imageLoading ? (
                        <ActivityIndicator color={Colors.primary} />
                      ) : imagePreview?.url ? (
                        <Image
                          source={{ uri: imagePreview.url }}
                          style={{ width: 64, height: 64 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons
                          name="image-outline"
                          size={26}
                          color={Colors.textLight}
                        />
                      )}
                    </Pressable>
                    <View style={{ flex: 1, gap: 5 }}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={imageSaving || imageLoading}
                        onPress={() => {
                          if (!canEditImage()) return;
                          setImageActionsOpen((old) => !old);
                        }}
                      >
                        <Text
                          style={[
                            TextStyles.body,
                            { color: Colors.primary, fontWeight: "700" },
                          ]}
                        >
                          Change image ✎
                        </Text>
                      </TouchableOpacity>
                      <Text style={TextStyles.small}>
                        {hasImageOverride
                          ? "Your saved picture is used for this ingredient."
                          : "Uses automatic picture or a placeholder."}
                      </Text>
                    </View>
                  </View>
                  {imageActionsOpen && (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: "rgba(0,0,0,0.04)",
                        marginBottom: Spacing.md,
                        gap: 10,
                      }}
                    >
                      <Text style={TextStyles.small}>
                        Image changes save immediately and apply to matching
                        pantry items and future scans.
                      </Text>
                      <TouchableOpacity
                        disabled={imageSaving}
                        onPress={() => {
                          void chooseGalleryImage();
                        }}
                        style={[
                          ButtonStyles.primary,
                          imageSaving && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={ButtonStyles.primaryText}>
                          Choose from gallery
                        </Text>
                      </TouchableOpacity>
                      <Text style={TextStyles.small}>
                        Or paste a direct image URL
                      </Text>
                      <TextInput
                        value={imageUrlText}
                        onChangeText={setImageUrlText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        placeholder="https://example.com/photo.jpg"
                        placeholderTextColor={Colors.textLight}
                        editable={!imageSaving}
                        style={{
                          borderWidth: 1,
                          borderColor: "rgba(120,120,120,0.18)",
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                          color: Colors.text,
                        }}
                      />
                      <TouchableOpacity
                        disabled={imageSaving || !imageUrlText.trim()}
                        onPress={() => {
                          void saveImageUrl();
                        }}
                        style={{
                          paddingVertical: 9,
                          alignItems: "center",
                          opacity:
                            !imageUrlText.trim() || imageSaving ? 0.5 : 1,
                        }}
                      >
                        <Text
                          style={[
                            TextStyles.body,
                            { fontWeight: "700", color: Colors.primary },
                          ]}
                        >
                          Save image URL
                        </Text>
                      </TouchableOpacity>
                      {hasImageOverride && (
                        <TouchableOpacity
                          disabled={imageSaving}
                          onPress={() => {
                            void resetSavedImage();
                          }}
                          style={{ paddingVertical: 8, alignItems: "center" }}
                        >
                          <Text
                            style={[TextStyles.body, { fontWeight: "700" }]}
                          >
                            Reset saved image
                          </Text>
                        </TouchableOpacity>
                      )}
                      {imageSaving && (
                        <ActivityIndicator color={Colors.primary} />
                      )}
                    </View>
                  )}

                  <Text style={TextStyles.small}>Name</Text>

                  <TextInput
                    value={name}
                    maxLength={40}
                    onChangeText={setName}
                    placeholder="e.g., Milk"
                    placeholderTextColor={Colors.textLight}
                    style={{
                      marginTop: 6,

                      borderWidth: 1,

                      borderColor: "rgba(120,120,120,0.18)",

                      borderRadius: 14,

                      paddingHorizontal: 12,

                      paddingVertical: 10,

                      color: Colors.text,
                    }}
                  />

                  <View
                    style={{
                      height: Spacing.md,
                    }}
                  />

                  <Text style={TextStyles.small}>Quantity</Text>

                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="e.g., 1 gallon"
                    placeholderTextColor={Colors.textLight}
                    style={{
                      marginTop: 6,

                      borderWidth: 1,

                      borderColor: "rgba(120,120,120,0.18)",

                      borderRadius: 14,

                      paddingHorizontal: 12,

                      paddingVertical: 10,

                      color: Colors.text,
                    }}
                  />

                  <View
                    style={{
                      height: Spacing.md,
                    }}
                  />

                  <Text style={TextStyles.small}>Category</Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setMoveSheetOpen(true)}
                    style={{
                      marginTop: 6,

                      borderWidth: 1,

                      borderColor: "rgba(120,120,120,0.18)",

                      borderRadius: 14,

                      paddingHorizontal: 12,

                      paddingVertical: 12,

                      flexDirection: "row",

                      alignItems: "center",

                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                      }}
                    >
                      {selectedCategory?.label ?? "Choose category"}
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={Colors.textLight}
                    />
                  </TouchableOpacity>

                  <View
                    style={{
                      height: Spacing.md,
                    }}
                  />

                  <Text style={TextStyles.small}>Expires in (days)</Text>

                  <TextInput
                    value={expiresInDays}
                    onChangeText={setExpiresInDays}
                    keyboardType="number-pad"
                    placeholder="e.g., 5"
                    placeholderTextColor={Colors.textLight}
                    style={{
                      marginTop: 6,

                      borderWidth: 1,

                      borderColor: "rgba(120,120,120,0.18)",

                      borderRadius: 14,

                      paddingHorizontal: 12,

                      paddingVertical: 10,

                      color: Colors.text,
                    }}
                  />

                  <View
                    style={{
                      height: Spacing.lg,
                    }}
                  />

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={ButtonStyles.primary}
                    onPress={save}
                    disabled={imageSaving || imageLoading}
                  >
                    <Text style={ButtonStyles.primaryText}>Save</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
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
