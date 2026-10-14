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

import { addPantryItems } from "@/features/pantry/storage";

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

import { syncExpiryReminders } from "@/features/reminders/pantryReminderSync";

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
    if (imageSaving || pantrySaving) return;
    setPantrySaving(true);
    const chosen = items.filter(
      (i) => i.selected && (i.name ?? "").trim().length > 0,
    );

    if (chosen.length === 0) {
      Alert.alert("Nothing selected", "Select at least one item to add.");
      setPantrySaving(false);
      return;
    }

    try {
      const newPantryItems = toPantryItems(chosen);

      console.log("addSelectedToPantry", {
        newPantryItems,
      });

      // Save items to pantry
      await addPantryItems(newPantryItems);

      // Record receipt purchases for pantry history + analytics
      await Promise.all(
        newPantryItems.map((item) =>
          appendPantryHistory(item, "purchased", "receipt"),
        ),
      );

      // Rebuild expiry notifications using updated pantry
      await syncExpiryReminders();

      // Save user's scan corrections
      await saveFixesForUserEdits(chosen);

      router.replace("/(tabs)/pantry");
    } catch (e) {
      console.log("addSelectedToPantry failed:", e);

      Alert.alert("Save failed", "Couldn't save pantry items. Try again.");
    } finally {
      setPantrySaving(false);
    }
  }

  if (aiLoading) {
    return (
      <View style={styles.blockWrap}>
        <Text style={styles.blockTitle}>✨ Improving item names…</Text>

        <Text style={styles.blockText}>Hang tight for a moment.</Text>
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Review Scan</Text>

      {report?.quality === "bad" && (
        <View style={[styles.warnBanner, styles.warnBad]}>
          <Text style={styles.warnTitle}>⚠️ Scan is hard to read</Text>

          <Text style={styles.warnText}>
            {report.message ??
              "Try retaking the photo with a tighter crop and better lighting."}
          </Text>
        </View>
      )}

      {report?.quality === "ok" && (
        <View style={[styles.warnBanner, styles.warnOk]}>
          <Text style={styles.warnTitle}>ℹ️ Scan may be incomplete</Text>

          <Text style={styles.warnText}>
            Some items might be missing. Cropping tighter can improve accuracy.
          </Text>
        </View>
      )}

      <Pressable onPress={() => setShowExcluded((v) => !v)}>
        <Text style={{ fontSize: 12, color: "#555" }}>
          {showExcluded ? "Hide excluded items" : "Show excluded items"}
        </Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Detected items</Text>

        <Text style={styles.countText}>
          {selectedCount}/{items.length} selected
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No items detected</Text>

          <Text style={styles.emptySub}>
            Try a tighter crop on the receipt and rescan.
          </Text>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.listCard}>
          {items

            .filter((i) => showExcluded || !i.excluded)

            .map((it) => (
              <View
                key={it.id}
                style={[styles.row, !it.selected && styles.rowOff]}
              >
                <View style={styles.editRow}>
                  <Pressable
                    onPress={() => openImagePicker(it.id)}
                    disabled={imageSaving || pantrySaving}
                    accessibilityRole="button"
                    accessibilityLabel={`Change image for ${it.name ?? "item"}`}
                    style={styles.imagePickerButton}
                  >
                    {it.ingredientImage?.url ? (
                      <Image
                        source={{ uri: it.ingredientImage.url }}
                        style={styles.ingredientImage}
                      />
                    ) : (
                      <View style={styles.ingredientImagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>＋</Text>
                      </View>
                    )}
                    <Text style={styles.changeImageText}>Image</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => toggleSelected(it.id)}
                    style={styles.rowTop}
                  >
                    <Text style={styles.checkbox}>
                      {it.selected ? "☑" : "☐"}
                    </Text>
                  </Pressable>

                  <TextInput
                    value={it.name ?? ""}
                    onChangeText={(t) => updateName(it.id, t)}
                    editable={!imageSaving && !pantrySaving}
                    placeholder="Item name"
                    style={styles.nameInput}
                  />
                </View>

                <View style={styles.metaRow}>
                  <Pressable
                    style={styles.metaPill}
                    onPress={() => openCategoryPicker(it.id)}
                  >
                    <Text style={styles.metaText}>
                      {categoryLabel(it.categoryKey)}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.metaPill}
                    onPress={() => openExpiryPicker(it.id)}
                  >
                    <Text style={styles.metaText}>
                      Expiry: {expiryDisplay(it.expiryDate)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>
      )}

      <Pressable
        style={[
          styles.primaryBtn,
          (selectedCount === 0 || imageSaving || pantrySaving) &&
            styles.btnDisabled,
        ]}
        onPress={addSelectedToPantry}
        disabled={selectedCount === 0 || imageSaving || pantrySaving}
      >
        <Text style={styles.primaryBtnText}>
          {pantrySaving ? "Saving pantry..." : "Add selected to pantry"}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.ghostBtn,
          (imageSaving || pantrySaving) && styles.btnDisabled,
        ]}
        disabled={imageSaving || pantrySaving}
        onPress={() => router.back()}
      >
        <Text style={styles.ghostBtnText}>Back</Text>
      </Pressable>

      <Modal
        visible={imagePickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeImagePicker}
      >
        <Pressable style={styles.backdrop} onPress={closeImagePicker} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose ingredient image</Text>
          <Text style={styles.imageHelpText}>
            A selection is saved on this device and reused for future scans of
            this ingredient.
          </Text>
          {imageSaving ? (
            <View style={styles.imageSavingRow}>
              <ActivityIndicator />
              <Text style={styles.imageHelpText}>Saving image...</Text>
            </View>
          ) : (
            <>
              <Pressable
                style={styles.sheetItem}
                onPress={() => void chooseGalleryImage()}
              >
                <Text style={styles.sheetItemText}>Choose from gallery</Text>
              </Pressable>
              <Text style={styles.imageHelpText}>
                Or paste a direct image URL (photo search is not built into this
                screen yet).
              </Text>
              <TextInput
                value={imageUrlText}
                onChangeText={setImageUrlText}
                placeholder="https://example.com/image.jpg"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.imageUrlInput}
              />
              <Pressable
                style={[
                  styles.inlineSetBtn,
                  !imageUrlText.trim() && styles.btnDisabled,
                ]}
                disabled={!imageUrlText.trim()}
                onPress={() => void saveImageFromUrl()}
              >
                <Text style={styles.inlineSetBtnText}>Save image URL</Text>
              </Pressable>
              {imagePickerForId &&
                !!imageOverridesRef.current[
                  ingredientImageOverrideKey(
                    items.find((row) => row.id === imagePickerForId)?.name ??
                      "",
                  )
                ] && (
                  <Pressable
                    style={styles.sheetItem}
                    onPress={() => void resetPreferredImage()}
                  >
                    <Text style={styles.sheetItemText}>
                      Reset to automatic image
                    </Text>
                  </Pressable>
                )}
              <Pressable style={styles.sheetCancel} onPress={closeImagePicker}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>

      <Modal
        visible={categoryPickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeCategoryPicker}
      >
        {/* Backdrop */}

        <Pressable style={styles.backdrop} onPress={closeCategoryPicker} />

        {/* Sheet */}

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose category</Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                style={styles.sheetItem}
                onPress={() => {
                  if (!categoryPickerForId) return;

                  updateCategory(categoryPickerForId, c.key);

                  closeCategoryPicker();
                }}
              >
                <Text style={styles.sheetItemText}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetCancel} onPress={closeCategoryPicker}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={expiryPickerForId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeExpiryPicker}
      >
        {/* Backdrop */}

        <Pressable style={styles.backdrop} onPress={closeExpiryPicker} />

        {/* Sheet */}

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Set expiration</Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ✅ Inline custom days row */}

            <View style={styles.inlineCustomRow}>
              <Text style={styles.inlineLabel}>Custom days</Text>

              <TextInput
                value={customDaysText}
                onChangeText={(t) => setCustomDaysText(t.replace(/[^\d]/g, ""))}
                placeholder="e.g. 10"
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
                style={[
                  styles.inlineSetBtn,

                  customDaysText.trim().length === 0 && { opacity: 0.5 },
                ]}
                disabled={customDaysText.trim().length === 0}
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

            {EXPIRY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={styles.sheetItem}
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
                    if (!expiryPickerForId) return;

                    const item = items.find((i) => i.id === expiryPickerForId);

                    const cat = item?.categoryKey ?? "pantry";

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

                    return;
                  }
                }}
              >
                <Text style={styles.sheetItemText}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetCancel} onPress={closeExpiryPicker}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, backgroundColor: "#fdfdfc" },

  title: {
    fontSize: 28,

    fontWeight: "800",

    textAlign: "center",

    marginBottom: 12,
  },

  blockWrap: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    padding: 20,

    backgroundColor: "#fdfdfc",
  },

  blockTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },

  blockText: { fontSize: 13, color: "#555", textAlign: "center" },

  headerRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "baseline",

    marginBottom: 10,
  },

  sectionTitle: { fontSize: 16, fontWeight: "800" },

  countText: { fontSize: 13, fontWeight: "700", color: "#444" },

  listCard: {
    borderRadius: 16,

    padding: 12,

    backgroundColor: "#fff",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.06)",

    marginBottom: 14,
  },

  row: {
    paddingVertical: 10,

    borderBottomWidth: 1,

    borderBottomColor: "rgba(0,0,0,0.06)",
  },

  rowOff: { opacity: 0.45 },

  rowTop: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 8,

    paddingVertical: 4,
  },

  checkbox: { width: 28, fontSize: 16, fontWeight: "800" },

  sourceLine: { flex: 1, color: "#555", fontSize: 12 },

  editRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },

  nameInput: {
    flex: 1,

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",

    borderRadius: 12,

    paddingHorizontal: 12,

    paddingVertical: 10,

    fontSize: 14,

    backgroundColor: "#fff",
  },

  primaryBtn: {
    borderRadius: 14,

    paddingVertical: 14,

    alignItems: "center",

    backgroundColor: "#111",

    marginBottom: 10,
  },

  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  btnDisabled: { opacity: 0.5 },

  ghostBtn: {
    borderRadius: 14,

    paddingVertical: 12,

    alignItems: "center",

    backgroundColor: "rgba(0,0,0,0.06)",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",
  },

  ghostBtnText: { color: "#111", fontSize: 15, fontWeight: "700" },

  emptyCard: {
    borderRadius: 16,

    padding: 16,

    backgroundColor: "#fff",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.06)",

    marginBottom: 14,
  },

  emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },

  emptySub: { fontSize: 13, color: "#666", marginBottom: 14 },

  backBtn: {
    borderRadius: 14,

    paddingVertical: 12,

    alignItems: "center",

    backgroundColor: "rgba(0,0,0,0.06)",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",
  },

  backBtnText: { color: "#111", fontSize: 15, fontWeight: "700" },

  warnBanner: {
    borderRadius: 14,

    padding: 12,

    backgroundColor: "rgba(0,0,0,0.04)",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",

    marginBottom: 12,
  },

  warnTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },

  warnText: { fontSize: 12, color: "#555" },

  warnBad: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",

    borderColor: "rgba(255, 59, 48, 0.25)",
  },

  warnOk: {
    backgroundColor: "rgba(255, 149, 0, 0.08)",

    borderColor: "rgba(255, 149, 0, 0.25)",
  },

  metaRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    marginTop: 8,
  },

  metaText: { fontSize: 12, fontWeight: "700", color: "#444" },

  metaPill: {
    paddingVertical: 6,

    paddingHorizontal: 10,

    borderRadius: 999,

    backgroundColor: "rgba(0,0,0,0.06)",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",
  },

  backdrop: {
    flex: 1,

    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",

    left: 0,

    right: 0,

    bottom: 0,

    backgroundColor: "#fff",

    borderTopLeftRadius: 18,

    borderTopRightRadius: 18,

    padding: 14,

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.08)",
  },

  sheetTitle: {
    fontSize: 16,

    fontWeight: "800",

    marginBottom: 10,
  },

  sheetItem: {
    paddingVertical: 12,

    paddingHorizontal: 10,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.06)",

    marginBottom: 10,

    backgroundColor: "rgba(0,0,0,0.03)",
  },

  sheetItemText: {
    fontSize: 14,

    fontWeight: "700",

    color: "#111",
  },

  sheetCancel: {
    marginTop: 6,

    paddingVertical: 12,

    alignItems: "center",

    borderRadius: 14,

    backgroundColor: "rgba(0,0,0,0.06)",

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",
  },

  sheetCancelText: {
    fontSize: 14,

    fontWeight: "800",
  },

  inlineCustomRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    paddingVertical: 12,

    paddingHorizontal: 10,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.06)",

    marginBottom: 10,

    backgroundColor: "rgba(0,0,0,0.03)",
  },

  inlineLabel: {
    fontSize: 13,

    fontWeight: "800",

    color: "#111",
  },

  inlineInput: {
    flex: 1,

    borderWidth: 1,

    borderColor: "rgba(0,0,0,0.10)",

    borderRadius: 10,

    paddingHorizontal: 10,

    paddingVertical: 8,

    fontSize: 14,

    backgroundColor: "#fff",
  },

  inlineSetBtn: {
    paddingVertical: 10,

    paddingHorizontal: 14,

    borderRadius: 10,

    backgroundColor: "#111",
  },

  inlineSetBtnText: {
    color: "#fff",

    fontSize: 13,

    fontWeight: "800",
  },

  ingredientImage: {
    width: 44,

    height: 44,

    borderRadius: 10,

    backgroundColor: "#eee",
  },

  ingredientImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: { fontSize: 22, fontWeight: "700", color: "#555" },
  imagePickerButton: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  changeImageText: { fontSize: 10, color: "#555", marginTop: 2 },
  imageHelpText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
    lineHeight: 17,
  },
  imageSavingRow: {
    paddingVertical: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  imageUrlInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.14)",
    marginBottom: 10,
    backgroundColor: "#fff",
    fontSize: 13,
  },
});
