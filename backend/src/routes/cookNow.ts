/**
 * Express route for a server-verified KitchenBuddy Premium account.
 * Mount only after your actual session authentication; NEVER authorize from a
 * client isPremium boolean, deviceId, or a client-controlled request header.
 * Requires Node 18+ global fetch, express, zod.
 */
import { Router, type RequestHandler } from "express";
import { z } from "zod";

const filterNames = [
  "min_calories",
  "max_calories",
  "min_protein",
  "max_protein",
  "min_carbs",
  "max_carbs",
  "min_fat",
  "max_fat",
  "max_sugars",
  "max_sodium",
] as const;
const filtersSchema = z
  .object(
    Object.fromEntries(
      filterNames.map((k) => [
        k,
        z.number().finite().min(0).max(50000).optional(),
      ]),
    ) as Record<(typeof filterNames)[number], z.ZodOptional<z.ZodNumber>>,
  )
  .strict()
  .default({});
const requestSchema = z
  .object({
    title: z.string().trim().min(2).max(100).optional(),
    ingredients: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(65)
          .refine(
            (value) => !value.includes(","),
            "Ingredient name cannot contain commas.",
          ),
      )
      .min(1)
      .max(5)
      .optional(),
    servings: z.number().int().min(1).max(1000).optional(),
    filters: filtersSchema,
    limit: z.number().int().min(1).max(10).default(10),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.title &&
      !value.ingredients?.length &&
      Object.keys(value.filters).length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a title, pantry ingredients or a nutrition filter.",
      });
    }
    for (const [min, max] of [
      ["min_calories", "max_calories"],
      ["min_protein", "max_protein"],
      ["min_carbs", "max_carbs"],
      ["min_fat", "max_fat"],
    ] as const) {
      const lo = value.filters[min],
        hi = value.filters[max];
      if (lo !== undefined && hi !== undefined && lo > hi)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${min} cannot exceed ${max}.`,
        });
    }
  });

export type CookNowDependencies = {
  /** Authenticate and verify Premium entitlement against YOUR server/billing record.
   * Must reject unauthenticated/non-premium clients with 401/403.
   * On success attach a server-verified user ID to res.locals.userId. */
  requirePremium: RequestHandler;
  /** Enforce a persistent per-account search quota BEFORE an upstream call.
   * Must reject exhausted quota with HTTP 429. */
  consumeQuota: RequestHandler;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
function formatRecipe(value: unknown) {
  const v = asRecord(value);
  if (
    typeof v.title !== "string" ||
    !Array.isArray(v.ingredients) ||
    !Array.isArray(v.instructions)
  )
    return null;
  const ing = v.ingredients
    .map((raw) => {
      const i = asRecord(raw);
      if (typeof i.name !== "string" || !i.name.trim()) return null;
      return {
        name: i.name.trim().slice(0, 200),
        ...(safeNumber(i.quantity) !== undefined
          ? { quantity: safeNumber(i.quantity) }
          : {}),
        unit: typeof i.unit === "string" ? i.unit.trim().slice(0, 60) : "",
      };
    })
    .filter(Boolean);
  const n = asRecord(v.nutrition);
  const nutrition: Record<string, number> = {};
  for (const field of [
    "calories",
    "total_fat",
    "saturated_fat",
    "protein",
    "sodium",
    "potassium",
    "dietary_fiber",
    "cholesterol",
    "sugars",
    "total_carbohydrate",
  ] as const) {
    const val = safeNumber(n[field]);
    if (val !== undefined) nutrition[field] = val;
  }
  const p = asRecord(v.pantry_match);
  const pantry_match = Object.keys(p).length
    ? {
        matched_ingredients: Array.isArray(p.matched_ingredients)
          ? p.matched_ingredients
          : [],
        matched_count: safeNumber(p.matched_count) ?? 0,
        requested_count: safeNumber(p.requested_count) ?? 0,
        missing_ingredients: Array.isArray(p.missing_ingredients)
          ? p.missing_ingredients
          : [],
        missing_count: safeNumber(p.missing_count) ?? 0,
      }
    : undefined;
  return {
    title: v.title.trim().slice(0, 200),
    ingredients: ing,
    instructions: v.instructions
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean),
    servings:
      typeof v.servings === "string"
        ? v.servings.trim()
        : "Yield not specified",
    nutrition,
    ...(pantry_match ? { pantry_match } : {}),
    ...(typeof v.original_servings === "string"
      ? { original_servings: v.original_servings }
      : {}),
    ...(safeNumber(v.scale_factor) !== undefined
      ? { scale_factor: v.scale_factor }
      : {}),
  };
}

/** In-process short-lived response cache; quota/auth still applies to each call.
 * Use your existing Redis/DB caching if scaling to multiple Render instances. */
const cache = new Map<
  string,
  { until: number; recipes: ReturnType<typeof formatRecipe>[] }
>();
const TTL_MS = 5 * 60 * 1000;

export function createCookNowRouter({
  requirePremium,
  consumeQuota,
}: CookNowDependencies): Router {
  if (
    typeof requirePremium !== "function" ||
    typeof consumeQuota !== "function"
  )
    throw new Error(
      "Cook Now requires server Premium verification and a quota middleware.",
    );
  const router = Router();
  router.post("/search", requirePremium, consumeQuota, async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Invalid search options.",
          details: parsed.error.issues.map((x) => x.message),
        });
      return;
    }
    const query = parsed.data;
    const key = process.env.API_NINJAS_RECIPE_KEY;
    if (!key) {
      res.status(503).json({ error: "Recipe provider is not configured yet." });
      return;
    }
    const params = new URLSearchParams();
    if (query.title) params.set("title", query.title);
    if (query.ingredients?.length)
      params.set("ingredients", query.ingredients.join(","));
    if (query.servings) params.set("servings", String(query.servings));
    for (const field of filterNames)
      if (query.filters[field] !== undefined)
        params.set(field, String(query.filters[field]));
    params.set("limit", String(query.limit));
    params.set("offset", String(query.offset));
    const cacheKey = params.toString();
    const hit = cache.get(cacheKey);
    if (hit && hit.until > Date.now()) {
      const recipes = hit.recipes.filter(
        (r): r is NonNullable<typeof r> => r !== null,
      );
      res.json({
        recipes,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          count: recipes.length,
          hasMore: recipes.length === query.limit,
        },
      });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9500);
    try {
      const response = await fetch(
        `https://api.api-ninjas.com/v3/recipe?${params}`,
        {
          headers: { "X-Api-Key": key, Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        // No upstream URL, headers, key, or response body is reflected to the client.
        res
          .status(response.status === 429 ? 429 : 502)
          .json({
            error:
              response.status === 429
                ? "Recipe provider quota is temporarily exhausted."
                : "Recipe provider is temporarily unavailable.",
          });
        return;
      }
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) {
        res
          .status(502)
          .json({ error: "Recipe provider returned an invalid response." });
        return;
      }
      const recipes = raw
        .map(formatRecipe)
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (cache.size >= 200) cache.clear();
      cache.set(cacheKey, { until: Date.now() + TTL_MS, recipes });
      res.json({
        recipes,
        pagination: {
          offset: query.offset,
          limit: query.limit,
          count: recipes.length,
          hasMore: raw.length === query.limit,
        },
      });
    } catch {
      res
        .status(503)
        .json({ error: "Recipe search could not be completed. Please retry." });
    } finally {
      clearTimeout(timeout);
    }
  });
  return router;
}
