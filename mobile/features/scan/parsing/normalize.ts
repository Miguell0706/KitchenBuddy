export function normalizeLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
