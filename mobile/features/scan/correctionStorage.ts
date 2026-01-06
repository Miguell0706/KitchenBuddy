import AsyncStorage from "@react-native-async-storage/async-storage";

export const CORRECTIONS_KEY = "scan_corrections_v1";

export type CorrectionRow = {
  key: string; // normalized key (or whatever you use)
  raw: string; // original OCR text
  corrected: string; // your corrected version
  updatedAt: number; // Date.now()
};

export type CorrectionsMap = Record<
  string,
  { raw: string; corrected: string; updatedAt: number }
>;

export async function loadCorrections(): Promise<CorrectionsMap> {
  const s = await AsyncStorage.getItem(CORRECTIONS_KEY);
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveCorrections(map: CorrectionsMap) {
  await AsyncStorage.setItem(CORRECTIONS_KEY, JSON.stringify(map));
}

export async function upsertCorrection(row: CorrectionRow) {
  const map = await loadCorrections();
  map[row.key] = {
    raw: row.raw,
    corrected: row.corrected,
    updatedAt: row.updatedAt,
  };
  await saveCorrections(map);
}

export async function deleteCorrection(key: string) {
  const map = await loadCorrections();
  delete map[key];
  await saveCorrections(map);
}

export async function clearCorrections() {
  await AsyncStorage.removeItem(CORRECTIONS_KEY);
}
