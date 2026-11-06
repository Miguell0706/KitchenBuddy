import { Router } from "express";
import { getAiOnlyImage } from "../lib/aiOnlyImages.js";

/** Drop-in replacement of /api/images; Pexels is not called anywhere here. */
const router = Router();

router.get("/recipe-image", async (req, res) => {
  const title = req.query.title;
  if (typeof title !== "string" || !title.trim() || title.length > 120) {
    res.status(400).json({ ok: false, error: "INVALID_RECIPE_TITLE" });
    return;
  }
  try {
    const result = await getAiOnlyImage("recipe", title, req);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      image: result.image,
      status: result.status,
      retryAfterSeconds: result.status === "pending" ? 5 : undefined,
    });
  } catch (error) {
    console.error("[images] recipe-image failed", error);
    res
      .status(503)
      .json({ ok: false, image: null, error: "IMAGE_SERVICE_UNAVAILABLE" });
  }
});

router.get("/ingredient-image", async (req, res) => {
  const name = req.query.name;
  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    res.status(400).json({ ok: false, error: "INVALID_INGREDIENT_NAME" });
    return;
  }
  try {
    const result = await getAiOnlyImage("ingredient", name, req);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      image: result.image,
      status: result.status,
      retryAfterSeconds: result.status === "pending" ? 5 : undefined,
    });
  } catch (error) {
    console.error("[images] ingredient-image failed", error);
    res
      .status(503)
      .json({ ok: false, image: null, error: "IMAGE_SERVICE_UNAVAILABLE" });
  }
});

export default router;
