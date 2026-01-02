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

    create index if not exists canon_cache_updated_at_idx
      on canon_cache (updated_at desc);
  `);

  console.log("✅ canon_cache table ready");
}
