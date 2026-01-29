import type { Request, Response } from "express";
import { Router } from "express";
import { LRUCache } from "lru-cache";

const router = Router();

type NinjaIngredient = {
  name: string;
  quantity?: number;
  unit?: string | null;
};

type NinjaRecipe = {
  title: string;
  ingredients: NinjaIngredient[]; // v3 shape
  instructions: string[]; // v3 shape (based on your sample)
  servings?: string;
  nutrition?: string;
};
const API_NINJA_BASE = "https://api.api-ninjas.com/v3/recipe";

// Simple in-memory cache (good enough for launch; replace with Redis/Tigris later)
const cache = new LRUCache<string, NinjaRecipe[]>({
  max: 2000, // max distinct titles cached
  ttl: 1000 * 60 * 60 * 24, // 24h TTL
});

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const rawTitle = String(req.query.title ?? "").trim();
    if (!rawTitle)
      return res.status(400).json({ ok: false, error: "MISSING_TITLE" });

    // Normalize for caching (helps reduce duplicates)
    const cacheKey =
      "recipes:title:" +
      rawTitle.trim().toLowerCase().normalize("NFKC").replace(/\s+/g, " "); // collapse weird spacing
    console.log("🍳 incoming title:", JSON.stringify(rawTitle));
    console.log("🍳 cacheKey:", cacheKey, "cacheHit?", cache.has(cacheKey));
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        ok: true,
        cached: true,
        title: rawTitle,
        cacheKey,
        recipes: cached,
      });
    }

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
      // ✅ app-friendly strings
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

    // Cache even empty arrays (prevents repeated expensive misses)
    cache.set(cacheKey, normalized as any);
    return res.json({
      ok: true,
      cached: false,
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
