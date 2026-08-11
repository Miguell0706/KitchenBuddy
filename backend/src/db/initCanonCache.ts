import { pool } from "../db.js";

export async function initCanonCache() {
  await pool.query(`
    create table if not exists canon_cache (
      key text primary key,
      canonical_name text not null,
      recipe_search_name text not null default '',

      status text not null
        check (status in ('item','not_item','unknown')),

      kind text not null
        check (kind in ('food','other')),

      ingredient_type text not null
        check (ingredient_type in ('ingredient','product','ambiguous')),

      category_key text not null default 'unknown'
        check (
          category_key in (
            'produce',
            'meatSeafood',
            'dairyEggs',
            'bakery',
            'pantry',
            'condiments',
            'spices',
            'beverages',
            'frozen',
            'snacks',
            'pet',
            'unknown'
          )
        ),

      storage_type text not null default 'unknown'
        check (
          storage_type in (
            'pantry',
            'refrigerated',
            'frozen',
            'unknown'
          )
        ),

      expiry_days integer,
      expiry_confidence real not null default 0,

      confidence real not null,
      source text not null,
      updated_at timestamptz not null default now(),
      hits bigint not null default 0
    );

    -- Existing DB migrations
    alter table canon_cache
      add column if not exists recipe_search_name text not null default '';

    alter table canon_cache
      add column if not exists category_key text not null default 'unknown';

    alter table canon_cache
      add column if not exists storage_type text not null default 'unknown';

    alter table canon_cache
      add column if not exists expiry_days integer;

    alter table canon_cache
      add column if not exists expiry_confidence real not null default 0;

    -- Convert old household cache entries
    update canon_cache
    set
      kind = 'other',
      status = 'not_item',
      canonical_name = '',
      recipe_search_name = '',
      ingredient_type = 'ambiguous',
      category_key = 'unknown',
      storage_type = 'unknown',
      expiry_days = null,
      expiry_confidence = 0
    where kind = 'household';

    -- Replace old kind constraint
    alter table canon_cache
      drop constraint if exists canon_cache_kind_check;

    alter table canon_cache
      add constraint canon_cache_kind_check
      check (kind in ('food','other'));

    -- Category constraint
    alter table canon_cache
      drop constraint if exists canon_cache_category_key_check;

    alter table canon_cache
      add constraint canon_cache_category_key_check
      check (
        category_key in (
          'produce',
          'meatSeafood',
          'dairyEggs',
          'bakery',
          'pantry',
          'condiments',
          'spices',
          'beverages',
          'frozen',
          'snacks',
          'pet',
          'unknown'
        )
      );

    -- Storage constraint
    alter table canon_cache
      drop constraint if exists canon_cache_storage_type_check;

    alter table canon_cache
      add constraint canon_cache_storage_type_check
      check (
        storage_type in (
          'pantry',
          'refrigerated',
          'frozen',
          'unknown'
        )
      );

    -- Basic expiry safety constraints
    alter table canon_cache
      drop constraint if exists canon_cache_expiry_days_check;

    alter table canon_cache
      add constraint canon_cache_expiry_days_check
      check (
        expiry_days is null
        or expiry_days > 0
      );

    alter table canon_cache
      drop constraint if exists canon_cache_expiry_confidence_check;

    alter table canon_cache
      add constraint canon_cache_expiry_confidence_check
      check (
        expiry_confidence >= 0
        and expiry_confidence <= 1
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

    create table if not exists recipe_image_cache (
      title text primary key,
      image_json jsonb not null,
      expires_at timestamptz not null,
      updated_at timestamptz not null default now()
    );

    create index if not exists recipe_image_cache_expires_at_idx
      on recipe_image_cache (expires_at);

    create table if not exists ingredient_image_cache (
      canonical_name text primary key,
      image_json jsonb not null,
      updated_at timestamptz not null default now(),
      hits bigint not null default 0
    );

    create index if not exists ingredient_image_cache_hits_idx
      on ingredient_image_cache (hits desc);

    create index if not exists ingredient_image_cache_updated_at_idx
      on ingredient_image_cache (updated_at desc);
  `);

  console.log("✅ canon_cache table ready");
  console.log("✅ recipe_query_cache table ready");
  console.log("✅ recipe_image_cache table ready");
  console.log("✅ ingredient_image_cache table ready");
}
