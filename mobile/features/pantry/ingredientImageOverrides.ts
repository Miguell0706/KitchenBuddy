/**
 * features/pantry/ingredientImageOverrides.ts
 *
 * User-selected ingredient images, shared by Scan Review, Pantry, and Analytics.
 * - One override per normalized canonical ingredient name.
 * - Copies gallery photos AND downloaded search photos into app document storage.
 * - Keeps photo attribution supplied by the image provider.
 * - Stores filenames rather than absolute app-sandbox paths (which may change).
 * - Serializes mutations so concurrent selections/deletions cannot overwrite each other.
 *
 * This module is storage-only: the ImagePicker/search UI belongs in your screens.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { ingredientKey } from "@/features/grocery/groceryIngredients";
import type { IngredientImage } from "@/features/pantry/types";

const STORAGE_KEY = "@kb_ingredient_image_overrides_v1";
const STORE_VERSION = 1;
const IMAGE_FOLDER = "ingredient-image-overrides/";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per selected photo

export type IngredientImageSource = "gallery" | "search";

export type IngredientImageOverride = {
  key: string;
  image: IngredientImage;
  source: IngredientImageSource;
  updatedAt: number;
};

type StoredOverride = IngredientImageOverride & {
  // For a saved local copy. Resolved into a current file:// URL when read.
  localFileName: string;
};

type OverrideStore = {
  version: 1;
  byKey: Record<string, StoredOverride>;
};

/** Pass canonical ingredient names consistently from all screens. */
export function ingredientImageOverrideKey(name: string): string {
  return ingredientKey(name).trim();
}

function requireKey(name: string): string {
  const key = ingredientImageOverrideKey(name);
  if (!key)
    throw new Error("An ingredient name is required to save its image.");
  return key;
}

function imageDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Persistent image storage is unavailable on this device.");
  }
  return FileSystem.documentDirectory + IMAGE_FOLDER;
}

function localImageUri(fileName: string): string {
  return imageDirectory() + fileName;
}

function emptyStore(): OverrideStore {
  return { version: 1, byKey: {} };
}

function isStoredOverride(value: unknown): value is StoredOverride {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredOverride>;
  return (
    typeof entry.key === "string" &&
    !!entry.key &&
    (entry.source === "gallery" || entry.source === "search") &&
    typeof entry.updatedAt === "number" &&
    Number.isFinite(entry.updatedAt) &&
    typeof entry.localFileName === "string" &&
    /^[a-zA-Z0-9_.-]+$/.test(entry.localFileName) &&
    !!entry.image &&
    typeof entry.image.url === "string"
  );
}

async function readStore(): Promise<OverrideStore> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();

  // Do not overwrite an unknown/newer/corrupted store with an empty record.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Saved ingredient image preferences could not be read.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid ingredient image preference data.");
  }
  const store = parsed as Partial<OverrideStore>;
  if (
    store.version !== STORE_VERSION ||
    !store.byKey ||
    Array.isArray(store.byKey) ||
    typeof store.byKey !== "object"
  ) {
    throw new Error("Unsupported ingredient image preference format.");
  }

  const byKey: Record<string, StoredOverride> = {};
  for (const [key, entry] of Object.entries(store.byKey)) {
    if (isStoredOverride(entry) && key === entry.key) byKey[key] = entry;
  }
  return { version: 1, byKey };
}

async function writeStore(store: OverrideStore): Promise<void> {
  // Let failures propagate: UI must not report success when persistence fails.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// A rejected mutation must not block future operations.
let mutationQueue: Promise<void> = Promise.resolve();
function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(task, task);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function afterPendingMutations(): Promise<void> {
  await mutationQueue;
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function fileExtension(uri: string, mimeType?: string): string {
  const mime = (mimeType ?? "").toLowerCase().split(";")[0].trim();
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (byMime[mime]) return byMime[mime];

  const path = uri.split(/[?#]/, 1)[0];
  const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext && ["jpg", "png", "webp", "heic", "heif"].includes(ext)) return ext;
  return "jpg";
}

async function ensureImageDirectory(): Promise<void> {
  await FileSystem.makeDirectoryAsync(imageDirectory(), {
    intermediates: true,
  });
}

async function deleteOwnedImage(fileName: string | undefined): Promise<void> {
  if (!fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName)) return;
  try {
    await FileSystem.deleteAsync(localImageUri(fileName), { idempotent: true });
  } catch (error) {
    // The preference is already updated; leaving an orphan is better than
    // incorrectly reporting that a completed update did not save.
    console.warn("Could not clean up an old ingredient image:", error);
  }
}

async function toPublicOverride(
  entry: StoredOverride,
): Promise<IngredientImageOverride | null> {
  const localUri = localImageUri(entry.localFileName);
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) {
    return {
      key: entry.key,
      source: entry.source,
      updatedAt: entry.updatedAt,
      image: { ...entry.image, url: localUri },
    };
  }

  // A downloaded search photo may still be accessible from its original URL.
  // Gallery temp URIs are intentionally never reused if the persistent copy vanishes.
  if (entry.source === "search" && isRemoteUrl(entry.image.url)) {
    return {
      key: entry.key,
      source: entry.source,
      updatedAt: entry.updatedAt,
      image: entry.image,
    };
  }
  return null;
}

/**
 * Save a chosen image for a canonical ingredient name.
 *
 * gallery: pass the URI from expo-image-picker and optionally asset.mimeType.
 * search: pass the selected HTTPS image URL and any photo credit metadata.
 * Both sources are copied into persistent app-owned storage, so future scans,
 * pantry rows and analytics can show the same image without another image lookup.
 *
 * Throws if copying/downloading/saving fails. Call from an awaited UI handler.
 */
export async function saveIngredientImageOverride(
  ingredientName: string,
  image: IngredientImage,
  source: IngredientImageSource,
  options?: { mimeType?: string | null },
): Promise<IngredientImageOverride> {
  const key = requireKey(ingredientName);
  const originalUrl = image.url?.trim();
  if (!originalUrl) throw new Error("Select an image before saving.");
  if (source === "search" && !isRemoteUrl(originalUrl)) {
    throw new Error("A searched image must have an HTTP(S) URL.");
  }
  if (source === "gallery" && !/^(file|content):\/\//i.test(originalUrl)) {
    throw new Error("A gallery image must be a local image-picker URI.");
  }

  return enqueueMutation(async () => {
    await ensureImageDirectory();
    const ext = fileExtension(originalUrl, options?.mimeType ?? undefined);
    const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`;
    const destination = localImageUri(fileName);
    try {
      if (source === "search") {
        const download = await FileSystem.downloadAsync(
          originalUrl,
          destination,
        );
        if (download.status < 200 || download.status >= 300) {
          throw new Error(`Image download failed (HTTP ${download.status}).`);
        }
      } else {
        await FileSystem.copyAsync({ from: originalUrl, to: destination });
      }

      const info = await FileSystem.getInfoAsync(destination);
      if (
        !info.exists ||
        (typeof info.size === "number" &&
          (info.size <= 0 || info.size > MAX_IMAGE_BYTES))
      ) {
        throw new Error(
          "The selected image is empty or exceeds the 10 MB limit.",
        );
      }

      const store = await readStore();
      const prior = store.byKey[key];
      const updatedAt = Date.now();
      const storedImage: IngredientImage =
        source === "gallery"
          ? { url: destination, avgColor: image.avgColor ?? null }
          : { ...image, url: originalUrl };

      const entry: StoredOverride = {
        key,
        source,
        updatedAt,
        image: storedImage,
        localFileName: fileName,
      };
      store.byKey[key] = entry;
      await writeStore(store);

      // Only delete the old image AFTER the updated preference is saved.
      if (prior?.localFileName !== fileName) {
        await deleteOwnedImage(prior?.localFileName);
      }

      return {
        key,
        source,
        updatedAt,
        image: { ...storedImage, url: destination },
      };
    } catch (error) {
      // A failed replacement never destroys the previous saved selection.
      // A failed download can still leave a partial file.
      await deleteOwnedImage(fileName);
      throw error;
    }
  });
}

/** Read the user's saved image (or null if none is set / gallery file vanished). */
export async function getIngredientImageOverride(
  ingredientName: string,
): Promise<IngredientImageOverride | null> {
  const key = ingredientImageOverrideKey(ingredientName);
  if (!key) return null;
  await afterPendingMutations();
  const store = await readStore();
  const entry = store.byKey[key];
  return entry ? toPublicOverride(entry) : null;
}

/** Prefer user-chosen image, then the automatic image, then caller's placeholder. */
export async function getPreferredIngredientImage(
  ingredientName: string,
  automaticImage: IngredientImage | null | undefined,
): Promise<IngredientImage | null> {
  const override = await getIngredientImageOverride(ingredientName);
  return override?.image ?? automaticImage ?? null;
}

/** Read all usable overrides (helpful when showing Analytics rankings). */
export async function listIngredientImageOverrides(): Promise<
  Record<string, IngredientImageOverride>
> {
  await afterPendingMutations();
  const store = await readStore();
  const result: Record<string, IngredientImageOverride> = {};
  for (const [key, entry] of Object.entries(store.byKey)) {
    const resolved = await toPublicOverride(entry);
    if (resolved) result[key] = resolved;
  }
  return result;
}

/** Remove one user's selection; automatic image lookup can be used again. */
export async function removeIngredientImageOverride(
  ingredientName: string,
): Promise<boolean> {
  const key = ingredientImageOverrideKey(ingredientName);
  if (!key) return false;
  return enqueueMutation(async () => {
    const store = await readStore();
    const prior = store.byKey[key];
    if (!prior) return false;
    delete store.byKey[key];
    await writeStore(store);
    await deleteOwnedImage(prior.localFileName);
    return true;
  });
}

/** Optional settings/testing operation; does not change existing pantry items. */
export async function clearIngredientImageOverrides(): Promise<void> {
  return enqueueMutation(async () => {
    const store = await readStore();
    await AsyncStorage.removeItem(STORAGE_KEY);
    for (const entry of Object.values(store.byKey)) {
      await deleteOwnedImage(entry.localFileName);
    }
  });
}
