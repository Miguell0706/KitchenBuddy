import type { ParsedItem } from "./types";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function upperForChecks(line: string) {
  return normalizeLine(line).toUpperCase();
}

// ✅ hard stop trigger (once we hit this, stop parsing items)
function isTotalsStart(upper: string) {
  return (
    upper.includes("SUBTOTAL") ||
    upper === "TOTAL" ||
    upper.startsWith("TOTAL ") ||
    upper.startsWith("TAX ") ||
    upper === "TAX"
  );
}

/** ----------------------------
 * Noise reasons
 * ---------------------------*/

type NoiseReason =
  // hard-stop
  | "totals_start"
  // universal
  | "promo_math"
  | "deal_math"
  | "long_code"
  | "unit_price"
  | "produce_header"
  // semantic
  | "semantic_keyword"
  | "cashier_variant"
  | "store_header"
  | "city_state"
  | "header_like"
  // structural
  | "separator"
  | "address"
  | "qty_only"
  | "weight_price"
  | "deal_format"
  | "weight_only"
  | "internal_fee"
  | "fake_one_dot"
  | "numbers_only"
  // extra early patterns you had
  | "price_only_plain"
  | "sku_digits_letters"
  | "long_numeric_token"
  | "compact_price_suffix"
  // post-clean filters
  | "too_short"
  | "not_mostly_letters"
  | "generic_token";

type NoiseHit = { line: string; reason: NoiseReason };

function universalNoiseReason(upper: string, raw: string): NoiseReason | null {
  // Promo / percent math
  if (/%/.test(raw)) return "promo_math";
  if (/^(CP:|SAVE|YOU SAVED)/.test(upper)) return "promo_math";

  // Deal math like 2/$12.00
  if (/\b\d+\s*\/\s*\$?\d+\.\d{2}\b/.test(raw)) return "deal_math";

  // Long codes
  if (/^\d{7,}\b/.test(raw)) return "long_code";
  if (/\bPC\b/.test(upper) && /\d{6,}/.test(raw)) return "long_code";

  // Unit price math ($/LB, $/KG)
  if (/\b(LB|KG)\b/.test(upper) && /\d+\.\d{2}\s*\/\s*(LB|KG)\b/.test(upper))
    return "unit_price";
  if (/^\d+(\.\d+)?\s*(LB|KG)\b/.test(upper)) return "unit_price";

  // Produce headers (OCR damaged)
  if (/^[P0O]R?[0O]?DUCE$/.test(raw)) return "produce_header";

  return null;
}

/** Returns semantic reason if the line is store/meta/noise (not an item). */
function semanticNoiseReason(upper: string): NoiseReason | null {
  const noise = [
    "SAVE MONEY",
    "LIVE BETTER",
    "MGR:",
    "ST#",
    "OP#",
    "TR#",
    "ITEM",
    "AMEX",
    "VISA",
    "MASTERCARD",
    "CASH",
    "CHANGE",
    "PAYMENT",
    "APPROVED",
    "SIGNATURE",
    "THANK YOU",
    "TRANSACTION",
    "REF",
    "INVOICE",
    "CASHIER",
    "TERMS",
    "YOUR CASHIER",
    "LANE",
    "REGISTER",
    "THANKS",
    "SURVEY",
    "SALES",
    "TAX",
    "TOTAL",
    "SAVED",
    "CREDIT",
    "DEBIT",
    "YOU SAVED",
    "ONLY:",
    "ORDER TOTAL",
    "GRAND TOTAL",
    "SALES TAX",
    "CASHIERE",
    "CASIHIER",
    "PROMO",
  ];

  if (noise.some((k) => upper.includes(k))) return "semantic_keyword";

  // cashier OCR variants
  if (/CASHI[EIA]R/.test(upper)) return "cashier_variant";
  if (upper.includes("CASH") && upper.includes("IER")) return "cashier_variant";

  // store header line like "H-E-B"
  if (/^H[-\s]?E[-\s]?B$/.test(upper)) return "store_header";

  // city + state: "MOBILE AL", "MOBILE, AL", "MOBILE AL 36608"
  if (
    /^[A-Z][A-Z\s.'-]+,?\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)(\s+\d{5}(-\d{4})?)?$/.test(
      upper
    )
  ) {
    return "city_state";
  }

  // header-like store line: short, no digits, ends with ">" or ":"
  if (
    upper.length < 20 &&
    !/\d/.test(upper) &&
    (upper.endsWith(">") || upper.endsWith(":"))
  ) {
    return "header_like";
  }

  return null;
}

function structuralNoiseReason(upperRaw: string): NoiseReason | null {
  const s = upperRaw.trim().replace(/\s+/g, " ");

  // separators / junk lines
  if (/^\/+$/.test(s) || /^[\d\s]*\/$/.test(s) || /^\/[\d\s]*$/.test(s))
    return "separator";

  // address lines
  if (
    /^\d{2,6}\s+[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9\s.'-]+?\s+(RD|ROAD|ST|STREET|AVE|AVENUE|BLVD|DR|DRIVE|LN|LANE|HWY|HIGHWAY|PKWY|PARKWAY|WAY|CT|COURT)\.?\s*(N|S|E|W)?\b/i.test(
      s
    )
  )
    return "address";

  // quantity-only lines
  if (/^\d+\s*(EA|EA\.|ES\.|E\.)(\s+\d{1,3})?$/i.test(s)) return "qty_only";

  // weight + price formats
  if (/^\d+(\.\d+)?\s*(LB|LBS)\s*@/i.test(s)) return "weight_price";
  if (
    /^\d+(\.\d+)?\s*(LB|LBS)\s*@\s*\$?\d+(\.\d+)?\s*\/\s*(LB|LBS)\b/i.test(s)
  )
    return "weight_price";

  // deal formats
  if (/^\d+\s*@\s*\d+\s*(FOR)?\s*\$?\d+(\.\d{2})?$/i.test(s))
    return "deal_format";
  if (/^\d+\s+FOR\s+\$?\d+(\.\d{2})?$/i.test(s)) return "deal_format";
  if (/^\d+\s*\/\s*\$?\d+(\.\d{2})?$/i.test(s)) return "deal_format";

  // weight-only lines
  if (/^\d+(\.\d+)?\s*(LB|LBS)\s*$/i.test(s)) return "weight_only";
  if (/^\d+(\.\d+)?\s*(LB|LBS)\s+\d{1,3}\s*$/i.test(s)) return "weight_only";
  if (/^\d+(\.\d+)?\s*\.?\s*(LB|LBS)\.?\s*[A-Z@]*$/i.test(s))
    return "weight_only";
  if (/^\d+(\.\d+)?(LB|LBS)\.?\s*[A-Z@]*$/i.test(s)) return "weight_only";

  // internal fee tokens / misc
  if (/\b(FW|FM|PM|FML)\b/i.test(s)) return "internal_fee";

  // OCR "L.00" / "I.00" pretending to be "1.00"
  if (/^[LI]\.\d{2}$/i.test(s)) return "fake_one_dot";

  // numbers-only (prices etc)
  if (/^[\d\s.,$]+$/.test(s)) return "numbers_only";

  return null;
}

function isMostlyLetters(s: string) {
  const letters = (s.match(/[A-Z]/gi) ?? []).length;
  const digits = (s.match(/\d/g) ?? []).length;
  return letters >= 3 && letters >= digits;
}

function cleanName(line: string) {
  let s = normalizeLine(line);

  // Drop trailing single-letter flags (F/E/T/X/I etc)
  s = s.replace(/\s+[A-Z]$/i, "").trim();

  // Drop trailing SKU-ish token (must contain digits)
  s = s.replace(/\s+[A-ZÀ-ÖØ-Ý0-9]*\d[A-ZÀ-ÖØ-Ý0-9]*$/i, "").trim();

  // Drop trailing numeric chunks like "08156500 1075"
  s = s.replace(/\s+\d{3,}(\s+\d{3,})+$/i, "").trim();

  // Drop trailing long pure-digit token
  s = s.replace(/\s+\d{8,}$/i, "").trim();

  // Drop trailing small PLU (2–4 digits) when line has words
  if (/[A-ZÀ-ÖØ-Ý]/i.test(s)) {
    s = s.replace(/\s+\d{2,4}$/i, "").trim();
  }

  return s;
}

function stripKnownPrefixes(name: string) {
  let n = name.trim();
  n = n.replace(/^(PUB|PUBLIX)\s+/i, "");
  return n.trim();
}

function stripWeirdProducePrefixes(name: string) {
  let n = name.trim();

  if (/^BANANA\s+\w+/i.test(n) && !/^BANANAS?\b/i.test(n)) {
    const produceStarters = ["SHALLOTS", "PEPPERS", "ONIONS", "TOMATOES", "LIMES", "CARROTS"];
    const second = n.split(" ")[1]?.toUpperCase();
    if (second && produceStarters.includes(second)) {
      n = n.replace(/^BANANA\s+/i, "");
    }
  }

  return n;
}

const GENERIC_TOKENS = new Set(["PUB", "HEB", "CELLO", "PRODUCE", "FRESH"]);

const ABBREVIATIONS: Record<string, string> = {
  BNLS: "BONELESS",
  BRST: "BREAST",
  CHICK: "CHICKEN",
  CHCKN: "CHICKEN",
  GRD: "GROUND",
  BURG: "BURGER",
  PORK: "PORK",
  BRGER: "BURGER",
  BRGR: "BURGER",
  THN: "THIN",
  THK: "THICK",
  SML: "SMALL",
  NY: "NEW YORK",
  TOM: "TOMATO",
  PARM: "PARMESAN",
  SHRD: "SHREDDED",
  GRN: "GREEN",
  WHEAT: "WHEAT",
  PEPERCRN: "PEPPERCORN",
  VANIL: "VANILLA",
  LT: "LIGHT",
  FF: "FAT FREE",
  LS: "LOW SODIUM",
  RD: "RED",
  FT: "FAT",
  W: "WITH",
  G: "GRAIN",
  FNCY: "FANCY",
};

function expandAbbreviations(name: string) {
  return name
    .toUpperCase()
    .split(/\s+/)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(" ");
}

function normalizeSpacing(name: string) {
  return name
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Centralized “why did we drop this line?” */
function noiseReasonForLine(raw: string): NoiseReason | null {
  const upperRaw = raw.toUpperCase();
  const upper = upperForChecks(raw);

  // --- early patterns you had ---
  if (/^\d+\.\d{2}$/.test(upperRaw)) return "price_only_plain";
  if (/^\d{6,}[A-Z]{1,4}$/.test(upperRaw)) return "sku_digits_letters";
  if (/^\d{8,}[A-Z0-9]*$/.test(upperRaw)) return "long_numeric_token";

  // NEW Layer order: Universal → Semantic → Structural
  return (
    universalNoiseReason(upper, upperRaw) ??
    semanticNoiseReason(upper) ??
    structuralNoiseReason(upperRaw)
  );
}

// Optional: debug flag so you can toggle logs
export function parseReceiptNamesOnly(rawText: string, debug = false): ParsedItem[] {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  const items: ParsedItem[] = [];
  const rejected: NoiseHit[] = [];

  if (debug) {
    console.log(
      `Parsing ${lines.length} lines:\n` + lines.map((l, i) => `${i}: ${l}`).join("\n")
    );
  }

  for (const line of lines) {
    const raw = normalizeLine(line);
    const upper = upperForChecks(raw);

    // hard stop
    if (isTotalsStart(upper)) {
      if (debug) rejected.push({ line, reason: "totals_start" });
      break;
    }

    const reason = noiseReasonForLine(raw);
    if (reason) {
      if (debug) rejected.push({ line, reason });
      continue;
    }

    // LAYER 2 (your compact edge case)
    const upperRaw = raw.toUpperCase();
    const compact = upperRaw.replace(/\s+/g, "");
    if (/^\d+\.\d{2}[A-Z0-9]$/.test(compact)) {
      if (debug) rejected.push({ line, reason: "compact_price_suffix" });
      continue;
    }

    // --- Clean name ---
    let name = cleanName(line);
    name = stripKnownPrefixes(name);
    name = stripWeirdProducePrefixes(name);
    name = expandAbbreviations(name);
    name = normalizeSpacing(name);

    if (name.length < 3) {
      if (debug) rejected.push({ line, reason: "too_short" });
      continue;
    }

    const nameUpper = name.toUpperCase().replace(/0/g, "O");
    if (!isMostlyLetters(nameUpper)) {
      if (debug) rejected.push({ line, reason: "not_mostly_letters" });
      continue;
    }
    if (GENERIC_TOKENS.has(nameUpper)) {
      if (debug) rejected.push({ line, reason: "generic_token" });
      continue;
    }

    items.push({ id: uid(), name, sourceLine: line, selected: true });
  }

  // De-dupe
  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    const key = it.name.toUpperCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (debug) {
    console.log(
      "Rejected lines:\n" +
        rejected.map((r) => `- [${r.reason}] ${r.line}`).join("\n")
    );
    console.log(
      `Kept ${deduped.length} items:\n` + deduped.map((it) => `- ${it.name}`).join("\n")
    );
  }

  return deduped;
}
