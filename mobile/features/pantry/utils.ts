// mobile/features/pantry/utils.ts
import { TagStyles } from "@/constants/styles";
import type { PantryItem } from "./types";

export function matchesQuery(item: PantryItem, q: string) {
  if (!q) return true;
  const hay = `${item.name} ${item.quantity}`.toLowerCase();
  return hay.includes(q);
}

export function getExpiryBadge(item: PantryItem) {
  const d = getExpiresInDays(item);

  if (d <= 0) {
    const daysAgo = Math.abs(d);

    let label = "Expired";
    if (d === 0) label = "Expired today";
    else if (d === -1) label = "Expired yesterday";
    else label = `Expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;

    return {
      container: [
        TagStyles.danger,
        { backgroundColor: "rgba(255, 59, 48, 0.15)" },
      ],
      text: [TagStyles.textDark, { color: "rgb(170, 20, 20)" }],
      label,
    };
  }

  if (d >= 9999) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(120, 120, 120, 0.12)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(60,60,60,0.9)" }],
      label: "No expiry",
    };
  }

  if (d <= 2) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(255, 149, 0, 0.18)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(140, 70, 0, 0.95)" }],
      label: `${d} day${d === 1 ? "" : "s"} left`,
    };
  }

  if (d <= 5) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(255, 204, 0, 0.18)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(120, 95, 0, 0.95)" }],
      label: `${d} days left`,
    };
  }

  return {
    container: [
      TagStyles.success,
      { backgroundColor: "rgba(52, 199, 89, 0.16)" },
    ],
    text: [TagStyles.textDark, { color: "rgba(0, 110, 40, 0.95)" }],
    label: `${d} days`,
  };
}
export function getExpiresInDays(item: PantryItem): number {
  // Treat "no expiry" as a big sentinel value
  if (!item.expiryDate) return 9999;

  const now = new Date();
  const todayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  // ✅ parse YYYY-MM-DD manually as LOCAL date (avoids UTC shift)
  const [y, m, d] = item.expiryDate.split("-").map((n) => Number(n));
  const expiryMs = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();

  const diffDays = Math.round((expiryMs - todayMs) / 86400000);
  return diffDays;
}

export function todayLocalMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysToExpiryDate(
  expiryDate: string | null,
  delta: number,
): string | null {
  if (!expiryDate) return null; // "no expiry" stays no expiry

  // parse YYYY-MM-DD safely as local date
  const [y, m, d] = expiryDate.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + delta);

  // clamp so we never go before today if you want that behavior
  const min = todayLocalMidnight();
  if (base < min) return toYMD(min);

  return toYMD(base);
}

export function setExpiryDaysFromToday(value: number): string {
  const base = todayLocalMidnight();
  base.setDate(base.getDate() + Math.max(0, value));
  return toYMD(base);
}
