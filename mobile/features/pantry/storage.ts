// features/pantry/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ALL_CATEGORY_KEYS } from "@/features/pantry/constants";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";

const PANTRY_KEY = "pantry_items_v1";

type PantryByCategory = Record<CategoryKey, PantryItem[]>;

function buildEmptyPantry(): PantryByCategory {
  return ALL_CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = [];
    return acc;
  }, {} as PantryByCategory);
}

function isPantryByCategory(v: unknown): v is PantryByCategory {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return ALL_CATEGORY_KEYS.every((k) => Array.isArray(obj[k]));
}

// If we ever find an old flat-array shape, migrate it into categories
function migrateFlatArrayToPantry(arr: PantryItem[]): PantryByCategory {
  const pantry = buildEmptyPantry();
  for (const it of arr) {
    const key = (it as any).categoryKey as CategoryKey | undefined;
    const dest: CategoryKey = ALL_CATEGORY_KEYS.includes(key as any) ? (key as CategoryKey) : "pantry";
    pantry[dest].push(it);
  }
  return pantry;
}

export async function loadPantry(): Promise<PantryByCategory> {
  const raw = await AsyncStorage.getItem(PANTRY_KEY);
  if (!raw) return buildEmptyPantry();

  try {
    const parsed = JSON.parse(raw);

    // ✅ current correct shape
    if (isPantryByCategory(parsed)) return parsed;

    // ✅ old shape support: flat array
    if (Array.isArray(parsed)) return migrateFlatArrayToPantry(parsed as PantryItem[]);

    // unknown/corrupt
    return buildEmptyPantry();
  } catch {
    return buildEmptyPantry();
  }
}

export async function savePantry(pantry: PantryByCategory) {
  await AsyncStorage.setItem(PANTRY_KEY, JSON.stringify(pantry));
}

export async function addPantryItems(newItems: PantryItem[]) {
  const pantry = await loadPantry();

  for (const it of newItems) {
    const key = (it as any).categoryKey as CategoryKey | undefined;
    const dest: CategoryKey = ALL_CATEGORY_KEYS.includes(key as any) ? (key as CategoryKey) : "pantry";

    const list = Array.isArray(pantry[dest]) ? pantry[dest] : [];
    const idx = list.findIndex((x) => x.id === it.id);

    if (idx >= 0) list[idx] = { ...list[idx], ...it };
    else list.unshift(it);

    pantry[dest] = list;
  }

  await savePantry(pantry);
  return pantry;
}

export async function clearPantry() {
  await AsyncStorage.removeItem(PANTRY_KEY);
}
