import React, { useCallback, useState } from "react";
import { usePremium } from "@/context/PremiumContext";
import { Ionicons } from "@expo/vector-icons";

const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  row: "#F2F0EC",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
};
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
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
    .replace(/[_-]/g, " ")
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
function PantryAnalyticsContent() {
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
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.ink,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        key={tab}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="analytics-outline" size={27} color={C.slate} />
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>YOUR KITCHEN, IN FOCUS</Text>
            </View>
          </View>
          <Text style={styles.heroEyebrow}>KITCHENBUDDY INSIGHTS</Text>
          <Text style={styles.heroTitle}>
            A clearer picture of your pantry.
          </Text>
          <Text style={styles.heroSubtitle}>
            Understand your food habits, celebrate what you use, and find ways
            to waste less.
          </Text>
          <View style={styles.heroBottom}>
            <Ionicons name="leaf-outline" size={16} color={C.cream} />
            <Text style={styles.heroBottomText}>
              Thoughtful insights from the food you track.
            </Text>
          </View>
        </View>
        <Text style={styles.selectorLabel}>EXPLORE YOUR INSIGHTS</Text>
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
        <Text style={styles.selectorLabel}>TIME PERIOD</Text>
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
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={C.slate} />
            <Text style={styles.loadingText}>Loading pantry analytics...</Text>
          </View>
        ) : (
          <>
            {/* ================= OVERVIEW ================= */}
            {tab === "overview" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionEyebrow}>THE BIG PICTURE</Text>
                  <Text style={styles.sectionTitle}>
                    Your pantry at a glance.
                  </Text>
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
                  <Text style={styles.sectionEyebrow}>MONTH BY MONTH</Text>
                  <Text style={styles.sectionTitle}>Monthly trends.</Text>
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
                  <Text style={styles.sectionEyebrow}>WHAT YOU REACH FOR</Text>
                  <Text style={styles.sectionTitle}>Food rankings.</Text>
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
                  <Text style={styles.sectionEyebrow}>CATEGORY BREAKDOWN</Text>
                  <Text style={styles.sectionTitle}>Category analytics.</Text>
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
                  <Text style={styles.sectionEyebrow}>YOUR ROUTINE</Text>
                  <Text style={styles.sectionTitle}>Purchase habits.</Text>
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
                  <Text style={styles.sectionEyebrow}>
                    FROM SHOPPING TO TABLE
                  </Text>
                  <Text style={styles.sectionTitle}>Food usage timing.</Text>
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
                  <Text style={styles.sectionEyebrow}>A LITTLE GUIDANCE</Text>
                  <Text style={styles.sectionTitle}>
                    KitchenBuddy insights.
                  </Text>
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
export default function PantryAnalyticsScreen() {
  const { isPremium, isLoading } = usePremium();
  const router = useRouter();
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            title: "Pantry Analytics",
            headerStyle: { backgroundColor: C.background },
            headerTintColor: C.ink,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.slate} />
          <Text style={styles.loadingText}>Checking your access...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen
          options={{
            title: "Pantry Analytics",
            headerStyle: { backgroundColor: C.background },
            headerTintColor: C.ink,
            headerShadowVisible: false,
          }}
        />
        <ScrollView
          contentContainerStyle={styles.premiumContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.premiumHero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="analytics-outline" size={28} color={C.slate} />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>KITCHENBUDDY PREMIUM</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>MORE INSIGHT, LESS WASTE</Text>
            <Text style={styles.heroTitle}>
              Get to know your kitchen better.
            </Text>
            <Text style={styles.heroSubtitle}>
              Unlock food usage trends, waste tracking, purchase habits, and
              personalized insights with KitchenBuddy Premium.
            </Text>
          </View>
          <View style={styles.premiumFeatureCard}>
            <View style={styles.premiumFeatureRow}>
              <Ionicons name="stats-chart-outline" size={21} color={C.slate} />
              <Text style={styles.premiumFeatureText}>
                Your food usage and waste trends
              </Text>
            </View>
            <View style={styles.premiumDivider} />
            <View style={styles.premiumFeatureRow}>
              <Ionicons name="basket-outline" size={21} color={C.slate} />
              <Text style={styles.premiumFeatureText}>
                Purchase habits and food rankings
              </Text>
            </View>
            <View style={styles.premiumDivider} />
            <View style={styles.premiumFeatureRow}>
              <Ionicons name="sparkles-outline" size={21} color={C.slate} />
              <Text style={styles.premiumFeatureText}>
                Insights based on your pantry history
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock KitchenBuddy Premium"
            onPress={() => router.push("/settings/premium")}
            style={({ pressed }) => [
              styles.premiumButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.premiumButtonText}>Explore Premium</Text>
            <Ionicons name="arrow-forward" size={18} color={C.paper} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <PantryAnalyticsContent />;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 65 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 28,
  },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 27,
    padding: 22,
    marginBottom: 23,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
    gap: 8,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: C.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  heroPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.13)",
    flexShrink: 1,
  },
  heroPillText: {
    color: C.cream,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "center",
  },
  heroEyebrow: {
    color: C.cream,
    letterSpacing: 1.8,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 9,
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 32,
    lineHeight: 39,
    color: C.paper,
    maxWidth: 330,
  },
  heroSubtitle: {
    color: "#E9EAE6",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.19)",
    marginTop: 22,
    paddingTop: 14,
    gap: 9,
  },
  heroBottomText: { color: C.cream, fontSize: 12, lineHeight: 18, flex: 1 },
  selectorLabel: {
    color: C.slate,
    letterSpacing: 1.6,
    fontWeight: "800",
    fontSize: 10,
    marginBottom: 10,
    marginLeft: 3,
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: C.taupe,
    borderRadius: 16,
    padding: 5,
    marginBottom: 19,
    gap: 3,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 2,
  },
  tabButtonActive: {
    backgroundColor: C.paper,
    shadowColor: C.ink,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  tabTextActive: { color: C.slateDark, fontWeight: "800" },
  rangeSelector: { flexDirection: "row", gap: 7, marginBottom: 27 },
  rangeButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  rangeButtonActive: { backgroundColor: C.slate, borderColor: C.slate },
  rangeButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
    textAlign: "center",
  },
  rangeButtonTextActive: { color: C.paper },
  section: { marginBottom: 25 },
  sectionEyebrow: {
    color: C.slate,
    letterSpacing: 1.5,
    fontWeight: "800",
    fontSize: 10,
    marginLeft: 2,
    marginBottom: 7,
  },
  sectionTitle: {
    fontFamily: "serif",
    fontSize: 25,
    lineHeight: 31,
    color: C.ink,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    marginBottom: 13,
  },
  dataScope: {
    fontSize: 11,
    color: C.slateDark,
    backgroundColor: C.taupe,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    alignSelf: "flex-start",
    overflow: "hidden",
    marginBottom: 13,
    fontWeight: "700",
  },
  statsRow: { flexDirection: "row", gap: 9, marginBottom: 9 },
  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 111,
    backgroundColor: C.paper,
    borderRadius: 17,
    paddingVertical: 18,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { fontFamily: "serif", fontSize: 28, color: C.slateDark },
  statLabel: {
    marginTop: 8,
    fontSize: 11,
    color: C.muted,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 28,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: C.muted, lineHeight: 19 },
  card: {
    backgroundColor: C.paper,
    borderRadius: 19,
    padding: 17,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 12,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  trendMonth: { width: 68, fontSize: 12, fontWeight: "700", color: C.ink },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 99,
    backgroundColor: C.taupe,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: C.slate, borderRadius: 99 },
  trendPercent: {
    width: 44,
    textAlign: "right",
    color: C.slateDark,
    fontSize: 12,
    fontWeight: "800",
  },
  footnote: { fontSize: 11, lineHeight: 18, color: C.muted, marginTop: 8 },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    padding: 24,
    backgroundColor: C.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    textAlign: "center",
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rankingName: {
    flex: 1,
    marginRight: 12,
    fontSize: 14,
    color: C.ink,
    fontWeight: "600",
  },
  rankingCount: {
    color: C.slateDark,
    fontSize: 15,
    fontWeight: "800",
    overflow: "hidden",
    backgroundColor: C.row,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
  },
  rowChevron: { fontSize: 21, color: C.muted, marginLeft: 9 },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    gap: 12,
  },
  categoryPercent: { fontSize: 16, fontWeight: "800", color: C.slateDark },
  categoryDetails: { color: C.muted, fontSize: 12, marginTop: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 9,
  },
  habitInfo: { flex: 1, minWidth: 0 },
  habitName: { fontSize: 14, fontWeight: "700", color: C.ink },
  habitDetails: { fontSize: 11, color: C.muted, marginTop: 5 },
  habitValue: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slateDark,
    textAlign: "right",
    maxWidth: 115,
  },
  insightCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    padding: 17,
    marginBottom: 11,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  insightIcon: { fontSize: 18, color: C.slateDark },
  insightTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: C.ink },
  insightMessage: { fontSize: 13, lineHeight: 21, color: C.muted },
  premiumContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 45,
    justifyContent: "center",
  },
  premiumHero: {
    backgroundColor: C.slate,
    borderRadius: 27,
    padding: 23,
    marginBottom: 15,
  },
  premiumFeatureCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    paddingHorizontal: 17,
    marginBottom: 18,
  },
  premiumFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 13,
  },
  premiumFeatureText: {
    color: C.ink,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    fontWeight: "600",
  },
  premiumDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 34,
  },
  premiumButton: {
    backgroundColor: C.slate,
    minHeight: 54,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  premiumButtonText: { color: C.paper, fontSize: 15, fontWeight: "800" },
});
