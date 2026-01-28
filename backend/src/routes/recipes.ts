import type { Request, Response } from "express";
import { Router } from "express";
import { LRUCache } from "lru-cache";

const router = Router();

type NinjaRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  servings?: string;
};

const API_NINJAS_BASE = "https://api.api-ninjas.com/v1/recipe";

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
    const title = rawTitle.toLowerCase();

    const cached = cache.get(title);
    if (cached) {
      return res.json({
        ok: true,
        cached: true,
        title: rawTitle,
        recipes: cached,
      });
    }

    const key = mustEnv("API_NINJAS_KEY");

    const url = `${API_NINJAS_BASE}?title=${encodeURIComponent(rawTitle)}`;
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

    // Cache even empty arrays (prevents repeated expensive misses)
    cache.set(title, recipes);

    return res.json({ ok: true, cached: false, title: rawTitle, recipes });
  } catch (e) {
    console.error("recipes route error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;
