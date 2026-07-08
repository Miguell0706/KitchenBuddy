import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import {
  getScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/features/scan/historyStorage";

export default function ScanHistoryScreen() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const insets = useSafeAreaInsets();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const load = useCallback(async () => {
    const data = await getScanHistory();
    setEntries(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  async function onClear() {
    if (!entries.length) return;
    Alert.alert("Clear history", "Remove all saved scans?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearScanHistory();
          load();
        },
      },
    ]);
  }

  const renderItem = ({ item }: { item: ScanHistoryEntry }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setSelectedImageUri(item.imageUri)}
    >
      <View style={styles.card}>
        <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />

        <View style={styles.info}>
          <Text style={styles.title}>Receipt</Text>
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>◀ Back</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Previous Scans</Text>

        <TouchableOpacity onPress={onClear} disabled={!entries.length}>
          <Text style={[styles.clearText, !entries.length && { opacity: 0.3 }]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No previous scans yet.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
      <Modal
        visible={!!selectedImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUri(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedImageUri(null)}
        >
          {selectedImageUri ? (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfc",
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
  },
  clearText: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  info: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: "#666",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
});
