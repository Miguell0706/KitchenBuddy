// src/features/scan/historyStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "scan_history_v1";

export type ScanHistoryEntry = {
  id: string;
  imageUri: string;
  createdAt: string; // ISO date
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function readAll(): Promise<ScanHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(entries: ScanHistoryEntry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function addScanHistoryEntry(imageUri: string) {
  const all = await readAll();
  const next: ScanHistoryEntry = {
    id: randomId(),
    imageUri,
    createdAt: new Date().toISOString(),
  };
  await writeAll([next, ...all]); // newest first
}

export async function getScanHistory() {
  return readAll();
}

export async function clearScanHistory() {
  await writeAll([]);
}
