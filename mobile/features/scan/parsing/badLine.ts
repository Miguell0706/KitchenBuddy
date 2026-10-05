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
    return letters >= 3;
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
  // Phone: (555) 123-4567
  if (/\(\s*\d{3}\s*\)\s*\d{3}\s*-\s*\d{4}/.test(upper)) {
    return true;
  }

  // Street address
  if (
    /^\d{2,6}\s+[A-Z0-9].*\b(ST|STREET|RD|ROAD|AVE|AVENUE|BLVD|DR|DRIVE|LN|LANE|HWY|HIGHWAY)\b/.test(
      upper,
    )
  ) {
    return true;
  }

  // City/state/ZIP
  if (/\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(upper)) {
    return true;
  }

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

  if (!upper) return true;

  // --------------------------------------------------
  // Very small / useless OCR fragments
  // --------------------------------------------------

  if (upper.length <= 2) return true;

  if (letterCount(upper) <= 2 && digitCount(upper) >= 5) {
    return true;
  }

  // --------------------------------------------------
  // Payment / receipt metadata
  // --------------------------------------------------

  if (/\b(PAYMENT|CHANGE)\b/i.test(line)) return true;
  if (/\bYOU SAVED\b/i.test(line)) return true;
  if (/\bKROGER PLUS CUSTOMER\b/i.test(line)) return true;
  if (/\bKROGER SAVINGS\b/i.test(line)) return true;
  if (/\bMFG CPN SAVINGS\b/i.test(line)) return true;
  if (/\bSCANNED COUPON\b/i.test(line)) return true;
  if (/\bFRESH FOOD\b/i.test(line)) return true;
  if (/\bLOW PRICES\b/i.test(line)) return true;
  if (/\bYOUR CASHIER\b/i.test(line)) return true;

  if (/^\s*REF#?:/i.test(line)) return true;

  // PURCHASE: $46.38
  // PURCHASE $46.38
  // PURCHASE S 46.38
  // PURCHASE 46.38
  if (/^\s*PURCHASE\b.*\d+\.\d{2}\s*$/i.test(line)) {
    return true;
  }

  // PUB 123
  if (/^\s*PUB\s+\d+\s*$/i.test(line)) {
    return true;
  }

  // 2 @ 3 FOR 10.00
  if (/^\s*\d+\s*@\s*\d+\s+FOR\s+\d+\.\d{2}\s*$/i.test(line)) {
    return true;
  }

  // SAVE .40 EGGS etc.
  if (/^\s*SAVE\s+[.\d]+\s+/i.test(line)) {
    return true;
  }

  if (/^\s*SC\s*$/i.test(line)) return true;
  if (/^\(?RROGER\)?$/i.test(line)) return true;

  // --------------------------------------------------
  // Section headers / branding
  // --------------------------------------------------

  if (SECTION_HEADERS.has(upper)) return true;

  if (upper.includes("TARGET")) return true;
  if (upper.includes("EXPECT MORE PAY LESS")) return true;

  if (upper.includes("CARTWHEEL")) return true;

  if (upper.includes("MFRCPN") || upper.includes("MFR CPN")) {
    return true;
  }

  if (
    upper.includes("SAVED") &&
    (upper.includes("OFF") || upper.includes("$"))
  ) {
    return true;
  }

  if (upper.includes("SEE BACK")) return true;
  if (upper.includes("CHANCE")) return true;
  if (upper.includes("WIN $") || upper.includes("WIN$")) return true;

  if (upper.includes("EXPECT MORE") && upper.includes("PAY LESS")) {
    return true;
  }

  if (upper.includes("REDUCED TO CLEAR")) return true;
  if (upper.startsWith("WAS ")) return true;
  if (upper.includes("LIMITED PARTNERSHIP")) return true;
  if (upper.startsWith("ABN:")) return true;
  if (upper === "ALDI STORES") return true;
  if (upper.includes("SAVINGS")) return true;

  // --------------------------------------------------
  // Discounts / promos
  //
  // IMPORTANT:
  // Do NOT reject "%" by itself.
  //
  // Legitimate products include:
  // 2% Milk
  // 1% Milk
  // 0% Greek Yogurt
  // 80% Lean Beef
  // --------------------------------------------------

  const promoWord =
    /\b(OFF|0FF|DFF|OFT|DISCOUNT|DISC|SAVE|SAVINGS|COUPON|CPN|MFRCPN|DEAL|PROMO)\b/.test(
      upper,
    );

  if (
    promoWord &&
    (upper.includes("%") ||
      /[$€]\s*\d/.test(upper) ||
      /\b\d+\.\d{2}\b/.test(upper))
  ) {
    return true;
  }

  // --------------------------------------------------
  // Known metadata helpers
  // --------------------------------------------------

  if (looksLikeStoreMeta(upper)) return true;
  if (looksLikeAddressOrPhone(upper)) return true;
  if (looksLikeTotalsOrPayment(upper)) return true;
  if (looksLikeDateTime(upper)) return true;

  // --------------------------------------------------
  // Manager / cashier
  //
  // Do this BEFORE generic "has a word" acceptance.
  // --------------------------------------------------

  if (
    upper.includes("MGR") ||
    upper.includes("MANAGER") ||
    upper.includes("CASHIER")
  ) {
    return true;
  }

  // --------------------------------------------------
  // Phone-ish numbers
  //
  // Handles OCR such as:
  // 530-378-02 44
  // --------------------------------------------------

  if (/\d{3}\s*[-.)]?\s*\d{3}\s*[-.)]?\s*\d{2,4}\b/.test(line)) {
    return true;
  }

  // --------------------------------------------------
  // ZIP/address combinations
  // --------------------------------------------------

  const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(line);

  const looksLikePlace =
    /\b(MINNESOTA|STREET|AVE|AVENUE|ROAD|BLVD|DRIVE)\b/i.test(line);

  if (hasZip && looksLikePlace) {
    return true;
  }

  // --------------------------------------------------
  // Mostly-numeric IDs / UPCs
  // --------------------------------------------------

  if (isDigitsHeavy(upper)) {
    return true;
  }

  // Compact tracking/ID codes
  if (
    /^[A-Z0-9]{8,}$/.test(upper.replace(/\s+/g, "")) &&
    !hasWordLikeToken(upper)
  ) {
    return true;
  }

  // --------------------------------------------------
  // Item + UPC
  //
  // Example:
  // BELL PEPPER 000000004065
  //
  // Previously this returned false for ANY line with a
  // word. Now it actually requires a long digit run.
  // --------------------------------------------------

  const hasWord = hasWordLikeToken(upper);
  const hasLongDigitRun = /\d{6,}/.test(upper);

  if (hasWord && hasLongDigitRun) {
    return false;
  }

  // --------------------------------------------------
  // Price handling
  // --------------------------------------------------

  const hasPrice = /[€$]\s*\d/.test(upper) || /\b\d+\.\d{2}\b/.test(upper);

  // Item with a price is allowed.
  if (hasWord && hasPrice) {
    return false;
  }

  // Price/math only
  if (hasPrice && !hasWord) {
    return true;
  }

  if (/\b\d+\.\d{2}\b/.test(upper) && letterCount(upper) < 4) {
    return true;
  }

  // --------------------------------------------------
  // Final item-name check
  // --------------------------------------------------

  // Most real item names contain at least 4 letters.
  if (letterCount(upper) >= 4) {
    return false;
  }

  // Anything else is probably OCR garbage.
  return true;
}
