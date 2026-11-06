import { pool } from "../db.js";

/** Separate cache: old Pexels records remain untouched for rollback. */
export async function initAiImageAssets(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_image_assets (
      kind text NOT NULL CHECK (kind IN ('ingredient', 'recipe')),
      lookup_key text NOT NULL,
      display_name text NOT NULL,
      status text NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
      public_url text,
      storage_key text,
      seed bigint,
      lease_id text,
      lease_expires_at timestamptz,
      retry_after timestamptz,
      error_code text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, lookup_key)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_image_assets_status
      ON ai_image_assets(status, updated_at)
  `);
}
