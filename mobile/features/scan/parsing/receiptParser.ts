import type { ParsedItem } from "./types";

/** ---------------------------------
 * Utilities
 * --------------------------------- */

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function upperForChecks(line: string) {
  return normalizeLine(line).toUpperCase();
}

/** ✅ hard stop trigger (once we hit this, stop parsing items) */
function isTotalsStart(upper: string) {
  return (
    upper.includes("SUBTOTAL") ||
    upper === "TOTAL" ||
    upper.startsWith("TOTAL ") ||
    upper.includes("BALANCE DUE") ||
    upper.includes("AMOUNT DUE")
    // remove TAX here — TAX alone is not a hard stop
  );
}


/** ---------------------------------
 * Scan Quality
 * --------------------------------- */

type ScanQuality = "good" | "ok" | "bad";

type ScanQualityReport = {
  quality: ScanQuality;
  totalLines: number;
  keptItems: number;
  rejectedLines: number;
  keptRatio: number; // keptItems / totalLines
  reasonsCount: Record<string, number>;
  message?: string;
};

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
  | "address_line"
  | "header_like"
  | "payment_keyword"
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
  | "at_price_line"
  // post-clean filters
  | "too_short"
  | "not_mostly_letters"
  | "generic_token"
  | "header_kill_zone"
  | "fails_semantic_shape"
  | "fragment"
  | "gibberish_name";

type NoiseHit = {
  line: string;
  reason: NoiseReason;
  details?: string;
  score?: number; // e.g. gibberish score
};

function countReasons(rejected: NoiseHit[]) {
  const out: Record<string, number> = {};
  for (const r of rejected) {
    // totals_start is a hard stop, not noise
    if (r.reason === "totals_start") continue;
    out[r.reason] = (out[r.reason] ?? 0) + 1;
  }
  return out;
}

function scoreScanQuality(
  totalLines: number,
  keptItems: number,
  rejected: NoiseHit[]
): ScanQualityReport {
  const rejectedLines = rejected.length;
  const keptRatio = totalLines > 0 ? keptItems / totalLines : 0;

  const reasonsCount = countReasons(rejected);

  const numbersOnly = reasonsCount["numbers_only"] ?? 0;
  const longCode = reasonsCount["long_code"] ?? 0;

  const promoMath = reasonsCount["promo_math"] ?? 0;
  const dealMath = reasonsCount["deal_math"] ?? 0;
  const unitPrice = reasonsCount["unit_price"] ?? 0;

  const normalReceiptNoise = promoMath + dealMath + unitPrice;
  const failureNoise = numbersOnly + longCode;

  let score = 0;

  if (keptItems <= 2) score += 6;
  else if (keptItems <= 3) score += 4;
  else if (keptItems <= 5) score += 2;

  if (keptRatio < 0.20) score += 5;
  else if (keptRatio < 0.28) score += 3;
  else if (keptRatio < 0.35) score += 2;

  if (numbersOnly >= 6) score += 5;
  else if (numbersOnly >= 4) score += 4;
  else if (numbersOnly >= 2) score += 2;

  if (longCode >= 4) score += 4;
  else if (longCode >= 2) score += 2;

  const rejectedRatio = totalLines > 0 ? rejectedLines / totalLines : 0;
  if (rejectedRatio >= 0.80) score += 4;
  else if (rejectedRatio >= 0.70) score += 3;
  else if (rejectedRatio >= 0.60) score += 2;

  if (normalReceiptNoise >= 8 && keptItems <= 5) score += 2;
  if (failureNoise >= 6 && keptItems <= 6) score += 3;

  const quality: ScanQuality =
    score >= 8 ? "bad" : score >= 4 ? "ok" : "good";

  const message =
    quality === "bad"
      ? "This scan looks hard to read (cropped/overlapping/low contrast). Try retaking the photo or cropping to a single receipt."
      : quality === "ok"
        ? "This scan is a bit noisy. You may want to crop/retake for better accuracy."
        : undefined;

  return {
    quality,
    totalLines,
    keptItems,
    rejectedLines,
    keptRatio,
    reasonsCount,
    message,
  };
}

/** ---------------------------------
 * Noise detection (your logic, unchanged)
 * --------------------------------- */

const LBX = "(LB|LBS|1B|IB|L8)";
const KGX = "(KG|K6)";
function isItemishLine(upper: string) {
  // at least 1 wordy token AND a long digit run
  return /[A-Z]{3,}/.test(upper) && /\d{7,}/.test(upper);
}

function universalNoiseReason(upper: string, raw: string): NoiseReason | null {
  const s = raw.toUpperCase().trim().replace(/\s+/g, " ");

  // ✅ keep item + UPC lines (word(s) + long digit-run)
  if (isItemishLine(upper)) return null;

  if (/%/.test(raw)) return "promo_math";
  if (/^(CP:|SAVE|YOU SAVED)/.test(upper)) return "promo_math";

  if (/\b\d+\s*\/\s*\$?\d+\.\d{2}\b/.test(raw)) return "deal_math";

  // reject only if the line is basically digits
  if (/^\d{10,14}$/.test(s.replace(/\s+/g, ""))) return "long_code";

  // mixed long code-ish tokens (BUT don't apply to item+UPC lines)
  if (!isItemishLine(upper) && /\b[A-Z0-9]{8,}\b/.test(upper)) {
    const tokens = upper.match(/\b[A-Z0-9]{8,}\b/g) ?? [];
    for (const t of tokens) {
      const digits = (t.match(/\d/g) ?? []).length;
      if (digits / t.length >= 0.6) return "long_code";
    }
  }

  if (/\bPC\b/.test(upper) && /\d{6,}/.test(raw)) return "long_code";

  if (
    new RegExp(`\\b(${LBX}|${KGX})\\b`).test(upper) &&
    new RegExp(`\\d+\\.\\d{2}\\s*\\/\\s*(${LBX}|${KGX})\\b`).test(upper)
  ) {
    return "unit_price";
  }
    // OCR unit math like "1 1b /0.58" or "1 lb / 0.58"
  if (new RegExp(`\\b\\d+\\s*${LBX}\\s*\\/\\s*\\$?\\d+(\\.\\d{2})?\\b`, "i").test(s)) {
    return "unit_price";
  }

  if (new RegExp(`^\\d+(\\.\\d+)?\\s*(${LBX}|${KGX})\\b`).test(upper)) {
    return "unit_price";
  }

  if (/^[P0O]R?[0O]?DUCE$/.test(raw)) return "produce_header";

  return null;
}

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
    "STORE CONTACT",
    "STORE PHONE",
    "STORE HOURS",
    "MANAGER",
    "CONTACT:",
    "PHONE:",
    "BALANCE",
    "PURCHASE",
    "PRICE",
    "SAVINGS",
    "SAV INGS",
    "SAVI NGS",

  ];
  const norm = upper.replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ");
  // Survey / feedback OCR junk (SURVEY, SURYEY, FEEDBACK, FOODBACK)
  if (
    /(SURV|SURY|SVRY)/.test(norm) ||
    /(FEED|FOOD)\s*BACK/.test(norm)
  ) {
    return "semantic_keyword";
  }
  // PAY FROM PRIMARY (OCR tolerant)
  if (norm.includes("PAY FROM PRIMARY")) return "payment_keyword";
  // WALMART OCR variants (WAL MAE, WAL MAT, WAL MRT, etc)
  if (/WAL\s*M[AEIO]?[RT]?/.test(norm)) {
    return "store_header";
  }

  if (
    /^(FOOD CITY|WALMART|TARGET|SAFEWAY|FRY'?S|KROGER|COSTCO|WHOLE FOODS)\b/.test(
      upper
    )
  )
    return "store_header";
  if (/(H\s*I\s*G\s*H\s*W|H\s*W\s*Y)/.test(norm)) return "address_line";

  if (upper.includes("STORE CONTACT")) return "store_header";

  if (/^MNC\b/.test(upper)) return "semantic_keyword";
  if (noise.some((k) => upper.includes(k))) return "semantic_keyword";

  if (/CASHI[EIA]R/.test(upper)) return "cashier_variant";
  if (upper.includes("CASH") && upper.includes("IER")) return "cashier_variant";

  if (/^H[-\s]?E[-\s]?B$/.test(upper)) return "store_header";

  if (
    /^[A-Z][A-Z\s.'-]+,?\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)(\s+\d{5}(-\d{4})?)?(\s+[A-Z]?\d{4,6})?$/.test(
      upper
    )
  )
    return "city_state";
  // Address-ish: contains common street words OR looks like a road name
  if (/\b(HWY|HIGHWAY|RD|ROAD|ST|STREET|AVE|AVENUE|BLVD|DR|LANE|LN|PKWY)\b/.test(upper)) {
    return "address_line";
  }
  
  if (  
    upper.length < 20 &&
    !/\d/.test(upper) &&
    (upper.endsWith(">") || upper.endsWith(":"))
  )
    return "header_like";
  if (/^[A-Z][A-Z\s]+:\s+[A-Z]/.test(upper)) return "header_like";

  return null;
}

function structuralNoiseReason(upperRaw: string): NoiseReason | null {
  const s = upperRaw.trim().replace(/\s+/g, " ");

  // ✅ detect weight/meta FIRST
  if (/^\d+\.\d{2,3}\s+[A-Z]{1,3}\b/.test(s) && /\b\d{11,14}\b/.test(s)) {
    return "weight_price";
  }

  if (new RegExp(`^\\d+(\\.\\d+)?\\s*${LBX}\\s*@`, "i").test(s)) {
    return "weight_price";
  }

  // ✅ weight only lines like "1.02 lb"
  if (new RegExp(`^\\d+(\\.\\d+)?\\s*${LBX}\\b`, "i").test(s)) {
    return "weight_only";
  }

  // ✅ only after meta detection, “protect” itemish lines
  if (/\d{7,}/.test(s) && /[A-Z]{3,}/.test(s)) return null;

  if (/^\/+$/.test(s) || /^[\d\s]*\/$/.test(s) || /^\/[\d\s]*$/.test(s))
    return "separator";

  if (/^\d{2,6}\s+[NESW]\.?\s+[A-Z][A-Z\s.'-]{3,}$/i.test(s)) return "address";

  if (
    /^\d{2,6}\s+[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9\s.'-]+?\s+(RD|ROAD|ST|STREET|AVE|AVENUE|BLVD|DR|DRIVE|LN|LANE|HWY|HIGHWAY|PKWY|PARKWAY|WAY|CT|COURT)\.?\s*(N|S|E|W)?\b/i.test(s)
  )
    return "address";

  if (/^\d+\s*(EA|EA\.|ES\.|E\.)(\s+\d{1,3})?$/i.test(s)) return "qty_only";

  if (
    new RegExp(
      `^\\d+(\\.\\d+)?\\s*${LBX}\\s*@\\s*\\$?\\d+(\\.\\d+)?\\s*\\/\\s*${LBX}\\b`,
      "i"
    ).test(s)
  )
    return "weight_price";

  if (new RegExp(`^\\d+(\\.\\d+)?\\s*\\.?\\s*${LBX}\\s*@`, "i").test(s))
    return "weight_price";

  if (/^\d+\s*@\s*\d+\s*(FOR)?\s*\$?\d+(\.\d{2})?$/i.test(s)) return "deal_format";
  if (/^\d+\s+FOR\s+\$?\d+(\.\d{2})?$/i.test(s)) return "deal_format";
  if (/^\d+\s*\/\s*\$?\d+(\.\d{2})?$/i.test(s)) return "deal_format";

  if (/\b(FW|FM|PM|FML)\b/i.test(s)) return "internal_fee";
  if (/^[LI]\.\d{2}$/i.test(s)) return "fake_one_dot";
  if (/^[\d\s.,$]+$/.test(s)) return "numbers_only";

  return null;
}


/** Centralized “why did we drop this line?” */
function noiseReasonForLine(raw: string): NoiseReason | null {
  const upperRaw = raw.toUpperCase();
  const upper = upperForChecks(raw);
  const compact = upperRaw.replace(/\s+/g, "");

  // 1) "continuation" lines
  if (/^@\s*/.test(raw)) return "at_price_line";

  // 2) absolute code-only rejects (safe early)
  if (/^\d{10,14}$/.test(compact)) return "long_code";              // UPC-only
  if (/^\d{8,}[A-Z0-9]*$/.test(compact)) return "long_numeric_token"; // code-only
  if (/^\d{6,}[A-Z]{1,4}$/.test(upperRaw)) return "sku_digits_letters";

  // b/5, b71 header garbage
  if (/^B\/?\d{1,3}\b/.test(upperRaw)) return "header_like";

  // phone-ish
  if (
    /\b\d{3}[-\s]?\d{4}\b/.test(raw) ||
    /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/.test(raw)
  ) {
    return "address_line"; // or "phone"
  }

  // 3) universal + semantic
  const universal = universalNoiseReason(upper, raw);
  if (universal) return universal;

  const semantic = semanticNoiseReason(upper);
  if (semantic) return semantic;

  // 4) structural (IMPORTANT: meta survives)
  const structural = structuralNoiseReason(upperRaw);

  // if it's meta, return it so groupCandidates can attach it
  if (
    structural === "weight_price" ||
    structural === "weight_only" ||
    structural === "qty_only" ||
    structural === "unit_price"
  ) {
    return structural;
  }

  // if it's other structural noise, reject it
  if (structural) return structural;

  // 5) fallback numeric-only checks (LAST)
  // don’t kill weight-ish lines here
  if (/^\d+\.\d{2}$/.test(compact)) return "price_only_plain";

  if (/^[\d\s.,$]+$/.test(raw.trim())) {
    return "numbers_only";
  }

  return null;
}



/** ---------------------------------
 * Header kill zone (simplified + safer)
 * --------------------------------- */

function isHeaderKillZone(i: number, upper: string) {
  if (i > 25) return false;

  // super early junk / store header area
  if (
    /WALMART|WAL[-\s]?MART/.test(upper) ||
    /FEEDB|FEE?DBACK|SURV(EY|E?Y)|TELL\s*US|RATE\s*US/.test(upper) ||
    /(THANK|IHANK|HANK)\b/.test(upper) ||
    /\bID\b/.test(upper) ||
    /\b(OP#|TR#|ST#|TC#|TE#)\b/.test(upper) ||
    /\b\d{3}-\d{3}-\d{4}\b/.test(upper)
  )
    return true;

  // early all-caps single token lines (often headers)
  if (i <= 18 && /^[A-Z]{3,}$/.test(upper) && !upper.includes(" "))
    return true;

  // early city/state line
  if (
    /^[A-Z][A-Z\s.'-]+,?\s+(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)(\s+\d{5}(-\d{4})?)?$/.test(
      upper
    )
  )
    return true;

  return false;
}

/** ---------------------------------
 * Normalization + semantic shape checks (your logic)
 * --------------------------------- */

function stripLeadingIndexOrQty(s: string) {
  return s.replace(/^\s*\d{1,3}\s+/, "");
}

function isMostlyLetters(s: string) {
  const letters = (s.match(/[A-Z]/gi) ?? []).length;
  const digits = (s.match(/\d/g) ?? []).length;
  return letters >= 3 && letters >= digits;
}

function cleanName(line: string) {
  let s = normalizeLine(line);

  s = s.replace(/\s+[A-Z]$/i, "").trim();
  s = s.replace(/([A-Z]{3,})(\d{2,})\b/g, "$1"); // THYME2502 -> THYME
// remove trailing UPC-ish token (10–14 digits, sometimes OCR O instead of 0) + optional letter flag
  s = s.replace(/\s+[0-9O]{10,14}[A-Z]{0,2}$/i, "").trim();
  s = s.replace(/\s+\d{3,}(\s+\d{3,})+$/i, "").trim();
  s = s.replace(/\s+\d{8,}$/i, "").trim();

  if (/[A-ZÀ-ÖØ-Ý]/i.test(s)) {
    s = s.replace(/\s+\d{2,4}$/i, "").trim();
  }

  return s;
}

function stripKnownPrefixes(name: string) {
  let n = name.trim();
  n = n.replace(/^(PUB|PUBLIX|WEGF?|WB|SD|MC|LA|EK)\s+/i, "");
  // do NOT strip GV here
  return n.trim();
}

function stripWeirdProducePrefixes(name: string) {
  let n = name.trim();

  if (/^BANANA\s+\w+/i.test(n) && !/^BANANAS?\b/i.test(n)) {
    const produceStarters = [
      "SHALLOTS",
      "PEPPERS",
      "ONIONS",
      "TOMATOES",
      "LIMES",
      "CARROTS",
    ];
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

function looksLikeRealItemName(name: string) {
  const tokens = name.split(/\s+/).filter(Boolean);
  const alphaTokens = tokens.filter((t) => /[A-Z]/i.test(t));
  const longWordCount = tokens.filter((t) => /^[A-Z]{5,}$/i.test(t)).length;

  if (alphaTokens.length >= 2) return true;
  if (longWordCount >= 1) return true;

  return false;
}

function isFragmenty(nameUpper: string) {
  const toks = nameUpper.split(/\s+/).filter(Boolean);

  // ✅ allow common single-word items
  if (toks.length === 1 && toks[0].length >= 6) return false;

  // ✅ allow 2-token items if at least one token is 4+ letters
  if (toks.length === 2) {
    if (toks.some(t => /^[A-Z]{4,}$/.test(t))) return false;
  }

  // old rule was too aggressive:
  // if (toks.length <= 2 && toks.join("").length <= 8) return true;

  // keep the rest of your logic
  if (toks[0] === "GV" && toks.length === 1) return true;
  if (toks[0] === "NS" && toks.length <= 3) return true;

  const digitTokens = toks.filter(t => /^\d{1,4}$/.test(t)).length;
  const alphaTokens = toks.filter(t => /[A-Z]/.test(t)).length;
  if (digitTokens >= 2 && alphaTokens <= 1) return true;

  return false;
}


function stripWeakLeadingToken(name: string) {
  const parts = name.split(" ");
  if (parts.length >= 3 && parts[0].length <= 2 && /^[A-Z]+$/.test(parts[0])) {
    return parts.slice(1).join(" ");
  }
  return name;
}

/** ---------------------------------
 * NEW: Pipeline stages
 * --------------------------------- */

type SegmentedLine =
  | { kind: "candidate"; index: number; raw: string; upper: string }
  | { kind: "rejected"; index: number; raw: string; reason: NoiseReason }
  | { kind: "stop"; index: number; raw: string; reason: "totals_start" };

type Candidate = {
  startIndex: number;
  lines: string[];        // grouped raw lines
  upperJoined: string;    // cached
};

function segmentLines(rawText: string): { totalLines: number; segmented: SegmentedLine[] } {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const segmented: SegmentedLine[] = [];
  let headerOver = false;

  for (const [i, line] of lines.entries()) {
    const raw = normalizeLine(line);
    const upper = upperForChecks(raw);

    if (/\b(ST#|OP#|TR#|TERM|TEM|REG)\b/.test(upper)) headerOver = true;

    if (!headerOver && isHeaderKillZone(i, upper)) {
      segmented.push({ kind: "rejected", index: i, raw, reason: "header_kill_zone" });
      continue;
    }

    if (isTotalsStart(upper)) {
      console.log("🛑 totalsStart detected:", raw);
      segmented.push({ kind: "stop", index: i, raw, reason: "totals_start" });
      break; // or continue + inTotals skip, but break is cleaner
    }

    const reason = noiseReasonForLine(raw);

    if (
      reason === "weight_price" ||
      reason === "weight_only" ||
      reason === "qty_only" ||
      reason === "unit_price"
    ) {
      segmented.push({ kind: "candidate", index: i, raw, upper });
      continue;
    }

    if (reason) {
      segmented.push({ kind: "rejected", index: i, raw, reason });
      continue;
    }


    // compact weird price suffix "12.34A"
    const compact = raw.toUpperCase().replace(/\s+/g, "");
    if (/^\d+\.\d{2}[A-Z0-9]$/.test(compact)) {
      segmented.push({ kind: "rejected", index: i, raw, reason: "compact_price_suffix" });
      continue;
    }

    segmented.push({ kind: "candidate", index: i, raw, upper });
  }

  return { totalLines: lines.length, segmented };
}


/**
 * NEW: Group “meta lines” (weights/qty/etc) into previous candidate
 * so you stop fighting “ONIONS” + “1.24 lb @ …” as separate.
 *
 * We only group when the line LOOKS like a meta line.
 */
function isMetaLineForPrevious(raw: string): boolean {
  const upperRaw = raw.toUpperCase();
  const structural = structuralNoiseReason(upperRaw);
  // These are the ones that almost always belong to previous item
  return structural === "weight_price" || structural === "weight_only" || structural === "qty_only";
}

function groupCandidates(segmented: SegmentedLine[]): {
  candidates: Candidate[];
  rejected: NoiseHit[];
} {
  const candidates: Candidate[] = [];
  const rejected: NoiseHit[] = [];

  for (const entry of segmented) {
    if (entry.kind === "rejected") {
      rejected.push({ line: entry.raw, reason: entry.reason });
      continue;
    }
    if (entry.kind === "stop") {
      rejected.push({ line: entry.raw, reason: entry.reason });
      break;
    }

    // entry.kind === "candidate"
    const raw = entry.raw;

    // If this candidate line is actually a “meta line”, attach to previous
    if (isMetaLineForPrevious(raw) && candidates.length > 0) {
      candidates[candidates.length - 1].lines.push(raw);
      candidates[candidates.length - 1].upperJoined =
        candidates[candidates.length - 1].lines.map(upperForChecks).join(" | ");
      continue;
    }

    candidates.push({
      startIndex: entry.index,
      lines: [raw],
      upperJoined: upperForChecks(raw),
    });
  }

  return { candidates, rejected };
}

/**
 * NEW: Normalize one grouped candidate into an item or a rejection.
 * Uses your existing cleanup + semantic checks.
 */

function gibberishScore(upper: string) {
  // keep only letters/spaces for language-y checks
  const letters = upper.replace(/[^A-Z\s]/g, "");
  const compact = letters.replace(/\s+/g, "");
  if (compact.length < 6) return 0; // short names are fine

  const vowelCount = (compact.match(/[AEIOU]/g) ?? []).length;
  const vowelRatio = vowelCount / compact.length;

  const tokens = letters.trim().split(/\s+/).filter(Boolean);

  // tokens with no vowels (long-ish) are suspicious
  const noVowelTokens = tokens.filter(t => t.length >= 5 && !/[AEIOU]/.test(t)).length;

  // too many rare-looking consonant runs (e.g., "NTHN", "DTST")
  const consonantRuns = (compact.match(/[BCDFGHJKLMNPQRSTVWXYZ]{5,}/g) ?? []).length;

  // “too many” single-letter tokens also tends to be junk
  const singleLetterTokens = tokens.filter(t => t.length === 1).length;

  let score = 0;
  if (vowelRatio < 0.22) score += 2;      // English-ish product text usually has more vowels
  if (noVowelTokens >= 1) score += 2;
  if (consonantRuns >= 1) score += 2;
  if (singleLetterTokens >= 3) score += 1;

  return score;
}

function isGibberishName(upperName: string) {
  return gibberishScore(upperName) >= 4;
}
function isLikelyWalmartGvItem(nameUpper: string) {
  // GV + at least 2 more tokens (even short ones) and NOT mostly digits
  const toks = nameUpper.split(/\s+/).filter(Boolean);
  if (toks[0] !== "GV") return false;
  if (toks.length < 3) return false;

  const letters = (nameUpper.match(/[A-Z]/g) ?? []).length;
  const digits = (nameUpper.match(/\d/g) ?? []).length;
  return letters >= 4 && letters >= digits; // “GV NS PJ 82” passes
}
function normalizeCandidate(candidate: Candidate): { item?: ParsedItem; reject?: NoiseHit } {
  const nameLine = candidate.lines[0];
  const raw = candidate.lines.join(" | ");

  let name = cleanName(nameLine);
  name = stripLeadingIndexOrQty(name);
  name = stripKnownPrefixes(name);
  name = stripWeirdProducePrefixes(name);
  name = expandAbbreviations(name);
  name = normalizeSpacing(name);

  // salvage codes BEFORE final checks
  name = stripSuspiciousLeadingToken(name);

  // your WEG/WB stripping
  const parts = name.split(" ");
  if (parts.length >= 2) {
    name = name.replace(/^(WEG(F)?|WB)\s+/, "");
  }
  name = stripWeakLeadingToken(name);
  name = name.replace(/^(WEG(F)?|WB)\s+/, "");

  if (name.length < 3) {
    return { reject: { line: raw, reason: "too_short" } };
  }

  // normalize for checks
  const upperName = name.toUpperCase().replace(/0/g, "O");

  if (!looksLikeRealItemName(name)) {
    return { reject: { line: raw, reason: "fails_semantic_shape" } };
  }
  if (/[#()[\]{}<>]/.test(upperName)) {
    return { reject: { line: raw, reason: "fails_semantic_shape" } };
  }
  if (!isMostlyLetters(upperName)) {
    return { reject: { line: raw, reason: "not_mostly_letters" } };
  }
  if (GENERIC_TOKENS.has(upperName)) {
    return { reject: { line: raw, reason: "generic_token" } };
  }
  if (isFragmenty(upperName) && !isLikelyWalmartGvItem(upperName)) {
    return { reject: { line: raw, reason: "fragment" } };
  }


  // ✅ FINAL gibberish detector goes HERE (after all cleaning)
  if (isGibberishName(upperName)) {
    return {
      reject: {
        line: raw,
        reason: "gibberish_name",
        details: name,
      },
    };
  }

  return {
    item: { id: uid(), name, sourceLine: nameLine, selected: true },
  };
}

function stripSuspiciousLeadingToken(name: string) {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 2) return name;

  const t0 = tokens[0];

  // If first token is 4-6 letters, NO vowels, looks like a code => drop it
  if (/^[A-Z]{4,6}$/.test(t0) && !/[AEIOU]/.test(t0)) {
    return tokens.slice(1).join(" ");
  }

  return name;
}
/** ---------------------------------
 * Public API (same as you had, but staged)
 * --------------------------------- */


export function parseReceiptNamesOnlyWithReport(rawText: string, debug = false) {
  console.log("🟢 TEST parseReceiptNamesOnly CALLED with NEWssss");

  const { totalLines, segmented } = segmentLines(rawText);
  const { candidates, rejected } = groupCandidates(segmented);

  console.log("seg counts", {
  candidate: segmented.filter(s => s.kind === "candidate").length,
  rejected: segmented.filter(s => s.kind === "rejected").length,
  });
  console.log("first 25", segmented.slice(0, 25));
  const items: ParsedItem[] = [];

  for (const c of candidates) {
    const out = normalizeCandidate(c);
    if (out.reject) rejected.push(out.reject);
    if (out.item) items.push(out.item);
  }

  // De-dupe (fixed stray backticks)
  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    const key = it.name.toUpperCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const report = scoreScanQuality(totalLines, deduped.length, rejected);

  if (debug) {
    console.log("Candidates:\n" + candidates.map(c => `- ${c.lines.join(" | ")}`).join("\n"));
    console.log(
      "Rejected lines:\n" + rejected.map((r) => `- [${r.reason}] ${r.line}`).join("\n")
    );
    console.log(
      `Kept ${deduped.length} items:\n` + deduped.map((it) => `- ${it.name}`).join("\n")
    );
    console.log("Scan quality:", report);
  }

  return { items: deduped, report };
}

export function parseReceiptNamesOnly(rawText: string, debug = false): ParsedItem[] {
  console.warn("🔥 parseReceiptNamesOnly WRAPPER CALLED");
  return parseReceiptNamesOnlyWithReport(rawText, debug).items;
}
