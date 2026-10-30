import type { Request, Response } from "express";
import { Router } from "express";
import { LRUCache } from "lru-cache";
import { pool } from "../db.js";
import {
  isBusinessCachingEnabled,
  reservePublicRecipeRequest,
  reserveNinjasUpstreamCall,
  retryAfterSeconds,
} from "../lib/apiUsage.js";

const router = Router();
const API_NINJA_BASE = "https://api.api-ninjas.com/v3/recipe";

type NinjaIngredient = {
  name?: string;
  quantity?: number;
  unit?: string | null;
};
type NinjaRecipe = {
  title?: string;
  ingredients?: NinjaIngredient[] | string;
  instructions?: string[] | string;
  servings?: string;
  nutrition?: string;
};
type PublicRecipe = {
  title: string;
  servings?: string;
  nutrition?: string;
  ingredients: string[];
  instructions: string[];
};

// Code is kept for the Business-tier transition; disabled in Free mode.
const memoryCache = new LRUCache<string, PublicRecipe[]>({
  max: 2000,
  ttl: 24 * 60 * 60 * 1000,
});

function normalizeKey(rawTitle: string): string {
  return (
    "recipes:title:" +
    rawTitle.trim().toLowerCase().normalize("NFKC").replace(/\s+/g, " ")
  );
}

function formatIngredient(value: NinjaIngredient | null | undefined): string {
  if (!value || typeof value !== "object") return "";
  const quantity =
    typeof value.quantity === "number" && Number.isFinite(value.quantity)
      ? String(value.quantity)
      : "";
  const unit =
    typeof value.unit === "string" && value.unit.toUpperCase() !== "NULL"
      ? value.unit
      : "";
  const name = typeof value.name === "string" ? value.name : "";
  return [quantity, unit, name].filter(Boolean).join(" ").trim();
}

function normalizeRecipe(recipe: NinjaRecipe): PublicRecipe | null {
  if (!recipe || typeof recipe.title !== "string" || !recipe.title.trim())
    return null;
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map(formatIngredient).filter(Boolean)
    : typeof recipe.ingredients === "string"
      ? recipe.ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.filter((s): s is string => typeof s === "string")
    : typeof recipe.instructions === "string"
      ? recipe.instructions
          .split(/\.\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return {
    title: recipe.title,
    servings: recipe.servings,
    nutrition: recipe.nutrition,
    ingredients,
    instructions,
  };
}

router.get("/", async (req: Request, res: Response) => {
  // Validate before consuming per-client request allowance.
  if (typeof req.query.title !== "string") {
    return res.status(400).json({ ok: false, error: "MISSING_TITLE" });
  }
  const title = req.query.title.trim();
  if (title.length < 2 || title.length > 100) {
    return res.status(400).json({ ok: false, error: "INVALID_TITLE" });
  }

  try {
    const requestLimit = await reservePublicRecipeRequest(req);
    if (!requestLimit.allowed) {
      res.setHeader(
        "Retry-After",
        String(retryAfterSeconds(requestLimit.resetAt)),
      );
      return res.status(429).json({
        ok: false,
        error: requestLimit.reason,
        resetAt: requestLimit.resetAt,
      });
    }

    const cacheKey = normalizeKey(title);
    const cachingEnabled = isBusinessCachingEnabled();

    if (cachingEnabled) {
      const hot = memoryCache.get(cacheKey);
      if (hot !== undefined) {
        return res.json({
          ok: true,
          cached: true,
          cachedFrom: "memory",
          title,
          cacheKey,
          recipes: hot,
        });
      }

      const dbHit = await pool.query<{ recipes_json: PublicRecipe[] }>(
        `SELECT recipes_json FROM recipe_query_cache
         WHERE query_title = $1 AND expires_at > now() LIMIT 1`,
        [cacheKey],
      );
      if (dbHit.rowCount) {
        const recipes = dbHit.rows[0].recipes_json;
        memoryCache.set(cacheKey, recipes);
        return res.json({
          ok: true,
          cached: true,
          cachedFrom: "postgres",
          title,
          cacheKey,
          recipes,
        });
      }
    }

    const apiKey = process.env.API_NINJA_KEY;
    if (!apiKey) {
      return res
        .status(503)
        .json({ ok: false, error: "RECIPE_PROVIDER_NOT_CONFIGURED" });
    }

    // One GLOBAL shared budget for Free and future Premium routes.
    // Cache hits never reach this point. Free plan enforces Free-tier caps.
    const upstreamBudget = await reserveNinjasUpstreamCall();
    if (!upstreamBudget.allowed) {
      res.setHeader(
        "Retry-After",
        String(retryAfterSeconds(upstreamBudget.resetAt)),
      );
      return res.status(503).json({
        ok: false,
        error: upstreamBudget.reason,
        resetAt: upstreamBudget.resetAt,
      });
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(
        `${API_NINJA_BASE}?title=${encodeURIComponent(title)}`,
        {
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(9500),
        },
      );
    } catch (error) {
      console.warn("Basic recipes upstream request failed:", error);
      return res
        .status(503)
        .json({ ok: false, error: "RECIPE_PROVIDER_UNAVAILABLE" });
    }
    if (!upstream.ok) {
      console.warn("Basic recipes provider HTTP status:", upstream.status);
      return res.status(upstream.status === 429 ? 503 : 502).json({
        ok: false,
        error:
          upstream.status === 429
            ? "RECIPE_PROVIDER_RATE_LIMITED"
            : "UPSTREAM_ERROR",
      });
    }

    const raw: unknown = await upstream.json();
    if (!Array.isArray(raw)) {
      return res
        .status(502)
        .json({ ok: false, error: "INVALID_UPSTREAM_RESPONSE" });
    }
    const normalized = raw
      .map((item): PublicRecipe | null => normalizeRecipe(item as NinjaRecipe))
      .filter((item): item is PublicRecipe => item !== null);

    if (cachingEnabled) {
      memoryCache.set(cacheKey, normalized);
      try {
        await pool.query(
          `INSERT INTO recipe_query_cache (query_title, recipes_json, expires_at, updated_at)
           VALUES ($1, $2::jsonb, now() + interval '7 days', now())
           ON CONFLICT (query_title) DO UPDATE SET
             recipes_json = excluded.recipes_json,
             expires_at = excluded.expires_at,
             updated_at = now()`,
          [cacheKey, JSON.stringify(normalized)],
        );
      } catch (error) {
        console.warn("Basic recipes cache write failed:", error);
      }
    } else {
      // Do not instruct caches/proxies to store Free-plan API Ninjas output.
      res.setHeader("Cache-Control", "no-store");
    }

    return res.json({
      ok: true,
      cached: false,
      cachedFrom: null,
      title,
      cacheKey,
      recipes: normalized,
    });
  } catch (error) {
    console.error("Basic recipes endpoint failed:", error);
    // Fail closed when guards cannot reserve the usage counters.
    return res
      .status(503)
      .json({ ok: false, error: "RECIPE_SERVICE_UNAVAILABLE" });
  }
});

export default router;
