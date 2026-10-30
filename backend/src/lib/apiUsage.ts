import { createHmac } from "node:crypto";
import type { Request } from "express";
import { pool } from "../db.js";

/**
 * Usage-policy foundation for KitchenBuddy.
 *
 * 1. Apply caller-level limits BEFORE checking cached results.
 * 2. Call reserveNinjasUpstreamCall() immediately BEFORE *every* API Ninjas
 *    network request, from every endpoint that shares the API key.
 * 3. Only use a server-authenticated ID for Premium caller limits.
 *
 * Each counter is a reservation of an attempted call, not provider billing data.
 * Counters are kept in existing table api_usage_counters.
 */
export type NinjasPlan = "free" | "business";
export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "BURST_LIMIT"
        | "DAILY_LIMIT"
        | "PROVIDER_HOURLY_BUDGET"
        | "PROVIDER_DAILY_BUDGET"
        | "PROVIDER_MONTHLY_BUDGET";
      used: number;
      limit: number;
      resetAt: string;
    };

type Window = { key: string; resetAt: string };
type Counter = {
  scope: string;
  subject: string;
  window: Window;
  limit: number;
  reason: Exclude<QuotaDecision, { allowed: true }>["reason"];
};

function configuredLimit(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return defaultValue;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return number;
}

export function getNinjasPlan(): NinjasPlan {
  const value = process.env.API_NINJAS_PLAN || "free";
  if (value !== "free" && value !== "business") {
    throw new Error("API_NINJAS_PLAN must be 'free' or 'business'.");
  }
  return value;
}

/** Keep the caching code, but run it only after Business is active. */
export function isBusinessCachingEnabled(): boolean {
  return getNinjasPlan() === "business";
}

export function utcWindow(now: Date, kind: "minute" | "hour" | "day"): Window {
  const size =
    kind === "minute" ? 60_000 : kind === "hour" ? 3_600_000 : 86_400_000;
  const start = Math.floor(now.getTime() / size) * size;
  return {
    key: new Date(start).toISOString(),
    resetAt: new Date(start + size).toISOString(),
  };
}

function monthBoundary(absoluteMonth: number, anchorDay: number): Date {
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth - year * 12;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchorDay, days)));
}

/**
 * Monthly limit reset uses the date the Business subscription first started,
 * not the first of every calendar month. This is a conservative date-only
 * approximation; confirm the actual provider billing reset time in dashboard.
 */
export function businessBillingWindow(
  now: Date,
  anchor: string | undefined,
): Window {
  if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    throw new Error(
      "Set API_NINJAS_BILLING_ANCHOR_UTC=YYYY-MM-DD after upgrading.",
    );
  }
  const first = new Date(`${anchor}T00:00:00.000Z`);
  if (
    Number.isNaN(first.getTime()) ||
    first.toISOString().slice(0, 10) !== anchor
  ) {
    throw new Error("API_NINJAS_BILLING_ANCHOR_UTC must be a real UTC date.");
  }
  if (now.getTime() < first.getTime()) {
    throw new Error("API_NINJAS_BILLING_ANCHOR_UTC is in the future.");
  }
  let month = now.getUTCFullYear() * 12 + now.getUTCMonth();
  let start = monthBoundary(month, first.getUTCDate());
  if (start.getTime() > now.getTime()) {
    month -= 1;
    start = monthBoundary(month, first.getUTCDate());
  }
  if (start.getTime() < first.getTime()) start = first;
  const next = monthBoundary(month + 1, first.getUTCDate());
  return { key: start.toISOString().slice(0, 10), resetAt: next.toISOString() };
}

function hashedSubject(prefix: string, value: string): string {
  const secret = process.env.API_ABUSE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Set API_ABUSE_HASH_SECRET (32+ characters) in Render.");
  }
  return createHmac("sha256", secret)
    .update(`${prefix}:${value}`)
    .digest("hex");
}

function ipSubject(req: Request): string {
  // Correct client IP depends on safely configuring Express trust proxy.
  // Never trust an arbitrary X-Forwarded-For value directly.
  return hashedSubject("ip", req.ip || req.socket.remoteAddress || "unknown");
}

/**
 * One transaction and one database advisory lock make a group of reservations
 * all-or-nothing, across concurrent requests and Render processes.
 * This simple global lock is deliberate for initial launch volumes.
 */
async function reserveAll(counters: Counter[]): Promise<QuotaDecision> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8137003)");
    for (const counter of counters) {
      const result = await client.query<{ used: number }>(
        `SELECT used FROM api_usage_counters
         WHERE scope = $1 AND subject_key = $2 AND window_key = $3`,
        [counter.scope, counter.subject, counter.window.key],
      );
      const used = Number(result.rows[0]?.used ?? 0);
      if (used >= counter.limit) {
        await client.query("ROLLBACK");
        return {
          allowed: false,
          reason: counter.reason,
          used,
          limit: counter.limit,
          resetAt: counter.window.resetAt,
        };
      }
    }
    for (const counter of counters) {
      await client.query(
        `INSERT INTO api_usage_counters (scope, subject_key, window_key, used, updated_at)
         VALUES ($1, $2, $3, 1, now())
         ON CONFLICT (scope, subject_key, window_key)
         DO UPDATE SET used = api_usage_counters.used + 1, updated_at = now()`,
        [counter.scope, counter.subject, counter.window.key],
      );
    }
    await client.query("COMMIT");
    return { allowed: true };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* propagate original error */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Basic search: per-IP, 5/minute and 60/day by default. */
export async function reservePublicRecipeRequest(
  req: Request,
): Promise<QuotaDecision> {
  const id = ipSubject(req);
  const now = new Date();
  return reserveAll([
    {
      scope: "basic-recipes-per-minute-v2",
      subject: id,
      window: utcWindow(now, "minute"),
      limit: configuredLimit("BASIC_RECIPES_PER_IP_PER_MINUTE", 5),
      reason: "BURST_LIMIT",
    },
    {
      scope: "basic-recipes-per-day-v2",
      subject: id,
      window: utcWindow(now, "day"),
      limit: configuredLimit("BASIC_RECIPES_PER_IP_PER_DAY", 60),
      reason: "DAILY_LIMIT",
    },
  ]);
}

/**
 * Reserved for later Premium integration. userId MUST be supplied by trusted
 * server-side auth middleware after RevenueCat entitlement validation.
 */
export async function reserveVerifiedPremiumRecipeRequest(
  userId: string,
): Promise<QuotaDecision> {
  if (typeof userId !== "string" || userId.trim().length < 8) {
    throw new Error("Premium request needs a server-verified user ID.");
  }
  const id = hashedSubject("account", userId);
  const now = new Date();
  return reserveAll([
    {
      scope: "premium-recipes-per-minute-v1",
      subject: id,
      window: utcWindow(now, "minute"),
      limit: configuredLimit("PREMIUM_RECIPES_PER_USER_PER_MINUTE", 5),
      reason: "BURST_LIMIT",
    },
    {
      scope: "premium-recipes-per-day-v1",
      subject: id,
      window: utcWindow(now, "day"),
      limit: configuredLimit("PREMIUM_RECIPES_PER_USER_PER_DAY", 60),
      reason: "DAILY_LIMIT",
    },
  ]);
}

/**
 * Shared API Ninjas budget — NO separate Free/Premium buckets.
 * One call to this function is one attempted upstream API Ninjas request.
 * Add it to every API Ninjas-consuming route, including Cook Now when mounted.
 */
export async function reserveNinjasUpstreamCall(): Promise<QuotaDecision> {
  const now = new Date();
  if (getNinjasPlan() === "business") {
    const billing = businessBillingWindow(
      now,
      process.env.API_NINJAS_BILLING_ANCHOR_UTC,
    );
    return reserveAll([
      {
        scope: "ninjas-global-month-v1",
        subject: "business",
        window: billing,
        limit: configuredLimit("NINJAS_GLOBAL_MONTHLY_MAX", 1_000_000),
        reason: "PROVIDER_MONTHLY_BUDGET",
      },
      {
        scope: "ninjas-global-day-v1",
        subject: "all",
        window: utcWindow(now, "day"),
        limit: configuredLimit("NINJAS_GLOBAL_DAILY_MAX", 50_000),
        reason: "PROVIDER_DAILY_BUDGET",
      },
    ]);
  }
  // Free-tier evaluation safeguards. Free is 3,000/month and 100/hour.
  // Use a conservative allowance, and never enable provider-response caching.
  return reserveAll([
    {
      scope: "ninjas-free-month-v1",
      subject: "all",
      window: {
        key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`,
        resetAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        ).toISOString(),
      },
      limit: configuredLimit("NINJAS_FREE_MONTHLY_MAX", 2_700),
      reason: "PROVIDER_MONTHLY_BUDGET",
    },
    {
      scope: "ninjas-free-hour-v1",
      subject: "all",
      window: utcWindow(now, "hour"),
      limit: configuredLimit("NINJAS_FREE_HOURLY_MAX", 90),
      reason: "PROVIDER_HOURLY_BUDGET",
    },
  ]);
}

export function retryAfterSeconds(resetAt: string): number {
  return Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000));
}
