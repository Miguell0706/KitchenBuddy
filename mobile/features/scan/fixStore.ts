// features/scan/fixStore.ts
// AsyncStorage-backed "user fixes" for recurring OCR items.
// Keyed by a normalized version of the ORIGINAL OCR source line.
// Purpose: if the same item OCRs again, we can auto-apply user edits (name/category/expiry).

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CategoryKey } from "@/features/pantry/types";

const STORAGE_KEY = "receiptchef:item_fixes:v1";
const VERSION = 1;
export const FIXES_KEY = "scan_fixes_v1"; // <-- replace with your real key

// keep it sane; prune oldest if it grows too large
const MAX_KEYS = 1500;
const MIN_KEY_LEN = 3;

export type ExpiryMode = "none" | "date"; // keep simple for now

export type StoredFix = {
  canonicalName: string;
  categoryKey: string;
  expiryDate: string | null;
  // optional: add updatedAt if you have it
  updatedAt?: number;
};

export type FixMap = Record<string, StoredFix>;

export async function loadFixes(): Promise<FixMap> {
  const s = await AsyncStorage.getItem(FIXES_KEY);
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function deleteFix(key: string) {
  const map = await loadFixes();
  delete map[key];
  await AsyncStorage.setItem(FIXES_KEY, JSON.stringify(map));
}

export async function clearFixes() {
  await AsyncStorage.removeItem(FIXES_KEY);
}
export type ItemFix = {
  canonicalName?: string;
  categoryKey?: CategoryKey;
  expiryMode: "none" | "days";
  expiryDays: number | null;
  timesUsed?: number;
  updatedAt?: number;
};

type FixStoreV1 = {
  version: 1;
  byKey: Record<string, ItemFix>;
};

function emptyStore(): FixStoreV1 {
  return { version: 1, byKey: {} };
}

function now() {
  return Date.now();
}

/**
 * Normalize a raw OCR line to a stable-ish key.
 * Goal: tolerate OCR noise while still distinguishing different items.
 */
export function normalizeFixKey(raw: string): string {
  if (!raw) return "";
  return (
    raw
      .toLowerCase()
      .trim()
      // remove prices/weights/skus that cause churn
      .replace(/\d+/g, " ")
      // keep letters/spaces
      .replace(/[^a-z\s]/g, " ")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Create a fix object from the edit screen fields.
 */
export function makeFixFromFields(args: {
  canonicalName: string;
  categoryKey: CategoryKey;
  expiryDays: number | null;
}): ItemFix {
  return {
    canonicalName: (args.canonicalName ?? "").trim(),
    categoryKey: (args.categoryKey ?? "pantry") as CategoryKey,
    expiryMode: typeof args.expiryDays === "number" ? "days" : "none",
    expiryDays: typeof args.expiryDays === "number" ? args.expiryDays : null,
    updatedAt: now(),
    timesUsed: 0,
  };
}

/**
 * Read store (never throws).
 */
export async function readFixStore(): Promise<FixStoreV1> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();

    const parsed = JSON.parse(raw) as Partial<FixStoreV1>;
    if (parsed.version !== VERSION) return emptyStore();
    if (!parsed.byKey || typeof parsed.byKey !== "object") return emptyStore();

    return { version: 1, byKey: parsed.byKey as Record<string, ItemFix> };
  } catch (e) {
    console.log("fixStore read failed:", e);
    return emptyStore();
  }
}

/**
 * Write store (never throws).
 */
async function writeFixStore(store: FixStoreV1): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.log("fixStore write failed:", e);
  }
}

/**
 * Get fix for a normalized key.
 */
export async function getFix(key: string): Promise<ItemFix | null> {
  const k = key.trim();
  if (!k || k.length < MIN_KEY_LEN) return null;

  const store = await readFixStore();
  return store.byKey[k] ?? null;
}

/**
 * Get fix for raw OCR text.
 */
export async function getFixForRaw(raw: string): Promise<ItemFix | null> {
  const k = normalizeFixKey(raw);
  return getFix(k);
}

/**
 * Upsert fix for a normalized key.
 */
export async function upsertFix(key: string, fix: ItemFix): Promise<void> {
  const k = key.trim();
  if (!k || k.length < MIN_KEY_LEN) return;

  const store = await readFixStore();

  const prev = store.byKey[k];
  store.byKey[k] = {
    ...fix,
    // preserve timesUsed if overwriting
    timesUsed: prev?.timesUsed ?? fix.timesUsed ?? 0,
    updatedAt: now(),
  };

  const pruned = pruneIfNeeded(store);
  await writeFixStore(pruned);
}

/**
 * Upsert fix for raw OCR text.
 */
export async function upsertFixForRaw(
  raw: string,
  fix: ItemFix,
): Promise<void> {
  const k = normalizeFixKey(raw);
  if (!k) return;
  await upsertFix(k, fix);
}

/**
 * Increment usage (optional; call when you auto-apply a fix on a future scan).
 */
export async function bumpFixUsage(key: string, inc = 1): Promise<void> {
  const k = key.trim();
  if (!k || k.length < MIN_KEY_LEN) return;

  const store = await readFixStore();
  const existing = store.byKey[k];
  if (!existing) return;

  store.byKey[k] = {
    ...existing,
    timesUsed: (existing.timesUsed ?? 0) + inc,
    updatedAt: now(),
  };

  await writeFixStore(store);
}
export async function listFixes(): Promise<Record<string, ItemFix>> {
  const store = await readFixStore();
  return store.byKey ?? {};
}

/**
 * Remove a fix by normalized key.
 */
export async function removeFix(key: string): Promise<void> {
  const k = key.trim();
  if (!k) return;

  const store = await readFixStore();
  if (!store.byKey[k]) return;

  delete store.byKey[k];
  await writeFixStore(store);
}

/**
 * Clear all fixes.
 */
export async function clearFixStore(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.log("fixStore clear failed:", e);
  }
}

/**
 * Prune: keep the "best" MAX_KEYS entries by (timesUsed, recency).
 */
function pruneIfNeeded(store: FixStoreV1): FixStoreV1 {
  const keys = Object.keys(store.byKey);
  if (keys.length <= MAX_KEYS) return store;

  const scored = keys.map((k) => {
    const f = store.byKey[k];
    const ageDays = (now() - (f?.updatedAt ?? 0)) / (1000 * 60 * 60 * 24);
    const used = f?.timesUsed ?? 0;

    // Higher is better:
    const score = used * 5 + Math.max(0, 30 - ageDays); // 30-day recency window
    return { k, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const keep = new Set(scored.slice(0, MAX_KEYS).map((s) => s.k));
  const next: Record<string, ItemFix> = {};

  for (const k of keep) next[k] = store.byKey[k];

  return { version: 1, byKey: next };
}
