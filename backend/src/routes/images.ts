import express from "express";
import { pexelsSearchPhotos } from "../pexels.js";

const router = express.Router();

router.get("/recipe-image", async (req, res) => {
  try {
    const title = String(req.query.title ?? "").trim();
    if (!title)
      return res.status(400).json({ ok: false, error: "Missing title" });

    // TODO: buildRecipeImageQuery(title) + cache check
    const query = `${title} food dish`; // temporary simple query

    const photo = await pexelsSearchPhotos(query);

    if (!photo) {
      return res.json({ ok: true, image: null, cached: false });
    }

    // choose a size for recipe hero image
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

    return res.json({ ok: true, image, cached: false });
  } catch (e: any) {
    console.log("❌ /recipe-image error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
router.get("/ingredient-image", async (req, res) => {
  try {
    const name = String(req.query.name ?? "").trim();
    if (!name)
      return res.status(400).json({ ok: false, error: "Missing name" });

    const query = `${name} ingredient food`; // simple for now
    const photo = await pexelsSearchPhotos(query);

    if (!photo) return res.json({ ok: true, image: null, cached: false });

    const image = {
      url: photo.src.small, // better for small icons
      avgColor: photo.avg_color,
      credit: {
        provider: "pexels" as const,
        providerUrl: "https://www.pexels.com",
        photoUrl: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
      },
    };

    return res.json({ ok: true, image, cached: false });
  } catch (e) {
    console.log("❌ /ingredient-image error", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
export default router;
