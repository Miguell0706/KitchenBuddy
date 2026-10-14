import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { Colors, Spacing } from "@/constants/theme";
import { CardStyles, Layout, TextStyles } from "@/constants/styles";
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

  // Refresh each time this screen comes into focus.
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
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[Layout.rowBetween, { marginBottom: Spacing.md }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={TextStyles.screenTitle}>Saved Scan Corrections</Text>
          <Text style={TextStyles.bodyMuted}>
            Corrections you make to scanned items are saved on this device and
            can be applied when the same scanned text is recognized again.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            padding: 8,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.05)",
          }}
        >
          <Ionicons name="close" size={18} color={Colors.text} />
        </Pressable>
      </View>

      <View style={[CardStyles.subtle, { marginBottom: Spacing.md }]}>
        <Text style={TextStyles.sectionTitle}>Your corrections</Text>
        <Text style={[TextStyles.small, { marginTop: 6 }]}>
          Removing corrections only affects future scans, not existing pantry
          items.
        </Text>

        <View
          style={{
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.03)",
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={Colors.textLight}
            style={{ marginRight: 10 }}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search scanned text, name, category…"
            placeholderTextColor={Colors.textLight}
            style={[TextStyles.body, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search saved scan corrections"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={{ padding: 4 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.textLight}
              />
            </Pressable>
          )}
        </View>

        <View style={[Layout.rowBetween, { marginTop: 12 }]}>
          <Text style={TextStyles.small}>
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
            style={{
              opacity: loading || busy || total === 0 ? 0.5 : 1,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.04)",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {busyKey === "__clear_all__" && (
              <ActivityIndicator size="small" color={Colors.text} />
            )}
            <Text style={TextStyles.small}>Clear all</Text>
          </Pressable>
        </View>
      </View>

      <View style={CardStyles.subtle}>
        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={[TextStyles.bodyMuted, { marginTop: 8 }]}>
              Loading corrections…
            </Text>
          </View>
        ) : loadError ? (
          <View style={{ paddingVertical: 18 }}>
            <Text style={TextStyles.body}>
              Unable to load saved corrections.
            </Text>
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
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: Colors.primary, fontWeight: "600" }}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 18 }}>
            <Text style={TextStyles.body}>
              {total === 0
                ? "No saved corrections yet."
                : "No matching corrections."}
            </Text>
            <Text style={[TextStyles.bodyMuted, { marginTop: 5 }]}>
              {total === 0
                ? "Corrections you save while reviewing scans will appear here."
                : "Try another name, category, or scanned text."}
            </Text>
          </View>
        ) : (
          rows.map((row, index) => (
            <View
              key={row.key}
              style={{
                paddingVertical: 14,
                borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                borderBottomColor: "rgba(0,0,0,0.06)",
              }}
            >
              <View style={[Layout.rowBetween, { marginBottom: 8, gap: 8 }]}>
                <Text
                  style={[
                    TextStyles.small,
                    { color: Colors.textLight, flex: 1 },
                  ]}
                >
                  {formatWhen(row.updatedAt)} · Reused {row.timesUsed}×
                </Text>
                <Pressable
                  onPress={() => onDeleteOne(row.key)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete correction for ${row.key}`}
                  style={{
                    opacity: busy ? 0.5 : 1,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,0,0,0.08)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {busyKey === row.key && (
                    <ActivityIndicator size="small" color="rgba(180,0,0,1)" />
                  )}
                  <Text
                    style={[TextStyles.small, { color: "rgba(180,0,0,1)" }]}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>

              <Text style={[TextStyles.small, { color: Colors.textLight }]}>
                Scanned text (normalized)
              </Text>
              <Text style={[TextStyles.body, { marginBottom: 10 }]} selectable>
                {row.key}
              </Text>
              <Text style={[TextStyles.small, { color: Colors.textLight }]}>
                Saved correction
              </Text>
              <Text
                style={[TextStyles.body, { fontWeight: "600", marginTop: 3 }]}
              >
                {row.canonicalName || "No saved name override"}
              </Text>
              <Text style={[TextStyles.small, { marginTop: 5 }]}>
                Category: {row.categoryKey || "No saved category override"}
              </Text>
              <Text style={[TextStyles.small, { marginTop: 3 }]}>
                Expiry: {formatExpiry(row)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
