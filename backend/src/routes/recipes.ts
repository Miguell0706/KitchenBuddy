import type { Request, Response } from "express";
import { Router } from "express";
import { LRUCache } from "lru-cache";
import { pool } from "../db.js";
import {
  reservePublicRecipeRequest,
  reserveBasicRecipeUpstreamCall,
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

const cache = new LRUCache<string, PublicRecipe[]>({
  max: 2000,
  ttl: 1000 * 60 * 60 * 24,
});

function normalizeKey(rawTitle: string) {
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

function retryAfterSeconds(resetAt: string) {
  return Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000));
}

router.get("/", async (req: Request, res: Response) => {
  // Reject malformed queries BEFORE consuming request quota.
  const titleValue = req.query.title;
  if (typeof titleValue !== "string") {
    return res.status(400).json({ ok: false, error: "MISSING_TITLE" });
  }
  const rawTitle = titleValue.trim();
  if (rawTitle.length < 2 || rawTitle.length > 100) {
    return res.status(400).json({ ok: false, error: "INVALID_TITLE" });
  }
  try {
    const requestQuota = await reservePublicRecipeRequest(req);
    if (!requestQuota.allowed) {
      res.setHeader(
        "Retry-After",
        String(retryAfterSeconds(requestQuota.resetAt)),
      );
      return res.status(429).json({
        ok: false,
        error: requestQuota.reason,
        resetAt: requestQuota.resetAt,
      });
    }

    const cacheKey = normalizeKey(rawTitle);
    // Hot cache first: avoids PostgreSQL reads for repeated searches.
    const mem = cache.get(cacheKey);
    if (mem !== undefined) {
      return res.json({
        ok: true,
        cached: true,
        cachedFrom: "memory",
        title: rawTitle,
        cacheKey,
        recipes: mem,
      });
    }

    const dbHit = await pool.query<{ recipes_json: PublicRecipe[] }>(
      `select recipes_json from recipe_query_cache
       where query_title = $1 and expires_at > now() limit 1`,
      [cacheKey],
    );
    if (dbHit.rowCount) {
      const recipes = dbHit.rows[0].recipes_json;
      cache.set(cacheKey, recipes);
      return res.json({
        ok: true,
        cached: true,
        cachedFrom: "postgres",
        title: rawTitle,
        cacheKey,
        recipes,
      });
    }

    const apiKey = process.env.API_NINJA_KEY;
    if (!apiKey)
      return res
        .status(503)
        .json({ ok: false, error: "RECIPE_PROVIDER_NOT_CONFIGURED" });

    // A GLOBAL DB-backed cap that an attacker cannot bypass by rotating their IP.
    const upstreamQuota = await reserveBasicRecipeUpstreamCall();
    if (!upstreamQuota.allowed) {
      res.setHeader(
        "Retry-After",
        String(retryAfterSeconds(upstreamQuota.resetAt)),
      );
      return res.status(503).json({
        ok: false,
        error: "RECIPE_PROVIDER_BUDGET_REACHED",
        resetAt: upstreamQuota.resetAt,
      });
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(
        `${API_NINJA_BASE}?title=${encodeURIComponent(rawTitle)}`,
        {
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(9500),
        },
      );
    } catch (error) {
      console.warn("Basic recipes upstream network failure:", error);
      return res
        .status(503)
        .json({ ok: false, error: "RECIPE_PROVIDER_UNAVAILABLE" });
    }
    if (!upstream.ok) {
      console.warn("Basic recipes upstream HTTP status:", upstream.status);
      return res.status(upstream.status === 429 ? 503 : 502).json({
        ok: false,
        error:
          upstream.status === 429
            ? "RECIPE_PROVIDER_RATE_LIMITED"
            : "UPSTREAM_ERROR",
      });
    }

    const raw: unknown = await upstream.json();
    if (!Array.isArray(raw))
      return res
        .status(502)
        .json({ ok: false, error: "INVALID_UPSTREAM_RESPONSE" });
    const normalized = raw
      .map((value): PublicRecipe | null =>
        normalizeRecipe(value as NinjaRecipe),
      )
      .filter((value): value is PublicRecipe => value !== null);

    cache.set(cacheKey, normalized);
    // Even if caching fails, return successfully retrieved recipes to the client.
    try {
      await pool.query(
        `insert into recipe_query_cache (query_title, recipes_json, expires_at, updated_at)
         values ($1, $2::jsonb, now() + interval '7 days', now())
         on conflict (query_title)
         do update set recipes_json = excluded.recipes_json,
           expires_at = excluded.expires_at, updated_at = now()`,
        [cacheKey, JSON.stringify(normalized)],
      );
    } catch (error) {
      console.warn("Could not persist basic recipe cache:", error);
    }

    return res.json({
      ok: true,
      cached: false,
      cachedFrom: null,
      title: rawTitle,
      cacheKey,
      recipes: normalized,
    });
  } catch (error) {
    console.error("Basic recipes route failed:", error);
    // Fail closed: if the database-backed guard is unavailable, don't spend API credits.
    return res
      .status(503)
      .json({ ok: false, error: "RECIPE_SERVICE_UNAVAILABLE" });
  }
});

export default router;
