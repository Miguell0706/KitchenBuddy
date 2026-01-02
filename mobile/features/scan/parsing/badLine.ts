
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


function upperForChecks(s: string) {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

function hasWordLikeToken(s: string) {
  const tokens = s.toUpperCase().split(/\s+/);

  return tokens.some((t) => {
    const letters = (t.match(/[A-Z]/g) ?? []).length;
    return letters >= 3; // "OATMILK", "0ATMILK", "TOMATOES"
  });
}


function isDigitsHeavy(s: string) {
  const digits = (s.match(/\d/g) ?? []).length;
  const letters = (s.match(/[A-Z]/g) ?? []).length;
  return digits >= 8 && letters < 3;
}


export function looksLikeStoreMeta(upper: string): boolean {
  if (!upper) return false;

  // ---- Store branding / headers ----
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
  ) {
    return true;
  }

  // ---- Register / transaction metadata ----
  if (
    upper.startsWith("ST#") ||
    upper.includes("OP#") ||
    upper.includes("TR#") ||
    upper.includes("TE#")
  ) {
    return true;
  }

  // ---- Pricing boilerplate ----
  if (
    upper === "REGULAR PRICE" ||
    upper.startsWith("REGULAR PRICE ") ||
    upper === "CARD SAVINGS" ||
    upper === "CARD SEVINGS" ||
    upper === "CARD SAVINSS" ||
    upper === "CARD PRICE" ||
    upper === "CARD PRLCE" ||
    upper === "SAVINGS"
  ) {
    return true;
  }

  // ---- Bags / tare ----
  if (upper.includes("BAG REFUND") || upper === "TARE") {
    return true;
  }

  // ---- Department headers ----
  if (DEPTS.has(upper)) {
    return true;
  }

  return false;
}


function looksLikeAddressOrPhone(upper: string) {
  // phone-ish
  if (/\(\s*\d{3}\s*\)\s*\d{3}\s*-\s*\d{4}/.test(upper)) return true;

  // street address-ish (very rough but works)
  if (/^\d{2,6}\s+[A-Z0-9].*\b(ST|STREET|RD|ROAD|AVE|AVENUE|BLVD|DR|DRIVE|LN|LANE|HWY|HIGHWAY)\b/.test(upper))
    return true;

  // city/state/zip-ish
  if (/\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(upper)) return true;

  return false;
}

function looksLikeTotalsOrPayment(upper: string) {
  return (
    upper.includes("SUBTOTAL") ||
    upper.includes("TOTAL") ||
    upper.includes("TAX") ||
    upper.includes("BALANCE") ||
    upper.includes("CHANGE DUE") ||
    upper.includes("DEBIT") ||
    upper.includes("CREDIT") ||
    upper.includes("VISA") ||
    upper.includes("MASTERCARD") ||
    upper.includes("AMEX") ||
    upper.includes("TEND") ||
    upper.includes("APPROV") ||
    upper.includes("AUTH") ||
    upper.includes("AID:") ||
    upper.includes("ACCOUNT#") ||
    upper.includes("REF #") ||
    upper.includes("NETWORK ID") ||
    upper.includes("APPR CODE") ||
    upper.includes("TERMINAL #") ||
    upper.includes("PAY FROM") ||
    upper.includes("PAYMENT") ||
    upper.includes("CASH") ||
    upper.includes("CASHIER") ||
    upper.includes("CASHIER#") ||
    upper.includes("THANK YOU")

  );
}

function looksLikeDateTime(upper: string) {
  return (
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(upper) ||
    /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(upper)
  );
}

function letterCount(upper: string) {
  return (upper.match(/[A-Z]/g) ?? []).length;
}
function digitCount(upper: string) {
  return (upper.match(/[0-9]/g) ?? []).length;
}
export function isBadLine(line: string): boolean {
  const upper = upperForChecks(line);
  if (/\b(PAYMENT|CHANGE)\b/i.test(line)) return true;
  if (/\bYOU SAVED\b/i.test(line)) return true;
  if (/^\s*PUB\s+\d+\s*$/i.test(line)) return true;
  if (/^\s*\d+\s*@\s*\d+\s+FOR\s+\d+\.\d{2}\s*$/i.test(line)) return true;
  if (/\bKROGER PLUS CUSTOMER\b/i.test(line)) return true;
  if (/\bFRESH FOOD\b/i.test(line)) return true;
  if (/\bLOW PRICES\b/i.test(line)) return true;
  if (/\bYOUR CASHIER\b/i.test(line)) return true;
  if (/^\s*REF#?:/i.test(line)) return true;
  if (/^\s*PURCHASE:\s*\$?\d+(\.\d{2})?\s*$/i.test(line)) return true;
  if (/\bKROGER SAVINGS\b/i.test(line)) return true;
  if (/\bMFG CPN SAVINGS\b/i.test(line)) return true;
  if (/\bSCANNED COUPON\b/i.test(line)) return true;
  if (/^\s*SAVE\s+[.\d]+\s+/i.test(line)) return true; // "Save .40 Eggs"
  if (/^\s*SC\s*$/i.test(line)) return true;
  if (/^\(?RROGER\)?$/i.test(line)) return true;
  if (/\b\d{3}\s*[-.)]\s*\d{3}\s*[-.)]\s*\d{4}\b/.test(line)) return true;


  if (letterCount(upper) <= 2 && digitCount(upper) >= 5) return true;
  // ZIP code (5 or 9) when line also looks like an address/location
  const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(line);
  const looksLikePlace = /\b(MINNESOTA|STREET|AVE|AVENUE|ROAD|BLVD|DRIVE)\b/i.test(line);
  if (hasZip && looksLikePlace) return true;
  if (!upper) return true;

  // tiny fragments like "BF", "ay."
  if (upper.length <= 2) return true;
  // --- Section headers / store slogans (not items) ---
  if (SECTION_HEADERS.has(upper)) return true;

  // Target branding/slogans
  if (upper.includes("TARGET")) return true;
  if (upper.includes("EXPECT MORE PAY LESS")) return true;
  // Coupon programs / labels
  if (upper.includes("CARTWHEEL")) return true;
  if (upper.includes("MFRCPN") || upper.includes("MFR CPN")) return true;
  if (upper.includes("SAVED") && (upper.includes("OFF") || upper.includes("$"))) return true;
// If there's a percent sign, it's almost never an item line.
  if (upper.includes("%")) return true;

  // common OCR variants for "OFF" / "DISCOUNT"
  if (/\b(OFF|0FF|DFF|0Ff|OFT|DISCOUNT|DISC|SAVE|SAVINGS|COUPON|CPN|MFRCPN|DEAL|PROMO)\b/.test(upper)) {
    // if it also mentions a money/percent, it's definitely promo/meta
    if (/%/.test(upper) || /[$€]\s*\d|\b\d+\.\d{2}\b/.test(upper)) return true;
  }
    // promo / header phrases
  if (upper.includes("SEE BACK") || upper.includes("CHANCE")) return true;
  if (upper.includes("WIN $") || upper.includes("WIN$")) return true;
  if (upper.includes("EXPECT MORE") && upper.includes("PAY LESS")) return true;

  // “ID” / tracking codes
  if (/^[A-Z0-9]{8,}$/.test(upper.replace(/\s+/g, "")) && !hasWordLikeToken(upper)) return true;

  // discount marker lines (not items)
  if (upper.includes("REDUCED TO CLEAR")) return true;
  if (upper.startsWith("WAS ")) return true;
  if (upper.includes("LIMITED PARTNERSHIP")) return true;
  if (upper.startsWith("ABN:")) return true;
  if (upper === "ALDI STORES") return true;
  if (upper.includes("SAVINGS")) return true;
    // obvious meta blocks
  if (looksLikeStoreMeta(upper)) return true;
  if (looksLikeAddressOrPhone(upper)) return true;
  if (looksLikeTotalsOrPayment(upper)) return true;
  if (looksLikeDateTime(upper)) return true;

  // ❗ If it's mostly digits, drop (UPC-only, IDs)
  if (isDigitsHeavy(upper)) return true;

  // ✅ If it has a real word AND a long digit run, KEEP it (item + UPC on same line)
  if (hasWordLikeToken(upper)) return false;

  
  // price/math-ish lines
  const hasPrice = /[€$]\s*\d/.test(upper) || /\b\d+\.\d{2}\b/.test(upper);
  const hasWord = hasWordLikeToken(upper);

  // ✅ keep if it looks like an item line that happens to include a price
  if (hasWord && hasPrice) return false;
  
  // manager/cashier lines
  if (upper.includes("MGR") || upper.includes("MANAGER") || upper.includes("CASHIER")) {
    return true;
  }

  // phone-number-ish lines (handles 530-378-02 44 OCR spacing)
  if (/\d{3}\s*[-.)]?\s*\d{3}\s*[-.)]?\s*\d{2,4}\b/.test(line)) {
    return true;
  }
  // ❌ price-only / math-only lines
  if (hasPrice && !hasWord) return true;
  if (/%/.test(upper)) return true;
  if (/\b\d+\.\d{2}\b/.test(upper) && letterCount(upper) < 4) return true;
  if (/%/.test(upper)) return true;
  // keep anything with decent letters (item names tend to have letters)
  if (letterCount(upper) >= 4) return false;

  // otherwise, default bad
  return true;
}
