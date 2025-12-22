import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

type ParsedItem = {
  id: string;
  name: string;
  sourceLine: string;
  selected: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

// ✅ hard stop trigger (once we hit this, stop parsing items)
function isTotalsStart(upper: string) {
  return (
    upper.includes("SUBTOTAL") ||
    upper === "TOTAL" ||
    upper.startsWith("TOTAL ") ||
    upper.startsWith("TAX ") ||
    upper === "TAX"
  );
}

/** Returns true if the line is store/meta/noise (not an item). */
function isNoiseOrMeta(upper: string) {
  // Explicit non-item phrases
  const noise = [
    "SAVE MONEY",
    "LIVE BETTER",
    "MGR:",
    "ST#",
    "OP#",
    "TR#",
    "ITEM",
    "AMEX",
    "VISA",
    "MASTERCARD",
    "CASH",
    "CHANGE",
    "PAYMENT",
    "APPROVED",
    "SIGNATURE",
    "THANK YOU",
    "TRANSACTION",
    "REF",
    "INVOICE",
    "CASHIER",
    "TERMS",
    "CASHIER",
    "YOUR CASHIER",
    "LANE",
    "REGISTER",
    "THANKS",
    "SURVEY",
    "SALES",
    "TAX",
    "TOTAL",
    "SAVED",
    "CREDIT",
    "DEBIT",
  ];

  if (noise.some((k) => upper.includes(k))) return true;
  if (upper.includes("CASHIER")) return true;
  if (/CASHI[EIA]R/.test(upper)) return true;
  if (upper.includes("CASH") && upper.includes("IER")) return true;

  // Store name (limited, intentional)
  if (upper.includes("WALMART")) return true;

  // Weight/math
  if (upper.includes("@")) return true;
  if (upper.includes("LB")) return true;

  // Numbers-only
  if (/^[\d\s.]+$/.test(upper)) return true;

  // Phone numbers
  if (/^\d{3}-\d{3}-\d{4}/.test(upper)) return true;

  // Address lines
  if (/^\d{3,}\s+[A-Z]/.test(upper)) return true;
  if (/\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(upper)) return true;

  return false;
}

function isMostlyLetters(s: string) {
  const letters = (s.match(/[A-Z]/gi) ?? []).length;
  const digits = (s.match(/\d/g) ?? []).length;
  return letters >= 3 && letters >= digits;
}

function cleanName(line: string) {
  let s = normalizeLine(line);

  // Drop trailing single-letter flags (F/E/T/X/I etc)
  s = s.replace(/\s+[A-Z]$/i, "").trim();

  // Drop long numeric codes at end (10-14 digits), with optional trailing letter
  s = s.replace(/\s+\d{10,14}[A-Z]?$/i, "").trim();

  // Drop codes like "000000004072KF"
  s = s.replace(/\s+\d{6,}[A-Z]{1,4}$/i, "").trim();

  // Drop trailing tiny fragments like "F" left behind
  s = s.replace(/\s+F$/i, "").trim();

  return s;
}

function parseReceiptNamesOnly(rawText: string): ParsedItem[] {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  const items: ParsedItem[] = [];

  for (const line of lines) {
    console.log("parseReceiptNamesOnly:", line);
    const upper = line.toUpperCase();

    // ✅ STOP once totals begin (prevents the huge repeated junk tail)
    if (isTotalsStart(upper)) break;

    if (isNoiseOrMeta(upper)) continue;

    // skip pure code lines (barcodes etc)
    if (/^\d{8,}[A-Z0-9]*$/i.test(upper)) continue;

    // skip price-flag lines like "5.48 T", "1.48 X", "5.48T"
    const compact = upper.replace(/\s+/g, "");
    if (/^\d+\.\d{2}[A-Z0-9]$/.test(compact)) continue;

    // keep only lines that look like item descriptions
    if (!isMostlyLetters(upper)) continue;

    const name = cleanName(line);
    if (name.length < 3) continue;

    items.push({
      id: uid(),
      name,
      sourceLine: line,
      selected: true,
    });
  }

  // De-dupe by normalized name (exact match only for now)
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = it.name.toUpperCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ScanEditScreen() {
  const params = useLocalSearchParams<{
    rawText?: string;
    imageUri?: string;
  }>();

  const rawText = typeof params.rawText === "string" ? params.rawText : "";
  const imageUri = typeof params.imageUri === "string" ? params.imageUri : "";

  const initialItems = useMemo(() => parseReceiptNamesOnly(rawText), [rawText]);
  const [items, setItems] = useState<ParsedItem[]>(initialItems);

  const selectedCount = items.filter((i) => i.selected).length;

  function toggleSelected(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  }

  function updateName(id: string, name: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function addSelectedToPantry() {
    const chosen = items.filter((i) => i.selected && i.name.trim().length > 0);
    if (chosen.length === 0) {
      Alert.alert("Nothing selected", "Select at least one item to add.");
      return;
    }

    Alert.alert(
      "Ready to add",
      `Selected ${chosen.length} item(s).\nNext: map → pantry store.`
    );

    // later:
    // usePantryStore.getState().bulkAddFromScan(chosen)
    // router.replace("/(tabs)/pantry");
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Review Scan</Text>

      {imageUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Detected items</Text>
        <Text style={styles.countText}>
          {selectedCount}/{items.length} selected
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No items detected</Text>
          <Text style={styles.emptySub}>
            Try a tighter crop on the receipt and rescan.
          </Text>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.listCard}>
          {items.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => toggleSelected(it.id)}
              style={[styles.row, !it.selected && styles.rowOff]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.checkbox}>{it.selected ? "☑" : "☐"}</Text>
                <Text style={styles.sourceLine} numberOfLines={1}>
                  {it.sourceLine}
                </Text>
              </View>

              <View style={styles.editRow}>
                <TextInput
                  value={it.name}
                  onChangeText={(t) => updateName(it.id, t)}
                  placeholder="Item name"
                  style={styles.nameInput}
                />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.primaryBtn, items.length === 0 && styles.btnDisabled]}
        onPress={addSelectedToPantry}
        disabled={items.length === 0}
      >
        <Text style={styles.primaryBtnText}>Add selected to pantry</Text>
      </Pressable>

      <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
        <Text style={styles.ghostBtnText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, backgroundColor: "#fdfdfc" },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  previewWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  previewImage: {
    width: "100%",
    height: 220,
    backgroundColor: "rgba(0,0,0,0.05)",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  countText: { fontSize: 13, fontWeight: "700", color: "#444" },

  listCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 14,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  rowOff: { opacity: 0.45 },
  rowTop: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  checkbox: { width: 28, fontSize: 16, fontWeight: "800" },
  sourceLine: { flex: 1, color: "#555", fontSize: 12 },

  editRow: { flexDirection: "row" },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },

  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#111",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },

  ghostBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  ghostBtnText: { color: "#111", fontSize: 15, fontWeight: "700" },

  emptyCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#666", marginBottom: 14 },
  backBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  backBtnText: { color: "#111", fontSize: 15, fontWeight: "700" },
});
