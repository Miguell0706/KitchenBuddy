import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
type OcrPhase =
  | "idle"
  | "preparing"
  | "uploading"
  | "reading"
  | "parsing"
  | "done";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [phase, setPhase] = useState<OcrPhase>("idle");

  // lets us cancel safely
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "preparing":
        return "Preparing image…";
      case "uploading":
        return "Uploading…";
      case "reading":
        return "Reading text…";
      case "parsing":
        return "Parsing items…";
      case "done":
        return "Done!";
      default:
        return "Idle";
    }
  }, [phase]);

  function cleanupTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function clearImage() {
    setImageUri(null);
    // also reset any OCR UI just in case
    setIsRunning(false);
    setPhase("idle");
    setProgress(0);
    cancelRef.current = false;
    cleanupTimer();
  }

  function cancelOcr() {
    cancelRef.current = true;
    cleanupTimer();
    setIsRunning(false);
    setPhase("idle");
    setProgress(0);
  }

  async function runFakeOcr(uri: string) {
    // reset state
    cancelRef.current = false;
    cleanupTimer();
    setIsRunning(true);
    setProgress(0);
    setPhase("preparing");

    // “scripted” feel: each phase has a target range of progress
    const steps: Array<{
      phase: OcrPhase;
      from: number;
      to: number;
      ms: number;
    }> = [
      { phase: "preparing", from: 0.0, to: 0.12, ms: 600 },
      { phase: "uploading", from: 0.12, to: 0.45, ms: 1200 },
      { phase: "reading", from: 0.45, to: 0.78, ms: 1400 },
      { phase: "parsing", from: 0.78, to: 0.97, ms: 900 },
    ];

    for (const s of steps) {
      if (cancelRef.current) return;
      setPhase(s.phase);

      // animate progress smoothly within this phase
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const tickMs = 80;

        timerRef.current = setInterval(() => {
          if (cancelRef.current) {
            cleanupTimer();
            resolve();
            return;
          }

          const t = clamp((Date.now() - start) / s.ms, 0, 1);
          // ease-out-ish
          const eased = 1 - Math.pow(1 - t, 2);
          const next = s.from + (s.to - s.from) * eased;

          setProgress(next);

          if (t >= 1) {
            cleanupTimer();
            resolve();
          }
        }, tickMs);
      });
    }

    if (cancelRef.current) return;

    // last tiny jump to 100%
    setPhase("done");
    setProgress(1);

    // pretend we got OCR output
    setTimeout(() => {
      if (cancelRef.current) return;

      setIsRunning(false);

      Alert.alert(
        "OCR Complete (stub)",
        "Next: map parsed items → an edit screen → add to pantry."
      );
    }, 350);
  }

  async function pickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });

    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera permission needed",
        "Enable camera access to scan receipts."
      );
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
    });

    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
    }
  }

  function startOcr() {
    if (!imageUri) return;
    runFakeOcr(imageUri);
  }

  const pct = Math.round(progress * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Scan Receipt</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.primaryBtn, isRunning && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={takePhoto}
          disabled={isRunning}
        >
          <Text style={styles.primaryBtnText}>Open Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, isRunning && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={pickFromGallery}
          disabled={isRunning}
        >
          <Text style={styles.secondaryBtnText}>Choose from Photos</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.removeBtn, isRunning && styles.btnDisabled]}
        activeOpacity={0.85}
        onPress={clearImage}
        disabled={isRunning}
      >
        <Text style={styles.removeBtnText}>Remove image</Text>
      </TouchableOpacity>

      {imageUri ? (
        <View style={styles.previewWrap}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />

          <TouchableOpacity
            style={[styles.ghostBtn, isRunning && styles.btnDisabled]}
            activeOpacity={0.85}
            onPress={startOcr}
            disabled={isRunning}
          >
            <Text style={styles.ghostBtnText}>Run OCR</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Loading / Progress */}
      {isRunning ? (
        <View style={styles.loadingCard}>
          <View style={styles.loadingHeader}>
            <Text style={styles.loadingTitle}>{phaseLabel}</Text>
            <Text style={styles.loadingPct}>{pct}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelOcr}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfc",
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 14,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#111",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  secondaryBtnText: { color: "#111", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.55 },
  helpText: {
    marginTop: 12,
    color: "#666",
    fontSize: 13,
    textAlign: "center",
  },
  previewWrap: { marginTop: 16 },
  previewTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  previewImage: {
    width: "100%",
    height: 260,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  ghostBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "transparent",
  },
  ghostBtnText: { color: "#111", fontSize: 15, fontWeight: "600" },

  // Loading card
  loadingCard: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  loadingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  loadingTitle: { fontSize: 16, fontWeight: "800" },
  loadingPct: { fontSize: 14, fontWeight: "700", color: "#333" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#111",
  },
  loadingSub: {
    marginTop: 10,
    color: "#666",
    fontSize: 13,
  },
  cancelBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 48, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.18)",
  },
  cancelBtnText: { color: "rgb(170, 20, 20)", fontSize: 15, fontWeight: "700" },
  removeBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  removeBtnText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
  },
});
