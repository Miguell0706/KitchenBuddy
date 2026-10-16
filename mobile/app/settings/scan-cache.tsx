import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
import {
  listFixes,
  removeFix,
  clearFixStore,
  type ItemFix,
} from "@/features/scan/fixStore";

type FixRow = {
  key: string;
  canonicalName: string;
  categoryKey: string;
  expiryMode: ItemFix["expiryMode"];
  expiryDays: number | null;
  timesUsed: number;
  updatedAt: number | null;
};

const P = {
  ivory: "#F8F6F1",
  paper: "#FFFEFB",
  slate: "#586D77",
  slateDeep: "#405762",
  ink: "#313A3C",
  muted: "#777B78",
  taupe: "#B8AA98",
  border: "#E8E2D9",
  wash: "#F1EDE6",
  paleBlue: "#EBF0F1",
  red: "#9B5550",
  paleRed: "#F8EEEB",
};

function formatWhen(timestamp: number | null): string {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) {
    return "Date unavailable";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function formatExpiry(row: FixRow): string {
  if (row.expiryMode === "days" && row.expiryDays != null) {
    return `${row.expiryDays} day${row.expiryDays === 1 ? "" : "s"}`;
  }
  return "No saved expiry override";
}

export default function ScanCacheScreen() {
  const [map, setMap] = useState<Record<string, ItemFix>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    const byKey = await listFixes();
    setMap(byKey);
    setLoadError(false);
  }, []);

  // The local fix store can change elsewhere, so reload on every focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError(false);
      async function load() {
        try {
          const byKey = await listFixes();
          if (active) setMap(byKey);
        } catch (error) {
          console.warn("Could not load saved scan corrections:", error);
          if (active) setLoadError(true);
        } finally {
          if (active) setLoading(false);
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  const total = Object.keys(map).length;
  const rows = useMemo((): FixRow[] => {
    const all = Object.entries(map).map(([key, fix]) => ({
      key,
      canonicalName: fix.canonicalName?.trim() ?? "",
      categoryKey: fix.categoryKey ?? "",
      expiryMode: fix.expiryMode,
      expiryDays: fix.expiryDays ?? null,
      timesUsed: fix.timesUsed ?? 0,
      updatedAt: fix.updatedAt ?? null,
    }));
    all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const search = query.trim().toLowerCase();
    if (!search) return all;
    return all.filter((row) =>
      [
        row.key,
        row.canonicalName,
        row.categoryKey,
        formatExpiry(row),
        String(row.expiryDays ?? ""),
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [map, query]);
  const busy = busyKey !== null;

  const onDeleteOne = (key: string) => {
    if (busy) return;
    Alert.alert(
      "Delete saved correction?",
      "KitchenBuddy will stop using this correction for future scans. Existing pantry items will not be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyKey(key);
              try {
                await removeFix(key);
                await refresh();
              } catch (error) {
                console.warn("Could not remove saved correction:", error);
                Alert.alert("Unable to delete", "Please try again.");
              } finally {
                setBusyKey(null);
              }
            })();
          },
        },
      ],
    );
  };

  const onClearAll = () => {
    if (busy || total === 0) return;
    Alert.alert(
      "Clear all saved corrections?",
      `Remove all ${total} local scan correction${total === 1 ? "" : "s"}? Future scans will no longer use them. Your existing pantry items will stay intact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyKey("__clear_all__");
              try {
                await clearFixStore();
                await refresh();
              } catch (error) {
                console.warn("Could not clear saved corrections:", error);
                Alert.alert("Unable to clear", "Please try again.");
              } finally {
                setBusyKey(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Saved Scan Corrections",
          headerBackTitle: "Settings",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>YOUR SCAN PREFERENCES</Text>
          <Text style={styles.pageTitle}>Saved corrections.</Text>
          <Text style={styles.pageSubtitle}>
            A record of the adjustments KitchenBuddy remembers when you scan
            your groceries.
          </Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="create-outline" size={23} color={P.paper} />
            </View>
            <Text style={styles.heroEyebrow}>PERSONALIZED RECOGNITION</Text>
          </View>
          <View style={styles.heroCountRow}>
            <Text style={styles.heroCount}>{loading ? "—" : total}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>
                Saved {total === 1 ? "correction" : "corrections"}
              </Text>
              <Text style={styles.heroText}>
                Applied locally when matching scanned text is recognized again.
              </Text>
            </View>
          </View>
          <View style={styles.heroRule} />
          <View style={styles.heroFoot}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color="#E9E5DD"
            />
            <Text style={styles.heroFootText}>
              Removing a correction never deletes an existing pantry item.
            </Text>
          </View>
        </View>

        <View style={styles.controlsCard}>
          <Text style={styles.sectionEyebrow}>FIND A CORRECTION</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={P.slate} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, scanned text, category…"
              placeholderTextColor={P.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search saved scan corrections"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={P.muted} />
              </Pressable>
            )}
          </View>
          <View style={styles.controlFooter}>
            <Text style={styles.resultCount}>
              {loading
                ? "Loading…"
                : query.trim()
                  ? `${rows.length} of ${total} shown`
                  : `${total} saved`}
            </Text>
            <Pressable
              onPress={onClearAll}
              disabled={loading || busy || total === 0}
              accessibilityRole="button"
              accessibilityLabel="Clear all saved corrections"
              style={[
                styles.clearButton,
                (loading || busy || total === 0) && styles.disabled,
              ]}
            >
              {busyKey === "__clear_all__" ? (
                <ActivityIndicator size="small" color={P.red} />
              ) : (
                <Ionicons name="trash-outline" size={15} color={P.red} />
              )}
              <Text style={styles.clearButtonText}>Clear all</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Your corrections</Text>
          <Text style={styles.listHint}>Newest first</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={P.slate} />
            <Text style={styles.stateText}>Loading corrections…</Text>
          </View>
        ) : loadError ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={P.slate} />
            <Text style={styles.stateTitle}>Unable to load corrections</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void refresh()
                  .catch((error) => {
                    console.warn(
                      "Retrying scan correction load failed:",
                      error,
                    );
                    setLoadError(true);
                  })
                  .finally(() => setLoading(false));
              }}
              accessibilityRole="button"
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={total === 0 ? "document-text-outline" : "search-outline"}
                size={28}
                color={P.slate}
              />
            </View>
            <Text style={styles.stateTitle}>
              {total === 0
                ? "No saved corrections yet"
                : "No matching corrections"}
            </Text>
            <Text style={styles.stateText}>
              {total === 0
                ? "Adjustments you save while reviewing scans will appear here."
                : "Try another name, category, or scanned text."}
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={row.key} style={styles.fixCard}>
              <View style={styles.fixTop}>
                <View style={styles.fixIcon}>
                  <Ionicons name="receipt-outline" size={20} color={P.slate} />
                </View>
                <View style={styles.fixHeading}>
                  <Text style={styles.fixTitle} numberOfLines={2}>
                    {row.canonicalName || "Saved correction"}
                  </Text>
                  <Text style={styles.fixDate}>
                    {formatWhen(row.updatedAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onDeleteOne(row.key)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete correction for ${row.key}`}
                  style={[styles.deleteButton, busy && styles.disabled]}
                >
                  {busyKey === row.key ? (
                    <ActivityIndicator size="small" color={P.red} />
                  ) : (
                    <Ionicons name="trash-outline" size={17} color={P.red} />
                  )}
                </Pressable>
              </View>
              <View style={styles.originalBox}>
                <Text style={styles.fieldLabel}>ORIGINAL SCANNED TEXT</Text>
                <Text style={styles.originalText} selectable>
                  {row.key}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailCell}>
                  <Text style={styles.fieldLabel}>CATEGORY</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {row.categoryKey || "No saved category override"}
                  </Text>
                </View>
                <View style={[styles.detailCell, styles.detailCellRight]}>
                  <Text style={styles.fieldLabel}>EXPIRY</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {formatExpiry(row)}
                  </Text>
                </View>
              </View>
              <View style={styles.fixFooter}>
                <Ionicons name="repeat-outline" size={15} color={P.slate} />
                <Text style={styles.reuseText}>Reused {row.timesUsed}×</Text>
                <Text style={styles.localLabel}>SAVED ON THIS DEVICE</Text>
              </View>
            </View>
          ))
        )}
        <Text style={styles.pageFooter}>KitchenBuddy · Scan corrections</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.ivory },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 65 },
  heading: { marginBottom: 20 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: P.slate,
    marginBottom: 7,
  },
  pageTitle: {
    fontSize: 31,
    lineHeight: 38,
    fontFamily: "serif",
    color: P.ink,
  },
  pageSubtitle: {
    fontSize: 13,
    color: P.muted,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 345,
  },
  hero: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: P.slate,
    marginBottom: 17,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#F3E9DC",
  },
  heroCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
    marginTop: 16,
  },
  heroCount: {
    fontSize: 48,
    lineHeight: 57,
    fontFamily: "serif",
    color: P.paper,
  },
  heroTitle: { fontSize: 17, fontWeight: "700", color: P.paper },
  heroText: { fontSize: 12, color: "#E9EAE7", lineHeight: 18, marginTop: 3 },
  heroRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.32)",
    marginVertical: 16,
  },
  heroFoot: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  heroFootText: { color: "#E9E5DD", fontSize: 11, lineHeight: 17, flex: 1 },
  controlsCard: {
    backgroundColor: P.paper,
    padding: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 23,
  },
  sectionEyebrow: {
    fontSize: 10,
    color: P.slate,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 11,
  },
  searchBox: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: P.ivory,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: P.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: P.ink,
    paddingVertical: 9,
    minWidth: 0,
  },
  controlFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  resultCount: { color: P.muted, fontSize: 12 },
  clearButton: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: P.paleRed,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  clearButtonText: { color: P.red, fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  listHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 23, fontFamily: "serif", color: P.ink },
  listHint: { fontSize: 11, color: P.muted },
  fixCard: {
    padding: 15,
    backgroundColor: P.paper,
    borderRadius: 18,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: P.border,
  },
  fixTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  fixIcon: {
    backgroundColor: P.paleBlue,
    height: 39,
    width: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  fixHeading: { flex: 1, minWidth: 0 },
  fixTitle: { color: P.ink, fontSize: 15, fontWeight: "700" },
  fixDate: { color: P.muted, fontSize: 11, marginTop: 4 },
  deleteButton: {
    width: 37,
    height: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.paleRed,
    borderRadius: 11,
  },
  originalBox: {
    backgroundColor: P.ivory,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: P.muted,
    marginBottom: 5,
  },
  originalText: { fontSize: 13, color: P.ink, fontWeight: "600" },
  detailRow: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  detailCell: { flex: 1 },
  detailCellRight: {
    borderLeftWidth: 1,
    borderColor: P.border,
    paddingLeft: 12,
  },
  detailValue: { color: P.ink, fontSize: 12, lineHeight: 18 },
  fixFooter: {
    borderTopWidth: 1,
    borderTopColor: P.border,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reuseText: { color: P.slate, fontSize: 11, fontWeight: "700" },
  localLabel: {
    marginLeft: "auto",
    fontSize: 9,
    letterSpacing: 0.4,
    fontWeight: "700",
    color: P.taupe,
  },
  stateCard: {
    minHeight: 168,
    backgroundColor: P.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 23,
    gap: 9,
  },
  emptyIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: P.paleBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  stateTitle: {
    color: P.ink,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  stateText: {
    color: P.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: P.paleBlue,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: { color: P.slateDeep, fontWeight: "700", fontSize: 13 },
  pageFooter: {
    textAlign: "center",
    color: P.taupe,
    fontSize: 11,
    marginTop: 16,
  },
});
