import { pool } from "../db.js";

/**
 * Global, PostgreSQL-backed safety limits for all calls using PEXELS_API_KEY.
 *
 * These are conservative application-side UTC windows, not Pexels' exact
 * billing windows. Provider response headers remain authoritative.
 *
 * Count one reservation immediately before each outbound call. A failed
 * provider call still consumes one reservation because it was attempted.
 * api_usage_counters is already created by initApiUsage().
 */
export type PexelsQuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "PEXELS_HOURLY_BUDGET" | "PEXELS_MONTHLY_BUDGET";
      resetAt: string;
    };

function positiveLimit(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${envName} must be a positive integer`);
  }
  return value;
}

export async function reservePexelsUpstreamCall(): Promise<PexelsQuotaDecision> {
  const now = new Date();
  const hourStart = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  const hourReset = new Date(hourStart.getTime() + 3_600_000);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthReset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const counters = [
    {
      scope: "pexels-global-hour-v1",
      windowKey: hourStart.toISOString(),
      resetAt: hourReset.toISOString(),
      limit: positiveLimit("PEXELS_GLOBAL_HOURLY_MAX", 180),
      reason: "PEXELS_HOURLY_BUDGET" as const,
    },
    {
      scope: "pexels-global-month-v1",
      windowKey: monthStart.toISOString().slice(0, 10),
      resetAt: monthReset.toISOString(),
      limit: positiveLimit("PEXELS_GLOBAL_MONTHLY_MAX", 18_000),
      reason: "PEXELS_MONTHLY_BUDGET" as const,
    },
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Distinct lock from API Ninjas/Gemini budget locks.
    // Serializes these checks across all Render instances using the same DB.
    await client.query("SELECT pg_advisory_xact_lock(8137021)");

    for (const item of counters) {
      const result = await client.query<{ used: number }>(
        `SELECT used FROM api_usage_counters
         WHERE scope = $1 AND subject_key = $2 AND window_key = $3`,
        [item.scope, "all", item.windowKey],
      );
      if (Number(result.rows[0]?.used ?? 0) >= item.limit) {
        await client.query("ROLLBACK");
        return { allowed: false, reason: item.reason, resetAt: item.resetAt };
      }
    }

    for (const item of counters) {
      await client.query(
        `INSERT INTO api_usage_counters (scope, subject_key, window_key, used, updated_at)
         VALUES ($1, $2, $3, 1, now())
         ON CONFLICT (scope, subject_key, window_key)
         DO UPDATE SET used = api_usage_counters.used + 1, updated_at = now()`,
        [item.scope, "all", item.windowKey],
      );
    }

    await client.query("COMMIT");
    return { allowed: true };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* preserve original failure */
    }
    // Fail closed: NEVER call Pexels when DB budgeting is unavailable.
    throw error;
  } finally {
    client.release();
  }
}
