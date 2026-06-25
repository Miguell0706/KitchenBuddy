import { pool } from "../db.js";

export async function initCanonCache() {
  await pool.query(`
    create table if not exists canon_cache (
      key text primary key,
      canonical_name text not null,
      status text not null check (status in ('item','not_item','unknown')),
      kind text not null check (kind in ('food','household','other')),
      ingredient_type text not null check (ingredient_type in ('ingredient','product','ambiguous')),
      confidence real not null,
      source text not null,
      updated_at timestamptz not null default now(),
      hits bigint not null default 0
    );

    create index if not exists canon_cache_hits_idx
      on canon_cache (hits desc);

    create index if not exists canon_cache_updated_at_idx
      on canon_cache (updated_at desc);

    create table if not exists recipe_query_cache (
      query_title text primary key,
      recipes_json jsonb not null,
      expires_at timestamptz not null,
      updated_at timestamptz not null default now()
    );

    create index if not exists recipe_query_cache_expires_at_idx
      on recipe_query_cache (expires_at);

    -- NEW
    create table if not exists recipe_image_cache (
      title text primary key,
      image_json jsonb not null,
      expires_at timestamptz not null,
      updated_at timestamptz not null default now()
    );

    create index if not exists recipe_image_cache_expires_at_idx
      on recipe_image_cache (expires_at);
  `);

  console.log("✅ canon_cache table ready");
  console.log("✅ recipe_query_cache table ready");
  console.log("✅ recipe_image_cache table ready");
}
