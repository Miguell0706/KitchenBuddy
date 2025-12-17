// mobile/features/pantry/utils.ts
import { TagStyles } from "@/constants/styles";
import type { PantryItem } from "./types";

export function matchesQuery(item: PantryItem, q: string) {
  if (!q) return true;
  const hay = `${item.name} ${item.quantity}`.toLowerCase();
  return hay.includes(q);
}

export function getExpiryBadge(item: PantryItem) {
  const d = item.expiresInDays;

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
