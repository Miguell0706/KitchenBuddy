import React, { useCallback, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  getPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";
import {
  getPantryOverviewStats,
  getPantryMonthlyTrends,
  getPantryFoodRankings,
  getPantryCategoryStats,
  getAnalyticsDateRange,
  getPantryItemTimingStats,
  getPantryRepurchaseStats,
  getPantryInsights,
  type AnalyticsRange,
} from "@/features/pantry/analytics";
type AnalyticsTab = "overview" | "foods" | "habits";
const TABS: { key: AnalyticsTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "foods", label: "Food Insights" },
  { key: "habits", label: "Habits" },
];
const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "30d", label: "30 Days" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "all", label: "All Time" },
];
function formatCategory(key: string): string {
  return key
    .replace(/[\_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function EmptyMessage({ message }: { message: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}
function ProgressBar({ percentage }: { percentage: number }) {
  const safePercentage = Math.max(0, Math.min(100, percentage));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${safePercentage}%` }]} />
    </View>
  );
}
export default function PantryAnalyticsScreen() {
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [history, setHistory] = useState<PantryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadHistory() {
        setLoading(true);
        try {
          const entries = await getPantryHistory();
          if (active) {
            setHistory(entries);
          }
        } catch (error) {
          console.error("Failed to load pantry analytics:", error);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
      void loadHistory();
      return () => {
        active = false;
      };
    }, []),
  );
  const overview = getPantryOverviewStats(history, range);
  const monthlyTrends = getPantryMonthlyTrends(history);
  const foodRankings = getPantryFoodRankings(history, range, 5);
  const categoryStats = getPantryCategoryStats(history, range);
  const timingStats = getPantryItemTimingStats(history);
  const repurchaseStats = getPantryRepurchaseStats(history);
  const insights = getPantryInsights(history, range);
  const { startAt } = getAnalyticsDateRange(range);
  const router = useRouter();
  const openIngredient = (name: string) => {
    router.push({
      pathname: "/ingredient/[name]",
      params: { name },
    });
  };
  // Keep full calendar-month statistics.
  // The selected range determines which months are visible,
  // not which individual days count within those months.
  const visibleTrends = monthlyTrends.filter((trend) => {
    if (startAt === null) return true;
    const monthEnd = new Date(trend.year, trend.month + 1, 1).getTime();
    return monthEnd > startAt;
  });
  // Timing and repurchase calculations are currently all-time
  // statistics. We label them accordingly rather than suggesting
  // that the date filter changes their calculations.
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: "Pantry Analytics",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        key={tab}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Pantry Analytics</Text>
          <Text style={styles.subtitle}>
            Understand your food habits and reduce waste.
          </Text>
        </View>
        {/* MAIN TABS */}
        <View style={styles.tabSelector}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[
                styles.tabButton,
                tab === item.key && styles.tabButtonActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  tab === item.key && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* DATE RANGE */}
        <View style={styles.rangeSelector}>
          {RANGES.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setRange(item.key)}
              style={[
                styles.rangeButton,
                range === item.key && styles.rangeButtonActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.rangeButtonText,
                  range === item.key && styles.rangeButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? (
          <Text style={styles.loadingText}>Loading pantry analytics...</Text>
        ) : (
          <>
            {/* ================= OVERVIEW ================= */}
            {tab === "overview" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Overview</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>
                        {overview.totalEntered}
                      </Text>
                      <Text style={styles.statLabel}>Items Entered</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{overview.used}</Text>
                      <Text style={styles.statLabel}>Items Used</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{overview.expired}</Text>
                      <Text style={styles.statLabel}>Items Expired</Text>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>
                        {overview.totalResolved > 0
                          ? `${overview.utilizationRate}%`
                          : "—"}
                      </Text>
                      <Text style={styles.statLabel}>Utilization</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>
                        {overview.totalResolved > 0
                          ? `${overview.wasteRate}%`
                          : "—"}
                      </Text>
                      <Text style={styles.statLabel}>Waste Rate</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Monthly Trends</Text>
                  <Text style={styles.sectionSubtitle}>
                    Food utilization by calendar month.
                  </Text>
                  {visibleTrends.length === 0 ? (
                    <EmptyMessage message="Not enough history to show trends yet." />
                  ) : (
                    <View style={styles.card}>
                      {visibleTrends.map((trend) => {
                        const monthLabel = new Date(
                          trend.year,
                          trend.month,
                          1,
                        ).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        });
                        return (
                          <View key={trend.monthKey} style={styles.trendRow}>
                            <Text style={styles.trendMonth}>{monthLabel}</Text>
                            <ProgressBar percentage={trend.utilizationRate} />
                            <Text style={styles.trendPercent}>
                              {trend.utilizationRate}%
                            </Text>
                          </View>
                        );
                      })}
                      <Text style={styles.footnote}>
                        Each month includes its own calendar dates. Percentage
                        of resolved items marked Used rather than Expired.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
            {/* ================= FOOD INSIGHTS ================= */}
            {tab === "foods" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Food Rankings</Text>
                  <Text style={styles.sectionSubtitle}>
                    Your most used and most expired foods.
                  </Text>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Most Used</Text>
                    {foodRankings.mostUsed.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No used foods recorded yet.
                      </Text>
                    ) : (
                      foodRankings.mostUsed.map((item, index) => (
                        <Pressable
                          key={item.name}
                          onPress={() => openIngredient(item.name)}
                          style={styles.rankingRow}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${item.name} details`}
                        >
                          <Text style={styles.rankingName}>
                            {index + 1}. {item.name}
                          </Text>
                          <Text style={styles.rankingCount}>{item.count}</Text>
                          <Text style={styles.rowChevron}>›</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Most Expired</Text>
                    {foodRankings.mostExpired.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No expired foods recorded yet.
                      </Text>
                    ) : (
                      foodRankings.mostExpired.map((item, index) => (
                        <Pressable
                          key={item.name}
                          onPress={() => openIngredient(item.name)}
                          style={styles.rankingRow}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${item.name} details`}
                        >
                          <Text style={styles.rankingName}>
                            {index + 1}. {item.name}
                          </Text>
                          <Text style={styles.rankingCount}>{item.count}</Text>
                          <Text style={styles.rowChevron}>›</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Category Analytics</Text>
                  <Text style={styles.sectionSubtitle}>
                    See which food categories you use most efficiently.
                  </Text>
                  {categoryStats.length === 0 ? (
                    <EmptyMessage message="No category activity recorded for this period." />
                  ) : (
                    categoryStats.map((category) => (
                      <View
                        key={String(category.categoryKey)}
                        style={styles.card}
                      >
                        <View style={styles.categoryHeader}>
                          <Text style={styles.cardTitle}>
                            {formatCategory(String(category.categoryKey))}
                          </Text>
                          <Text style={styles.categoryPercent}>
                            {category.resolved > 0
                              ? `${category.utilizationRate}%`
                              : "—"}
                          </Text>
                        </View>
                        <ProgressBar
                          percentage={
                            category.resolved > 0 ? category.utilizationRate : 0
                          }
                        />
                        <Text style={styles.categoryDetails}>
                          {category.used} used · {category.expired} expired
                        </Text>
                        {category.resolved === 0 && (
                          <Text style={styles.footnote}>
                            No resolved items yet.
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
            {/* ================= HABITS ================= */}
            {tab === "habits" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Purchase Habits</Text>
                  <Text style={styles.sectionSubtitle}>
                    Learn how often you bring foods into your pantry.
                  </Text>
                  <Text style={styles.dataScope}>
                    All-time purchase history
                  </Text>
                  {repurchaseStats.filter(
                    (item) =>
                      item.timesEntered >= 2 &&
                      item.averageDaysBetween !== null,
                  ).length === 0 ? (
                    <EmptyMessage message="More repeated purchases are needed to identify shopping patterns." />
                  ) : (
                    <View style={styles.card}>
                      {repurchaseStats
                        .filter(
                          (item) =>
                            item.timesEntered >= 2 &&
                            item.averageDaysBetween !== null,
                        )
                        .slice(0, 5)
                        .map((item) => (
                          <Pressable
                            key={item.name}
                            onPress={() => openIngredient(item.name)}
                            style={styles.habitRow}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${item.name} details`}
                          >
                            <View style={styles.habitInfo}>
                              <Text style={styles.habitName}>{item.name}</Text>
                              <Text style={styles.habitDetails}>
                                Added {item.timesEntered} times
                              </Text>
                            </View>
                            <Text style={styles.habitValue}>
                              Every {item.averageDaysBetween} days
                            </Text>
                            <Text style={styles.rowChevron}>›</Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Food Usage Timing</Text>
                  <Text style={styles.sectionSubtitle}>
                    Average time foods spend in your pantry before use.
                  </Text>
                  <Text style={styles.dataScope}>
                    All-time completed food lifecycles
                  </Text>
                  {timingStats.filter(
                    (item) => item.averageDaysBeforeUse !== null,
                  ).length === 0 ? (
                    <EmptyMessage message="Not enough completed food history to calculate usage timing." />
                  ) : (
                    <View style={styles.card}>
                      {timingStats
                        .filter((item) => item.averageDaysBeforeUse !== null)
                        .slice(0, 5)
                        .map((item) => (
                          <Pressable
                            key={item.name}
                            onPress={() => openIngredient(item.name)}
                            style={styles.habitRow}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${item.name} details`}
                          >
                            <View style={styles.habitInfo}>
                              <Text style={styles.habitName}>{item.name}</Text>
                              <Text style={styles.habitDetails}>
                                {item.usedSamples} tracked uses
                              </Text>
                            </View>
                            <Text style={styles.habitValue}>
                              {item.averageDaysBeforeUse} days
                            </Text>
                            <Text style={styles.rowChevron}>›</Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>KitchenBuddy Insights</Text>
                  <Text style={styles.sectionSubtitle}>
                    Recommendations based on your tracked food habits.
                  </Text>
                  {insights.length === 0 ? (
                    <EmptyMessage message="Keep tracking your pantry activity to unlock personalized insights." />
                  ) : (
                    insights.map((insight) => (
                      <View key={insight.id} style={styles.insightCard}>
                        <View style={styles.insightHeader}>
                          <Text style={styles.insightIcon}>
                            {insight.severity === "warning"
                              ? "⚠️"
                              : insight.severity === "positive"
                                ? "✓"
                                : "💡"}
                          </Text>
                          <Text style={styles.insightTitle}>
                            {insight.title}
                          </Text>
                        </View>
                        <Text style={styles.insightMessage}>
                          {insight.message}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#171717",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: "#6B6B6B",
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#EAEAEA",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777777",
  },
  tabTextActive: {
    color: "#171717",
    fontWeight: "700",
  },
  rangeSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  rangeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  rangeButtonActive: {
    backgroundColor: "#171717",
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
  },
  rangeButtonTextActive: {
    color: "#FFFFFF",
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#777777",
    marginBottom: 14,
  },
  dataScope: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 10,
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  statValue: {
    fontSize: 25,
    fontWeight: "700",
    color: "#171717",
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#777777",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#777777",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 12,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  trendMonth: {
    width: 72,
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EAEAEA",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 6,
  },
  trendPercent: {
    width: 42,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: "#171717",
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: "#888888",
    marginTop: 6,
  },
  emptyCard: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#888888",
    textAlign: "center",
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rankingName: {
    flex: 1,
    fontSize: 14,
    color: "#333333",
    marginRight: 12,
  },
  rankingCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#171717",
  },
  rowChevron: {
    fontSize: 22,
    color: "#AAAAAA",
    marginLeft: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryPercent: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  categoryDetails: {
    fontSize: 12,
    color: "#777777",
    marginTop: 10,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 12,
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  habitDetails: {
    fontSize: 12,
    color: "#888888",
    marginTop: 4,
  },
  habitValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#171717",
    textAlign: "right",
    maxWidth: 120,
  },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 18,
  },
  insightTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: "#666666",
  },
});
