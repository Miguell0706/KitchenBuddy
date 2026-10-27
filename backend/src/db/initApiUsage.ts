import { pool } from "../db.js";

export async function initApiUsage() {
  await pool.query(`
    create table if not exists api_usage_counters (
      scope text not null,
      subject_key text not null,
      window_key text not null,
      used integer not null default 0 check (used >= 0),
      updated_at timestamptz not null default now(),
      primary key (scope, subject_key, window_key)
    )
  `);
  await pool.query(`
    create index if not exists idx_api_usage_updated_at
    on api_usage_counters (updated_at)
  `);
}
