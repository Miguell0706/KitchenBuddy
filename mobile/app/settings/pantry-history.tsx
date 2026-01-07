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
  clearPantryHistory,
  type PantryHistoryEntry,
} from "@/features/pantry/history";

type Filter = "all" | "used" | "deleted";

export default function PantryHistoryScreen() {
  const [entries, setEntries] = useState<PantryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    const data = await getPantryHistory();
    setEntries(data);
    setLoading(false);
  }

  async function handleClear() {
    await clearPantryHistory();
    setEntries([]);
  }

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.action === filter);
  }, [entries, filter]);

  // 🔹 THIS MUST BE INSIDE AN `if`, not a bare return
  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator />
      </View>
    );
  }

  // 🔹 Main render
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={TextStyles.sectionTitle}>Pantry history</Text>
          <Text style={TextStyles.small}>
            Track items you&apos;ve marked used or deleted
          </Text>
        </View>

        {entries.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClear}
            style={styles.clearBtn}
          >
            <Ionicons name="trash-outline" size={16} color="rgb(170, 20, 20)" />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <FilterChip
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Used"
          active={filter === "used"}
          onPress={() => setFilter("used")}
        />
        <FilterChip
          label="Deleted"
          active={filter === "deleted"}
          onPress={() => setFilter("deleted")}
        />
      </View>

      {/* Empty state or list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="time-outline"
            size={36}
            color={"rgba(120,120,120,0.6)"}
          />
          <Text style={[TextStyles.body, { marginTop: Spacing.sm }]}>
            No history yet
          </Text>
          <Text style={TextStyles.small}>
            Items you mark as used or delete will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={{ paddingTop: Spacing.sm }}
          renderItem={({ item }) => <HistoryRow entry={item} />}
        />
      )}
    </View>
  );
}

/* ────────────── row + helpers ────────────── */

function HistoryRow({ entry }: { entry: PantryHistoryEntry }) {
  const actionLabel = entry.action === "used" ? "Used" : "Deleted";
  const actionColor =
    entry.action === "used" ? "rgba(30, 90, 35, 0.95)" : "rgb(170, 20, 20)";
  const actionBg =
    entry.action === "used"
      ? "rgba(76, 175, 80, 0.10)"
      : "rgba(255, 59, 48, 0.08)";

  const subtitleParts: string[] = [];
  if (entry.quantity) subtitleParts.push(entry.quantity);
  if (entry.categoryKey) subtitleParts.push(entry.categoryKey);
  const subtitle = subtitleParts.join(" • ");

  return (
    <View style={[CardStyles.subtle, styles.rowCard]}>
      <View style={Layout.rowBetween}>
        <View style={{ flex: 1, paddingRight: Spacing.md }}>
          <Text style={TextStyles.body} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={TextStyles.small} numberOfLines={1}>
            {subtitle || "No extra details"}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <View style={[styles.badge, { backgroundColor: actionBg }]}>
            <Text style={[TextStyles.small, { color: actionColor }]}>
              {actionLabel}
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

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return day === 1 ? "1 day ago" : `${day} days ago`;
  if (hr > 0) return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
  if (min > 0) return min === 1 ? "1 min ago" : `${min} mins ago`;
  return "Just now";
}

/* ────────────── styles ────────────── */

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
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  clearText: {
    ...TextStyles.small,
    color: "rgb(170, 20, 20)",
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(120,120,120,0.35)",
    marginRight: Spacing.xs,
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
