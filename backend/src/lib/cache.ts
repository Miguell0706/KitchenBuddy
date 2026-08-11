import { pool } from "../db.js";
import type { CanonResult } from "./types.js";

export async function cacheGetMany(
  keys: string[],
): Promise<Record<string, CanonResult>> {
  if (keys.length === 0) return {};

  const { rows } = await pool.query(
    `
    select
      key,
      canonical_name as "canonicalName",
      recipe_search_name as "recipeSearchName",
      status,
      kind,
      ingredient_type as "ingredientType",
      category_key as "categoryKey",
      storage_type as "storageType",
      expiry_days as "expiryDays",
      expiry_confidence as "expiryConfidence",
      confidence,
      source,
      extract(epoch from updated_at) * 1000 as "updatedAt"
    from canon_cache
    where key = any($1::text[])
    `,
    [keys],
  );

  // Optional: bump hit counter (non-blocking)
  const hitKeys = rows.map((r) => r.key);

  if (hitKeys.length) {
    pool
      .query(
        `
        update canon_cache
        set hits = hits + 1
        where key = any($1::text[])
        `,
        [hitKeys],
      )
      .catch(() => {});
  }

  const out: Record<string, CanonResult> = {};

  for (const r of rows) {
    out[r.key] = {
      key: r.key,
      canonicalName: r.canonicalName,
      recipeSearchName: r.recipeSearchName,

      status: r.status,
      kind: r.kind,
      ingredientType: r.ingredientType,

      categoryKey: r.categoryKey,
      storageType: r.storageType,
      expiryDays: r.expiryDays === null ? null : Number(r.expiryDays),
      expiryConfidence: Number(r.expiryConfidence),

      confidence: Number(r.confidence),
      updatedAt: Number(r.updatedAt),
      source: r.source,
    };
  }

  return out;
}

export async function cacheUpsertMany(rows: CanonResult[]): Promise<void> {
  if (rows.length === 0) return;

  // One-by-one upserts are fine at current scale.
  // Can batch later if needed.
  const q = `
    insert into canon_cache (
      key,
      canonical_name,
      recipe_search_name,
      status,
      kind,
      ingredient_type,
      category_key,
      storage_type,
      expiry_days,
      expiry_confidence,
      confidence,
      source,
      updated_at
    )
    values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      now()
    )
    on conflict (key) do update set
      canonical_name = excluded.canonical_name,
      recipe_search_name = excluded.recipe_search_name,
      status = excluded.status,
      kind = excluded.kind,
      ingredient_type = excluded.ingredient_type,
      category_key = excluded.category_key,
      storage_type = excluded.storage_type,
      expiry_days = excluded.expiry_days,
      expiry_confidence = excluded.expiry_confidence,
      confidence = excluded.confidence,
      source = excluded.source,
      updated_at = now()
  `;

  for (const r of rows) {
    await pool.query(q, [
      r.key,
      r.canonicalName,
      r.recipeSearchName,

      r.status,
      r.kind,
      r.ingredientType,

      r.categoryKey,
      r.storageType,
      r.expiryDays,
      r.expiryConfidence,

      r.confidence,
      r.source ?? "cache",
    ]);
  }
}
