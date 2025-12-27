function upperForChecks(s: string) {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

function hasLongDigitRun(s: string, n = 8) {
  return new RegExp(`\\d{${n},}`).test(s.replace(/\s+/g, ""));
}

function hasWordLikeToken(s: string) {
  // at least one token with 3+ letters (handles "POTATO", "COOKIES", "CHSYBACBREAD")
  return /\b[A-Z]{3,}\b/.test(s);
}

function isDigitsHeavy(s: string) {
  const digits = (s.match(/\d/g) ?? []).length;
  const letters = (s.match(/[A-Z]/g) ?? []).length;
  return digits >= 8 && letters < 3;
}


function isMostlyDigitsOrSymbols(s: string) {
  const cleaned = s.replace(/[A-Z]/gi, "");
  const digits = (s.match(/\d/g) ?? []).length;
  return digits >= 6 && cleaned.length <= s.length * 0.8;
}

function looksLikeUpcLine(upper: string) {
  const compact = upper.replace(/\s+/g, "");
  // 10–18 digits (common UPC/EAN-ish) possibly with trailing letters
  return /^\d{10,18}[A-Z]{0,3}$/.test(compact);
}

function looksLikeStoreMeta(upper: string) {
  return (
    upper.includes("WALMART") ||
    upper.includes("SAVE MONEY") ||
    upper.includes("LIVE BETTER") ||
    upper.includes("MANAGER") ||
    upper.includes("STORE") && upper.includes("RECEIPT") ||
    upper.includes("SURVEY") ||
    upper.includes("CHANCE") && upper.includes("WIN") ||
    upper.startsWith("ST#") ||
    upper.includes("OP#") ||
    upper.includes("TR#") ||
    upper.includes("TE#")
  );
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
    upper.includes("PAY FROM")
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

export function isBadLine(line: string): boolean {
  const upper = upperForChecks(line);

  if (!upper) return true;

  // tiny fragments like "BF", "ay."
  if (upper.length <= 2) return true;
  // promo / header phrases
  if (upper.includes("SEE BACK") || upper.includes("CHANCE")) return true;
  if (upper.includes("WIN $") || upper.includes("WIN$")) return true;

  // “ID” / tracking codes
  if (/^[A-Z0-9]{8,}$/.test(upper.replace(/\s+/g, "")) && !hasWordLikeToken(upper)) return true;

// discount marker lines (not items)
if (upper.includes("REDUCED TO CLEAR")) return true;
if (upper.startsWith("WAS ")) return true;

  // obvious meta blocks
  if (looksLikeStoreMeta(upper)) return true;
  if (looksLikeAddressOrPhone(upper)) return true;
  if (looksLikeTotalsOrPayment(upper)) return true;
  if (looksLikeDateTime(upper)) return true;

  // ❗ If it's mostly digits, drop (UPC-only, IDs)
  if (isDigitsHeavy(upper)) return true;

  // ✅ If it has a real word AND a long digit run, KEEP it (item + UPC on same line)
  if (hasWordLikeToken(upper) && hasLongDigitRun(upper)) return false;


  // price/math-ish lines
  if (/[€$]\s*\d/.test(upper)) return true;
  if (/\b\d+\.\d{2}\b/.test(upper) && letterCount(upper) < 4) return true;
  if (/%/.test(upper)) return true;

  // if it's mostly digits/symbols, drop
  if (isMostlyDigitsOrSymbols(upper)) return true;

  // keep anything with decent letters (item names tend to have letters)
  if (letterCount(upper) >= 4) return false;

  // otherwise, default bad
  return true;
}
