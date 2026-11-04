import { pool } from "../db.js";
import { pexelsSearchPhotos } from "../pexels.js";

/**
 * Ingredient images are nonessential: failure to retrieve one must never
 * prevent a receipt from being reviewed or saved.
 */
type IngredientImage = {
  url: string;
  avgColor: string;
  credit: {
    provider: "pexels";
    providerUrl: string;
    photoUrl: string;
    photographer: string;
    photographerUrl: string;
  };
};

const inFlight = new Map<string, Promise<IngredientImage | null>>();
const negativeCache = new Map<string, number>();
const NEGATIVE_TTL_MS = 30 * 60 * 1000;
const MAX_NEGATIVE_KEYS = 500;

async function resolveImage(
  name: string,
  cacheKey: string,
): Promise<IngredientImage | null> {
  let cached;
  try {
    cached = await pool.query<{
      canonical_name: string;
      image_json: IngredientImage;
    }>(
      `SELECT canonical_name, image_json
         FROM ingredient_image_cache
        WHERE canonical_name = $1
           OR lower(btrim(canonical_name)) = lower($1)
        ORDER BY CASE WHEN canonical_name = $1 THEN 0 ELSE 1 END
        LIMIT 1`,
      [name],
    );
  } catch (error) {
    // Fail closed for Pexels costs when cache database is unavailable.
    console.warn("Ingredient image cache unavailable:", error);
    return null;
  }

  if (cached.rowCount) {
    pool
      .query(
        `UPDATE ingredient_image_cache SET hits = hits + 1 WHERE canonical_name = $1`,
        [cached.rows[0].canonical_name],
      )
      .catch(() => {});
    return cached.rows[0].image_json;
  }

  if ((negativeCache.get(cacheKey) ?? 0) > Date.now()) return null;
  negativeCache.delete(cacheKey);

  let photo;
  try {
    photo = await pexelsSearchPhotos(name);
  } catch (error) {
    console.warn("Ingredient image provider unavailable:", error);
    return null;
  }
  if (!photo?.src?.medium) {
    // Keeps repeated uncached searches for absent images inexpensive.
    // Also briefly suppresses repeat attempts after provider rate limits;
    // source-side quotas independently protect against excess traffic.
    if (negativeCache.size >= MAX_NEGATIVE_KEYS) {
      const oldestKey = negativeCache.keys().next().value;
      if (oldestKey !== undefined) negativeCache.delete(oldestKey);
    }
    negativeCache.set(cacheKey, Date.now() + NEGATIVE_TTL_MS);
    return null;
  }

  const image = {
    url: photo.src.medium,
    avgColor: photo.avg_color,
    credit: {
      provider: "pexels" as const,
      providerUrl: "https://www.pexels.com",
      photoUrl: photo.url,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
    },
  };

  try {
    await pool.query(
      `INSERT INTO ingredient_image_cache (canonical_name, image_json, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (canonical_name)
       DO UPDATE SET image_json = EXCLUDED.image_json, updated_at = now()`,
      [name, JSON.stringify(image)],
    );
  } catch (error) {
    console.warn("Ingredient image cache write failed:", error);
    // A fetched valid image can still be used for this request.
  }
  return image;
}

export async function getOrCreateIngredientImage(
  canonicalName: string,
): Promise<IngredientImage | null> {
  const name = canonicalName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) return null;
  const key = name.toLowerCase();
  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = resolveImage(name, key);
  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    if (inFlight.get(key) === work) inFlight.delete(key);
  }
}
