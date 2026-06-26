import { pool } from "../db.js";
import { pexelsSearchPhotos } from "../pexels.js";

export async function getOrCreateIngredientImage(canonicalName: string) {
  const cached = await pool.query(
    `select image_json
     from ingredient_image_cache
     where canonical_name = $1
     limit 1`,
    [canonicalName],
  );

  if (cached.rowCount) {
    pool
      .query(
        `update ingredient_image_cache
         set hits = hits + 1
         where canonical_name = $1`,
        [canonicalName],
      )
      .catch(() => {});

    return cached.rows[0].image_json;
  }

  const photo = await pexelsSearchPhotos(canonicalName);

  if (!photo) return null;

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

  await pool.query(
    `insert into ingredient_image_cache
      (canonical_name, image_json, updated_at)
     values
      ($1, $2::jsonb, now())
     on conflict (canonical_name)
     do update set image_json = excluded.image_json,
                   updated_at = now()`,
    [canonicalName, JSON.stringify(image)],
  );

  return image;
}
