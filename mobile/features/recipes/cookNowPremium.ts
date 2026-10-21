import type { CategoryKey, PantryItem } from "@/features/pantry/types";
/** Local expiry calendar calculation, used only for sorting suggestions. */
export function daysUntilExpiry(
  raw: unknown,
  today = new Date(),
): number | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(raw);
  if (!match) return null;
  const y = +match[1],
    m = +match[2],
    d = +match[3];
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return null;
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  );
}

export type PantryData = Record<CategoryKey, PantryItem[]>;
export type PantryCandidate = {
  id: string;
  name: string;
  daysLeft: number | null;
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function singular(value: string): string {
  if (value.endsWith("ies") && value.length > 4)
    return `${value.slice(0, -3)}y`;
  if (value.endsWith("oes") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 3)
    return value.slice(0, -1);
  return value;
}

/** A suggestion is not a guarantee about freshness, identity, or available quantity. */
export function pantryCandidates(
  pantry: PantryData,
  now = new Date(),
): PantryCandidate[] {
  const seen = new Set<string>();
  const output: PantryCandidate[] = [];
  for (const item of Object.values(pantry).flat()) {
    if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
    const daysLeft = daysUntilExpiry(item.expiryDate, now);
    if (daysLeft !== null && daysLeft < 0) continue;
    const name = String(item.recipeSearchName || item.name).trim();
    const key = normalize(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({ id: item.id, name, daysLeft });
  }
  return output.sort(
    (a, b) =>
      (a.daysLeft === null ? Number.MAX_SAFE_INTEGER : a.daysLeft) -
        (b.daysLeft === null ? Number.MAX_SAFE_INTEGER : b.daysLeft) ||
      a.name.localeCompare(b.name),
  );
}

/** Conservative name hint only: never treats a Pantry name as evidence of sufficient quantity. */
export function likelyInPantry(
  ingredientName: string,
  candidates: readonly PantryCandidate[],
): boolean {
  const primary = ingredientName
    .split(";")[0]
    .replace(/^\s*\d+(?:[./]\d+)?\s*(?:oz|g|kg|lb|cup|cups|can|cans)?\s*/i, "");
  const wanted = normalize(primary);
  if (!wanted) return false;
  return candidates.some((candidate) => {
    const actual = normalize(candidate.name);
    if (!actual) return false;
    const a = singular(actual),
      w = singular(wanted);
    return (
      a === w || ` ${a} `.includes(` ${w} `) || ` ${w} `.includes(` ${a} `)
    );
  });
}

export function getInitialIngredientIds(
  candidates: readonly PantryCandidate[],
): string[] {
  return candidates.slice(0, 5).map((candidate) => candidate.id);
}
