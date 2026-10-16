/**
 * Pexels photo search.
 * Requests five landscape candidates, then returns ONE best metadata match.
 * The return type is unchanged, so existing recipe/ingredient callers still work.
 */
type PexelsPhoto = {
  id: number;
  url: string; // Pexels photo page
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

type PexelsSearchResponse = {
  photos: PexelsPhoto[];
  total_results: number;
};

// Words that describe search context, rather than identify the actual food.
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

// A small amount of singularization lets "strawberries" match "strawberry".
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
  ) {
    return word.slice(0, -1);
  }
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

  // When descriptions are absent or irrelevant, retain Pexels' own ranking.
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

  // Only for simple ingredient lookups. Recipe searches deliberately contain
  // "food dish" and should NOT be penalized for showing prepared meals.
  if (!isRecipeSearch && target.length <= 2) {
    const preparedDishNotRequested = descriptionWords.some(
      (word) => PREPARED_FOOD_WORDS.has(word) && !target.includes(word),
    );
    if (preparedDishNotRequested) score -= 20;
  }

  // Use original Pexels ordering as a modest tie-breaker.
  return score - position * 3;
}

export async function pexelsSearchPhotos(
  query: string,
): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Missing PEXELS_API_KEY");

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=5&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: key },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pexels error ${res.status}: ${text}`);
  }

  // Optional quota headers, useful if you later want to log remaining requests:
  // res.headers.get("X-Ratelimit-Remaining");
  // res.headers.get("X-Ratelimit-Reset");

  const json = (await res.json()) as PexelsSearchResponse;
  const photos = Array.isArray(json.photos) ? json.photos : [];
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
}
