import type { CanonResult } from "./types.js";

const mem = new Map<string, CanonResult>();

export async function cacheGetMany(keys: string[]) {
  const out: Record<string, CanonResult> = {};
  for (const k of keys) {
    const hit = mem.get(k);
    if (hit) out[k] = hit;
  }
  return out;
}

export async function cacheUpsertMany(rows: CanonResult[]) {
  for (const r of rows) mem.set(r.key, r);
}
