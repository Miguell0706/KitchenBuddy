import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { TextStyles, CardStyles, Layout } from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";
import {
  getPantryHistory,
  type PantryHistoryAction,
  type PantryHistoryEntry,
} from "@/features/pantry/history";

type Filter = "all" | PantryHistoryAction;

export default function PantryHistoryScreen() {
  const [entries, setEntries] = useState<PantryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    loadHistory();
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
  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={TextStyles.sectionTitle}>Pantry history</Text>

          <Text style={TextStyles.small}>
            See how items have moved through your pantry.
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />

        <FilterChip
          label="Added"
          active={filter === "added" || filter === "purchased"}
          onPress={() => setFilter("added")}
        />

        <FilterChip
          label="Used"
          active={filter === "used"}
          onPress={() => setFilter("used")}
        />

        <FilterChip
          label="Expired"
          active={filter === "expired"}
          onPress={() => setFilter("expired")}
        />

        <FilterChip
          label="Removed"
          active={filter === "removed"}
          onPress={() => setFilter("removed")}
        />
      </View>

      {/* Empty state / history */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="time-outline"
            size={36}
            color="rgba(120,120,120,0.6)"
          />

          <Text style={[TextStyles.body, { marginTop: Spacing.sm }]}>
            No history yet
          </Text>

          <Text style={TextStyles.small}>
            Pantry activity will appear here as you use KitchenBuddy.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.entryId}
          contentContainerStyle={{
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
          }}
          renderItem={({ item }) => <HistoryRow entry={item} />}
        />
      )}
    </View>
  );
}

/* ────────────── Row ────────────── */

function HistoryRow({ entry }: { entry: PantryHistoryEntry }) {
  const appearance = getActionAppearance(entry.action);

  const subtitleParts: string[] = [];

  if (entry.quantity) {
    subtitleParts.push(entry.quantity);
  }

  if (entry.categoryKey) {
    subtitleParts.push(formatCategory(entry.categoryKey));
  }

  if (entry.action === "purchased" && entry.source === "receipt") {
    subtitleParts.push("Receipt");
  }

  const subtitle = subtitleParts.join(" • ");

  return (
    <View style={[CardStyles.subtle, styles.rowCard]}>
      <View style={Layout.rowBetween}>
        <View style={styles.rowLeft}>
          <Text style={TextStyles.body} numberOfLines={1}>
            {entry.name}
          </Text>

          <Text style={TextStyles.small} numberOfLines={1}>
            {subtitle || "Pantry item"}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <View
            style={[styles.badge, { backgroundColor: appearance.background }]}
          >
            <Text style={[TextStyles.small, { color: appearance.color }]}>
              {appearance.label}
            </Text>
          </View>

          <Text style={[TextStyles.small, styles.timeText]}>
            {timeAgo(entry.at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ────────────── Filters ────────────── */

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
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[
          TextStyles.small,
          active ? styles.filterChipTextActive : styles.filterChipText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ────────────── Event appearance ────────────── */

function getActionAppearance(action: PantryHistoryAction): {
  label: string;
  color: string;
  background: string;
} {
  switch (action) {
    case "purchased":
      return {
        label: "Purchased",
        color: "rgba(20, 80, 150, 0.95)",
        background: "rgba(30, 120, 220, 0.10)",
      };

    case "added":
      return {
        label: "Added",
        color: "rgba(20, 80, 150, 0.95)",
        background: "rgba(30, 120, 220, 0.10)",
      };

    case "used":
      return {
        label: "Used",
        color: "rgba(30, 90, 35, 0.95)",
        background: "rgba(76, 175, 80, 0.10)",
      };

    case "expired":
      return {
        label: "Expired",
        color: "rgba(170, 80, 0, 0.95)",
        background: "rgba(255, 149, 0, 0.12)",
      };

    case "removed":
      return {
        label: "Removed",
        color: "rgb(170, 20, 20)",
        background: "rgba(255, 59, 48, 0.08)",
      };
  }
}

/* ────────────── Helpers ────────────── */

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

  if (day > 0) {
    return day === 1 ? "1 day ago" : `${day} days ago`;
  }

  if (hr > 0) {
    return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
  }

  if (min > 0) {
    return min === 1 ? "1 min ago" : `${min} mins ago`;
  }

  return "Just now";
}

/* ────────────── Styles ────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.background,
  },

  headerRow: {
    ...Layout.rowBetween,
    marginBottom: Spacing.md,
  },

  headerText: {
    flex: 1,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.sm,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.35)",
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },

  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(0,0,0,0.04)",
  },

  filterChipText: {
    color: Colors.textLight,
  },

  filterChipTextActive: {
    color: Colors.text,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  rowCard: {
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  rowLeft: {
    flex: 1,
    paddingRight: Spacing.md,
  },

  rowRight: {
    alignItems: "flex-end",
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },

  timeText: {
    color: Colors.textLight,
  },
});
