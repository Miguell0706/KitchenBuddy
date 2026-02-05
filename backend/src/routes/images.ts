import express from "express";
import { pexelsSearchPhotos } from "../pexels.js";
import { pool } from "../db.js";

const router = express.Router();

/* -------------------------------------------
   Recipe image
-------------------------------------------- */
router.get("/recipe-image", async (req, res) => {
  try {
    const title = String(req.query.title ?? "").trim();
    if (!title)
      return res.status(400).json({ ok: false, error: "Missing title" });

    // 1) Try DB cache
    const cached = await pool.query(
      `select image_json
       from recipe_image_cache
       where title = $1 and expires_at > now()
       limit 1`,
      [title],
    );

    if (cached.rowCount) {
      return res.json({
        ok: true,
        image: cached.rows[0].image_json,
        cached: true,
      });
    }

    // 2) Fetch from Pexels
    const query = `${title} food dish`;
    const photo = await pexelsSearchPhotos(query);

    if (!photo) {
      return res.json({ ok: true, image: null, cached: false });
    }

    const image = {
      url: photo.src.landscape,
      avgColor: photo.avg_color,
      credit: {
        provider: "pexels" as const,
        providerUrl: "https://www.pexels.com",
        photoUrl: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
      },
    };

    // 3) Store in DB (long TTL – images rarely change)
    await pool.query(
      `insert into recipe_image_cache (title, image_json, expires_at, updated_at)
       values ($1, $2::jsonb, now() + interval '90 days', now())
       on conflict (title)
       do update set image_json = excluded.image_json,
                     expires_at = excluded.expires_at,
                     updated_at = now()`,
      [title, JSON.stringify(image)],
    );

    return res.json({ ok: true, image, cached: false });
  } catch (e: any) {
    console.log("❌ /recipe-image error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* -------------------------------------------
   Ingredient image
-------------------------------------------- */
router.get("/ingredient-image", async (req, res) => {
  try {
    const name = String(req.query.name ?? "").trim();
    if (!name)
      return res.status(400).json({ ok: false, error: "Missing name" });

    // We namespace the key so it never collides with recipe titles
    const cacheKey = `ingredient:${name.toLowerCase()}`;

    // 1) DB cache
    const cached = await pool.query(
      `select image_json
       from recipe_image_cache
       where title = $1 and expires_at > now()
       limit 1`,
      [cacheKey],
    );

    if (cached.rowCount) {
      return res.json({
        ok: true,
        image: cached.rows[0].image_json,
        cached: true,
      });
    }

    // 2) Fetch
    const query = `${name} ingredient food`;
    const photo = await pexelsSearchPhotos(query);

    if (!photo) return res.json({ ok: true, image: null, cached: false });

    const image = {
      url: photo.src.small,
      avgColor: photo.avg_color,
      credit: {
        provider: "pexels" as const,
        providerUrl: "https://www.pexels.com",
        photoUrl: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
      },
    };

    // 3) Store (same table, different key)
    await pool.query(
      `insert into recipe_image_cache (title, image_json, expires_at, updated_at)
       values ($1, $2::jsonb, now() + interval '90 days', now())
       on conflict (title)
       do update set image_json = excluded.image_json,
                     expires_at = excluded.expires_at,
                     updated_at = now()`,
      [cacheKey, JSON.stringify(image)],
    );

    return res.json({ ok: true, image, cached: false });
  } catch (e) {
    console.log("❌ /ingredient-image error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
