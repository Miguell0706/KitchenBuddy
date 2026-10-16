import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import {
  getScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/features/scan/historyStorage";

// Matches KitchenBuddy's redesigned Settings, Pantry History, and About pages.
const P = {
  ivory: "#F8F6F1",
  paper: "#FFFEFB",
  slate: "#586D77",
  slateDeep: "#405762",
  charcoal: "#313A3C",
  muted: "#777B78",
  taupe: "#B8AA98",
  border: "#E8E2D9",
  wash: "#F1EDE6",
  paleBlue: "#EBF0F1",
  red: "#9B5550",
  paleRed: "#F8EEEB",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

export default function ScanHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getScanHistory();
    setEntries(data);
    setLoadError(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError(false);
      async function refreshOnFocus() {
        try {
          const data = await getScanHistory();
          if (active) setEntries(data);
        } catch (error) {
          console.warn("Unable to load scan history:", error);
          if (active) setLoadError(true);
        } finally {
          if (active) setLoading(false);
        }
      }
      void refreshOnFocus();
      return () => {
        active = false;
      };
    }, []),
  );

  function onClear() {
    if (!entries.length || clearing || loading) return;
    Alert.alert(
      "Clear scan history?",
      `Remove all ${entries.length} saved ${entries.length === 1 ? "scan" : "scans"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear history",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setClearing(true);
              try {
                await clearScanHistory();
                await load();
              } catch (error) {
                console.warn("Unable to clear scan history:", error);
                Alert.alert("Unable to clear history", "Please try again.");
              } finally {
                setClearing(false);
              }
            })();
          },
        },
      ],
    );
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: ScanHistoryEntry;
    index: number;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View receipt scanned ${formatDate(item.createdAt)}`}
      onPress={() => setSelectedImageUri(item.imageUri)}
      style={({ pressed }) => [styles.scanCard, pressed && styles.pressed]}
    >
      <View style={styles.thumbnailWrap}>
        <Image
          source={{ uri: item.imageUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      </View>
      <View style={styles.scanInfo}>
        <Text style={styles.scanOverline}>
          SAVED RECEIPT {String(index + 1).padStart(2, "0")}
        </Text>
        <Text style={styles.scanTitle}>Grocery receipt</Text>
        <View style={styles.dateRow}>
          <Ionicons name="time-outline" size={13} color={P.muted} />
          <Text style={styles.scanDate} numberOfLines={2}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text style={styles.scanHint}>Tap to view full receipt</Text>
      </View>
      <View style={styles.chevronWrap}>
        <Ionicons name="expand-outline" size={19} color={P.slate} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={P.slateDeep} />
        </Pressable>
        <Text style={styles.topTitle}>Previous Scans</Text>
        <View style={styles.topTrailing}>
          <Ionicons name="receipt-outline" size={22} color={P.slate} />
        </View>
      </View>

      <FlatList
        data={loading || loadError ? [] : entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 38 },
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="receipt-outline" size={15} color="#EDE6DA" />
                <Text style={styles.eyebrow}>YOUR RECEIPT JOURNAL</Text>
              </View>
              <Text style={styles.heroTitle}>Every little shop, saved.</Text>
              <Text style={styles.heroSubtitle}>
                Take another look at the receipts you've scanned along the way.
              </Text>
              <View style={styles.heroFooter}>
                <View style={styles.heroCountIcon}>
                  <Ionicons name="albums-outline" size={17} color={P.ivory} />
                </View>
                <Text style={styles.heroCount}>
                  {loading
                    ? "Loading your scans"
                    : `${entries.length} saved ${entries.length === 1 ? "receipt" : "receipts"}`}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Your saved scans</Text>
                <Text style={styles.sectionSubtitle}>
                  Select a receipt to see the full image.
                </Text>
              </View>
              <Pressable
                onPress={onClear}
                disabled={loading || clearing || entries.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Clear all saved receipt scans"
                style={({ pressed }) => [
                  styles.clearButton,
                  (loading || clearing || entries.length === 0) &&
                    styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {clearing ? (
                  <ActivityIndicator size="small" color={P.red} />
                ) : (
                  <Ionicons name="trash-outline" size={15} color={P.red} />
                )}
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={P.slate} size="large" />
              <Text style={styles.emptyTitle}>Loading your receipts…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={27}
                  color={P.slate}
                />
              </View>
              <Text style={styles.emptyTitle}>Couldn't load your scans</Text>
              <Text style={styles.emptyDescription}>
                Your saved scans could not be opened right now.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  void load()
                    .catch((error) => {
                      console.warn("Scan history retry failed:", error);
                      setLoadError(true);
                    })
                    .finally(() => setLoading(false));
                }}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={29} color={P.slate} />
              </View>
              <Text style={styles.emptyTitle}>
                Your receipt journal starts here.
              </Text>
              <Text style={styles.emptyDescription}>
                Receipts you scan with KitchenBuddy will appear here for you to
                revisit.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && entries.length > 0 && !loadError ? (
            <View style={styles.footerNote}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={P.slate}
              />
              <Text style={styles.footerText}>
                Saved receipt images are available to revisit here.
              </Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={selectedImageUri !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedImageUri(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={[styles.modalClose, { top: insets.top + 20 }]}
            accessibilityRole="button"
            accessibilityLabel="Close full receipt"
            onPress={() => setSelectedImageUri(null)}
          >
            <Ionicons name="close" color="#FFFFFF" size={24} />
          </Pressable>
          {selectedImageUri ? (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
          <Text style={[styles.modalCaption, { bottom: insets.bottom + 20 }]}>
            Your saved receipt
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.ivory },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
  },
  topTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: P.charcoal },
  topTrailing: { width: 40, alignItems: "center" },
  listContent: { paddingHorizontal: 18, flexGrow: 1 },
  hero: {
    backgroundColor: P.slate,
    borderRadius: 25,
    paddingHorizontal: 23,
    paddingTop: 24,
    paddingBottom: 21,
    marginBottom: 24,
    overflow: "hidden",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 13,
  },
  eyebrow: {
    color: "#EDE6DA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: P.paper,
    fontFamily: "Georgia",
    fontSize: 29,
    lineHeight: 36,
    maxWidth: 275,
  },
  heroSubtitle: {
    color: "#E6E9E7",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 305,
  },
  heroFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
    marginTop: 21,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  heroCountIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroCount: { color: P.paper, fontSize: 12, fontWeight: "700" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 13,
  },
  sectionTitle: { color: P.charcoal, fontFamily: "Georgia", fontSize: 23 },
  sectionSubtitle: {
    marginTop: 4,
    color: P.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: P.paleRed,
    borderWidth: 1,
    borderColor: "#EBD7D2",
  },
  clearText: { fontSize: 12, fontWeight: "700", color: P.red },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7 },
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: P.paper,
    borderRadius: 19,
    padding: 11,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: P.border,
    gap: 12,
  },
  thumbnailWrap: {
    width: 81,
    height: 91,
    borderRadius: 12,
    backgroundColor: P.wash,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: "100%" },
  scanInfo: { flex: 1, justifyContent: "center", minWidth: 0 },
  scanOverline: {
    color: P.taupe,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 5,
  },
  scanTitle: {
    color: P.charcoal,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  dateRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  scanDate: { color: P.muted, fontSize: 11, flexShrink: 1 },
  scanHint: { color: P.slate, fontSize: 11, fontWeight: "600", marginTop: 8 },
  chevronWrap: {
    alignSelf: "center",
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: P.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 20,
    padding: 27,
    backgroundColor: P.paper,
    alignItems: "center",
    marginTop: 4,
    gap: 9,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: P.paleBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    textAlign: "center",
    color: P.charcoal,
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: P.muted,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: P.slate,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 5,
  },
  retryText: { color: P.paper, fontSize: 13, fontWeight: "700" },
  footerNote: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: P.paleBlue,
    borderRadius: 13,
    padding: 13,
    marginTop: 7,
    alignItems: "center",
  },
  footerText: { color: P.slateDeep, fontSize: 12, flex: 1, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(19,25,29,0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 65,
  },
  modalClose: {
    position: "absolute",
    right: 20,
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  fullImage: { width: "100%", height: "100%" },
  modalCaption: {
    position: "absolute",
    color: "#ECE7DE",
    fontSize: 12,
    fontWeight: "600",
  },
});
