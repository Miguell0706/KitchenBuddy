import { pool } from "../db.js";
import { pexelsSearchPhotos } from "../pexels.js";

/** Finds the existing Pexels cache even if display-name casing/spacing differs. */
export async function getOrCreateIngredientImage(canonicalName: string) {
  const name = canonicalName.trim().replace(/\s+/g, " ");
  if (!name) return null;

  // Preserve existing cache keys, but also find old entries with different casing
  // or trailing spaces. Return the actual matched key to increment its hits.
  const cached = await pool.query(
    `select canonical_name, image_json
       from ingredient_image_cache
      where canonical_name = $1
         or lower(btrim(canonical_name)) = lower($1)
      order by case when canonical_name = $1 then 0 else 1 end
      limit 1`,
    [name],
  );

  if (cached.rowCount) {
    pool
      .query(
        `update ingredient_image_cache
          set hits = hits + 1
        where canonical_name = $1`,
        [cached.rows[0].canonical_name],
      )
      .catch(() => {});
    return cached.rows[0].image_json;
  }

  const photo = await pexelsSearchPhotos(name);
  if (!photo) return null;

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

  await pool.query(
    `insert into ingredient_image_cache
      (canonical_name, image_json, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (canonical_name)
     do update set image_json = excluded.image_json,
                   updated_at = now()`,
    [name, JSON.stringify(image)],
  );
  return image;
}
