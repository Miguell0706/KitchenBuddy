import { normalizeLines } from "./normalize";
import { isBadLine } from "./badLine"; // ✅ add back
import { cleanName } from "./cleanName";

export type ParsedItem = {
  id: string;
  name: string;
  sourceLine: string;
  selected: boolean;
  excluded?: boolean;
};

export type ParseQuality = "good" | "ok" | "bad";

export type ParseReport = {
  quality: ParseQuality;
  message?: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function dedupeExact(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const key = line.toUpperCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  return out;
}

export function parseReceiptNamesOnlyWithReport(
  rawText: string,
  debug = false
): { items: ParsedItem[]; report: ParseReport } {
  const lines = normalizeLines(rawText);

  if (debug) {
    for (let i = 0; i < lines.length; i++) {
      console.log(i + ":", lines[i]);
    }
  }

  const kept: string[] = [];
  const rejected: { line: string; reason: "badline" }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toUpperCase().includes("SUBTOTAL") || line.toUpperCase().startsWith("TOTAL")) {
      break;
    }

    const bad = isBadLine(line);

    console.log(bad ? "❌ BAD" : "✅ OK", `[${i}]`, line);
    

    if (bad) rejected.push({ line, reason: "badline" });
    else kept.push(line);
  }


  const keptDeduped = dedupeExact(kept);

  const items: ParsedItem[] = keptDeduped.map((line) => ({
    id: uid(),
    name: line,
    sourceLine: line,
    selected: true,
  }));
  console.log("cleaning good items===================================xxxxxxxxxxxxxx")
  for (const item of items) {
    item.name = cleanName(item.name);
  }

  console.log("🧾 FINAL ITEMS:");
  items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.name}`);
  });
  const quality: ParseQuality =
    items.length < 3 ? "bad" : items.length < 8 ? "ok" : "good";

  return {
    items,
    report: {
      quality,
      message:
        quality === "bad"
          ? "Very few item-like lines detected."
          : quality === "ok"
          ? "Some items detected, but scan may be incomplete."
          : undefined,
    },
  };
}
