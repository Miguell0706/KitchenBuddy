/**
 * Receipt OCR pre-filter. Keep plausible product descriptions for canonicalization,
 * while rejecting receipt metadata, prices, addresses and identifiers on their own.
 * This is deliberately conservative: uncertain product text should go to the
 * canonicalization endpoint, which makes the final item/not_item decision.
 */

const SECTION_HEADERS = new Set([
  "GROCERY",
  "HOME",
  "PETS",
  "CLEANING SUPPLIES",
  "PRODUCE",
  "DELI",
  "BAKERY",
  "MEAT",
  "FROZEN",
]);

const DEPTS = new Set([
  "BAKED GOODS",
  "REFRIG/FROZEN",
  "LIQUOR",
  "MISCELLANEOUS",
  "MEAT",
  "PRODUCE",
  "DELI",
  "GROCERY",
  "HOME",
  "PETS",
]);

const STATE_NAMES = [
  "ALABAMA",
  "ALASKA",
  "ARIZONA",
  "ARKANSAS",
  "CALIFORNIA",
  "COLORADO",
  "CONNECTICUT",
  "DELAWARE",
  "FLORIDA",
  "GEORGIA",
  "HAWAII",
  "IDAHO",
  "ILLINOIS",
  "INDIANA",
  "IOWA",
  "KANSAS",
  "KENTUCKY",
  "LOUISIANA",
  "MAINE",
  "MARYLAND",
  "MASSACHUSETTS",
  "MICHIGAN",
  "MINNESOTA",
  "MISSISSIPPI",
  "MISSOURI",
  "MONTANA",
  "NEBRASKA",
  "NEVADA",
  "NEW HAMPSHIRE",
  "NEW JERSEY",
  "NEW MEXICO",
  "NEW YORK",
  "NORTH CAROLINA",
  "NORTH DAKOTA",
  "OHIO",
  "OKLAHOMA",
  "OREGON",
  "PENNSYLVANIA",
  "RHODE ISLAND",
  "SOUTH CAROLINA",
  "SOUTH DAKOTA",
  "TENNESSEE",
  "TEXAS",
  "UTAH",
  "VERMONT",
  "VIRGINIA",
  "WASHINGTON",
  "WEST VIRGINIA",
  "WISCONSIN",
  "WYOMING",
  "DISTRICT OF COLUMBIA",
];

const STATE_NAME_PATTERN = new RegExp(
  `\\b(?:${STATE_NAMES.join("|")})\\s+\\d{5}(?:[-\\s]\\d{4})?\\b`,
);

function upperForChecks(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

function letterCount(s: string): number {
  return (s.match(/[A-Z]/g) ?? []).length;
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function hasWordLikeToken(s: string): boolean {
  return s.split(/\s+/).some((token) => letterCount(token) >= 3);
}

export function looksLikeStoreMeta(upperInput: string): boolean {
  const upper = upperForChecks(upperInput);
  if (!upper) return false;

  if (
    upper.includes("WALMART") ||
    upper.includes("WHOLE FOODS") ||
    upper === "WHOLE" ||
    upper === "FOODS" ||
    upper.includes("GROCERY STORE") ||
    upper.includes("SAVE MONEY") ||
    upper.includes("LIVE BETTER") ||
    upper.includes("MANAGER") ||
    upper.includes("SURVEY") ||
    (upper.includes("STORE") && upper.includes("RECEIPT")) ||
    (upper.includes("CHANCE") && upper.includes("WIN"))
  )
    return true;

  if (
    upper.startsWith("ST#") ||
    upper.includes("OP#") ||
    upper.includes("TR#") ||
    upper.includes("TE#")
  )
    return true;

  if (
    upper === "REGULAR PRICE" ||
    upper.startsWith("REGULAR PRICE ") ||
    upper === "CARD SAVINGS" ||
    upper === "CARD SEVINGS" ||
    upper === "CARD SAVINSS" ||
    upper === "CARD PRICE" ||
    upper === "CARD PRLCE" ||
    upper === "SAVINGS"
  )
    return true;

  return upper.includes("BAG REFUND") || upper === "TARE" || DEPTS.has(upper);
}

/** Phone number requires separators (or parentheses). A bare 9–12 digit SKU
 * must NEVER count as a phone number. Also allows OCR-spaced final four digits.
 */
function looksLikePhone(s: string): boolean {
  return (
    /\(\s*\d{3}\s*\)\s*\d{3}[\s.-]*\d{2}\s*\d{2}\b/.test(s) ||
    /\b\d{3}[-.)\s]+\d{3}[-.)\s]+\d{2}\s*\d{2}\b/.test(s)
  );
}

function looksLikeAddressOrPhone(upper: string): boolean {
  if (looksLikePhone(upper)) return true;

  // Street lines such as "5959 Poplar Ave".
  if (
    /^\d{1,6}\s+.+\b(?:ST|STREET|RD|ROAD|AVE|AVENUE|BLVD|DR|DRIVE|LN|LANE|HWY|HIGHWAY)\b/.test(
      upper,
    )
  ) {
    return true;
  }

  // City, state abbreviation and ZIP, e.g. "Memphis, TN 38119".
  if (/\b[A-Z]{2}\s+\d{5}(?:[-\s]\d{4})?\b/.test(upper)) return true;

  // Full state name + ZIP, e.g. "Memphis, Tennessee 38119-3938".
  if (STATE_NAME_PATTERN.test(upper)) return true;

  return false;
}

function looksLikeTotalsOrPayment(upper: string): boolean {
  return [
    "SUBTOTAL",
    "TOTAL",
    "TAX",
    "BALANCE",
    "CHANGE DUE",
    "DEBIT",
    "CREDIT",
    "VISA",
    "MASTERCARD",
    "AMEX",
    "TEND",
    "APPROV",
    "AUTH",
    "AID:",
    "ACCOUNT#",
    "REF #",
    "NETWORK ID",
    "APPR CODE",
    "TERMINAL #",
    "PAY FROM",
    "PAYMENT",
    "CASH",
    "CASHIER",
    "THANK YOU",
  ].some((word) => upper.includes(word));
}

function looksLikeDateTime(upper: string): boolean {
  return (
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(upper) ||
    /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(upper)
  );
}

/**
 * Removes an isolated product ID/UPC at the beginning or end of an accepted
 * OCR line. Does not alter the raw original; use this on a copy before sending
 * candidates to canonicalization. Returns the input trimmed when no SKU found.
 */
export function cleanReceiptCandidateLine(line: string): string {
  let cleaned = line.replace(/\s+/g, " ").trim();
  // Require a largely numeric ID (allows an OCR-confused letter within the ID)
  // AND a remaining textual description; avoid changing "0ATMILK" by itself.
  cleaned = cleaned.replace(
    /^(?=[A-Z0-9]{6,14}\s)(?=(?:[A-Z]*\d){4})[A-Z0-9]{6,14}\s+(?=[A-Z])/i,
    "",
  );
  cleaned = cleaned.replace(/\s+\d{6,14}$/, "");
  return cleaned.trim();
}

export function isBadLine(line: string): boolean {
  const upper = upperForChecks(line);
  if (!upper || upper.length <= 2) return true;

  // Run metadata checks BEFORE stripping an ID so phone/address details cannot
  // turn into superficially plausible product names.
  if (
    /\b(?:PAYMENT|CHANGE|YOU SAVED|KROGER PLUS CUSTOMER|KROGER SAVINGS|MFG CPN SAVINGS|SCANNED COUPON|FRESH FOOD|LOW PRICES|YOUR CASHIER)\b/.test(
      upper,
    )
  )
    return true;
  if (/^REF#?:/.test(upper)) return true;
  if (/^PURCHASE\b.*\d+\.\d{2}\s*$/.test(upper)) return true;
  if (/^PUB\s+\d+$/.test(upper)) return true;
  if (/^\d+\s*@\s*\d+\s+FOR\s+\d+\.\d{2}$/.test(upper)) return true;
  if (/^SAVE\s+[.\d]+\s+/.test(upper)) return true;
  if (upper === "SC" || /^\(?RROGER\)?$/.test(upper)) return true;

  if (SECTION_HEADERS.has(upper)) return true;
  if (
    upper.includes("TARGET") ||
    upper.includes("EXPECT MORE PAY LESS") ||
    upper.includes("CARTWHEEL") ||
    upper.includes("MFRCPN") ||
    upper.includes("MFR CPN") ||
    (upper.includes("SAVED") &&
      (upper.includes("OFF") || upper.includes("$"))) ||
    upper.includes("SEE BACK") ||
    upper.includes("CHANCE") ||
    upper.includes("WIN $") ||
    upper.includes("WIN$") ||
    upper.includes("REDUCED TO CLEAR") ||
    upper.startsWith("WAS ") ||
    upper.includes("LIMITED PARTNERSHIP") ||
    upper.startsWith("ABN:") ||
    upper === "ALDI STORES" ||
    upper.includes("SAVINGS")
  )
    return true;

  // A percentage alone must NOT disqualify foods like "2% Milk".
  const promoWord =
    /\b(?:OFF|0FF|DFF|OFT|DISCOUNT|DISC|SAVE|SAVINGS|COUPON|CPN|MFRCPN|DEAL|PROMO)\b/.test(
      upper,
    );
  if (
    promoWord &&
    (upper.includes("%") ||
      /[$€]\s*\d/.test(upper) ||
      /\b\d+\.\d{2}\b/.test(upper))
  )
    return true;

  if (looksLikeStoreMeta(upper)) return true;
  if (looksLikeAddressOrPhone(upper)) return true;
  if (looksLikeTotalsOrPayment(upper)) return true;
  if (looksLikeDateTime(upper)) return true;
  if (
    upper.includes("MGR") ||
    upper.includes("MANAGER") ||
    upper.includes("CASHIER")
  )
    return true;

  // Evaluate the description without an attached SKU. In particular, do not
  // mistake the 9-digit prefix for a phone number or reject it as a UPC.
  const candidate = upperForChecks(cleanReceiptCandidateLine(line));
  if (!candidate || candidate.length <= 2) return true;
  if (letterCount(candidate) <= 2 && digitCount(candidate) >= 5) return true;

  // Remaining bare ID/barcode with no product text.
  if (digitCount(candidate) >= 8 && letterCount(candidate) < 3) return true;
  if (
    /^[A-Z0-9]{8,}$/.test(candidate.replace(/\s+/g, "")) &&
    !hasWordLikeToken(candidate)
  )
    return true;

  const hasWord = hasWordLikeToken(candidate);
  const hasPrice =
    /[€$]\s*\d/.test(candidate) || /\b\d+\.\d{2}\b/.test(candidate);
  if (hasPrice && !hasWord) return true;
  if (/\b\d+\.\d{2}\b/.test(candidate) && letterCount(candidate) < 4)
    return true;

  // Preserve shortened or OCR-imperfect item descriptions for the backend.
  return letterCount(candidate) < 4;
}
