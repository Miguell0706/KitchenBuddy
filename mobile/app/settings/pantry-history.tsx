import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getPantryHistory,
  type PantryHistoryAction,
  type PantryHistoryEntry,
} from "@/features/pantry/history";

// Shared visual language with the redesigned KitchenBuddy Settings screens.
const PALETTE = {
  ivory: "#F8F6F0",
  paper: "#FFFEFB",
  slate: "#586D77",
  slateDark: "#405660",
  slatePale: "#E8EEF0",
  charcoal: "#30373B",
  muted: "#768087",
  taupe: "#AC9C89",
  line: "#E8E3DA",
  soft: "#F1EEE7",
  white: "#FFFFFF",
};

type Filter = "all" | PantryHistoryAction;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "added", label: "Added" },
  { key: "used", label: "Used" },
  { key: "expired", label: "Expired" },
  { key: "removed", label: "Removed" },
];

export default function PantryHistoryScreen() {
  const [entries, setEntries] = useState<PantryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await getPantryHistory();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "added") {
      return entries.filter(
        (entry) => entry.action === "added" || entry.action === "purchased",
      );
    }
    return entries.filter((entry) => entry.action === filter);
  }, [entries, filter]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.entryId}
        renderItem={({ item }) => <HistoryRow entry={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="time-outline" size={15} color="#F0E7DB" />
                <Text style={styles.eyebrow}>YOUR PANTRY JOURNAL</Text>
              </View>
              <Text style={styles.heroTitle}>
                A little history, a lot of insight.
              </Text>
              <Text style={styles.heroSubtitle}>
                See how groceries have moved through your kitchen, one item at a
                time.
              </Text>
              <View style={styles.heroBottom}>
                <View style={styles.heroCountIcon}>
                  <Ionicons name="receipt-outline" size={17} color="#F8F6F0" />
                </View>
                <Text style={styles.heroCount}>
                  {loading
                    ? "Loading your activity"
                    : `${entries.length} recorded ${entries.length === 1 ? "event" : "events"}`}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>YOUR ACTIVITY</Text>
                <Text style={styles.sectionTitle}>Pantry history</Text>
              </View>
              <Ionicons name="layers-outline" size={22} color={PALETTE.taupe} />
            </View>
            <View style={styles.filterRow}>
              {FILTERS.map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  active={
                    filter === option.key ||
                    (option.key === "added" && filter === "purchased")
                  }
                  onPress={() => setFilter(option.key)}
                />
              ))}
            </View>
            {!loading && filtered.length > 0 && (
              <Text style={styles.resultsLabel}>
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                {filter === "all"
                  ? ""
                  : ` · ${filter === "added" ? "Added & purchased" : (FILTERS.find((option) => option.key === filter)?.label ?? filter)}`}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={PALETTE.slate} />
              <Text style={styles.emptyDescription}>
                Loading pantry history...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="time-outline" size={27} color={PALETTE.slate} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "all"
                  ? "Your story starts here"
                  : "Nothing in this category yet"}
              </Text>
              <Text style={styles.emptyDescription}>
                {filter === "all"
                  ? "As you add, use, or remove pantry items, their activity will appear here."
                  : "Try another filter to see more of your pantry activity."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && filtered.length > 0 ? (
            <Text style={styles.footer}>
              A thoughtful record of your everyday kitchen.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

function HistoryRow({ entry }: { entry: PantryHistoryEntry }) {
  const appearance = getActionAppearance(entry.action);
  const subtitleParts: string[] = [];
  if (entry.quantity) subtitleParts.push(entry.quantity);
  if (entry.categoryKey) subtitleParts.push(formatCategory(entry.categoryKey));
  if (entry.action === "purchased" && entry.source === "receipt") {
    subtitleParts.push("Receipt");
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <View style={styles.rowCard}>
      <View
        style={[styles.actionIcon, { backgroundColor: appearance.background }]}
      >
        <Ionicons name={appearance.icon} size={21} color={appearance.color} />
      </View>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={2}>
          {entry.name}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>
          {subtitle || "Pantry item"}
        </Text>
        <Text style={styles.timeText}>{timeAgo(entry.at)}</Text>
      </View>
      <View
        style={[styles.actionBadge, { backgroundColor: appearance.background }]}
      >
        <Text style={[styles.actionBadgeText, { color: appearance.color }]}>
          {appearance.label}
        </Text>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getActionAppearance(action: PantryHistoryAction): {
  label: string;
  icon: IconName;
  color: string;
  background: string;
} {
  switch (action) {
    case "purchased":
      return {
        label: "Purchased",
        icon: "bag-check-outline",
        color: "#516B78",
        background: "#E8EEF0",
      };
    case "added":
      return {
        label: "Added",
        icon: "add-circle-outline",
        color: "#516B78",
        background: "#E8EEF0",
      };
    case "used":
      return {
        label: "Used",
        icon: "checkmark-circle-outline",
        color: "#617C68",
        background: "#E9F0E7",
      };
    case "expired":
      return {
        label: "Expired",
        icon: "calendar-outline",
        color: "#997348",
        background: "#F5EBDE",
      };
    case "removed":
      return {
        label: "Removed",
        icon: "trash-outline",
        color: "#98706C",
        background: "#F4E9E6",
      };
  }
}

function formatCategory(categoryKey: string): string {
  switch (categoryKey) {
    case "meatSeafood":
      return "Meat & Seafood";
    case "dairyEggs":
      return "Dairy & Eggs";
    default:
      return categoryKey
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase());
  }
}

function timeAgo(ts: number): string {
  const diffMs = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return day === 1 ? "1 day ago" : `${day} days ago`;
  if (hr > 0) return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
  if (min > 0) return min === 1 ? "1 min ago" : `${min} mins ago`;
  return "Just now";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.ivory },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 50,
    flexGrow: 1,
  },
  hero: {
    backgroundColor: PALETTE.slate,
    borderRadius: 24,
    padding: 22,
    marginBottom: 27,
    overflow: "hidden",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#F0E7DB",
  },
  heroTitle: {
    color: PALETTE.paper,
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 9,
  },
  heroSubtitle: {
    color: "#E2E7E7",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 310,
  },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 23,
  },
  heroCountIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#718590",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCount: { color: PALETTE.paper, fontWeight: "600", fontSize: 12 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    paddingHorizontal: 2,
  },
  sectionEyebrow: {
    color: PALETTE.taupe,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "Georgia",
    fontSize: 24,
    color: PALETTE.charcoal,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  filterChip: {
    backgroundColor: PALETTE.paper,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  filterChipActive: {
    backgroundColor: PALETTE.slate,
    borderColor: PALETTE.slate,
  },
  filterChipText: { color: PALETTE.muted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: PALETTE.white },
  pressed: { opacity: 0.75 },
  resultsLabel: {
    marginBottom: 12,
    marginLeft: 3,
    color: PALETTE.muted,
    fontSize: 12,
  },
  rowCard: {
    backgroundColor: PALETTE.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLeft: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: PALETTE.charcoal,
    marginBottom: 3,
  },
  rowSubtitle: { fontSize: 12, color: PALETTE.muted, lineHeight: 17 },
  timeText: {
    color: PALETTE.taupe,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  actionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  actionBadgeText: { fontSize: 10, fontWeight: "800" },
  emptyCard: {
    backgroundColor: PALETTE.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 24,
    paddingVertical: 42,
    alignItems: "center",
    marginTop: 12,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: PALETTE.slatePale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  emptyTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    color: PALETTE.charcoal,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    textAlign: "center",
    marginTop: 9,
  },
  footer: {
    color: PALETTE.taupe,
    textAlign: "center",
    fontSize: 11,
    marginTop: 17,
  },
});
