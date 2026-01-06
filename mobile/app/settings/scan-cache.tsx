import React, { useCallback, useMemo, useState } from "react";
import {
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

import { listFixes, removeFix, clearFixStore } from "@/features/scan/fixStore"; // <-- adjust path
import type { ItemFix } from "@/features/scan/fixStore";

function formatWhen(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function ScanCacheScreen() {
  const [map, setMap] = useState<Record<string, ItemFix>>({});
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const byKey = await listFixes();
    setMap(byKey);
    console.log("📦 listFixes count:", Object.keys(byKey).length);
  }, []);

  // ✅ refresh whenever you navigate to this screen
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const rows = useMemo(() => {
    const arr = Object.entries(map).map(([key, v]) => ({
      key,
      canonicalName: v.canonicalName ?? "",
      categoryKey: v.categoryKey ?? "",
      expiryDate: v.expiryDate ?? null,
      expiryMode: (v as any).expiryMode ?? "",
      timesUsed: v.timesUsed ?? 0,
      updatedAt: v.updatedAt ?? 0,
    }));

    arr.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const q = query.trim().toLowerCase();
    if (!q) return arr;

    return arr.filter((r) => {
      return (
        r.key.toLowerCase().includes(q) ||
        r.canonicalName.toLowerCase().includes(q) ||
        r.categoryKey.toLowerCase().includes(q) ||
        String(r.expiryDate ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [map, query]);

  async function onDeleteOne(key: string) {
    Alert.alert("Delete fix?", "Remove this saved correction/fix.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removeFix(key);
          await refresh();
        },
      },
    ]);
  }

  async function onClearAll() {
    Alert.alert("Clear all fixes?", "Remove all saved receipt corrections.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          await clearFixStore();
          await refresh();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl }}
    >
      <View style={[Layout.rowBetween, { marginBottom: Spacing.md }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={TextStyles.screenTitle}>Scan cache & corrections</Text>
          <Text style={TextStyles.bodyMuted}>
            Saved fixes that auto-apply to future scans.
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
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
        <Text style={TextStyles.sectionTitle}>Fixes</Text>

        <View
          style={{
            marginTop: 10,
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
            placeholder="Search key/name/category…"
            placeholderTextColor={Colors.textLight}
            style={[TextStyles.body, { flex: 1 }]}
            autoCapitalize="none"
          />
        </View>

        <View style={[Layout.rowBetween, { marginTop: 10 }]}>
          <Text style={TextStyles.small}>{Object.keys(map).length} saved</Text>

          <Pressable
            onPress={onClearAll}
            disabled={Object.keys(map).length === 0}
            style={{
              opacity: Object.keys(map).length === 0 ? 0.5 : 1,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: "rgba(0,0,0,0.04)",
            }}
          >
            <Text style={TextStyles.small}>Clear all</Text>
          </Pressable>
        </View>
      </View>

      <View style={[CardStyles.subtle]}>
        {rows.length === 0 ? (
          <View style={{ paddingVertical: 18 }}>
            <Text style={TextStyles.body}>No saved fixes found.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <View
              key={r.key}
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(0,0,0,0.06)",
              }}
            >
              <View style={[Layout.rowBetween, { marginBottom: 8 }]}>
                <Text style={[TextStyles.small, { color: Colors.textLight }]}>
                  {formatWhen(r.updatedAt)} • used {r.timesUsed}x
                </Text>

                <Pressable
                  onPress={() => onDeleteOne(r.key)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,0,0,0.08)",
                  }}
                >
                  <Text
                    style={[TextStyles.small, { color: "rgba(180,0,0,1)" }]}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>

              <Text style={[TextStyles.small, { color: Colors.textLight }]}>
                Key
              </Text>
              <Text style={[TextStyles.body, { marginBottom: 8 }]}>
                {r.key}
              </Text>

              <Text style={[TextStyles.small, { color: Colors.textLight }]}>
                Fix
              </Text>
              <Text style={TextStyles.body}>
                {r.canonicalName} • {r.categoryKey}
                {r.expiryDate ? ` • exp ${r.expiryDate}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
