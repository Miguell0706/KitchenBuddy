import type { PantryHistoryEntry, PantryHistoryAction } from "./history";

export type AnalyticsRange = "30d" | "3m" | "6m" | "all";

export type AnalyticsDateRange = {
  startAt: number | null;
  endAt: number;
};

export function getAnalyticsDateRange(
  range: AnalyticsRange,
  now = Date.now(),
): AnalyticsDateRange {
  const DAY_MS = 24 * 60 * 60 * 1000;

  switch (range) {
    case "30d":
      return {
        startAt: now - 30 * DAY_MS,
        endAt: now,
      };

    case "3m":
      return {
        startAt: now - 90 * DAY_MS,
        endAt: now,
      };

    case "6m":
      return {
        startAt: now - 180 * DAY_MS,
        endAt: now,
      };

    case "all":
    default:
      return {
        startAt: null,
        endAt: now,
      };
  }
}
export function filterHistoryByRange(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryHistoryEntry[] {
  const { startAt, endAt } = getAnalyticsDateRange(range, now);

  return entries.filter((entry) => {
    if (entry.at > endAt) return false;
    if (startAt !== null && entry.at < startAt) return false;

    return true;
  });
}
export type PantryOverviewStats = {
  purchased: number;
  added: number;
  used: number;
  expired: number;
  removed: number;

  totalEntered: number;
  totalResolved: number;

  utilizationRate: number;
  wasteRate: number;
};

export function getPantryOverviewStats(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryOverviewStats {
  const filtered = filterHistoryByRange(entries, range, now);

  const counts: Record<PantryHistoryAction, number> = {
    purchased: 0,
    added: 0,
    used: 0,
    expired: 0,
    removed: 0,
  };

  for (const entry of filtered) {
    counts[entry.action] += 1;
  }

  const totalEntered = counts.purchased + counts.added;

  // Removed is intentionally neutral.
  // It is neither successful use nor food waste.
  const totalResolved = counts.used + counts.expired;

  const utilizationRate =
    totalResolved > 0 ? Math.round((counts.used / totalResolved) * 100) : 0;

  const wasteRate =
    totalResolved > 0 ? Math.round((counts.expired / totalResolved) * 100) : 0;

  return {
    purchased: counts.purchased,
    added: counts.added,
    used: counts.used,
    expired: counts.expired,
    removed: counts.removed,

    totalEntered,
    totalResolved,

    utilizationRate,
    wasteRate,
  };
}
export type PantryItemStats = {
  name: string;
  entered: number;
  used: number;
  expired: number;
  removed: number;
  resolved: number;
  utilizationRate: number;
  wasteRate: number;
};

function normalizeAnalyticsName(name: string): string {
  return name.trim().toLowerCase();
}

export function getPantryItemStats(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryItemStats[] {
  const filtered = filterHistoryByRange(entries, range, now);

  const grouped = new Map<
    string,
    {
      name: string;
      entered: number;
      used: number;
      expired: number;
      removed: number;
    }
  >();

  for (const entry of filtered) {
    const key = normalizeAnalyticsName(entry.name);
    if (!key) continue;

    const current = grouped.get(key) ?? {
      name: entry.name.trim(),
      entered: 0,
      used: 0,
      expired: 0,
      removed: 0,
    };

    if (entry.action === "purchased" || entry.action === "added") {
      current.entered += 1;
    } else if (entry.action === "used") {
      current.used += 1;
    } else if (entry.action === "expired") {
      current.expired += 1;
    } else if (entry.action === "removed") {
      current.removed += 1;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((item) => {
    const resolved = item.used + item.expired;

    return {
      ...item,
      resolved,

      utilizationRate:
        resolved > 0 ? Math.round((item.used / resolved) * 100) : 0,

      wasteRate: resolved > 0 ? Math.round((item.expired / resolved) * 100) : 0,
    };
  });
}
export type PantryLifecycle = {
  id: string;
  name: string;
  enteredAt: number;
  outcomeAt: number;
  outcome: "used" | "expired";
  daysInPantry: number;
};

export function getPantryLifecycles(
  entries: PantryHistoryEntry[],
): PantryLifecycle[] {
  const byId = new Map<string, PantryHistoryEntry[]>();

  for (const entry of entries) {
    const list = byId.get(entry.id) ?? [];
    list.push(entry);
    byId.set(entry.id, list);
  }

  const lifecycles: PantryLifecycle[] = [];

  for (const itemEntries of byId.values()) {
    const sorted = [...itemEntries].sort((a, b) => a.at - b.at);

    const entered = sorted.find(
      (entry) => entry.action === "purchased" || entry.action === "added",
    );

    if (!entered) continue;

    const outcome = sorted.find(
      (entry) =>
        entry.at >= entered.at &&
        (entry.action === "used" || entry.action === "expired"),
    );

    if (!outcome) continue;

    const daysInPantry = Math.max(
      0,
      (outcome.at - entered.at) / (24 * 60 * 60 * 1000),
    );

    lifecycles.push({
      id: entered.id,
      name: entered.name,
      enteredAt: entered.at,
      outcomeAt: outcome.at,
      outcome: outcome.action as "used" | "expired",
      daysInPantry,
    });
  }

  return lifecycles;
}
export type PantryItemTimingStats = {
  name: string;
  averageDaysBeforeUse: number | null;
  averageDaysBeforeExpiry: number | null;
  usedSamples: number;
  expiredSamples: number;
};

export function getPantryItemTimingStats(
  entries: PantryHistoryEntry[],
): PantryItemTimingStats[] {
  const lifecycles = getPantryLifecycles(entries);

  const grouped = new Map<
    string,
    {
      name: string;
      usedDays: number[];
      expiredDays: number[];
    }
  >();

  for (const lifecycle of lifecycles) {
    const key = normalizeAnalyticsName(lifecycle.name);
    if (!key) continue;

    const current = grouped.get(key) ?? {
      name: lifecycle.name.trim(),
      usedDays: [],
      expiredDays: [],
    };

    if (lifecycle.outcome === "used") {
      current.usedDays.push(lifecycle.daysInPantry);
    } else {
      current.expiredDays.push(lifecycle.daysInPantry);
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((item) => {
    const average = (values: number[]): number | null => {
      if (values.length === 0) return null;

      const total = values.reduce((sum, value) => sum + value, 0);

      return Math.round((total / values.length) * 10) / 10;
    };

    return {
      name: item.name,
      averageDaysBeforeUse: average(item.usedDays),
      averageDaysBeforeExpiry: average(item.expiredDays),
      usedSamples: item.usedDays.length,
      expiredSamples: item.expiredDays.length,
    };
  });
}
export type PantryRepurchaseStats = {
  name: string;
  timesEntered: number;
  averageDaysBetween: number | null;
  typicalDaysBetween: number | null;
  lastEnteredAt: number;
};

export function getPantryRepurchaseStats(
  entries: PantryHistoryEntry[],
): PantryRepurchaseStats[] {
  const arrivals = entries.filter(
    (entry) => entry.action === "purchased" || entry.action === "added",
  );

  const grouped = new Map<
    string,
    {
      name: string;
      timestamps: number[];
    }
  >();

  for (const entry of arrivals) {
    const key = normalizeAnalyticsName(entry.name);
    if (!key) continue;

    const current = grouped.get(key) ?? {
      name: entry.name.trim(),
      timestamps: [],
    };

    current.timestamps.push(entry.at);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((item) => {
    const timestamps = [...item.timestamps].sort((a, b) => a - b);

    const intervals: number[] = [];

    for (let i = 1; i < timestamps.length; i += 1) {
      const days = (timestamps[i] - timestamps[i - 1]) / (24 * 60 * 60 * 1000);

      intervals.push(days);
    }

    let averageDaysBetween: number | null = null;
    let typicalDaysBetween: number | null = null;

    if (intervals.length > 0) {
      const total = intervals.reduce((sum, value) => sum + value, 0);

      averageDaysBetween = Math.round((total / intervals.length) * 10) / 10;

      const sortedIntervals = [...intervals].sort((a, b) => a - b);
      const middle = Math.floor(sortedIntervals.length / 2);

      const median =
        sortedIntervals.length % 2 === 0
          ? (sortedIntervals[middle - 1] + sortedIntervals[middle]) / 2
          : sortedIntervals[middle];

      typicalDaysBetween = Math.round(median * 10) / 10;
    }

    return {
      name: item.name,
      timesEntered: timestamps.length,
      averageDaysBetween,
      typicalDaysBetween,
      lastEnteredAt: timestamps[timestamps.length - 1],
    };
  });
}
export type PantryCategoryStats = {
  categoryKey: PantryHistoryEntry["categoryKey"];
  entered: number;
  used: number;
  expired: number;
  removed: number;
  resolved: number;
  utilizationRate: number;
  wasteRate: number;
};

export function getPantryCategoryStats(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryCategoryStats[] {
  const filtered = filterHistoryByRange(entries, range, now);

  const grouped = new Map<
    PantryHistoryEntry["categoryKey"],
    {
      entered: number;
      used: number;
      expired: number;
      removed: number;
    }
  >();

  for (const entry of filtered) {
    const current = grouped.get(entry.categoryKey) ?? {
      entered: 0,
      used: 0,
      expired: 0,
      removed: 0,
    };

    if (entry.action === "purchased" || entry.action === "added") {
      current.entered += 1;
    } else if (entry.action === "used") {
      current.used += 1;
    } else if (entry.action === "expired") {
      current.expired += 1;
    } else if (entry.action === "removed") {
      current.removed += 1;
    }

    grouped.set(entry.categoryKey, current);
  }

  return Array.from(grouped.entries()).map(([categoryKey, stats]) => {
    const resolved = stats.used + stats.expired;

    return {
      categoryKey,
      ...stats,
      resolved,

      utilizationRate:
        resolved > 0 ? Math.round((stats.used / resolved) * 100) : 0,

      wasteRate:
        resolved > 0 ? Math.round((stats.expired / resolved) * 100) : 0,
    };
  });
}
export type PantryMonthlyTrend = {
  monthKey: string;
  year: number;
  month: number;
  used: number;
  expired: number;
  resolved: number;
  utilizationRate: number;
  wasteRate: number;
};

export function getPantryMonthlyTrends(
  entries: PantryHistoryEntry[],
): PantryMonthlyTrend[] {
  const grouped = new Map<
    string,
    {
      year: number;
      month: number;
      used: number;
      expired: number;
    }
  >();

  for (const entry of entries) {
    if (entry.action !== "used" && entry.action !== "expired") {
      continue;
    }

    const date = new Date(entry.at);
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

    const current = grouped.get(monthKey) ?? {
      year,
      month,
      used: 0,
      expired: 0,
    };

    if (entry.action === "used") {
      current.used += 1;
    } else {
      current.expired += 1;
    }

    grouped.set(monthKey, current);
  }

  return Array.from(grouped.entries())
    .map(([monthKey, stats]) => {
      const resolved = stats.used + stats.expired;

      return {
        monthKey,
        year: stats.year,
        month: stats.month,
        used: stats.used,
        expired: stats.expired,
        resolved,

        utilizationRate:
          resolved > 0 ? Math.round((stats.used / resolved) * 100) : 0,

        wasteRate:
          resolved > 0 ? Math.round((stats.expired / resolved) * 100) : 0,
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}
export type PantryMonthlyChange = {
  currentUtilizationRate: number | null;
  previousUtilizationRate: number | null;
  utilizationChange: number | null;
};

export function getPantryMonthlyChange(
  entries: PantryHistoryEntry[],
): PantryMonthlyChange {
  const trends = getPantryMonthlyTrends(entries);

  if (trends.length === 0) {
    return {
      currentUtilizationRate: null,
      previousUtilizationRate: null,
      utilizationChange: null,
    };
  }

  const current = trends[trends.length - 1];

  if (trends.length === 1) {
    return {
      currentUtilizationRate: current.utilizationRate,
      previousUtilizationRate: null,
      utilizationChange: null,
    };
  }

  const previous = trends[trends.length - 2];

  return {
    currentUtilizationRate: current.utilizationRate,
    previousUtilizationRate: previous.utilizationRate,
    utilizationChange: current.utilizationRate - previous.utilizationRate,
  };
}
export type PantryFoodRanking = {
  name: string;
  count: number;
  entered: number;
  used: number;
  expired: number;
  utilizationRate: number;
  wasteRate: number;
};

export type PantryFoodRankings = {
  mostUsed: PantryFoodRanking[];
  mostExpired: PantryFoodRanking[];
};

export function getPantryFoodRankings(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  limit = 5,
  now = Date.now(),
): PantryFoodRankings {
  const itemStats = getPantryItemStats(entries, range, now);

  const mostUsed = itemStats
    .filter((item) => item.used > 0)
    .sort((a, b) => {
      if (b.used !== a.used) return b.used - a.used;
      return b.utilizationRate - a.utilizationRate;
    })
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      count: item.used,
      entered: item.entered,
      used: item.used,
      expired: item.expired,
      utilizationRate: item.utilizationRate,
      wasteRate: item.wasteRate,
    }));

  const mostExpired = itemStats
    .filter((item) => item.expired > 0)
    .sort((a, b) => {
      if (b.expired !== a.expired) return b.expired - a.expired;
      return b.wasteRate - a.wasteRate;
    })
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      count: item.expired,
      entered: item.entered,
      used: item.used,
      expired: item.expired,
      utilizationRate: item.utilizationRate,
      wasteRate: item.wasteRate,
    }));

  return {
    mostUsed,
    mostExpired,
  };
}
export type PantryInsightType =
  | "waste"
  | "success"
  | "restock"
  | "category"
  | "trend";

export type PantryInsightSeverity = "info" | "positive" | "warning";

export type PantryInsight = {
  id: string;
  type: PantryInsightType;
  severity: PantryInsightSeverity;
  title: string;
  message: string;

  itemName?: string;
  categoryKey?: PantryHistoryEntry["categoryKey"];

  priority: number;
};
export function getWastePatternInsights(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryInsight[] {
  const itemStats = getPantryItemStats(entries, range, now);

  const insights: PantryInsight[] = [];

  for (const item of itemStats) {
    // Require enough history before making a strong recommendation.
    if (item.resolved < 3) continue;

    // At least 2 expirations and 40% waste.
    if (item.expired < 2 || item.wasteRate < 40) continue;

    insights.push({
      id: `waste-${normalizeAnalyticsName(item.name)}`,
      type: "waste",
      severity: item.wasteRate >= 60 ? "warning" : "info",

      title: `${item.name} is frequently wasted`,

      message:
        `${item.name} has expired ${item.expired} out of ` +
        `${item.resolved} tracked outcomes. ` +
        `Consider buying a smaller amount or purchasing it less frequently.`,

      itemName: item.name,

      // Higher waste + more evidence = higher priority.
      priority: item.wasteRate + Math.min(item.resolved, 10),
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
export function getSuccessPatternInsights(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryInsight[] {
  const itemStats = getPantryItemStats(entries, range, now);

  const insights: PantryInsight[] = [];

  for (const item of itemStats) {
    // Require enough history to call this a real pattern.
    if (item.resolved < 3) continue;

    // At least 80% utilization.
    if (item.utilizationRate < 80) continue;

    insights.push({
      id: `success-${normalizeAnalyticsName(item.name)}`,
      type: "success",
      severity: "positive",

      title: `${item.name} is being used efficiently`,

      message:
        `You've used ${item.used} out of ${item.resolved} tracked ` +
        `outcomes for ${item.name}, with a ${item.utilizationRate}% ` +
        `utilization rate.`,

      itemName: item.name,

      // Stronger utilization + more evidence = higher priority.
      priority: item.utilizationRate + Math.min(item.resolved, 10),
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
export function getRestockPatternInsights(
  entries: PantryHistoryEntry[],
  now = Date.now(),
): PantryInsight[] {
  const repurchaseStats = getPantryRepurchaseStats(entries);

  const insights: PantryInsight[] = [];

  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const item of repurchaseStats) {
    if (item.timesEntered < 3) continue;
    if (item.typicalDaysBetween === null) continue;

    const daysSinceLastPurchase = (now - item.lastEnteredAt) / DAY_MS;

    // Only surface the insight when the user is approaching
    // their normal repurchase interval.
    const restockThreshold = item.typicalDaysBetween * 0.8;

    if (daysSinceLastPurchase < restockThreshold) continue;

    const roundedTypical = Math.max(1, Math.round(item.typicalDaysBetween));

    const roundedSinceLast = Math.max(0, Math.round(daysSinceLastPurchase));

    insights.push({
      id: `restock-${normalizeAnalyticsName(item.name)}`,
      type: "restock",
      severity: "info",

      title: `${item.name} may be due for a restock`,

      message:
        `You typically add ${item.name} about every ` +
        `${roundedTypical} days. It's been about ` +
        `${roundedSinceLast} days since the last time.`,

      itemName: item.name,

      priority:
        60 +
        Math.min(40, (daysSinceLastPurchase / item.typicalDaysBetween) * 20),
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
export function getCategoryPatternInsights(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
): PantryInsight[] {
  const categoryStats = getPantryCategoryStats(entries, range, now);

  const insights: PantryInsight[] = [];

  for (const category of categoryStats) {
    // Require enough outcomes before identifying a category pattern.
    if (category.resolved < 5) continue;

    // Only flag categories with meaningful waste.
    if (category.expired < 2 || category.wasteRate < 30) {
      continue;
    }

    insights.push({
      id: `category-waste-${category.categoryKey}`,
      type: "category",
      severity: category.wasteRate >= 50 ? "warning" : "info",

      title: `Higher waste in ${category.categoryKey}`,

      message:
        `${category.expired} of ${category.resolved} tracked ` +
        `outcomes in this category expired, for a ` +
        `${category.wasteRate}% waste rate.`,

      categoryKey: category.categoryKey,

      priority: category.wasteRate + Math.min(category.resolved, 20),
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
export function getTrendInsight(
  entries: PantryHistoryEntry[],
  now = Date.now(),
): PantryInsight | null {
  const trends = getPantryMonthlyTrends(entries);

  const currentDate = new Date(now);

  const currentMonthKey =
    `${currentDate.getFullYear()}-` +
    `${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const previousDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1,
    1,
  );

  const previousMonthKey =
    `${previousDate.getFullYear()}-` +
    `${String(previousDate.getMonth() + 1).padStart(2, "0")}`;

  const current = trends.find((trend) => trend.monthKey === currentMonthKey);

  const previous = trends.find((trend) => trend.monthKey === previousMonthKey);

  // We need data from both actual consecutive months.
  if (!current || !previous) {
    return null;
  }

  // Require enough outcomes before comparing the months.
  if (current.resolved < 3 || previous.resolved < 3) {
    return null;
  }

  const change = current.utilizationRate - previous.utilizationRate;

  // Ignore tiny changes that are probably just noise.
  if (Math.abs(change) < 3) {
    return null;
  }

  if (change > 0) {
    return {
      id: `trend-improved-${current.monthKey}`,
      type: "trend",
      severity: "positive",

      title: "Your food utilization is improving",

      message:
        `Your utilization rate increased by ${change} ` +
        `percentage points compared with last month.`,

      priority: 80 + Math.min(change, 20),
    };
  }

  const decline = Math.abs(change);

  return {
    id: `trend-declined-${current.monthKey}`,
    type: "trend",
    severity: decline >= 10 ? "warning" : "info",

    title: "Your food utilization has decreased",

    message:
      `Your utilization rate decreased by ${decline} ` +
      `percentage points compared with last month.`,

    priority: 80 + Math.min(decline, 20),
  };
}
export function getPantryInsights(
  entries: PantryHistoryEntry[],
  range: AnalyticsRange,
  now = Date.now(),
  limit = 5,
): PantryInsight[] {
  const wasteInsights = getWastePatternInsights(entries, range, now);

  const successInsights = getSuccessPatternInsights(entries, range, now);

  const restockInsights = getRestockPatternInsights(entries, now);

  const categoryInsights = getCategoryPatternInsights(entries, range, now);

  const trendInsight = getTrendInsight(entries, now);
  const insights: PantryInsight[] = [
    ...wasteInsights,
    ...successInsights,
    ...restockInsights,
    ...categoryInsights,
  ];

  if (trendInsight) {
    insights.push(trendInsight);
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
