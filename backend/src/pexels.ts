/**
 * Pexels photo search. Returns a single best metadata match from 5 photos.
 * All users of this helper share one PostgreSQL-backed Pexels budget.
 * Existing return type and ranking behavior are preserved.
 */
import { reservePexelsUpstreamCall } from "./lib/pexelsUsage.js";

type PexelsPhoto = {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  avg_color: string;
  src: {
    tiny: string;
    small: string;
    medium: string;
    large: string;
    large2x: string;
    portrait: string;
    landscape: string;
    original: string;
  };
  alt?: string;
};

type PexelsSearchResponse = { photos: PexelsPhoto[]; total_results: number };

const SEARCH_FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "with",
  "in",
  "on",
  "at",
  "for",
  "to",
  "food",
  "dish",
  "photo",
  "image",
  "ingredient",
  "ingredients",
  "fresh",
  "raw",
  "delicious",
  "homemade",
  "closeup",
]);
const IRREGULAR_PLURALS: Record<string, string> = {
  berries: "berry",
  cherries: "cherry",
  tomatoes: "tomato",
  potatoes: "potato",
  leaves: "leaf",
};
function singularize(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (
    word.length > 3 &&
    word.endsWith("s") &&
    !word.endsWith("ss") &&
    !word.endsWith("us") &&
    !word.endsWith("is")
  )
    return word.slice(0, -1);
  return word;
}
function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)
    .filter((word) => !SEARCH_FILLER_WORDS.has(word));
}
const PREPARED_FOOD_WORDS = new Set([
  "breakfast",
  "dinner",
  "lunch",
  "meal",
  "toast",
  "sandwich",
  "burger",
  "pizza",
  "pasta",
  "soup",
  "salad",
  "cake",
  "cupcake",
  "cookie",
  "pie",
  "dessert",
  "bread",
  "pancake",
  "smoothie",
]);
function relevanceScore(
  photo: PexelsPhoto,
  targetWords: string[],
  isRecipeSearch: boolean,
  position: number,
): number {
  const descriptionWords = words(photo.alt ?? "");
  const description = new Set(descriptionWords);
  const target = [...new Set(targetWords)];
  if (!target.length || !descriptionWords.length) return -position * 3;
  const matched = target.filter((word) => description.has(word)).length;
  if (!matched) return -position * 3;
  let score = matched * 22 + Math.round((matched / target.length) * 45);
  if (matched === target.length) score += 12;
  const phrase = target.join(" ");
  const descriptionPhrase = ` ${descriptionWords.join(" ")} `;
  if (descriptionPhrase.includes(` ${phrase} `)) score += 28;
  if (descriptionWords.slice(0, target.length).join(" ") === phrase)
    score += 10;
  if (!isRecipeSearch && target.length <= 2) {
    const preparedDishNotRequested = descriptionWords.some(
      (word) => PREPARED_FOOD_WORDS.has(word) && !target.includes(word),
    );
    if (preparedDishNotRequested) score -= 20;
  }
  return score - position * 3;
}

// Prevent in-process stampedes for identical query strings. Across instances,
// the PostgreSQL reservation still enforces the global request safety cap.
const inFlight = new Map<string, Promise<PexelsPhoto | null>>();

// Bound concurrency without an unbounded queue. This is per Render process;
// the shared PostgreSQL budget is the cross-process protection.
const MAX_CONCURRENT = 4;
const MAX_WAITING = 12;
let active = 0;
const waiting: Array<() => void> = [];

async function withPexelsSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active < MAX_CONCURRENT) {
    active += 1;
  } else {
    if (waiting.length >= MAX_WAITING) throw new Error("PEXELS_BUSY");
    // The releasing task transfers its reserved slot to this waiter.
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next)
      next(); // Transfer slot; active stays unchanged.
    else active -= 1;
  }
}

// Provider-side quota can differ from our conservative calendar windows.
// This local cooldown reduces repeat 429s on a single instance.
let providerBlockedUntil = 0;
let providerResetAt = 0;

function observeQuotaHeaders(response: Response): void {
  const remainingRaw = response.headers.get("x-ratelimit-remaining");
  const resetRaw = response.headers.get("x-ratelimit-reset");
  const remaining = remainingRaw === null ? NaN : Number(remainingRaw);
  const resetSeconds = resetRaw === null ? NaN : Number(resetRaw);
  if (Number.isFinite(resetSeconds) && resetSeconds > Date.now() / 1000) {
    providerResetAt = resetSeconds * 1000;
  }
  if (Number.isFinite(remaining) && remaining <= 0) {
    providerBlockedUntil =
      providerResetAt > Date.now()
        ? providerResetAt
        : Date.now() + 60 * 60 * 1000;
  }
}

async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Missing PEXELS_API_KEY");
  if (Date.now() < providerBlockedUntil) return null;

  // Serialize concurrency in this process, then atomically reserve budget in
  // PostgreSQL just before the outbound network call.
  return withPexelsSlot(async () => {
    if (Date.now() < providerBlockedUntil) return null;
    const quota = await reservePexelsUpstreamCall();
    if (!quota.allowed) {
      console.warn(
        "Pexels local budget exhausted:",
        quota.reason,
        quota.resetAt,
      );
      return null;
    }

    const url =
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
      "&per_page=5&orientation=landscape";
    const response = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 429) {
      // 429 may not contain quota reset headers; keep last valid 200 response.
      providerBlockedUntil =
        providerResetAt > Date.now()
          ? providerResetAt
          : Date.now() + 60 * 60 * 1000;
      console.warn("Pexels provider returned HTTP 429; image lookup skipped.");
      return null;
    }
    if (!response.ok) {
      throw new Error(`Pexels provider returned HTTP ${response.status}`);
    }
    observeQuotaHeaders(response);

    const json: unknown = await response.json();
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as PexelsSearchResponse).photos)
    ) {
      throw new Error("Pexels provider returned invalid response");
    }
    const photos = (json as PexelsSearchResponse).photos.filter(
      (item): item is PexelsPhoto =>
        typeof item === "object" &&
        item !== null &&
        typeof item.src?.medium === "string" &&
        item.src.medium.startsWith("https://") &&
        typeof item.url === "string",
    );
    if (!photos.length) return null;

    const targetWords = words(query);
    const isRecipeSearch = /\bfood\s+dish\b/i.test(query);
    let bestPhoto = photos[0];
    let bestScore = relevanceScore(bestPhoto, targetWords, isRecipeSearch, 0);
    for (let index = 1; index < photos.length; index += 1) {
      const score = relevanceScore(
        photos[index],
        targetWords,
        isRecipeSearch,
        index,
      );
      if (score > bestScore) {
        bestPhoto = photos[index];
        bestScore = score;
      }
    }
    return bestPhoto;
  });
}

export async function pexelsSearchPhotos(
  query: string,
): Promise<PexelsPhoto | null> {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 120) return null;
  const key = normalized.toLowerCase();
  const current = inFlight.get(key);
  if (current) return current;

  const work = searchPexels(normalized);
  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    if (inFlight.get(key) === work) inFlight.delete(key);
  }
}
