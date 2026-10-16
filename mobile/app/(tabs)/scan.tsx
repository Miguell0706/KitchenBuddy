import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";
import { addScanHistoryEntry } from "@/features/scan/historyStorage";

type OcrPhase = "idle" | "preparing" | "reading" | "parsing" | "done";
type OcrHealth = {
  ok: boolean;
  hardFail: boolean;
  lineCount: number;
  charCount: number;
  letterCount: number;
  message?: string;
};

const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  white: "#FFFFFF",
  warning: "#8A623B",
  warningBg: "#F6EFE4",
};

function normalizeLines(lines: string[]) {
  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
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
  return { ok, hardFail, lineCount, charCount, letterCount, message };
}

function textFromMlkitResult(result: any): string {
  if (!result) return "";
  if (typeof result.text === "string") return result.text;
  if (typeof result.resultText === "string") return result.resultText;
  if (typeof result?.text?.text === "string") return result.text.text;
  return "";
}

const phaseCopy: Record<OcrPhase, string> = {
  idle: "Ready to scan",
  preparing: "Preparing image…",
  reading: "Reading receipt text…",
  parsing: "Preparing your review…",
  done: "Scan complete",
};

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cropBeforeOCR, setCropBeforeOCR] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<OcrPhase>("idle");
  // ML Kit itself cannot be interrupted; invalidate a run so its late result is ignored.
  const runIdRef = useRef(0);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const pct = Math.round(progress * 100);
  const phaseLabel = useMemo(() => phaseCopy[phase], [phase]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  function resetRunState() {
    setIsRunning(false);
    setPhase("idle");
    setProgress(0);
  }

  function clearImage() {
    if (isRunning) return;
    runIdRef.current += 1;
    setImageUri(null);
    resetRunState();
  }

  function cancelOcr() {
    runIdRef.current += 1;
    resetRunState();
  }

  async function runOnDeviceOcr(uri: string) {
    if (isRunning) return;
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;
    setIsRunning(true);
    setProgress(0);
    setPhase("preparing");

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      if (!isCurrent()) return;
      setProgress(0.15);
      setPhase("reading");
      setProgress(0.35);
      const result = await recognizeText(uri);
      if (!isCurrent()) return;

      const rawText = textFromMlkitResult(result);
      const lines = normalizeLines(rawText.split("\n"));
      const health = getOcrHealthFromLines(lines);
      if (health.hardFail) {
        Alert.alert(
          "Couldn’t read receipt",
          `Only ${health.lineCount} lines detected.\nTry retaking the photo.`,
        );
        resetRunState();
        return;
      }

      setProgress(0.7);
      setPhase("parsing");
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      if (!isCurrent()) return;
      setProgress(0.92);
      setPhase("done");
      setProgress(1);

      // A history write should not prevent review if local history storage fails.
      try {
        await addScanHistoryEntry(uri);
      } catch (historyError) {
        console.warn("Could not save scan history:", historyError);
      }
      if (!isCurrent()) return;
      setIsRunning(false);

      if (!health.ok) {
        Alert.alert(
          "OCR may be incomplete",
          health.message ??
            `OCR returned only ${health.lineCount} lines. Try a tighter crop and better lighting for more items.`,
        );
      }
      router.push({
        pathname: "/scan/edit",
        params: { rawText, imageUri: uri },
      });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      console.error("OCR failed:", error);
      resetRunState();
      Alert.alert(
        "OCR failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async function pickFromGallery() {
    if (isRunning) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: cropBeforeOCR,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        runIdRef.current += 1;
        resetRunState();
        setImageUri(res.assets[0].uri);
      }
    } catch (error) {
      console.warn("Gallery image selection failed:", error);
      Alert.alert(
        "Photos unavailable",
        "Couldn't open your photos. Please try again.",
      );
    }
  }

  async function takePhoto() {
    if (isRunning) return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access to scan receipts.",
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: cropBeforeOCR,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        runIdRef.current += 1;
        resetRunState();
        setImageUri(res.assets[0].uri);
      }
    } catch (error) {
      console.warn("Camera capture failed:", error);
      Alert.alert(
        "Camera unavailable",
        "Couldn't capture a photo. Please try again.",
      );
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + insets.bottom + 28 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="scan-outline" size={25} color={C.slateDark} />
          </View>
          <View style={styles.heroTag}>
            <Ionicons name="sparkles-outline" size={12} color={C.white} />
            <Text style={styles.heroTagText}>YOUR KITCHEN, ORGANIZED</Text>
          </View>
        </View>
        <Text style={styles.heroEyebrow}>RECEIPT SCANNER</Text>
        <Text style={styles.heroTitle}>Scan your groceries.</Text>
        <Text style={styles.heroDescription}>
          Turn a grocery receipt into pantry items in just a few steps. Review
          everything before you save.
        </Text>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Start with a receipt</Text>
        <Text style={styles.sectionCaption}>
          Take a new photo or choose one you've saved.
        </Text>
      </View>
      <View style={styles.actionGrid}>
        <Pressable
          disabled={isRunning}
          onPress={() => void takePhoto()}
          accessibilityRole="button"
          accessibilityLabel="Open camera to photograph a receipt"
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.pressed,
            isRunning && styles.disabled,
          ]}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="camera-outline" size={25} color={C.slateDark} />
          </View>
          <Text style={styles.actionTitle}>Open camera</Text>
          <Text style={styles.actionDetail}>Capture a receipt</Text>
          <Ionicons
            name="arrow-forward-outline"
            size={18}
            color={C.slate}
            style={styles.actionArrow}
          />
        </Pressable>
        <Pressable
          disabled={isRunning}
          onPress={() => void pickFromGallery()}
          accessibilityRole="button"
          accessibilityLabel="Choose receipt from photos"
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.pressed,
            isRunning && styles.disabled,
          ]}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="images-outline" size={25} color={C.slateDark} />
          </View>
          <Text style={styles.actionTitle}>Choose photo</Text>
          <Text style={styles.actionDetail}>From your gallery</Text>
          <Ionicons
            name="arrow-forward-outline"
            size={18}
            color={C.slate}
            style={styles.actionArrow}
          />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: cropBeforeOCR, disabled: isRunning }}
        accessibilityLabel="Crop photo before scanning"
        disabled={isRunning}
        onPress={() => setCropBeforeOCR((current) => !current)}
        style={({ pressed }) => [
          styles.cropCard,
          pressed && styles.pressed,
          isRunning && styles.disabled,
        ]}
      >
        <View style={styles.cropIcon}>
          <Ionicons name="crop-outline" size={20} color={C.slate} />
        </View>
        <View style={styles.cropTextArea}>
          <Text style={styles.cropTitle}>Crop before scanning</Text>
          <Text style={styles.cropDescription}>
            {cropBeforeOCR
              ? "Edit the photo after selecting it"
              : "Use the full photo without editing"}
          </Text>
        </View>
        <View
          style={[styles.switchTrack, cropBeforeOCR && styles.switchTrackOn]}
        >
          <View
            style={[styles.switchThumb, cropBeforeOCR && styles.switchThumbOn]}
          />
        </View>
      </Pressable>

      {imageUri ? (
        <View style={styles.previewSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Receipt preview</Text>
            <Text style={styles.sectionCaption}>
              Make sure the print is readable and the whole receipt is visible.
            </Text>
          </View>
          <View style={styles.previewCard}>
            <View style={styles.previewImageWrap}>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.previewInfo}>
              <View style={styles.readyDot} />
              <Text style={styles.previewReady}>Photo selected</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={clearImage}
                disabled={isRunning}
                accessibilityRole="button"
                accessibilityLabel="Remove selected receipt photo"
                style={[styles.removeControl, isRunning && styles.disabled]}
              >
                <Ionicons name="trash-outline" size={15} color={C.muted} />
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => void runOnDeviceOcr(imageUri)}
              disabled={isRunning}
              accessibilityRole="button"
              accessibilityLabel="Scan receipt text"
              style={({ pressed }) => [
                styles.scanButton,
                pressed && styles.scanButtonPressed,
                isRunning && styles.disabled,
              ]}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Ionicons name="scan-outline" size={19} color={C.white} />
              )}
              <Text style={styles.scanButtonText}>
                {isRunning ? "Scanning receipt…" : "Scan receipt"}
              </Text>
              {!isRunning && (
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb-outline" size={19} color={C.slate} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>A little scanning tip</Text>
            <Text style={styles.tipText}>
              Good lighting and a flat receipt help KitchenBuddy recognize more
              items.
            </Text>
          </View>
        </View>
      )}

      {isRunning && (
        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <View style={styles.progressIcon}>
              <ActivityIndicator color={C.slateDark} size="small" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressEyebrow}>
                ON-DEVICE TEXT RECOGNITION
              </Text>
              <Text style={styles.progressTitle}>{phaseLabel}</Text>
            </View>
            <Text style={styles.progressPercent}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressNote}>
            Progress indicates the current step; receipt-reading time may vary.
          </Text>
          <Pressable
            onPress={cancelOcr}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel scan</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.footer}>KITCHENBUDDY / SCAN & ORGANIZE</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 26,
    padding: 22,
    marginBottom: 27,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 29,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.paper,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  heroTagText: {
    color: C.white,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  heroEyebrow: {
    color: "#E0E8E9",
    fontWeight: "700",
    letterSpacing: 2,
    fontSize: 10,
    marginBottom: 9,
  },
  heroTitle: {
    fontFamily: "serif",
    fontSize: 32,
    lineHeight: 38,
    color: C.white,
    marginBottom: 10,
  },
  heroDescription: {
    color: "#E6EAEB",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 310,
  },
  sectionHead: { marginBottom: 13 },
  sectionTitle: {
    fontFamily: "serif",
    color: C.ink,
    fontSize: 23,
    lineHeight: 29,
  },
  sectionCaption: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  actionGrid: { flexDirection: "row", gap: 11, marginBottom: 15 },
  actionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 166,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    padding: 15,
    backgroundColor: C.paper,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  actionTitle: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  actionDetail: { color: C.muted, fontSize: 11 },
  actionArrow: { position: "absolute", right: 14, bottom: 15 },
  cropCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    padding: 13,
    marginBottom: 23,
  },
  cropIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.cream,
    marginRight: 11,
  },
  cropTextArea: { flex: 1, paddingRight: 8 },
  cropTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  cropDescription: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  switchTrack: {
    width: 42,
    height: 25,
    backgroundColor: C.taupe,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  switchTrackOn: { backgroundColor: C.slate },
  switchThumb: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.white,
  },
  switchThumbOn: { alignSelf: "flex-end" },
  previewSection: { marginTop: 3 },
  previewCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 12,
    marginBottom: 22,
  },
  previewImageWrap: {
    height: 258,
    borderRadius: 13,
    backgroundColor: "#F0ECE5",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "100%" },
  previewInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 13,
    paddingHorizontal: 3,
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.slate,
    marginRight: 7,
  },
  previewReady: { color: C.ink, fontSize: 12, fontWeight: "600" },
  removeControl: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 5,
    alignItems: "center",
  },
  removeText: { color: C.muted, fontSize: 12 },
  scanButton: {
    backgroundColor: C.slateDark,
    minHeight: 51,
    borderRadius: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  scanButtonText: { color: C.white, fontSize: 14, fontWeight: "700" },
  scanButtonPressed: { opacity: 0.85 },
  tipCard: {
    backgroundColor: C.cream,
    padding: 15,
    borderRadius: 17,
    flexDirection: "row",
    gap: 11,
    marginBottom: 20,
  },
  tipIcon: {
    width: 34,
    height: 34,
    backgroundColor: C.paper,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  tipText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  progressCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    padding: 16,
    marginTop: 2,
    marginBottom: 20,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 17,
  },
  progressIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: C.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  progressEyebrow: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  progressTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  progressPercent: { fontFamily: "serif", color: C.slateDark, fontSize: 24 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: C.taupe,
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: C.slate },
  progressNote: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  cancelButton: {
    backgroundColor: C.background,
    borderColor: C.border,
    borderWidth: 1,
    minHeight: 39,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  cancelText: { color: C.ink, fontSize: 12, fontWeight: "700" },
  footer: {
    textAlign: "center",
    color: "#A49E96",
    fontSize: 9,
    letterSpacing: 1.8,
    marginTop: 5,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
