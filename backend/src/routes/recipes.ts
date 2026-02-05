import type { Request, Response } from "express";
import { Router } from "express";
import { LRUCache } from "lru-cache";
import { pool } from "../db.js";

const router = Router();

type NinjaIngredient = {
  name: string;
  quantity?: number;
  unit?: string | null;
};

type NinjaRecipe = {
  title: string;
  ingredients: NinjaIngredient[];
  instructions: string[];
  servings?: string;
  nutrition?: string;
};

const API_NINJA_BASE = "https://api.api-ninjas.com/v3/recipe";

// In-memory cache (still good for hot queries)
const cache = new LRUCache<string, any[]>({
  max: 2000,
  ttl: 1000 * 60 * 60 * 24, // 24h
});

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeKey(rawTitle: string) {
  return (
    "recipes:title:" +
    rawTitle.trim().toLowerCase().normalize("NFKC").replace(/\s+/g, " ")
  );
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const rawTitle = String(req.query.title ?? "").trim();
    if (!rawTitle)
      return res.status(400).json({ ok: false, error: "MISSING_TITLE" });

    const cacheKey = normalizeKey(rawTitle);

    console.log("🍳 incoming title:", JSON.stringify(rawTitle));
    console.log("🍳 cacheKey:", cacheKey);

    // ------------------------------------------------------------
    // 1) Postgres cache (survives deploys/restarts)
    // ------------------------------------------------------------
    const dbHit = await pool.query(
      `select recipes_json
       from recipe_query_cache
       where query_title = $1 and expires_at > now()
       limit 1`,
      [cacheKey],
    );

    if (dbHit.rowCount) {
      const recipes = dbHit.rows[0].recipes_json;
      // warm in-memory too
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

    // ------------------------------------------------------------
    // 2) In-memory cache
    // ------------------------------------------------------------
    const mem = cache.get(cacheKey);
    if (mem) {
      return res.json({
        ok: true,
        cached: true,
        cachedFrom: "memory",
        title: rawTitle,
        cacheKey,
        recipes: mem,
      });
    }

    // ------------------------------------------------------------
    // 3) Upstream fetch
    // ------------------------------------------------------------
    const key = mustEnv("API_NINJA_KEY");
    const url = `${API_NINJA_BASE}?title=${encodeURIComponent(rawTitle)}`;
    console.log("🍳 upstream url:", url);

    const upstream = await fetch(url, {
      headers: { "X-Api-Key": key },
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return res.status(502).json({
        ok: false,
        error: "UPSTREAM_ERROR",
        status: upstream.status,
        body: txt.slice(0, 400),
      });
    }

    const recipes = (await upstream.json()) as NinjaRecipe[];

    function formatIngredient(i: any) {
      const qty = i?.quantity;
      const unit = i?.unit && i.unit !== "NULL" ? i.unit : "";
      const name = i?.name ?? "";
      const qtyStr =
        typeof qty === "number"
          ? Number.isInteger(qty)
            ? String(qty)
            : String(qty)
          : "";
      return [qtyStr, unit, name].filter(Boolean).join(" ").trim();
    }

    const normalized = recipes.map((r: any) => ({
      title: r.title,
      servings: r.servings,
      nutrition: r.nutrition,
      ingredients: Array.isArray(r.ingredients)
        ? r.ingredients.map(formatIngredient)
        : typeof r.ingredients === "string"
          ? r.ingredients
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
      instructions: Array.isArray(r.instructions)
        ? r.instructions
        : typeof r.instructions === "string"
          ? r.instructions
              .split(/\.\s+/)
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
    }));

    // ------------------------------------------------------------
    // Write caches
    // ------------------------------------------------------------
    cache.set(cacheKey, normalized as any);

    // Postgres TTL: 7 days (tweak as you want)
    await pool.query(
      `insert into recipe_query_cache (query_title, recipes_json, expires_at, updated_at)
       values ($1, $2::jsonb, now() + interval '7 days', now())
       on conflict (query_title)
       do update set recipes_json = excluded.recipes_json,
                     expires_at = excluded.expires_at,
                     updated_at = now()`,
      [cacheKey, JSON.stringify(normalized)],
    );

    return res.json({
      ok: true,
      cached: false,
      cachedFrom: null,
      title: rawTitle,
      cacheKey,
      recipes: normalized,
    });
  } catch (e) {
    console.error("recipes route error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;
