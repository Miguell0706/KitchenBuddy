import { pool } from "../db.js";
import type { CanonResult } from "./types.js";

export async function cacheGetMany(keys: string[]): Promise<Record<string, CanonResult>> {
  if (keys.length === 0) return {};

  const { rows } = await pool.query(
    `
    select
      key,
      canonical_name as "canonicalName",
      status,
      kind,
      ingredient_type as "ingredientType",
      confidence,
      source,
      extract(epoch from updated_at) * 1000 as "updatedAt"
    from canon_cache
    where key = any($1::text[])
    `,
    [keys]
  );

  // optional: bump hit counter (non-blocking)
  const hitKeys = rows.map((r) => r.key);
    if (hitKeys.length) {
      pool.query(
        `update canon_cache set hits = hits + 1 where key = any($1::text[])`,
        [hitKeys]
      ).catch(() => {});
    }

  const out: Record<string, CanonResult> = {};
  for (const r of rows) {
    out[r.key] = {
      key: r.key,
      canonicalName: r.canonicalName,
      status: r.status,
      kind: r.kind,
      ingredientType: r.ingredientType,
      confidence: Number(r.confidence),
      updatedAt: Number(r.updatedAt),
      source: r.source,
    };
  }
  return out;
}

export async function cacheUpsertMany(rows: CanonResult[]): Promise<void> {
  if (rows.length === 0) return;

  // Upsert one-by-one is fine at your scale; we can batch later if needed.
  // (This keeps it simple and reliable.)
  const q = `
    insert into canon_cache
      (key, canonical_name, status, kind, ingredient_type, confidence, source, updated_at)
    values
      ($1, $2, $3, $4, $5, $6, $7, now())
    on conflict (key) do update set
      canonical_name = excluded.canonical_name,
      status = excluded.status,
      kind = excluded.kind,
      ingredient_type = excluded.ingredient_type,
      confidence = excluded.confidence,
      source = excluded.source,
      updated_at = now()
  `;

  for (const r of rows) {
    await pool.query(q, [
      r.key,
      r.canonicalName,
      r.status,
      r.kind,
      r.ingredientType,
      r.confidence,
      r.source ?? "cache",
    ]);
  }
}
