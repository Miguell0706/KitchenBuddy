import { createHmac } from "node:crypto";
import type { Request } from "express";
import { pool } from "../db.js";

/**
 * First-release safety rails for a public endpoint that does not yet have accounts.
 * IP-based limits are an abuse-control fallback, NOT a secure per-user identity.
 * A trusted proxy configuration is required for req.ip to identify the client.
 */
function positiveEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export type QuotaDecision = {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
};

/** Atomic even if concurrent requests reach multiple Render instances. */
async function takeCounter(
  scope: string,
  subject: string,
  windowKey: string,
  limit: number,
  resetAt: string,
): Promise<QuotaDecision> {
  const result = await pool.query<{ used: number }>(
    `insert into api_usage_counters
       (scope, subject_key, window_key, used, updated_at)
     values ($1, $2, $3, 1, now())
     on conflict (scope, subject_key, window_key)
     do update set
       used = api_usage_counters.used + 1,
       updated_at = now()
     where api_usage_counters.used < $4
     returning used`,
    [scope, subject, windowKey, limit],
  );
  return {
    allowed: (result.rowCount ?? 0) > 0,
    used: result.rows[0]?.used ?? limit,
    limit,
    resetAt,
  };
}

function utcDayWindow(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const midnight = new Date(`${day}T00:00:00.000Z`);
  return {
    key: day,
    resetAt: new Date(midnight.getTime() + 86_400_000).toISOString(),
  };
}

function utcMinuteWindow(now: Date) {
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return {
    key: minute.toISOString(),
    resetAt: new Date(minute.getTime() + 60_000).toISOString(),
  };
}

function callerKey(req: Request): string {
  const secret = process.env.API_ABUSE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Set API_ABUSE_HASH_SECRET (32+ random characters) on Render.",
    );
  }
  // Hash the IP rather than storing the address in the usage table.
  // This is only a stopgap until authenticated guest sessions are introduced.
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function reservePublicRecipeRequest(
  req: Request,
): Promise<
  | { allowed: true }
  | { allowed: false; reason: "BURST_LIMIT" | "DAILY_LIMIT"; resetAt: string }
> {
  const now = new Date();
  const key = callerKey(req);
  const minute = utcMinuteWindow(now);
  const burst = await takeCounter(
    "basic-recipes-per-minute",
    key,
    minute.key,
    positiveEnv("BASIC_RECIPES_PER_IP_PER_MINUTE", 10),
    minute.resetAt,
  );
  if (!burst.allowed)
    return { allowed: false, reason: "BURST_LIMIT", resetAt: burst.resetAt };

  const day = utcDayWindow(now);
  const daily = await takeCounter(
    "basic-recipes-per-day",
    key,
    day.key,
    positiveEnv("BASIC_RECIPES_PER_IP_PER_DAY", 100),
    day.resetAt,
  );
  if (!daily.allowed)
    return { allowed: false, reason: "DAILY_LIMIT", resetAt: daily.resetAt };
  return { allowed: true };
}

/**
 * Reserve one GLOBAL upstream API Ninjas call; do this only after both caches miss.
 * Counts attempts conservatively, even on provider errors. This is intentional as
 * an emergency cap on usage, not an invoice reconciliation mechanism.
 */
export async function reserveBasicRecipeUpstreamCall(): Promise<QuotaDecision> {
  const day = utcDayWindow(new Date());
  return takeCounter(
    "basic-recipes-upstream-global",
    "all",
    day.key,
    positiveEnv("BASIC_RECIPES_UPSTREAM_MAX_PER_DAY", 200),
    day.resetAt,
  );
}
