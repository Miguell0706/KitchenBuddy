import type { Request } from "express";
import { getAiOnlyImage, type AiImage } from "./aiOnlyImages.js";

/** Used by receipt canonicalization; stays non-fatal if AI generation is unavailable. */
export async function getOrCreateIngredientImage(
  canonicalName: string,
  req?: Request,
): Promise<AiImage | null> {
  try {
    return (await getAiOnlyImage("ingredient", canonicalName, req)).image;
  } catch (error) {
    console.warn("Ingredient AI image unavailable:", error);
    return null;
  }
}
