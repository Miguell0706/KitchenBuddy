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
import { router } from "expo-router";
import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";

type OcrPhase = "idle" | "preparing" | "reading" | "parsing" | "done";

type OcrHealth = {
  ok: boolean;
  hardFail: boolean;
  lineCount: number;
  charCount: number;
  letterCount: number;
  message?: string;
};

function normalizeLines(lines: string[]) {
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function getOcrHealthFromLines(lines: string[]): OcrHealth {
  const joined = lines.join("\n");
  const lineCount = lines.length;
  const charCount = joined.length;
  const letterCount = (joined.match(/[A-Za-z]/g) ?? []).length;

  const hardFail = lineCount < 10 || letterCount < 40;
  const ok = !hardFail && lineCount >= 18 && letterCount >= 120;

  let message: string | undefined;

  if (hardFail) {
    message =
      "We couldn’t read the receipt. Try retaking the photo closer, with better lighting, and filling the frame with just the receipt.";
  } else if (!ok) {
    message =
      "OCR may be incomplete. Try cropping tighter (single receipt), better lighting, and filling the frame.";
  }

  return {
    ok,
    hardFail,
    lineCount,
    charCount,
    letterCount,
    message,
  };
}

function textFromMlkitResult(result: any): string {
  // Different versions/exposed shapes sometimes use different key names.
  // Prefer full recognized text, fall back safely.
  if (!result) return "";
  if (typeof result.text === "string") return result.text;
  if (typeof result.resultText === "string") return result.resultText;
  if (typeof result?.text?.text === "string") return result.text.text; // extra defensive
  return "";
}

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cropBeforeOCR, setCropBeforeOCR] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [phase, setPhase] = useState<OcrPhase>("idle");

  // Lets us cancel safely
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "preparing":
        return "Preparing image…";
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
  function debugPrintFirstLines(result: any) {
    const blocks = result?.blocks ?? [];
    const lines: any[] = [];

    for (const b of blocks) {
      for (const l of b.lines ?? []) {
        lines.push(l);
        if (lines.length >= 5) break;
      }
      if (lines.length >= 5) break;
    }

    // console.log("🔍 ML Kit first lines:");
    // lines.forEach((l, i) => {
    //   console.log(`#${i + 1}`, `"${l.text}"`, "frame:", l.frame);
    // });
  }

  function resetRunState() {
    cancelRef.current = false;
    cleanupTimer();
    setIsRunning(false);
    setPhase("idle");
    setProgress(0);
  }

  function clearImage() {
    setImageUri(null);
    resetRunState();
  }

  function cancelOcr() {
    cancelRef.current = true;
    resetRunState();
  }

  async function runOnDeviceOcr(uri: string) {
    cancelRef.current = false;
    cleanupTimer();
    setIsRunning(true);
    setProgress(0);
    setPhase("preparing");

    try {
      // PREPARING (small UX delay only)
      await new Promise((r) => setTimeout(r, 200));
      if (cancelRef.current) return;
      setProgress(0.15);

      // READING (real OCR happens here)
      setPhase("reading");
      setProgress(0.35);

      const result = await recognizeText(uri);
      debugPrintFirstLines(result);
      if (cancelRef.current) return;

      const rawText = textFromMlkitResult(result);
      const lines = normalizeLines(rawText.split("\n"));
      const health = getOcrHealthFromLines(lines);

      if (health.hardFail) {
        Alert.alert(
          "Couldn’t read receipt",
          `Only ${health.lineCount} lines detected.\nTry retaking the photo.`
        );
        resetRunState();
        return;
      }

      if (!health.ok) {
        Alert.alert("OCR may be incomplete", health.message);
      }

      setProgress(0.7);

      // PARSING (you do parsing in /scan/edit currently)
      setPhase("parsing");
      await new Promise((r) => setTimeout(r, 150));
      if (cancelRef.current) return;
      setProgress(0.92);

      // DONE
      setPhase("done");
      setProgress(1);
      setIsRunning(false);

      // If OCR looks incomplete, warn BEFORE navigating (but still navigate).
      if (!health.ok) {
        Alert.alert(
          "OCR may be incomplete",
          health.message ??
            `OCR returned only ${health.lineCount} lines. Try a tighter crop and better lighting for more items.`
        );
      }

      router.push({
        pathname: "/scan/edit",
        params: { rawText, imageUri: uri },
      });
    } catch (e: any) {
      console.error("OCR failed:", e);
      resetRunState();
      Alert.alert("OCR failed", e?.message ?? "Unknown error");
    }
  }

  async function pickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
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
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
    });

    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
    }
  }

  function startOcr() {
    if (!imageUri || isRunning) return;
    runOnDeviceOcr(imageUri);
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

      <TouchableOpacity onPress={() => setCropBeforeOCR((v) => !v)}>
        <Text>
          {cropBeforeOCR ? "Cropping: ON" : "Cropping: OFF (full page)"}
        </Text>
      </TouchableOpacity>

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
  cancelBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 48, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.18)",
  },
  cancelBtnText: {
    color: "rgb(170, 20, 20)",
    fontSize: 15,
    fontWeight: "700",
  },
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
