type PexelsPhoto = {
  id: number;
  url: string; // pexels photo page
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

export async function pexelsSearchPhotos(query: string) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Missing PEXELS_API_KEY");

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=1&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: key },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pexels error ${res.status}: ${text}`);
  }

  // Optional: track remaining quota from headers
  const remaining = res.headers.get("X-Ratelimit-Remaining");
  const reset = res.headers.get("X-Ratelimit-Reset");
  // console.log({ remaining, reset });

  const json = (await res.json()) as PexelsSearchResponse;
  return json.photos?.[0] ?? null;
}
