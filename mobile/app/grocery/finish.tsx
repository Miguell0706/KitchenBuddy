/**
 * KitchenBuddy Shopping Mode — Phase 2
 * Save as mobile/app/grocery/finish.tsx
 *
 * Only currently checked grocery IDs enter the review. The saved grocery list
 * is the source of truth at confirmation; unchecked/new items are retained.
 * Pantry IDs are stable across retries. Existing pantry and purchase-history
 * entries are checked before adding, to recover from interrupted transfers.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  GROCERY_STORAGE_KEY,
  type GroceryItem,
  isGroceryItem,
} from "@/features/grocery/groceryIngredients";
import { RECIPES_URL } from "@/config/api";
import {
  ingredientImageOverrideKey,
  listIngredientImageOverrides,
  getIngredientImageOverride,
  saveIngredientImageOverride,
  removeIngredientImageOverride,
  type IngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";
import {
  CATEGORIES,
  CATEGORY_DEFAULT_EXPIRY,
} from "@/features/pantry/constants";
import { inferCategoryFromName } from "@/features/pantry/categoryInference";
import type {
  CategoryKey,
  IngredientImage,
  PantryItem,
} from "@/features/pantry/types";
import { loadPantry } from "@/features/pantry/storage";
import {
  startPantryPersistence,
  flushPantryPersistence,
  commitPantryItemsBatch,
} from "@/features/pantry/persistence";
import {
  appendPantryHistory,
  getPantryHistory,
} from "@/features/pantry/history";
import { useSettingsStore } from "@/features/settings/store";

// Reuse the existing backend images route. The Pexels search stays landscape.
const INGREDIENT_IMAGE_URL = RECIPES_URL.replace(
  /\/api\/recipes\/?$/,
  "/api/images/ingredient-image",
);
const AUTO_IMAGE_CACHE_KEY = "@kb_finish_shopping_images_v1";
const IMAGE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NO_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
const IMAGE_REQUEST_TIMEOUT_MS = 10000;
const MAX_IMAGE_REQUESTS = 3;

type ImageCacheEntry = { image: IngredientImage | null; expiresAt: number };
function validImage(value: unknown): value is IngredientImage {
  if (!value || typeof value !== "object") return false;
  const url = (value as { url?: unknown }).url;
  return typeof url === "string" && /^https?:\/\//i.test(url);
}
async function readAutoImageCache(): Promise<Record<string, ImageCacheEntry>> {
  const raw = await AsyncStorage.getItem(AUTO_IMAGE_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const result: Record<string, ImageCacheEntry> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Partial<ImageCacheEntry>;
      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now())
        continue;
      if (entry.image !== null && !validImage(entry.image)) continue;
      result[key] = { image: entry.image ?? null, expiresAt: entry.expiresAt };
    }
    return result;
  } catch {
    // A corrupt thumbnail cache must never block Finish Shopping.
    return {};
  }
}
async function fetchAutoImage(name: string): Promise<IngredientImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    IMAGE_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      `${INGREDIENT_IMAGE_URL}?name=${encodeURIComponent(name)}`,
      { signal: controller.signal },
    );
    if (!response.ok)
      throw new Error(`Ingredient image HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object")
      throw new Error("Invalid image response");
    const result = payload as { ok?: unknown; image?: unknown };
    if (result.ok !== true) throw new Error("Ingredient image request failed");
    if (result.image == null) return null;
    if (!validImage(result.image))
      throw new Error("Invalid ingredient image URL");
    return result.image;
  } finally {
    clearTimeout(timeout);
  }
}

type DialogTone = "information" | "warning" | "success" | "destructive";
type DialogState = {
  title: string;
  message: string;
  tone: DialogTone;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onDismiss?: () => void;
};

type ExpiryChoice = "default" | "none" | "days";
type ReviewItem = {
  source: GroceryItem;
  name: string;
  categoryKey: CategoryKey;
  quantityText: string;
  expiryChoice: ExpiryChoice;
  daysText: string;
};

function pantryId(groceryId: string) {
  return `shopping-${groceryId}`;
}
function localIsoAfter(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initialQuantity(item: GroceryItem): string {
  if (
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  ) {
    const unit = typeof item.unit === "string" ? item.unit.trim() : "";
    return `${item.quantity}${unit ? ` ${unit}` : ""}`;
  }
  return "1";
}
async function readGroceryList(): Promise<GroceryItem[]> {
  const raw = await AsyncStorage.getItem(GROCERY_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error("The saved grocery list could not be read.");
  return parsed.filter(isGroceryItem);
}
function validQuantity(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 60) return false;
  // Allow everyday entries such as 1, 2 bottles, 1/2 lb and 1 bag;
  // don't accept an empty or zero quantity as an accidental purchase.
  const numeric = trimmed.match(/^(\d+(?:\.\d+)?|\d+\/\d+)(?:\s|$)/);
  if (!numeric) return false;
  if (numeric[1].includes("/")) {
    const [a, b] = numeric[1].split("/").map(Number);
    return b > 0 && a > 0;
  }
  return Number(numeric[1]) > 0;
}

export default function ShoppingFinishScreen() {
  const router = useRouter();
  const busyRef = useRef(false);
  const imageActionBusyRef = useRef(false);
  const galleryPickerOpenRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [uncollectedCount, setUncollectedCount] = useState(0);
  const [images, setImages] = useState<Record<string, IngredientImageOverride>>(
    {},
  );
  const [automaticImages, setAutomaticImages] = useState<
    Record<string, IngredientImage | null>
  >({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [imagePickerForId, setImagePickerForId] = useState<string | null>(null);
  const [imageUrlText, setImageUrlText] = useState("");
  const [imageSaving, setImageSaving] = useState(false);
  const [categoryForId, setCategoryForId] = useState<string | null>(null);
  const expiryOverrides = useSettingsStore((state) => state.expiryOverrides);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  function showNotice(
    title: string,
    message: string,
    tone: DialogTone = "information",
  ) {
    Keyboard.dismiss();
    setDialog({ title, message, tone, confirmLabel: "Got it" });
  }

  function dismissDialog() {
    const callback = dialog?.onDismiss;
    setDialog(null);
    callback?.();
  }

  function acceptDialog() {
    const callback = dialog?.onConfirm ?? dialog?.onDismiss;
    setDialog(null);
    callback?.();
  }

  const reload = useCallback(async (isActive: () => boolean) => {
    try {
      setLoading(true);
      // Hydrate the user's category expiry preferences before creating drafts.
      try {
        await useSettingsStore.getState().hydrate();
      } catch (error) {
        // Continue with built-in expiry defaults if preferences cannot load.
        console.warn("Finish Shopping: using default expiry rules", error);
      }
      const list = await readGroceryList();
      let foundImages: Record<string, IngredientImageOverride> = {};
      try {
        foundImages = await listIngredientImageOverrides();
      } catch (error) {
        console.warn("Finish Shopping: images unavailable", error);
      }
      if (!isActive()) return;
      setReview(
        list
          .filter((item) => item.checked)
          .map((item) => ({
            source: item,
            name: item.name,
            categoryKey: inferCategoryFromName(item.name),
            quantityText: initialQuantity(item),
            expiryChoice: "default" as const,
            daysText: "7",
          })),
      );
      setUncollectedCount(list.filter((item) => !item.checked).length);
      setImages(foundImages);

      // Fill thumbnails progressively. A failed image lookup never prevents
      // editing, saving purchases, or transferring items to Pantry.
      const collected = list.filter((item) => item.checked);
      const initial: Record<string, IngredientImage | null> = {};
      const pending: { key: string; name: string }[] = [];
      let cache: Record<string, ImageCacheEntry> = {};
      try {
        cache = await readAutoImageCache();
      } catch (error) {
        console.warn("Finish Shopping: local image cache unavailable", error);
      }
      let pantry: Awaited<ReturnType<typeof loadPantry>> | null = null;
      try {
        pantry = await loadPantry();
      } catch (error) {
        console.warn(
          "Finish Shopping: pantry image fallback unavailable",
          error,
        );
      }
      if (!isActive()) return;
      const pantryImages: Record<string, IngredientImage> = {};
      if (pantry) {
        for (const item of Object.values(pantry).flat() as PantryItem[]) {
          // Replaced gallery overrides may have been deleted from app storage.
          // Only use remote Pantry images as an automatic-image fallback.
          if (!validImage(item.ingredientImage)) continue;
          for (const name of [item.name, item.recipeSearchName]) {
            const key = name ? ingredientImageOverrideKey(name) : "";
            if (key && !pantryImages[key])
              pantryImages[key] = item.ingredientImage;
          }
        }
      }
      const seen = new Set<string>();
      for (const item of collected) {
        const key = ingredientImageOverrideKey(item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (foundImages[key]?.image?.url) continue;
        if (pantryImages[key]) {
          initial[key] = pantryImages[key];
          continue;
        }
        if (cache[key]) {
          initial[key] = cache[key].image;
          continue;
        }
        pending.push({ key, name: item.name });
      }
      setAutomaticImages(initial);
      setImageLoading(
        Object.fromEntries(pending.map((row) => [row.key, true])),
      );
      // The image requests intentionally outlive the initial screen spinner.
      void (async () => {
        let nextIndex = 0;
        const fetched: Record<string, ImageCacheEntry> = {};
        async function worker() {
          while (nextIndex < pending.length && isActive()) {
            const task = pending[nextIndex++];
            try {
              const image = await fetchAutoImage(task.name);
              fetched[task.key] = {
                image,
                expiresAt:
                  Date.now() + (image ? IMAGE_CACHE_TTL_MS : NO_IMAGE_TTL_MS),
              };
              if (isActive())
                setAutomaticImages((prev) => ({ ...prev, [task.key]: image }));
            } catch (error) {
              // Do not cache request errors (including a sleeping Render service).
              console.warn(
                `Finish Shopping: image lookup failed for ${task.name}`,
                error,
              );
            } finally {
              if (isActive())
                setImageLoading((prev) => ({ ...prev, [task.key]: false }));
            }
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(MAX_IMAGE_REQUESTS, pending.length) },
            () => worker(),
          ),
        );
        if (Object.keys(fetched).length) {
          try {
            // Merge with the current cache rather than overwriting older entries.
            const current = await readAutoImageCache();
            await AsyncStorage.setItem(
              AUTO_IMAGE_CACHE_KEY,
              JSON.stringify({ ...current, ...fetched }),
            );
          } catch (error) {
            console.warn(
              "Finish Shopping: could not persist image cache",
              error,
            );
          }
        }
      })();
    } catch (error) {
      console.warn("Finish Shopping: unable to load review", error);
      if (isActive())
        showNotice(
          "Review unavailable",
          "Please go back and try again.",
          "warning",
        );
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void reload(() => active);
      return () => {
        active = false;
      };
    }, [reload]),
  );

  // Image editing is shared by ingredient name: changing one copy updates all
  // matching rows on this screen and the persistent preference used elsewhere.
  const imageTarget = review.find(
    (item) => item.source.id === imagePickerForId,
  );
  const imageTargetKey = imageTarget
    ? ingredientImageOverrideKey(imageTarget.name)
    : "";
  const openImagePicker = (id: string) => {
    if (
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current
    )
      return;
    setImagePickerForId((previous) => (previous === id ? null : id));
    setImageUrlText("");
  };
  const closeImagePicker = () => {
    if (imageActionBusyRef.current || galleryPickerOpenRef.current) return;
    setImagePickerForId(null);
    setImageUrlText("");
  };

  async function saveChosenImage(
    source: "gallery" | "search",
    image: IngredientImage,
    mimeType?: string | null,
  ) {
    if (
      !imageTargetKey ||
      !imageTarget ||
      imageActionBusyRef.current ||
      busyRef.current
    )
      return;
    const name = imageTarget.name.trim();
    imageActionBusyRef.current = true;
    setImageSaving(true);
    try {
      const saved = await saveIngredientImageOverride(name, image, source, {
        mimeType,
      });
      setImages((previous) => ({ ...previous, [saved.key]: saved }));
      setImagePickerForId(null);
      setImageUrlText("");
    } catch (error) {
      console.warn("Finish Shopping: image not saved", error);
      showNotice(
        "Image not saved",
        error instanceof Error ? error.message : "Please choose another image.",
        "warning",
      );
    } finally {
      imageActionBusyRef.current = false;
      setImageSaving(false);
    }
  }

  async function chooseGalleryImage() {
    if (
      !imageTarget ||
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current
    )
      return;
    galleryPickerOpenRef.current = true;
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showNotice(
          "Photo access needed",
          "Allow photo access to choose an ingredient image.",
          "warning",
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
      await saveChosenImage("gallery", { url: asset.uri }, asset.mimeType);
    } catch (error) {
      console.warn("Finish Shopping: gallery picker failed", error);
      showNotice("Couldn't select image", "Please try again.", "warning");
    } finally {
      galleryPickerOpenRef.current = false;
    }
  }

  async function saveImageUrl() {
    const url = imageUrlText.trim();
    if (!/^https?:\/\//i.test(url)) {
      showNotice(
        "Invalid image URL",
        "Paste a direct HTTP(S) image URL.",
        "warning",
      );
      return;
    }
    await saveChosenImage("search", { url });
  }

  async function resetPreferredImage() {
    if (
      !imageTarget ||
      !imageTargetKey ||
      busyRef.current ||
      imageActionBusyRef.current
    )
      return;
    const name = imageTarget.name.trim();
    const key = imageTargetKey;
    imageActionBusyRef.current = true;
    setImageSaving(true);
    try {
      const prior = await getIngredientImageOverride(name);
      if (!prior) {
        setImages((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
        showNotice(
          "No saved override",
          "This ingredient is already using its automatic picture.",
        );
        return;
      }
      await removeIngredientImageOverride(name);
      setImages((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      setImagePickerForId(null);
      setImageUrlText("");

      // If an automatic picture was never needed because of the override,
      // restore it from local cache, then the existing server/DB endpoint.
      // Never use the old override's deleted local file as a fallback.
      if (automaticImages[key]?.url) return;
      setImageLoading((previous) => ({ ...previous, [key]: true }));
      try {
        const cache = await readAutoImageCache();
        if (cache[key]) {
          setAutomaticImages((previous) => ({
            ...previous,
            [key]: cache[key].image,
          }));
        } else {
          const image = await fetchAutoImage(name);
          setAutomaticImages((previous) => ({ ...previous, [key]: image }));
          try {
            const latest = await readAutoImageCache();
            await AsyncStorage.setItem(
              AUTO_IMAGE_CACHE_KEY,
              JSON.stringify({
                ...latest,
                [key]: {
                  image,
                  expiresAt:
                    Date.now() + (image ? IMAGE_CACHE_TTL_MS : NO_IMAGE_TTL_MS),
                },
              }),
            );
          } catch (error) {
            console.warn("Finish Shopping: unable to cache reset image", error);
          }
        }
      } catch (error) {
        console.warn(
          "Finish Shopping: unable to restore automatic image",
          error,
        );
        showNotice(
          "Automatic image unavailable",
          "The preference was reset. The automatic image couldn't load right now; it can be retrieved next time.",
          "warning",
        );
      } finally {
        setImageLoading((previous) => ({ ...previous, [key]: false }));
      }
    } catch (error) {
      console.warn("Finish Shopping: reset image failed", error);
      showNotice(
        "Reset failed",
        error instanceof Error ? error.message : "Please try again.",
        "warning",
      );
    } finally {
      imageActionBusyRef.current = false;
      setImageSaving(false);
    }
  }

  const updateDraft = (id: string, patch: Partial<ReviewItem>) => {
    setReview((prev) =>
      prev.map((item) =>
        item.source.id === id ? { ...item, ...patch } : item,
      ),
    );
  };
  const rules = useMemo(
    () =>
      review.map((row) => {
        const rule =
          expiryOverrides[row.categoryKey] ??
          CATEGORY_DEFAULT_EXPIRY[row.categoryKey];
        return { id: row.source.id, rule };
      }),
    [expiryOverrides, review],
  );
  function resolvedExpiry(row: ReviewItem): string | null {
    if (row.expiryChoice === "none") return null;
    if (row.expiryChoice === "days")
      return localIsoAfter(Number(row.daysText.trim()));
    const rule = rules.find((x) => x.id === row.source.id)?.rule;
    return typeof rule === "number" ? localIsoAfter(rule) : null;
  }
  function ruleLabel(row: ReviewItem): string {
    const rule = rules.find((x) => x.id === row.source.id)?.rule;
    return typeof rule === "number"
      ? `${rule} days (category default)`
      : "No expiry (category default)";
  }
  function validate(rows: ReviewItem[]): string | null {
    for (const row of rows) {
      if (!row.name.trim()) return "An item has no name.";
      if (!validQuantity(row.quantityText))
        return `Enter a valid quantity for ${row.name} (for example, 1 or 2 bottles).`;
      if (row.expiryChoice === "days") {
        const days = row.daysText.trim();
        if (
          !/^\d+$/.test(days) ||
          !Number.isSafeInteger(Number(days)) ||
          Number(days) > 3650
        ) {
          return `Enter 0–3650 whole days for ${row.name}, or select No expiry.`;
        }
      }
    }
    return null;
  }

  async function performTransfer(rows: ReviewItem[]) {
    // Always reread persisted groceries, not a potentially stale screen snapshot.
    const latest = await readGroceryList();
    const checked = new Set(
      latest.filter((item) => item.checked).map((item) => item.id),
    );
    const selected = rows.filter((row) => checked.has(row.source.id));
    if (selected.length !== rows.length) {
      throw new Error(
        "Your grocery list changed. Return to Shopping Mode and reopen this review.",
      );
    }
    if (!selected.length)
      throw new Error("No collected items remain to transfer.");

    // Refresh manual selections at transfer time. They always take priority,
    // including if a user changed an image elsewhere after opening this screen.
    let latestOverrides = images;
    try {
      latestOverrides = await listIngredientImageOverrides();
    } catch (error) {
      console.warn(
        "Finish Shopping: using previously loaded image preferences",
        error,
      );
    }
    const pantryItems: PantryItem[] = selected.map((row) => ({
      id: pantryId(row.source.id),
      name: row.name.trim(),
      recipeSearchName: row.name.trim(),
      quantity: row.quantityText.trim(),
      categoryKey: row.categoryKey,
      expiryDate: resolvedExpiry(row),
      addedAt: Date.now(),
      ingredientImage:
        latestOverrides[ingredientImageOverrideKey(row.name)]?.image ??
        automaticImages[ingredientImageOverrideKey(row.name)] ??
        null,
    }));

    // One authoritative Pantry writer: first hydrate and drain pending edits
    // before checking which deterministic Shopping IDs are already persisted.
    // This preserves retry safety without competing AsyncStorage writes.
    await startPantryPersistence();
    await flushPantryPersistence();
    const existing = await loadPantry();
    const existingIds = new Set(
      (Object.values(existing).flat() as PantryItem[]).map((item) => item.id),
    );
    const missing = pantryItems.filter((item) => !existingIds.has(item.id));
    if (missing.length) {
      // One Zustand update, one durable save and one incremental reminder pass.
      await commitPantryItemsBatch(missing);
    }

    // Verify the pantry write before logging purchases or clearing groceries.
    const persisted = await loadPantry();
    const persistedIds = new Set(
      (Object.values(persisted).flat() as PantryItem[]).map((item) => item.id),
    );
    if (pantryItems.some((item) => !persistedIds.has(item.id))) {
      throw new Error(
        "Pantry save could not be verified. Your grocery list was not cleared.",
      );
    }

    // History entry.id is the PantryItem ID in KitchenBuddy. Sequential writes
    // avoid racing history's AsyncStorage read/modify/write logic.
    const history = await getPantryHistory();
    const recorded = new Set(
      history
        .filter((entry) => entry.action === "purchased")
        .map((entry) => entry.id),
    );
    for (const item of pantryItems) {
      if (recorded.has(item.id)) continue;
      await appendPantryHistory(item, "purchased", "manual");
      recorded.add(item.id);
    }

    // Clear only the purchased, still-checked IDs; preserve uncollected items
    // and any additions made to the grocery list while this screen was open.
    const purchasedIds = new Set(selected.map((row) => row.source.id));
    const fresh = await readGroceryList();
    const remaining = fresh.filter(
      (item) => !(purchasedIds.has(item.id) && item.checked),
    );
    await AsyncStorage.setItem(GROCERY_STORAGE_KEY, JSON.stringify(remaining));
    // commitPantryItemsBatch already requested incremental reminder scheduling
    // through the single writer; do not run a second full reconciliation.
    return { purchased: pantryItems.length, left: remaining.length };
  }

  // Keep review validation and transfer semantics unchanged. The following
  // presentation state replaces native alerts, not the shopping transaction.
  async function completePurchase() {
    if (
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const outcome = await performTransfer(review);
      setDialog({
        title: "Shopping complete!",
        message: `${outcome.purchased} item${outcome.purchased === 1 ? "" : "s"} added to Pantry. ${outcome.left} grocery item${outcome.left === 1 ? "" : "s"} remain on your list.`,
        eyebrow: "ALL DONE",
        tone: "success",
        confirmLabel: "View Pantry",
        onConfirm: () => router.replace("/(tabs)/pantry"),
        onDismiss: () => router.replace("/(tabs)/pantry"),
      });
    } catch (cause) {
      console.warn("Finish Shopping: transfer did not complete", cause);
      showNotice(
        "Could not finish shopping",
        `${cause instanceof Error ? cause.message : "Please try again."}\n\nIf the Pantry save already succeeded, retrying won't add those items twice. Your grocery list stays until the transfer completes.`,
        "warning",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const confirm = () => {
    if (
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current ||
      loading ||
      !review.length
    )
      return;
    const error = validate(review);
    if (error) {
      showNotice("Check your items", error, "warning");
      return;
    }
    Keyboard.dismiss();
    setDialog({
      eyebrow: "READY TO PUT AWAY",
      title: "Add collected items to Pantry?",
      message: `Add ${review.length} collected item${review.length === 1 ? "" : "s"}, record them as purchased, and leave uncollected groceries on your list?`,
      tone: "information",
      cancelLabel: "Keep reviewing",
      confirmLabel: "Confirm purchase",
      onConfirm: () => {
        void completePurchase();
      },
    });
  };

  async function completeWithoutPantry() {
    if (
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const ids = new Set(review.map((row) => row.source.id));
      const fresh = await readGroceryList();
      const next = fresh.filter((item) => !(ids.has(item.id) && item.checked));
      await AsyncStorage.setItem(GROCERY_STORAGE_KEY, JSON.stringify(next));
      router.replace("/(tabs)/grocery-list");
    } catch (error) {
      console.warn("Finish without Pantry failed", error);
      showNotice(
        "Couldn't finish",
        "Nothing was intentionally cleared. Please try again.",
        "warning",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const finishWithoutPantry = () => {
    if (
      busyRef.current ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current ||
      loading ||
      !review.length
    )
      return;
    Keyboard.dismiss();
    setDialog({
      eyebrow: "SKIP PANTRY TRANSFER",
      title: "Finish without Pantry?",
      message:
        "Remove the collected groceries from your list without adding them to Pantry or Analytics? Uncollected items will remain.",
      tone: "destructive",
      cancelLabel: "Keep reviewing",
      confirmLabel: "Finish without adding",
      onConfirm: () => {
        void completeWithoutPantry();
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || imageSaving}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color="#292D2C" />
        </Pressable>
        <Text style={styles.topTitle}>Finish shopping</Text>
        <Ionicons name="basket-outline" size={22} color="#485F6A" />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#485F6A" />
          <Text style={styles.subtle}>Loading your purchases...</Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <Ionicons name="basket-outline" size={24} color="#FFFEFB" />
            </View>
            <Text style={styles.summaryEyebrow}>
              SHOPPING MODE · FINAL STEP
            </Text>
            <Text style={styles.summaryTitle}>Review your shopping.</Text>
            <Text style={styles.subtle}>
              Confirm quantities and expiry before adding purchased groceries to
              Pantry.
            </Text>
            <View style={styles.countRow}>
              <View style={styles.countCard}>
                <Text style={styles.countNumber}>{review.length}</Text>
                <Text style={styles.subtle}>Collected</Text>
              </View>
              <View style={styles.countCard}>
                <Text style={styles.countNumber}>{uncollectedCount}</Text>
                <Text style={styles.subtle}>Not collected</Text>
              </View>
            </View>
          </View>

          {review.length === 0 ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Nothing collected yet</Text>
              <Text style={styles.subtle}>
                Return to Shopping Mode and check the items you bought.
              </Text>
            </View>
          ) : (
            review.map((row) => {
              const imageKey = ingredientImageOverrideKey(row.name);
              const image =
                images[imageKey]?.image ?? automaticImages[imageKey];
              const categoryLabel =
                CATEGORIES.find((c) => c.key === row.categoryKey)?.label ??
                "Pantry";
              return (
                <View key={row.source.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change image for ${row.name}`}
                      onPress={() => openImagePicker(row.source.id)}
                      disabled={busy || imageSaving}
                      style={styles.imageButton}
                    >
                      {image?.url ? (
                        <Image
                          source={{ uri: image.url }}
                          style={styles.thumbnail}
                        />
                      ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                          {imageLoading[imageKey] ? (
                            <ActivityIndicator size="small" color="#586D77" />
                          ) : (
                            <Ionicons
                              name="basket-outline"
                              size={22}
                              color="#586D77"
                            />
                          )}
                        </View>
                      )}
                      <View style={styles.imageEditIcon}>
                        <Ionicons name="pencil" size={10} color="#FFFEFB" />
                      </View>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.name}</Text>
                      <Text style={styles.subtle}>{categoryLabel}</Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || imageSaving}
                        onPress={() => openImagePicker(row.source.id)}
                      >
                        <Text style={styles.changeImageText}>
                          {images[imageKey]
                            ? "Saved picture · Change"
                            : "Change image"}
                        </Text>
                      </Pressable>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#485F6A"
                    />
                  </View>
                  {imagePickerForId === row.source.id && (
                    <View style={styles.imageEditor}>
                      <Text style={styles.imageEditorTitle}>
                        Choose image for {row.name}
                      </Text>
                      <Text style={styles.hint}>
                        Your choice saves immediately for matching ingredients
                        and future scans.
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || imageSaving}
                        style={[
                          styles.imageAction,
                          (busy || imageSaving) && styles.disabled,
                        ]}
                        onPress={() => void chooseGalleryImage()}
                      >
                        <Ionicons
                          name="images-outline"
                          size={19}
                          color="#485F6A"
                        />
                        <Text style={styles.imageActionText}>
                          Choose from gallery
                        </Text>
                      </Pressable>
                      <Text style={styles.label}>
                        Or paste a direct image URL
                      </Text>
                      <TextInput
                        value={imageUrlText}
                        onChangeText={setImageUrlText}
                        editable={!busy && !imageSaving}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        placeholder="https://example.com/image.jpg"
                        placeholderTextColor="#747571"
                        style={styles.input}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || imageSaving || !imageUrlText.trim()}
                        style={[
                          styles.imageAction,
                          (busy || imageSaving || !imageUrlText.trim()) &&
                            styles.disabled,
                        ]}
                        onPress={() => void saveImageUrl()}
                      >
                        <Ionicons
                          name="link-outline"
                          size={19}
                          color="#485F6A"
                        />
                        <Text style={styles.imageActionText}>
                          Save image URL
                        </Text>
                      </Pressable>
                      {images[imageKey] && (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy || imageSaving}
                          style={[
                            styles.imageAction,
                            (busy || imageSaving) && styles.disabled,
                          ]}
                          onPress={() => void resetPreferredImage()}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={19}
                            color="#485F6A"
                          />
                          <Text style={styles.imageActionText}>
                            Reset to automatic image
                          </Text>
                        </Pressable>
                      )}
                      {imageSaving ? (
                        <View style={styles.imageBusy}>
                          <ActivityIndicator size="small" color="#485F6A" />
                          <Text style={styles.hint}>Saving image...</Text>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          onPress={closeImagePicker}
                          style={styles.imageCancel}
                        >
                          <Text style={styles.subtle}>Close image options</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    value={row.quantityText}
                    editable={!busy}
                    onChangeText={(quantityText) =>
                      updateDraft(row.source.id, { quantityText })
                    }
                    placeholder="e.g., 1 or 2 bottles"
                    placeholderTextColor="#747571"
                    style={styles.input}
                  />
                  <Text style={styles.label}>Pantry category</Text>
                  <Pressable
                    style={styles.categoryButton}
                    disabled={busy}
                    onPress={() =>
                      setCategoryForId(
                        categoryForId === row.source.id ? null : row.source.id,
                      )
                    }
                  >
                    <Text style={styles.categoryText}>{categoryLabel}</Text>
                    <Ionicons
                      name={
                        categoryForId === row.source.id
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={17}
                      color="#586D77"
                    />
                  </Pressable>
                  {categoryForId === row.source.id && (
                    <View style={styles.categoryChoices}>
                      {CATEGORIES.map((category) => (
                        <Pressable
                          key={category.key}
                          disabled={busy}
                          onPress={() => {
                            updateDraft(row.source.id, {
                              categoryKey: category.key,
                            });
                            setCategoryForId(null);
                          }}
                          style={[
                            styles.categoryChoice,
                            row.categoryKey === category.key &&
                              styles.selectedChoice,
                          ]}
                        >
                          <Text style={styles.categoryText}>
                            {category.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Text style={styles.label}>Expiration</Text>
                  <View style={styles.expiryRow}>
                    {(["default", "days", "none"] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        disabled={busy}
                        onPress={() =>
                          updateDraft(row.source.id, { expiryChoice: mode })
                        }
                        style={[
                          styles.expiryChip,
                          row.expiryChoice === mode && styles.expiryActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.expiryText,
                            row.expiryChoice === mode &&
                              styles.expiryActiveText,
                          ]}
                        >
                          {mode === "default"
                            ? "Auto"
                            : mode === "days"
                              ? "Custom days"
                              : "No expiry"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {row.expiryChoice === "default" ? (
                    <Text style={styles.hint}>{ruleLabel(row)}</Text>
                  ) : row.expiryChoice === "days" ? (
                    <TextInput
                      value={row.daysText}
                      onChangeText={(daysText) =>
                        updateDraft(row.source.id, {
                          daysText: daysText.replace(/[^\d]/g, ""),
                        })
                      }
                      keyboardType="number-pad"
                      editable={!busy}
                      placeholder="Days until expiry"
                      style={styles.input}
                    />
                  ) : (
                    <Text style={styles.hint}>
                      This item will have no expiration date.
                    </Text>
                  )}
                  <Text style={styles.hint}>
                    Pantry expiry:{" "}
                    {row.expiryChoice === "days" &&
                    !/^\d+$/.test(row.daysText.trim())
                      ? "Enter days"
                      : (resolvedExpiry(row) ?? "None")}
                  </Text>
                </View>
              );
            })
          )}
          {review.length > 0 && (
            <View style={styles.actions}>
              <Pressable
                onPress={() => void confirm()}
                disabled={busy || imageSaving}
                style={[
                  styles.primary,
                  (busy || imageSaving) && styles.disabled,
                ]}
              >
                <Ionicons name="cube-outline" color="#FFFEFB" size={19} />
                <Text style={styles.primaryText}>
                  Add {review.length} to Pantry
                </Text>
              </Pressable>
              <Pressable
                disabled={busy || imageSaving}
                onPress={finishWithoutPantry}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>
                  Finish without adding to Pantry
                </Text>
              </Pressable>
            </View>
          )}
          <Pressable
            disabled={busy || imageSaving}
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={styles.subtle}>Continue Shopping</Text>
          </Pressable>
          <Text style={styles.footerNote}>
            Uncollected groceries stay on your list. Purchases are recorded once
            for Pantry Analytics.
          </Text>
        </ScrollView>
      )}
      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color="#485F6A" />
          <Text style={styles.busyTitle}>Saving your purchases...</Text>
          <Text style={styles.subtle}>
            Updating Pantry, history, and your grocery list.
          </Text>
        </View>
      )}
      <Modal
        visible={dialog !== null && !busy}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={dismissDialog}
      >
        <View style={styles.dialogBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            style={StyleSheet.absoluteFill}
            onPress={dismissDialog}
          />
          {dialog && (
            <View style={styles.dialogCard} accessibilityViewIsModal>
              <View style={styles.dialogHandle} />
              <View style={styles.dialogHeadingRow}>
                <View
                  style={[
                    styles.dialogIcon,
                    dialog.tone === "destructive" && styles.dialogIconDanger,
                    dialog.tone === "success" && styles.dialogIconSuccess,
                    dialog.tone === "warning" && styles.dialogIconWarning,
                  ]}
                >
                  <Ionicons
                    name={
                      dialog.tone === "success"
                        ? "checkmark-circle-outline"
                        : dialog.tone === "destructive"
                          ? "trash-outline"
                          : dialog.tone === "warning"
                            ? "alert-circle-outline"
                            : "basket-outline"
                    }
                    size={24}
                    color={
                      dialog.tone === "destructive"
                        ? "#965D57"
                        : dialog.tone === "warning"
                          ? "#926C3D"
                          : "#485F6A"
                    }
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={dismissDialog}
                  style={styles.dialogClose}
                  hitSlop={10}
                >
                  <Ionicons name="close" color="#747571" size={20} />
                </Pressable>
              </View>
              <Text style={styles.dialogEyebrow}>
                {dialog.eyebrow ??
                  (dialog.tone === "warning"
                    ? "PLEASE REVIEW"
                    : dialog.tone === "success"
                      ? "PURCHASE RECORDED"
                      : "KITCHENBUDDY")}
              </Text>
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              <ScrollView
                style={styles.dialogMessageScroll}
                contentContainerStyle={styles.dialogMessageContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.dialogMessage}>{dialog.message}</Text>
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                onPress={acceptDialog}
                style={({ pressed }) => [
                  styles.dialogPrimary,
                  dialog.tone === "destructive" && styles.dialogPrimaryDanger,
                  pressed && styles.dialogPressed,
                ]}
              >
                <Text style={styles.dialogPrimaryText}>
                  {dialog.confirmLabel ?? "Got it"}
                </Text>
                <Ionicons
                  name={
                    dialog.tone === "success"
                      ? "arrow-forward"
                      : dialog.tone === "destructive"
                        ? "trash-outline"
                        : "checkmark-outline"
                  }
                  color="#FFFEFB"
                  size={17}
                />
              </Pressable>
              {dialog.cancelLabel ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={dismissDialog}
                  style={styles.dialogSecondary}
                >
                  <Text style={styles.dialogSecondaryText}>
                    {dialog.cancelLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F3EE" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFFEFB",
    gap: 12,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F0F3EF",
  },
  topTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: "serif",
    fontWeight: "700",
    color: "#292D2C",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  content: { padding: 16, paddingBottom: 55 },
  summary: {
    borderRadius: 19,
    backgroundColor: "#FFFEFB",
    padding: 19,
    marginBottom: 15,
    gap: 7,
  },
  summaryTitle: {
    fontSize: 29,
    lineHeight: 36,
    fontFamily: "serif",
    fontWeight: "700",
    color: "#292D2C",
  },
  subtle: { color: "#747571", fontSize: 13, lineHeight: 19 },
  countRow: { flexDirection: "row", gap: 10, marginTop: 9 },
  countCard: {
    flex: 1,
    borderRadius: 13,
    padding: 13,
    backgroundColor: "#F1ECE5",
  },
  countNumber: {
    fontSize: 27,
    fontFamily: "serif",
    fontWeight: "700",
    color: "#485F6A",
  },
  itemCard: {
    borderRadius: 18,
    backgroundColor: "#FFFEFB",
    padding: 15,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  thumbnail: { width: 48, height: 48, borderRadius: 11 },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E2DA",
  },
  imageButton: { width: 48, height: 48, position: "relative" },
  imageEditIcon: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    backgroundColor: "#485F6A",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFEFB",
  },
  changeImageText: {
    color: "#485F6A",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  imageEditor: {
    backgroundColor: "#F2EDE6",
    borderRadius: 13,
    padding: 12,
    gap: 8,
    marginBottom: 9,
  },
  imageEditorTitle: { fontSize: 14, fontWeight: "700", color: "#292D2C" },
  imageAction: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    backgroundColor: "#FFFEFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E9E5DE",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  imageActionText: { fontSize: 13, fontWeight: "700", color: "#485F6A" },
  imageBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 6,
  },
  imageCancel: { paddingVertical: 6, alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#292D2C" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#586D77",
    marginBottom: 5,
    marginTop: 9,
  },
  input: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E9E5DE",
    backgroundColor: "#FFFEFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#292D2C",
  },
  categoryButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9E5DE",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryText: { fontSize: 13, color: "#292D2C" },
  categoryChoices: { paddingTop: 6, gap: 5 },
  categoryChoice: { borderRadius: 8, padding: 10, backgroundColor: "#F2EDE6" },
  selectedChoice: { backgroundColor: "#E8E2DA" },
  expiryRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  expiryChip: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 9,
    backgroundColor: "#F2EDE6",
    alignItems: "center",
  },
  expiryActive: { backgroundColor: "#485F6A" },
  expiryText: { fontSize: 12, color: "#586D77", fontWeight: "700" },
  expiryActiveText: { color: "#FFFEFB" },
  hint: { color: "#747571", fontSize: 12, marginTop: 8 },
  actions: { gap: 10, marginTop: 7 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#485F6A",
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryText: { color: "#FFFEFB", fontSize: 15, fontWeight: "800" },
  secondary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9E5DE",
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryText: { color: "#586D77", fontWeight: "700", fontSize: 13 },
  backLink: { alignItems: "center", paddingVertical: 16 },
  footerNote: {
    textAlign: "center",
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#747571",
  },
  disabled: { opacity: 0.5 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(246,243,238,0.96)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  busyTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "serif",
    color: "#292D2C",
  },
  summaryIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#586D77",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#586D77",
    marginTop: 2,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(28,34,34,0.48)",
    justifyContent: "flex-end",
  },
  dialogCard: {
    backgroundColor: "#FFFEFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 23,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 38 : 25,
    borderWidth: 1,
    borderColor: "#E9E5DE",
    shadowColor: "#292D2C",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.11,
    shadowRadius: 20,
    elevation: 20,
  },
  dialogHandle: {
    width: 39,
    height: 4,
    borderRadius: 6,
    backgroundColor: "#D9D5CF",
    alignSelf: "center",
    marginBottom: 23,
  },
  dialogHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  dialogIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#E8E2DA",
    alignItems: "center",
    justifyContent: "center",
  },
  dialogIconDanger: { backgroundColor: "#F7EDE9" },
  dialogIconSuccess: { backgroundColor: "#E6EDEB" },
  dialogIconWarning: { backgroundColor: "#F7F0E5" },
  dialogClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F2EDE6",
    alignItems: "center",
    justifyContent: "center",
  },
  dialogEyebrow: {
    color: "#586D77",
    fontSize: 10,
    letterSpacing: 1.65,
    fontWeight: "800",
    marginBottom: 8,
  },
  dialogTitle: {
    fontFamily: "serif",
    fontWeight: "700",
    color: "#292D2C",
    fontSize: 27,
    lineHeight: 34,
    marginBottom: 10,
  },
  dialogMessageScroll: { flexGrow: 0, maxHeight: 220, marginBottom: 25 },
  dialogMessageContent: { flexGrow: 0 },
  dialogMessage: { fontSize: 13, color: "#747571", lineHeight: 21 },
  dialogPrimary: {
    minHeight: 51,
    borderRadius: 14,
    backgroundColor: "#485F6A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  dialogPrimaryDanger: { backgroundColor: "#965D57" },
  dialogPrimaryText: { color: "#FFFEFB", fontSize: 14, fontWeight: "800" },
  dialogSecondary: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    borderRadius: 13,
    backgroundColor: "#F2EDE6",
  },
  dialogSecondaryText: { color: "#485F6A", fontWeight: "700", fontSize: 13 },
  dialogPressed: { opacity: 0.78 },
});
