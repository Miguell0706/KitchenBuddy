import { fal } from "@fal-ai/client";

type ImageKind = "ingredient" | "recipe";

export async function generateFluxImage(prompt: string, kind: ImageKind) {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY is missing");
  }

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size:
        kind === "ingredient"
          ? { width: 960, height: 960 }
          : { width: 1024, height: 768 },

      num_inference_steps: 4,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "jpeg",
      acceleration: "none",
    },
  });

  if (result.data.has_nsfw_concepts?.some(Boolean)) {
    throw new Error("Image rejected by safety checker");
  }

  const image = result.data.images?.[0];

  if (!image?.url) {
    throw new Error("FLUX returned no image");
  }

  return {
    imageUrl: image.url,
    seed: result.data.seed,
    width: image.width,
    height: image.height,
    provider: "fal-flux-schnell",
  };
}
