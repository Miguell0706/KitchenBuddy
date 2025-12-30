// cleanName.ts
// Conservative, reversible name cleanup for OCR grocery items

// -------------------------------
// Public API
// -------------------------------
export function cleanName(raw: string): string {
  let s = raw;

  s = normalizeUnicode(s);
  s = normalizeSpacing(s);
  s = stripLeadingCodes(s);
  s = stripTrailingCodes(s);
  s = splitCamelCase(s);
  s = expandAbbreviations(s);
  s = normalizeHyphens(s);
  s = titleCase(s);

  return s.trim();
}

// -------------------------------
// Helpers
// -------------------------------

function normalizeUnicode(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "");
}

function normalizeSpacing(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([/-])/g, "$1")
    .replace(/([/-])\s+/g, "$1")
    .trim();
}

function splitCamelCase(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function normalizeHyphens(s: string) {
  return s.replace(/[-–—]+/g, " ");
}

// -------------------------------
// Abbreviation Expansion
// -------------------------------

const ABBREVIATIONS: Array<[RegExp, string]> = [
  // meat
  [/\bBNLS\b/i, "Boneless"],
  [/\bBRST\b/i, "Breast"],
  [/\bTHN\b/i, "Thin"],
  [/\bSL\b(?=\s|$)/i, "Slice"],
  [/\bGRND\b/i, "Ground"],

  // produce
  [/\bGRN\b/i, "Green"],
  [/\bORG\b/i, "Organic"],
  [/\bEX\b/i, "Extra"],

  // dairy / pantry
  [/\bCO[- ]?JACK\b/i, "Colby Jack"],
  [/\bMOZZ\b/i, "Mozzarella"],
  [/\bCHED\b/i, "Cheddar"],

  // misc
  [/\bFRZ\b/i, "Frozen"],
  [/\bGLUT\b/i, "Gluten"],
  [/\bGF\b/i, "Gluten Free"],

  // OCR junk fixes
  [/\b0IL\b/i, "Oil"],
  [/\bMI\s*IK\b/i, "Milk"],
  [/\bEGG[S]?\b/i, "Eggs"],
  [/\bCHKN\b/i, "Chicken"],
  [/\bCHK\b/i, "Chicken"],
  [/\bTHGH\b/i, "Thigh"],
  [/\bDRMSTK\b/i, "Drumstick"],
  [/\bTOM\b/i, "Tomato"],
  [/\bPOT\b/i, "Potato"],
  [/\bONN?\b/i, "Onion"], // OCR drops I
  [/\bBROCC?\b/i, "Broccoli"],
  [/\bSCE\b/i, "Sauce"],
  [/\bOIL\b/i, "Oil"],
  [/\bVINEG\b/i, "Vinegar"],
];

function expandAbbreviations(s: string) {
  let out = s;
  for (const [re, val] of ABBREVIATIONS) {
    out = out.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), val);
  }
  return out;
}
function stripLeadingCodes(s: string) {
  // Strip only if first token:
  // - is 4+ alphanumeric
  // - contains at least TWO digits
  // Examples stripped: "38066 Tomatoes", "470B6 Rice", "1725 Bag"
  // Examples kept: "OREO COOKIE", "UPUP HOUSEH", "ABCD Soup"
  return s.replace(
    /^\s*(?=[A-Z0-9]{4,}\b)(?=(?:[A-Z0-9]*\d){2,})[A-Z0-9]{4,}\s+/,
    ""
  );
}



function stripTrailingCodes(s: string) {
s = s.replace(/[?)]/g, "");
  return s
    .replace(
      /(?:\s+[A-Z]?\d{3,}[A-Z]{0,3})+(?:\s+[A-Z])*\s*$/gi,
      ""
    )
    .trim();
}


// -------------------------------
// Formatting
// -------------------------------

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
