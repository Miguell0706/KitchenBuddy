import React, { useMemo, useState, useEffect } from "react";

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Modal } from "react-native";

import * as ImagePicker from "expo-image-picker";

import { router, useLocalSearchParams } from "expo-router";

import { CANONICALIZE_URL } from "@/config/api";

import { getDeviceId } from "@/src/utils/deviceId";

import { fetchWithTimeout } from "@/src/utils/fetchWithTimeout";

import { inferCategoryFromName } from "@/features/pantry/categoryInference";

import type {
  CategoryKey,
  PantryItem,
  IngredientImage,
} from "@/features/pantry/types";

import {
  ingredientImageOverrideKey,
  listIngredientImageOverrides,
  saveIngredientImageOverride,
  removeIngredientImageOverride,
  type IngredientImageOverride,
} from "@/features/pantry/ingredientImageOverrides";

import { commitPantryItemsBatch } from "@/features/pantry/persistence";

import { appendPantryHistory } from "@/features/pantry/history";

import {
  readFixStore,
  normalizeFixKey,
  makeFixFromFields,
  upsertFix,
  type ItemFix,
} from "@/features/scan/fixStore";

import {
  CATEGORIES,
  CATEGORY_DEFAULT_EXPIRY,
} from "@/features/pantry/constants";

import { useSettingsStore } from "@/features/settings/store";

import {
  parseReceiptNamesOnlyWithReport,
  type ParsedItem,
} from "@/features/scan/parsing";

type DraftScanItem = ParsedItem & {
  categoryKey?: CategoryKey;

  expiryDate?: string | null;

  recipeSearchName?: string;

  storageType?: "pantry" | "refrigerated" | "frozen" | "unknown";

  expiryConfidence?: number;

  ingredientImage?: IngredientImage | null;
};

type Baseline = {
  name: string;

  categoryKey: CategoryKey;

  expiryDate: string | null;
};

function diffDaysFromNow(iso: string) {
  const target = new Date(`${iso}T00:00:00`); // local midnight

  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const ms = target.getTime() - today.getTime();

  return Math.max(0, Math.ceil(ms / 86400000));
}

function addDaysISO(days: number) {
  const d = new Date();

  d.setHours(0, 0, 0, 0);

  d.setDate(d.getDate() + days);

  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function applyFixExpiry(
  fix: { expiryMode: "none" | "days"; expiryDays: number | null },

  fallback: string | null | undefined,
) {
  if (fix.expiryMode === "none") return null;

  if (fix.expiryMode === "days" && fix.expiryDays != null) {
    return addDaysISO(fix.expiryDays);
  }

  return fallback ?? null;
}

function bestResultByCanon(merged: any[]) {
  const best = new Map<string, any>();

  const canonId = (m: any) => {
    const r = m?.result ?? {};

    const name = (r.canonicalName ?? "").trim();

    if (r.status === "item" && name) return `name:${name.toLowerCase()}`;

    return `key:${(r.key ?? m?.key ?? "").trim()}`;
  };

  const score = (m: any) => {
    const r = m.result ?? {};

    const conf = r.confidence ?? 0;

    const isItem = r.status === "item" ? 1 : 0;

    const isFood = r.kind === "food" ? 1 : 0;

    const hasCanon = r.canonicalName?.trim() ? 1 : 0;

    const digitPenalty = ((m.text ?? "").match(/\d/g)?.length ?? 0) * 0.02;

    const lengthPenalty = Math.min((m.text ?? "").length, 40) * 0.002;

    return (
      conf +
      isItem * 0.3 +
      isFood * 0.2 +
      hasCanon * 0.1 -
      digitPenalty -
      lengthPenalty
    );
  };

  for (const m of merged ?? []) {
    const id = canonId(m);

    if (!id) continue;

    const prev = best.get(id);

    if (!prev || score(m) > score(prev)) {
      best.set(id, m.result);
    }
  }

  return best;
}

function isoDateDaysFromNow(days: number) {
  const d = new Date();

  d.setHours(0, 0, 0, 0); // normalize to local midnight

  d.setDate(d.getDate() + days);

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;

  const today = new Date();

  const target = new Date(dateStr + "T00:00:00");

  const ms = target.getTime() - today.setHours(0, 0, 0, 0);

  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function toPantryItems(drafts: DraftScanItem[]): PantryItem[] {
  return drafts.map((d) => ({
    id: d.id,

    name: (d.name ?? d.sourceLine ?? "").trim(),

    recipeSearchName:
      d.recipeSearchName ?? (d.name ?? d.sourceLine ?? "").trim(),

    quantity: "1",

    expiryDate: d.expiryDate ?? null,

    categoryKey: d.categoryKey ?? "pantry",

    addedAt: Date.now(),

    ingredientImage: d.ingredientImage ?? null,
  }));
}

// KitchenBuddy editorial scan review. Receipt processing, overrides, fixes,
// and pantry persistence are intentionally carried over from the source screen.
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
  taupe: "#E8E2DA",
  soft: "#F2F0EC",
};

export default function ScanEditScreen() {
  const params = useLocalSearchParams<{ rawText?: string }>();

  const [aiLoading, setAiLoading] = useState(false);

  // 👇 read overrides ONCE, with a hook (allowed here)

  const expiryOverrides = useSettingsStore((s) => s.expiryOverrides);

  const defaultExpiryDateForCategory = React.useCallback(
    (categoryKey: CategoryKey): string | null => {
      const rule =
        expiryOverrides[categoryKey] ?? CATEGORY_DEFAULT_EXPIRY[categoryKey];

      if (rule === "none" || rule == null) return null;

      return isoDateDaysFromNow(rule as number);
    },

    [expiryOverrides],
  );

  const rawText = typeof params.rawText === "string" ? params.rawText : "";

  const { items: parsedItems, report } = useMemo(
    () => parseReceiptNamesOnlyWithReport(rawText, false),

    [rawText],
  );

  const payloadItems = parsedItems.map((i) => ({
    id: i.id,

    text: i.name?.trim() || i.sourceLine?.trim() || "",
  }));

  const [items, setItems] = useState<DraftScanItem[]>(parsedItems);

  const [showExcluded, setShowExcluded] = useState(false);

  const [expiryPickerForId, setExpiryPickerForId] = useState<string | null>(
    null,
  );

  const [categoryPickerForId, setCategoryPickerForId] = useState<string | null>(
    null,
  );

  const [customDaysText, setCustomDaysText] = useState("");

  // Manual images are saved by ingredient name, not solely by this scan row.

  const imageOverridesRef = React.useRef<
    Record<string, IngredientImageOverride>
  >({});

  const automaticImagesRef = React.useRef<
    Map<string, { nameKey: string; image: IngredientImage | null }>
  >(new Map());

  const imageActionBusyRef = React.useRef(false);

  const galleryPickerOpenRef = React.useRef(false);

  const [imagePickerForId, setImagePickerForId] = useState<string | null>(null);

  const [imageUrlText, setImageUrlText] = useState("");

  const [imageSaving, setImageSaving] = useState(false);

  const [pantrySaving, setPantrySaving] = useState(false);
  const pantryCommitBusyRef = React.useRef(false);

  const categoryLabel = React.useCallback((key?: CategoryKey) => {
    return (
      CATEGORIES.find((c) => c.key === (key ?? "pantry"))?.label ??
      "Pantry (Dry Goods)"
    );
  }, []);

  const canonDoneRef = React.useRef(false);

  const fixesRef = React.useRef<Record<string, ItemFix>>({});

  const baselineRef = React.useRef<Map<string, Baseline>>(new Map());

  const baselineReadyRef = React.useRef(false);

  useEffect(() => {
    if (!canonDoneRef.current) return; // ✅ wait for canonicalize

    if (aiLoading) return;

    if (baselineReadyRef.current) return;

    if (!items || items.length === 0) return;

    const m = new Map<string, Baseline>();

    for (const it of items) {
      m.set(it.id, {
        name: (it.name ?? "").trim(),

        categoryKey: (it.categoryKey ?? "pantry") as CategoryKey,

        expiryDate: it.expiryDate ?? null,
      });
    }

    baselineRef.current = m;

    baselineReadyRef.current = true;
  }, [aiLoading, items]);

  useEffect(() => {
    if (!report) return;

    if (report.quality !== "bad") return;

    Alert.alert(
      "Bad scan",

      report.message ??
        "This scan is hard to read. Try retaking the photo or cropping tighter.",
    );
  }, [report?.quality]); // keep as-is

  useEffect(() => {
    let cancelled = false;

    canonDoneRef.current = false;

    baselineReadyRef.current = false;

    baselineRef.current = new Map();

    automaticImagesRef.current = new Map();

    fixesRef.current = {};

    imageOverridesRef.current = {};

    async function runCanonicalize() {
      setAiLoading(true);

      try {
        // Load saved corrections BEFORE building review rows. The old separate

        // effects raced, so fixes were sometimes missing on the first render.

        try {
          const store = await readFixStore();

          if (cancelled) return;

          fixesRef.current = store.byKey;

          console.log("🧠 loaded fixes", Object.keys(store.byKey).length);
        } catch (fixError) {
          if (cancelled) return;

          console.warn("Unable to load saved scan corrections:", fixError);

          // Continue with the OCR rows; do not erase or rewrite the fix store.
        }

        try {
          const savedImages = await listIngredientImageOverrides();

          if (cancelled) return;

          imageOverridesRef.current = savedImages;
        } catch (imageError) {
          if (cancelled) return;

          console.warn(
            "Unable to load preferred ingredient images:",

            imageError,
          );

          // Continue without overriding or deleting the persisted image store.
        }

        const initialRows: DraftScanItem[] = parsedItems.map((it) => {
          const baseName = (it.name ?? it.sourceLine ?? "").trim();

          const raw = (it.sourceLine ?? baseName).trim();

          const key = normalizeFixKey(raw);

          const fix = key ? fixesRef.current[key] : undefined;

          const name = fix?.canonicalName?.trim() || baseName;

          const category = fix?.categoryKey ?? inferCategoryFromName(name);

          const defaultExpiry = defaultExpiryDateForCategory(category);

          const preferred =
            imageOverridesRef.current[ingredientImageOverrideKey(name)];

          return {
            ...it,

            name,

            categoryKey: category,

            expiryDate: fix
              ? applyFixExpiry(fix, defaultExpiry)
              : defaultExpiry,

            ingredientImage: preferred?.image ?? null,

            selected: fix ? true : it.selected,
          };
        });

        if (cancelled) return;

        setItems(initialRows);

        if (parsedItems.length === 0) return;

        console.log("🚀 running canonicalize-items", payloadItems);

        // Device ID failures belong inside this try/catch/finally as well.

        const deviceId = await getDeviceId();

        if (cancelled) return;

        console.log("🌐 CANONICALIZE_URL", CANONICALIZE_URL);

        console.log("📦 sending items", payloadItems.length);

        const resp = await fetchWithTimeout(
          CANONICALIZE_URL,

          {
            method: "POST",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({
              deviceId,

              items: payloadItems,
            }),
          },

          60_000,
        );

        if (cancelled) return;

        if (!resp.ok) {
          const errorBody = await resp.text().catch(() => "");

          if (cancelled) return;

          console.warn("❌ Canonicalization HTTP error:", {
            status: resp.status,

            statusText: resp.statusText,

            responseBody: errorBody.slice(0, 2000),

            requestUrl: CANONICALIZE_URL,

            itemCount: payloadItems.length,
          });

          const requestError = new Error(`HTTP ${resp.status}`);

          // Mark as already reported so the catch displays only one alert.

          (
            requestError as Error & { alreadyReported?: boolean }
          ).alreadyReported = true;

          Alert.alert(
            "AI unavailable",

            "Couldn't improve item names this time. You can still review and edit your scanned items.",
          );

          throw requestError;
        }

        const data = await resp.json();

        if (cancelled) return;

        console.log(
          "✅ canonicalize-items response",

          JSON.stringify(data, null, 2),
        );

        const merged = data.merged ?? [];

        const bestByCanon = bestResultByCanon(merged);

        const canonId = (m: any) => {
          const r = m?.result ?? {};

          const name = (r.canonicalName ?? "").trim();

          if (r.status === "item" && name) return `name:${name.toLowerCase()}`;

          return `key:${(r.key ?? m?.key ?? "").trim()}`;
        };

        const byId = new Map<string, any>(merged.map((m: any) => [m.id, m]));

        setItems((prev) => {
          // PASS 1: apply canonical results to each row

          const mapped = prev.map((it) => {
            const raw = (it.sourceLine ?? it.name ?? "").trim();

            const key = normalizeFixKey(raw);

            const fix = key ? fixesRef.current[key] : undefined;

            const mergedItem = byId.get(it.id);

            const automaticImage: IngredientImage | null =
              mergedItem?.ingredientImage ?? null;

            if (fix) {
              const fixedName = fix.canonicalName?.trim() || it.name || "";

              automaticImagesRef.current.set(it.id, {
                nameKey: ingredientImageOverrideKey(fixedName),

                image: automaticImage,
              });

              const preferred =
                imageOverridesRef.current[
                  ingredientImageOverrideKey(fixedName)
                ];

              return {
                ...it,

                name: fixedName,

                categoryKey: fix.categoryKey ?? it.categoryKey,

                expiryDate: applyFixExpiry(fix, it.expiryDate),

                ingredientImage:
                  preferred?.image ??
                  automaticImage ??
                  it.ingredientImage ??
                  null,

                selected: true,
              };
            }

            if (!mergedItem) return it;

            const r = bestByCanon.get(canonId(mergedItem)) ?? mergedItem.result;

            if (!r) return it;

            const excluded = r.status === "not_item" || r.kind === "other";

            const nextName =
              r.status === "item" && r.canonicalName?.trim()
                ? r.canonicalName
                : it.name;

            const autoSelect =
              !excluded && r.status === "item" && (r.confidence ?? 0) >= 0.8;

            const aiCategory =
              r.categoryKey && r.categoryKey !== "unknown"
                ? (r.categoryKey as CategoryKey)
                : null;

            const nextCategory =
              aiCategory ?? inferCategoryFromName(nextName ?? "");

            const aiExpiry =
              typeof r.expiryDays === "number" && r.expiryDays > 0
                ? isoDateDaysFromNow(r.expiryDays)
                : null;

            const nextExpiry =
              aiExpiry ??
              it.expiryDate ??
              defaultExpiryDateForCategory(nextCategory);

            const preferred =
              imageOverridesRef.current[
                ingredientImageOverrideKey(nextName ?? "")
              ];

            automaticImagesRef.current.set(it.id, {
              nameKey: ingredientImageOverrideKey(nextName ?? ""),

              image: automaticImage,
            });

            return {
              ...it,

              name: nextName,

              recipeSearchName: r.recipeSearchName?.trim() || nextName,

              categoryKey: nextCategory,

              expiryDate: nextExpiry,

              storageType: r.storageType ?? "unknown",

              expiryConfidence: r.expiryConfidence ?? 0,

              selected: excluded ? false : autoSelect || it.selected,

              excluded,

              ingredientImage: preferred?.image ?? automaticImage,
            };
          });

          // PASS 2: collapse duplicates (by canonicalized name)

          const groups = new Map<string, (typeof mapped)[number]>();

          const groupKeyFor = (it: (typeof mapped)[number]) => {
            const n = (it.name ?? "").trim().toLowerCase();

            return n ? `name:${n}` : `id:${it.id}`;
          };

          const score = (it: (typeof mapped)[number]) => {
            // Prefer selected + non-excluded; slight preference for longer name (more specific)

            return (
              (it.selected ? 10 : 0) +
              (!it.excluded ? 5 : 0) +
              Math.min((it.name ?? "").length, 40) * 0.01
            );
          };

          for (const it of mapped) {
            const k = groupKeyFor(it);

            const existing = groups.get(k);

            if (!existing) {
              groups.set(k, it);

              continue;
            }

            const keep = score(it) > score(existing) ? it : existing;

            const other = keep === it ? existing : it;

            // Merge without adding fields

            groups.set(k, {
              ...keep,

              selected: keep.selected || other.selected, // if any selected, selected

              excluded: keep.excluded && other.excluded, // only excluded if both excluded

              categoryKey: keep.categoryKey ?? other.categoryKey,

              expiryDate: keep.expiryDate ?? other.expiryDate,

              recipeSearchName: keep.recipeSearchName ?? other.recipeSearchName,

              ingredientImage:
                keep.ingredientImage ?? other.ingredientImage ?? null,

              // sourceLine: keep.sourceLine ?? other.sourceLine, // only if this exists on your type
            });
          }

          // Prefer a user override even if duplicate collapsing selected a

          // different OCR row as its representative.

          return Array.from(groups.values()).map((it) => ({
            ...it,

            ingredientImage:
              imageOverridesRef.current[
                ingredientImageOverrideKey(it.name ?? "")
              ]?.image ??
              it.ingredientImage ??
              null,
          }));
        });
      } catch (e: unknown) {
        if (!cancelled) {
          console.warn("canonicalize-items failed:", e);

          const error = e as Error & { alreadyReported?: boolean };

          if (!error?.alreadyReported) {
            if (error?.name === "AbortError") {
              Alert.alert(
                "Server unavailable",

                "The request timed out or was interrupted. You can still edit and add your scanned items.",
              );
            } else {
              Alert.alert(
                "AI unavailable",

                "Couldn't improve item names this time. You can still edit and add your scanned items.",
              );
            }
          }
        }
      } finally {
        if (!cancelled) {
          canonDoneRef.current = true; // ✅ mark canonicalize done

          setAiLoading(false);
        }
      }
    }

    void runCanonicalize();

    return () => {
      cancelled = true;
    };
  }, [parsedItems]);

  const selectedCount = items.filter((i) => i.selected).length;

  function didChange(base: Baseline, it: DraftScanItem) {
    return (
      base.name !== (it.name ?? "").trim() ||
      base.categoryKey !== ((it.categoryKey ?? "pantry") as CategoryKey) ||
      (base.expiryDate ?? null) !== (it.expiryDate ?? null)
    );
  }

  async function saveFixesForUserEdits(chosen: DraftScanItem[]) {
    const base = baselineRef.current;

    for (const it of chosen) {
      const b = base.get(it.id);

      if (!b) continue;

      if (!didChange(b, it)) continue;

      const raw = (it.sourceLine ?? b.name ?? it.name ?? "").trim();

      const key = normalizeFixKey(raw);

      if (!key) continue;

      const fix = makeFixFromFields({
        canonicalName: (it.name ?? "").trim(),

        categoryKey: (it.categoryKey ?? "pantry") as CategoryKey,

        expiryDays: it.expiryDate ? diffDaysFromNow(it.expiryDate) : null,
      });

      await upsertFix(key, fix);

      console.log("✅ upsertFix", { key, fix });
    }
  }

  const openImagePicker = (id: string) => {
    if (imageSaving || pantrySaving) return;

    setImagePickerForId(id);

    setImageUrlText("");
  };

  const closeImagePicker = () => {
    if (imageSaving) return;

    setImagePickerForId(null);

    setImageUrlText("");
  };

  // A saved override is applied to all rows with the same ingredient name.

  function applyImageToMatchingRows(
    name: string,

    image: IngredientImage | null,
  ) {
    const key = ingredientImageOverrideKey(name);

    setItems((previous) =>
      previous.map((row) =>
        ingredientImageOverrideKey(row.name ?? "") === key
          ? { ...row, ingredientImage: image }
          : row,
      ),
    );
  }

  async function saveSelectedImage(
    source: "gallery" | "search",

    image: IngredientImage,

    mimeType?: string | null,
  ) {
    if (!imagePickerForId || imageActionBusyRef.current) return;

    const selected = items.find((row) => row.id === imagePickerForId);

    const name = selected?.name?.trim();

    if (!name) {
      Alert.alert(
        "Name required",

        "Give this item a name before choosing an image.",
      );

      return;
    }

    imageActionBusyRef.current = true;

    setImageSaving(true);

    try {
      const saved = await saveIngredientImageOverride(name, image, source, {
        mimeType,
      });

      imageOverridesRef.current[saved.key] = saved;

      applyImageToMatchingRows(name, saved.image);

      setImagePickerForId(null);

      setImageUrlText("");
    } catch (error) {
      console.warn("Unable to save ingredient image:", error);

      Alert.alert(
        "Image not saved",

        error instanceof Error
          ? error.message
          : "Please try a different image.",
      );
    } finally {
      imageActionBusyRef.current = false;

      setImageSaving(false);
    }
  }

  async function chooseGalleryImage() {
    if (
      !imagePickerForId ||
      imageActionBusyRef.current ||
      galleryPickerOpenRef.current
    )
      return;

    galleryPickerOpenRef.current = true;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",

          "Allow photo access to choose an ingredient image.",
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

      await saveSelectedImage("gallery", { url: asset.uri }, asset.mimeType);
    } catch (error) {
      console.warn("Gallery picker failed:", error);

      Alert.alert("Couldn't open photos", "Please try again.");
    } finally {
      galleryPickerOpenRef.current = false;
    }
  }

  async function saveImageFromUrl() {
    const url = imageUrlText.trim();

    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("Invalid image URL", "Paste a direct HTTPS image URL.");

      return;
    }

    await saveSelectedImage("search", { url });
  }

  async function resetPreferredImage() {
    if (!imagePickerForId || imageActionBusyRef.current) return;

    const selected = items.find((row) => row.id === imagePickerForId);

    if (!selected?.name?.trim()) return;

    const name = selected.name.trim();

    const key = ingredientImageOverrideKey(name);

    imageActionBusyRef.current = true;

    setImageSaving(true);

    try {
      await removeIngredientImageOverride(name);

      delete imageOverridesRef.current[key];

      setItems((previous) =>
        previous.map((row) => {
          if (ingredientImageOverrideKey(row.name ?? "") !== key) return row;

          const automatic = automaticImagesRef.current.get(row.id);

          return {
            ...row,

            ingredientImage:
              automatic?.nameKey === key ? automatic.image : null,
          };
        }),
      );

      setImagePickerForId(null);

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
  }

  function toggleSelected(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  }

  function updateName(id: string, name: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        const oldKey = ingredientImageOverrideKey(it.name ?? "");

        const newKey = ingredientImageOverrideKey(name);

        const automatic = automaticImagesRef.current.get(it.id);

        const matchingAutoImage =
          automatic?.nameKey === newKey ? automatic.image : null;

        const preferred = imageOverridesRef.current[newKey]?.image ?? null;

        const nextCategory = inferCategoryFromName(name);

        const nextExpiry =
          it.expiryDate ?? defaultExpiryDateForCategory(nextCategory);

        return {
          ...it,

          name,

          ingredientImage:
            newKey === oldKey
              ? it.ingredientImage
              : (preferred ?? matchingAutoImage),

          categoryKey: nextCategory,

          expiryDate: nextExpiry,
        };
      }),
    );
  }

  function openExpiryPicker(id: string) {
    setExpiryPickerForId(id);

    setCustomDaysText("");
  }

  function closeExpiryPicker() {
    setExpiryPickerForId(null);

    setCustomDaysText("");
  }

  function updateCategory(id: string, categoryKey: CategoryKey) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,

              categoryKey,

              // when category changes, reset expiry to that category default

              expiryDate: defaultExpiryDateForCategory(categoryKey),
            }
          : it,
      ),
    );
  }

  function parsePositiveInt(s: string): number | null {
    const cleaned = s.trim();

    if (!cleaned) return null;

    if (!/^\d+$/.test(cleaned)) return null; // ✅ digits only

    const int = Number(cleaned);

    if (!Number.isFinite(int)) return null;

    if (int <= 0) return null; // allow 0? change to < 0

    return int;
  }

  function updateExpiry(id: string, expiryDate: string | null) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, expiryDate } : it)),
    );
  }

  async function addSelectedToPantry() {
    // The ref prevents double submissions before React rerenders the disabled button.
    if (imageSaving || pantrySaving || pantryCommitBusyRef.current) return;
    pantryCommitBusyRef.current = true;
    setPantrySaving(true);

    const chosen = items.filter(
      (i) => i.selected && (i.name ?? "").trim().length > 0,
    );
    if (chosen.length === 0) {
      Alert.alert("Nothing selected", "Select at least one item to add.");
      pantryCommitBusyRef.current = false;
      setPantrySaving(false);
      return;
    }

    const newPantryItems = toPantryItems(chosen);
    console.log("addSelectedToPantry", { newPantryItems });

    try {
      // ONE Zustand batch, ONE durable AsyncStorage write, and ONE incremental
      // reminder pass. Do not navigate until the Pantry data is saved.
      await commitPantryItemsBatch(newPantryItems);
    } catch (error) {
      console.warn("Receipt Pantry commit failed:", error);
      Alert.alert(
        "Save failed",
        "Couldn't save pantry items. Please try again.",
      );
      pantryCommitBusyRef.current = false;
      setPantrySaving(false);
      return;
    }

    // Pantry is safely saved. Keep history and scan corrections independent:
    // failure here must not falsely tell the user their Pantry was not saved.
    let historyFailures = 0;
    for (const item of newPantryItems) {
      try {
        // Sequential: supports history implementations using read/modify/write.
        await appendPantryHistory(item, "purchased", "receipt");
      } catch (error) {
        historyFailures++;
        console.warn(
          "Unable to record receipt purchase history:",
          item.id,
          error,
        );
      }
    }
    try {
      await saveFixesForUserEdits(chosen);
    } catch (error) {
      console.warn(
        "Pantry saved but scan corrections could not be saved:",
        error,
      );
    }

    pantryCommitBusyRef.current = false;
    setPantrySaving(false);
    router.replace("/(tabs)/pantry");
    if (historyFailures > 0) {
      Alert.alert(
        "Pantry saved",
        `${historyFailures} purchase-history ${historyFailures === 1 ? "entry" : "entries"} could not be recorded.`,
      );
    }
  }

  if (aiLoading) {
    return (
      <View style={styles.blockWrap}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color={C.slate} />
        </View>
        <Text style={styles.blockEyebrow}>KITCHENBUDDY · SCAN REVIEW</Text>
        <Text style={styles.blockTitle}>Making sense of your receipt.</Text>
        <Text style={styles.blockText}>
          Improving item names and preparing your pantry suggestions…
        </Text>
      </View>
    );
  }

  function daysLeftFromIso(iso: string) {
    const target = new Date(`${iso}T00:00:00`);

    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = target.getTime() - today.getTime();

    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  function expiryDisplay(expiryDate?: string | null) {
    if (!expiryDate) return "None";

    const days = daysLeftFromIso(expiryDate);

    if (days < 0) return "Expired";

    if (days === 0) return "Today";

    if (days === 1) return "1 day";

    return `${days} days`;
  }

  function openCategoryPicker(id: string) {
    setCategoryPickerForId(id);
  }

  function closeCategoryPicker() {
    setCategoryPickerForId(null);
  }

  type ExpiryOption =
    | { label: string; kind: "none" }
    | { label: string; kind: "default" }
    | { label: string; kind: "days"; days: number };

  const EXPIRY_OPTIONS: ExpiryOption[] = [
    { label: "No expiration", kind: "none" },

    { label: "Default for category", kind: "default" },

    { label: "3 days", kind: "days", days: 3 },

    { label: "7 days", kind: "days", days: 7 },

    { label: "14 days", kind: "days", days: 14 },
  ];

  const visibleCount = items.filter((i) => showExcluded || !i.excluded).length;
  const excludedCount = items.filter((i) => i.excluded).length;
  const imagePickerItem = items.find((row) => row.id === imagePickerForId);
  const categoryPickerItem = items.find(
    (row) => row.id === categoryPickerForId,
  );
  const expiryPickerItem = items.find((row) => row.id === expiryPickerForId);
  const hasPreferredImage =
    !!imagePickerItem &&
    !!imageOverridesRef.current[
      ingredientImageOverrideKey(imagePickerItem.name ?? "")
    ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="scan-outline" size={27} color={C.slate} />
            </View>
            <Text style={styles.heroMarker}>STEP 02 · REVIEW</Text>
          </View>
          <Text style={styles.heroEyebrow}>YOUR RECEIPT, REFINED</Text>
          <Text style={styles.heroTitle}>A little review goes a long way.</Text>
          <Text style={styles.heroSubtitle}>
            Check the names, images and expiry dates. Choose what belongs in
            your pantry.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{items.length}</Text>
              <Text style={styles.heroStatLabel}>DETECTED</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{selectedCount}</Text>
              <Text style={styles.heroStatLabel}>SELECTED</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{excludedCount}</Text>
              <Text style={styles.heroStatLabel}>EXCLUDED</Text>
            </View>
          </View>
        </View>

        {report?.quality === "bad" && (
          <View style={[styles.notice, styles.noticeBad]}>
            <View style={styles.noticeIcon}>
              <Ionicons name="alert-circle-outline" size={22} color="#94614E" />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Scan is hard to read</Text>
              <Text style={styles.noticeText}>
                {report.message ??
                  "Try retaking the photo with a tighter crop and better lighting."}
              </Text>
            </View>
          </View>
        )}
        {report?.quality === "ok" && (
          <View style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={C.slate}
              />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Scan may be incomplete</Text>
              <Text style={styles.noticeText}>
                Some items might be missing. Cropping tighter can improve
                accuracy.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeadingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionEyebrow}>MAKE IT YOURS</Text>
            <Text style={styles.sectionTitle}>Detected items</Text>
            <Text style={styles.sectionCaption}>
              Tap an item’s checkmark to include or leave it out.
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {selectedCount}/{items.length}
            </Text>
          </View>
        </View>

        {excludedCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.excludedToggle,
              pressed && styles.pressed,
            ]}
            onPress={() => setShowExcluded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showExcluded ? "Hide excluded items" : "Show excluded items"
            }
          >
            <Ionicons
              name={showExcluded ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={C.slate}
            />
            <Text style={styles.excludedToggleText}>
              {showExcluded
                ? "Hide excluded items"
                : `Show ${excludedCount} excluded item${excludedCount === 1 ? "" : "s"}`}
            </Text>
            <Ionicons
              name={showExcluded ? "chevron-up" : "chevron-down"}
              size={16}
              color={C.muted}
            />
          </Pressable>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={29} color={C.slate} />
            </View>
            <Text style={styles.emptyTitle}>No items detected</Text>
            <Text style={styles.emptySub}>
              Try a tighter crop on the receipt and rescan.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back to scan</Text>
            </Pressable>
          </View>
        ) : visibleCount === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              All detected items are excluded
            </Text>
            <Text style={styles.emptySub}>
              Show excluded items to review or select them.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {items
              .filter((i) => showExcluded || !i.excluded)
              .map((it, index) => (
                <View
                  key={it.id}
                  style={[styles.itemCard, !it.selected && styles.itemCardOff]}
                >
                  <View style={styles.itemTop}>
                    <Pressable
                      onPress={() => openImagePicker(it.id)}
                      disabled={imageSaving || pantrySaving}
                      style={({ pressed }) => [
                        styles.imagePickerButton,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Change image for ${it.name ?? "item"}`}
                    >
                      {it.ingredientImage?.url ? (
                        <Image
                          source={{ uri: it.ingredientImage.url }}
                          style={styles.ingredientImage}
                        />
                      ) : (
                        <View style={styles.ingredientImagePlaceholder}>
                          <Ionicons
                            name="image-outline"
                            size={23}
                            color={C.slate}
                          />
                        </View>
                      )}
                      <View style={styles.imageEditDot}>
                        <Ionicons name="pencil" size={10} color={C.paper} />
                      </View>
                    </Pressable>
                    <View style={styles.itemMain}>
                      <Text style={styles.itemEyebrow}>
                        ITEM {String(index + 1).padStart(2, "0")}
                      </Text>
                      <TextInput
                        value={it.name ?? ""}
                        onChangeText={(t) => updateName(it.id, t)}
                        editable={!imageSaving && !pantrySaving}
                        placeholder="Item name"
                        placeholderTextColor={C.muted}
                        style={styles.nameInput}
                        accessibilityLabel="Edit detected item name"
                      />
                      {it.excluded && (
                        <Text style={styles.excludedLabel}>
                          EXCLUDED BY SCAN
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => toggleSelected(it.id)}
                      disabled={imageSaving || pantrySaving}
                      style={({ pressed }) => [
                        styles.selectTouch,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: !!it.selected,
                        disabled: imageSaving || pantrySaving,
                      }}
                      accessibilityLabel={`Include ${it.name ?? "item"} in pantry`}
                    >
                      <Ionicons
                        name={
                          it.selected ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={28}
                        color={it.selected ? C.slate : "#A9ABA6"}
                      />
                    </Pressable>
                  </View>
                  <View style={styles.itemDivider} />
                  <View style={styles.metaRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.metaPill,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openCategoryPicker(it.id)}
                      disabled={imageSaving || pantrySaving}
                      accessibilityRole="button"
                      accessibilityLabel={`Change category for ${it.name ?? "item"}`}
                    >
                      <Ionicons name="grid-outline" size={15} color={C.slate} />
                      <Text numberOfLines={1} style={styles.metaText}>
                        {categoryLabel(it.categoryKey)}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color={C.muted} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.metaPill,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openExpiryPicker(it.id)}
                      disabled={imageSaving || pantrySaving}
                      accessibilityRole="button"
                      accessibilityLabel={`Change expiry for ${it.name ?? "item"}`}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={C.slate}
                      />
                      <Text numberOfLines={1} style={styles.metaText}>
                        {expiryDisplay(it.expiryDate)}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color={C.muted} />
                    </Pressable>
                  </View>
                </View>
              ))}
          </View>
        )}

        <View style={styles.bottomActions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (selectedCount === 0 || imageSaving || pantrySaving) &&
                styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={addSelectedToPantry}
            disabled={selectedCount === 0 || imageSaving || pantrySaving}
            accessibilityRole="button"
            accessibilityLabel={`Add ${selectedCount} selected items to pantry`}
          >
            {pantrySaving ? (
              <ActivityIndicator color={C.paper} size="small" />
            ) : (
              <Ionicons name="basket-outline" color={C.paper} size={19} />
            )}
            <Text style={styles.primaryBtnText}>
              {pantrySaving
                ? "Saving pantry..."
                : `Add ${selectedCount} to pantry`}
            </Text>
            {!pantrySaving && (
              <Ionicons name="arrow-forward" color={C.paper} size={17} />
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.ghostBtn,
              (imageSaving || pantrySaving) && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            disabled={imageSaving || pantrySaving}
            onPress={() => router.back()}
          >
            <Text style={styles.ghostBtnText}>Back</Text>
          </Pressable>
          <Text style={styles.footerText}>
            You can always adjust food details in your pantry later.
          </Text>
        </View>
      </ScrollView>

      {/* Ingredient image preference sheet */}
      <Modal
        visible={imagePickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeImagePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeImagePicker} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingIcon}>
                <Ionicons name="image-outline" size={21} color={C.slate} />
              </View>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetEyebrow}>PERSONALIZE YOUR PANTRY</Text>
                <Text style={styles.sheetTitle}>Choose ingredient image</Text>
              </View>
              <Pressable
                onPress={closeImagePicker}
                disabled={imageSaving}
                style={styles.sheetClose}
                accessibilityLabel="Close image picker"
              >
                <Ionicons name="close" size={20} color={C.ink} />
              </Pressable>
            </View>
            <Text style={styles.imageHelpText}>
              A selection is saved on this device and reused for future scans of
              this ingredient.
            </Text>
            {imageSaving ? (
              <View style={styles.imageSavingRow}>
                <ActivityIndicator color={C.slate} size="small" />
                <Text style={styles.imageHelpText}>Saving image...</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetItem,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => void chooseGalleryImage()}
                >
                  <View style={styles.sheetItemIcon}>
                    <Ionicons name="images-outline" size={20} color={C.slate} />
                  </View>
                  <Text style={styles.sheetItemText}>Choose from gallery</Text>
                  <Ionicons name="chevron-forward" size={17} color={C.muted} />
                </Pressable>
                <Text style={styles.fieldLabel}>OR USE AN IMAGE URL</Text>
                <Text style={styles.imageHelpText}>
                  Paste a direct image URL. Photo search is not built into this
                  screen yet.
                </Text>
                <TextInput
                  value={imageUrlText}
                  onChangeText={setImageUrlText}
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.imageUrlInput}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.inlineSetBtn,
                    !imageUrlText.trim() && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={!imageUrlText.trim()}
                  onPress={() => void saveImageFromUrl()}
                >
                  <Ionicons name="checkmark" size={17} color={C.paper} />
                  <Text style={styles.inlineSetBtnText}>Save image URL</Text>
                </Pressable>
                {hasPreferredImage && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.sheetItem,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => void resetPreferredImage()}
                  >
                    <View style={styles.sheetItemIcon}>
                      <Ionicons
                        name="refresh-outline"
                        size={20}
                        color={C.slate}
                      />
                    </View>
                    <Text style={styles.sheetItemText}>
                      Reset to automatic image
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.sheetCancel}
                  onPress={closeImagePicker}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Category sheet */}
      <Modal
        visible={categoryPickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeCategoryPicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeCategoryPicker} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingIcon}>
                <Ionicons name="grid-outline" size={21} color={C.slate} />
              </View>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetEyebrow}>ORGANIZE YOUR FOOD</Text>
                <Text style={styles.sheetTitle}>Choose category</Text>
                {!!categoryPickerItem && (
                  <Text style={styles.sheetSubtext}>
                    {categoryPickerItem.name}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={closeCategoryPicker}
                style={styles.sheetClose}
                accessibilityLabel="Close category picker"
              >
                <Ionicons name="close" size={20} color={C.ink} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {CATEGORIES.map((c) => {
                const selected = categoryPickerItem?.categoryKey === c.key;
                return (
                  <Pressable
                    key={c.key}
                    style={({ pressed }) => [
                      styles.sheetItem,
                      selected && styles.sheetItemSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      if (!categoryPickerForId) return;
                      updateCategory(categoryPickerForId, c.key);
                      closeCategoryPicker();
                    }}
                  >
                    <View style={styles.sheetItemIcon}>
                      <Ionicons name="grid-outline" size={18} color={C.slate} />
                    </View>
                    <Text style={styles.sheetItemText}>{c.label}</Text>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={C.slate}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={closeCategoryPicker}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Expiration sheet */}
      <Modal
        visible={expiryPickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeExpiryPicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeExpiryPicker} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingIcon}>
                <Ionicons name="calendar-outline" size={21} color={C.slate} />
              </View>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetEyebrow}>SET YOUR TIMING</Text>
                <Text style={styles.sheetTitle}>Set expiration</Text>
                {!!expiryPickerItem && (
                  <Text style={styles.sheetSubtext}>
                    {expiryPickerItem.name}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={closeExpiryPicker}
                style={styles.sheetClose}
                accessibilityLabel="Close expiration picker"
              >
                <Ionicons name="close" size={20} color={C.ink} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>CUSTOM NUMBER OF DAYS</Text>
              <View style={styles.inlineCustomRow}>
                <TextInput
                  value={customDaysText}
                  onChangeText={(t) =>
                    setCustomDaysText(t.replace(/[^\d]/g, ""))
                  }
                  placeholder="e.g. 10"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  style={styles.inlineInput}
                  onSubmitEditing={() => {
                    if (!expiryPickerForId) return;
                    const days = parsePositiveInt(customDaysText);
                    if (!days) {
                      Alert.alert("Enter days", "Type a number like 3, 7, 14…");
                      return;
                    }
                    updateExpiry(expiryPickerForId, isoDateDaysFromNow(days));
                    closeExpiryPicker();
                  }}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.inlineSetBtn,
                    !customDaysText.trim() && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={!customDaysText.trim()}
                  onPress={() => {
                    if (!expiryPickerForId) return;
                    const days = parsePositiveInt(customDaysText);
                    if (!days) {
                      Alert.alert("Enter days", "Type a number like 3, 7, 14…");
                      return;
                    }
                    updateExpiry(expiryPickerForId, isoDateDaysFromNow(days));
                    closeExpiryPicker();
                  }}
                >
                  <Text style={styles.inlineSetBtnText}>Set</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>QUICK OPTIONS</Text>
              {EXPIRY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (!expiryPickerForId) return;
                    const item = items.find((x) => x.id === expiryPickerForId);
                    const cat = item?.categoryKey ?? "pantry";
                    if (opt.kind === "none") {
                      updateExpiry(expiryPickerForId, null);
                      closeExpiryPicker();
                      return;
                    }
                    if (opt.kind === "default") {
                      const nextExpiry = defaultExpiryDateForCategory(cat);
                      updateExpiry(expiryPickerForId, nextExpiry);
                      closeExpiryPicker();
                      return;
                    }
                    if (opt.kind === "days") {
                      updateExpiry(
                        expiryPickerForId,
                        isoDateDaysFromNow(opt.days),
                      );
                      closeExpiryPicker();
                    }
                  }}
                >
                  <View style={styles.sheetItemIcon}>
                    <Ionicons
                      name={
                        opt.kind === "none"
                          ? "infinite-outline"
                          : opt.kind === "default"
                            ? "refresh-outline"
                            : "time-outline"
                      }
                      size={19}
                      color={C.slate}
                    />
                  </View>
                  <Text style={styles.sheetItemText}>{opt.label}</Text>
                  <Ionicons name="chevron-forward" size={17} color={C.muted} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={closeExpiryPicker}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 17, paddingTop: 14, paddingBottom: 55 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 24,
    padding: 22,
    marginBottom: 23,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 23,
  },
  heroIcon: {
    width: 50,
    height: 50,
    backgroundColor: C.ivory,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMarker: {
    fontSize: 10,
    color: C.cream,
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  heroEyebrow: {
    fontSize: 10,
    color: C.cream,
    letterSpacing: 1.45,
    fontWeight: "700",
    marginBottom: 9,
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 29,
    lineHeight: 36,
    color: C.paper,
    marginBottom: 9,
  },
  heroSubtitle: {
    color: "#E4E8E7",
    lineHeight: 20,
    fontSize: 13,
    maxWidth: 335,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingTop: 17,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#83939A",
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatNumber: { fontFamily: "serif", fontSize: 26, color: C.paper },
  heroStatLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    color: C.cream,
    letterSpacing: 1,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 27,
    backgroundColor: "#96A5AA",
  },
  notice: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    marginBottom: 18,
    flexDirection: "row",
    gap: 10,
  },
  noticeBad: { backgroundColor: "#F7EEE7", borderColor: "#EBDDD1" },
  noticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeCopy: { flex: 1 },
  noticeTitle: {
    color: C.ink,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  noticeText: { color: C.muted, lineHeight: 18, fontSize: 12 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  headingCopy: { flex: 1 },
  sectionEyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.25,
    marginBottom: 5,
  },
  sectionTitle: { fontFamily: "serif", fontSize: 24, color: C.ink },
  sectionCaption: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  countPill: {
    backgroundColor: C.taupe,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 99,
  },
  countPillText: { fontSize: 12, color: C.slateDark, fontWeight: "700" },
  excludedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    borderRadius: 13,
    marginBottom: 12,
  },
  excludedToggleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: C.slateDark,
  },
  listWrap: { gap: 11 },
  itemCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 13,
  },
  itemCardOff: { backgroundColor: "#F4F1EC" },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  imagePickerButton: { width: 66, height: 66, position: "relative" },
  ingredientImage: {
    width: 66,
    height: 66,
    borderRadius: 13,
    backgroundColor: C.soft,
  },
  ingredientImagePlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 13,
    backgroundColor: C.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  imageEditDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: C.slate,
    borderWidth: 2,
    borderColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: C.muted,
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    color: C.ink,
    paddingHorizontal: 0,
    paddingVertical: 5,
    minWidth: 0,
  },
  excludedLabel: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 0.7,
    marginTop: 3,
  },
  selectTouch: { padding: 5, marginRight: -3, justifyContent: "center" },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 13,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaPill: {
    backgroundColor: C.soft,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  metaText: { fontSize: 11, fontWeight: "600", color: C.ink, flexShrink: 1 },
  bottomActions: { marginTop: 18 },
  primaryBtn: {
    backgroundColor: C.slateDark,
    borderRadius: 14,
    minHeight: 55,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  primaryBtnText: { color: C.paper, fontSize: 14, fontWeight: "700" },
  ghostBtn: {
    marginTop: 10,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    minHeight: 49,
    justifyContent: "center",
    alignItems: "center",
  },
  ghostBtnText: { color: C.ink, fontSize: 13, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: C.muted,
    marginTop: 15,
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    marginBottom: 10,
  },
  emptyIcon: {
    width: 53,
    height: 53,
    borderRadius: 17,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 21,
    color: C.ink,
    textAlign: "center",
  },
  emptySub: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: C.soft,
    borderRadius: 12,
    minHeight: 41,
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 15,
  },
  secondaryButtonText: { color: C.slateDark, fontSize: 13, fontWeight: "700" },
  blockWrap: {
    flex: 1,
    backgroundColor: C.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
  },
  loadingIcon: {
    width: 75,
    height: 75,
    borderRadius: 23,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 19,
  },
  blockEyebrow: {
    color: C.slate,
    letterSpacing: 1.2,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 9,
  },
  blockTitle: {
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 32,
    color: C.ink,
    textAlign: "center",
    marginBottom: 9,
  },
  blockText: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30,36,37,0.46)",
  },
  sheet: {
    backgroundColor: C.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 32,
    maxHeight: "88%",
  },
  sheetHandle: {
    width: 42,
    height: 5,
    backgroundColor: "#CFCDC8",
    alignSelf: "center",
    borderRadius: 99,
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 13,
  },
  sheetHeadingIcon: {
    width: 43,
    height: 43,
    backgroundColor: C.cream,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetHeadingCopy: { flex: 1 },
  sheetEyebrow: {
    color: C.slate,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "800",
    marginBottom: 2,
  },
  sheetTitle: {
    fontFamily: "serif",
    color: C.ink,
    fontSize: 21,
    lineHeight: 27,
  },
  sheetSubtext: { color: C.muted, fontSize: 11, marginTop: 3 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetList: { maxHeight: 405, marginBottom: 5 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: C.paper,
    paddingHorizontal: 13,
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  sheetItemSelected: { backgroundColor: C.cream, borderColor: C.taupe },
  sheetItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetItemText: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "600" },
  sheetCancel: {
    borderRadius: 12,
    borderColor: C.border,
    borderWidth: 1,
    backgroundColor: C.paper,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
    marginTop: 7,
  },
  sheetCancelText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  imageHelpText: {
    fontSize: 12,
    lineHeight: 19,
    color: C.muted,
    marginBottom: 12,
  },
  imageSavingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 25,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: C.slate,
    marginTop: 9,
    marginBottom: 10,
  },
  imageUrlInput: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 47,
    paddingHorizontal: 13,
    color: C.ink,
    fontSize: 13,
    marginBottom: 9,
  },
  inlineSetBtn: {
    backgroundColor: C.slateDark,
    borderRadius: 11,
    minHeight: 43,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 11,
  },
  inlineSetBtnText: { fontSize: 13, fontWeight: "700", color: C.paper },
  inlineCustomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
  },
  inlineInput: {
    flex: 1,
    minHeight: 46,
    backgroundColor: C.paper,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 13,
    fontSize: 14,
    color: C.ink,
  },
});
