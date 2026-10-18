import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

// The shared KitchenBuddy editorial palette used across Settings and Contact Support.
const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  row: "#F2F0EC",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  ivory: "#F8F4ED",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
type Screenshot = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};
type Dialog = {
  title: string;
  message: string;
  kind: "info" | "error" | "success";
};
function imageMime(asset: ImagePicker.ImagePickerAsset): string | null {
  const mime = asset.mimeType?.toLowerCase();
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")
    return mime;
  if (mime && mime !== "application/octet-stream") return null;
  const filename = (asset.fileName ?? asset.uri).split("?")[0].toLowerCase();
  if (/\.jpe?g$/.test(filename)) return "image/jpeg";
  if (/\.png$/.test(filename)) return "image/png";
  if (/\.webp$/.test(filename)) return "image/webp";
  return null;
}

type ProblemType =
  | "Receipt scanning"
  | "Pantry"
  | "Recipes"
  | "Notifications"
  | "Account"
  | "Other";

const PROBLEM_TYPES: ProblemType[] = [
  "Receipt scanning",
  "Pantry",
  "Recipes",
  "Notifications",
  "Account",
  "Other",
];

function getProblemIcon(type: ProblemType): IoniconName {
  switch (type) {
    case "Receipt scanning":
      return "scan-outline";
    case "Pantry":
      return "basket-outline";
    case "Recipes":
      return "restaurant-outline";
    case "Notifications":
      return "notifications-outline";
    case "Account":
      return "person-outline";
    default:
      return "help-circle-outline";
  }
}

export default function ReportProblemScreen() {
  const router = useRouter();
  const [problemType, setProblemType] =
    useState<ProblemType>("Receipt scanning");
  const [showProblemTypes, setShowProblemTypes] = useState(false);
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [expectedFocused, setExpectedFocused] = useState(false);
  const submitRef = useRef(false);
  const pickerRef = useRef(false);
  const [picking, setPicking] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [preview, setPreview] = useState<Screenshot | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  function dismissDialog() {
    const completed = dialog?.kind === "success";
    setDialog(null);
    if (completed) router.back();
  }

  async function addScreenshots() {
    if (
      submitting ||
      pickerRef.current ||
      screenshots.length >= MAX_SCREENSHOTS
    )
      return;
    pickerRef.current = true;
    setPicking(true);
    try {
      // Uses the system photo picker; no broad library permission request needed.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: MAX_SCREENSHOTS - screenshots.length,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const added: Screenshot[] = [];
      let rejected = false;
      for (const [index, asset] of result.assets.entries()) {
        const mimeType = imageMime(asset);
        if (
          !mimeType ||
          (typeof asset.fileSize === "number" &&
            asset.fileSize > MAX_SCREENSHOT_BYTES)
        ) {
          rejected = true;
          continue;
        }
        const ext =
          mimeType === "image/jpeg"
            ? "jpg"
            : mimeType === "image/png"
              ? "png"
              : "webp";
        added.push({
          id: `${Date.now()}-${index}-${asset.assetId ?? asset.uri}`,
          uri: asset.uri,
          name: `screenshot-${Date.now()}-${index + 1}.${ext}`,
          mimeType,
          size: asset.fileSize,
        });
      }
      setScreenshots((current) => {
        const next = [...current];
        for (const asset of added) {
          if (next.length >= MAX_SCREENSHOTS) break;
          if (!next.some((existing) => existing.uri === asset.uri))
            next.push(asset);
        }
        return next;
      });
      if (rejected)
        setDialog({
          kind: "error",
          title: "Some images weren't added",
          message:
            "Choose JPG, PNG, or WebP screenshots, no larger than 4 MB each. HEIC images can be exported as JPG first.",
        });
    } catch (error) {
      console.warn("Problem report screenshot picker failed:", error);
      setDialog({
        kind: "error",
        title: "Couldn't open photos",
        message: "Please try selecting your screenshots again.",
      });
    } finally {
      pickerRef.current = false;
      setPicking(false);
    }
  }

  const canSubmit = description.trim().length >= 5;

  async function handleSubmit() {
    if (submitRef.current) return;
    const descriptionTrimmed = description.trim();
    const expectedTrimmed = expected.trim();
    if (descriptionTrimmed.length < 5) {
      setDialog({
        kind: "info",
        title: "Tell us what happened",
        message: "Please describe the problem before submitting.",
      });
      return;
    }
    if (picking || pickerRef.current) return;

    submitRef.current = true;
    setSubmitting(true);
    try {
      // Match the existing /api/support contract for both JSON and multipart.
      const fields = {
        type: "problem",
        category: problemType,
        message: descriptionTrimmed,
        ...(expectedTrimmed ? { expected: expectedTrimmed } : {}),
      };
      let body: string | FormData;
      let headers: Record<string, string> | undefined;
      if (screenshots.length > 0) {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) =>
          form.append(key, value),
        );
        screenshots.forEach((shot) => {
          // React Native's FormData accepts file objects. Fetch must set the
          // multipart Content-Type and boundary; don't supply it manually.
          form.append("screenshots", {
            uri: shot.uri,
            name: shot.name,
            type: shot.mimeType,
          } as unknown as Blob);
        });
        body = form;
      } else {
        // Existing text-only reports stay compatible with the JSON backend.
        body = JSON.stringify(fields);
        headers = { "Content-Type": "application/json" };
      }

      const response = await fetch(
        "https://receiptchef.onrender.com/api/support",
        {
          method: "POST",
          headers,
          body,
        },
      );
      const serverVersion = response.headers.get(
        "x-kitchenbuddy-support-version",
      );
      const data: { ok?: boolean; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        if (
          screenshots.length > 0 &&
          !serverVersion &&
          data.error === "Type and message are required."
        ) {
          throw new Error(
            "The deployed support server does not appear to support screenshots yet. Deploy the updated backend route, then try again. Your report and screenshots are still here.",
          );
        }
        if (data.error === "Type and message are required.") {
          throw new Error(
            "The support server did not receive the report fields. Verify the updated backend is deployed.",
          );
        }
        throw new Error(
          data.error ||
            `Your report could not be sent (HTTP ${response.status}). Please try again.`,
        );
      }
      setDialog({
        kind: "success",
        title: "Report received",
        message: `Thanks for helping improve KitchenBuddy. Your report${screenshots.length ? ` and ${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"}` : ""} ${screenshots.length === 0 ? "has" : "have"} been submitted.`,
      });
    } catch (error) {
      console.error("Report problem error:", error);
      setDialog({
        kind: "error",
        title: "Couldn't send report",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while sending your report. Please try again.",
      });
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Report a Problem",
          headerBackTitle: "Help",
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="bug-outline" size={29} color={C.slate} />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>HELP US IMPROVE</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>A NOTE TO KITCHENBUDDY</Text>
            <Text style={styles.heroTitle}>Something not quite right?</Text>
            <Text style={styles.heroSubtitle}>
              Tell us what went wrong. The more detail you share, the easier it
              is to investigate.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons name="construct-outline" size={17} color={C.cream} />
              <Text style={styles.heroBottomText}>
                Every report helps us make KitchenBuddy better.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.eyebrow}>YOUR REPORT</Text>
            <Text style={styles.sectionTitle}>Tell us what happened.</Text>
          </View>
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Problem type</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Problem type: ${problemType}`}
                accessibilityState={{
                  expanded: showProblemTypes,
                  disabled: submitting,
                }}
                disabled={submitting}
                onPress={() => setShowProblemTypes((current) => !current)}
                style={({ pressed }) => [
                  styles.selector,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.selectorLeft}>
                  <View style={styles.smallIcon}>
                    <Ionicons
                      name={getProblemIcon(problemType)}
                      size={20}
                      color={C.slate}
                    />
                  </View>
                  <Text style={styles.selectorText}>{problemType}</Text>
                </View>
                <Ionicons
                  name={showProblemTypes ? "chevron-up" : "chevron-down"}
                  size={19}
                  color={C.slate}
                />
              </Pressable>
              {showProblemTypes && (
                <View style={styles.optionsCard}>
                  {PROBLEM_TYPES.map((type, index) => {
                    const selected = type === problemType;
                    return (
                      <View key={type}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${type}`}
                          accessibilityState={{ selected }}
                          disabled={submitting}
                          style={({ pressed }) => [
                            styles.option,
                            selected && styles.optionSelected,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => {
                            setProblemType(type);
                            setShowProblemTypes(false);
                          }}
                        >
                          <Ionicons
                            name={getProblemIcon(type)}
                            size={19}
                            color={C.slate}
                          />
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {type}
                          </Text>
                          {selected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={19}
                              color={C.slate}
                            />
                          )}
                        </Pressable>
                        {index < PROBLEM_TYPES.length - 1 && (
                          <View style={styles.optionDivider} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>What happened?</Text>
                <Text style={styles.required}>REQUIRED</Text>
              </View>
              <TextInput
                accessibilityLabel="Describe the problem"
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what you were doing and what went wrong..."
                placeholderTextColor="#95958E"
                multiline
                textAlignVertical="top"
                maxLength={1500}
                editable={!submitting}
                onFocus={() => setDescriptionFocused(true)}
                onBlur={() => setDescriptionFocused(false)}
                style={[
                  styles.input,
                  styles.largeInput,
                  descriptionFocused && styles.inputFocused,
                ]}
              />
              <Text style={styles.characterCount}>
                {description.length}/1500
              </Text>
            </View>

            <View style={[styles.field, styles.lastField]}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  What did you expect to happen?
                </Text>
                <Text style={styles.optional}>OPTIONAL</Text>
              </View>
              <TextInput
                accessibilityLabel="Expected result"
                value={expected}
                onChangeText={setExpected}
                placeholder="Tell us what you expected instead..."
                placeholderTextColor="#95958E"
                multiline
                textAlignVertical="top"
                maxLength={750}
                editable={!submitting}
                onFocus={() => setExpectedFocused(true)}
                onBlur={() => setExpectedFocused(false)}
                style={[
                  styles.input,
                  styles.mediumInput,
                  expectedFocused && styles.inputFocused,
                ]}
              />
              <Text style={styles.characterCount}>{expected.length}/750</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.eyebrow}>A LITTLE EXTRA CONTEXT</Text>
            <Text style={styles.sectionTitle}>Screenshots</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add screenshots from your photos"
            disabled={
              submitting || picking || screenshots.length >= MAX_SCREENSHOTS
            }
            onPress={() => void addScreenshots()}
            style={({ pressed }) => [
              styles.attachmentCard,
              (submitting ||
                picking ||
                screenshots.length >= MAX_SCREENSHOTS) &&
                styles.faded,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.attachmentIcon}>
              <Ionicons name="images-outline" size={23} color={C.slate} />
            </View>
            <View style={styles.attachmentText}>
              <Text style={styles.attachmentTitle}>
                {screenshots.length
                  ? "Add another screenshot"
                  : "Add screenshots"}
              </Text>
              <Text style={styles.attachmentSubtitle}>
                {screenshots.length}/3 selected · Optional · JPG, PNG or WebP ·
                4 MB each
              </Text>
            </View>
            {picking ? (
              <ActivityIndicator color={C.slate} />
            ) : (
              <Ionicons name="add-circle-outline" size={23} color={C.slate} />
            )}
          </Pressable>
          {screenshots.length > 0 && (
            <View style={styles.screenshotGrid}>
              {screenshots.map((shot, index) => (
                <View key={shot.id} style={styles.shotCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Preview screenshot ${index + 1}`}
                    onPress={() => setPreview(shot)}
                    disabled={submitting}
                  >
                    <Image
                      source={{ uri: shot.uri }}
                      style={styles.shotImage}
                      resizeMode="cover"
                    />
                    <View style={styles.shotLabel}>
                      <Text style={styles.shotLabelText}>VIEW {index + 1}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove screenshot ${index + 1}`}
                    disabled={submitting}
                    style={styles.removeShot}
                    onPress={() =>
                      setScreenshots((current) =>
                        current.filter((item) => item.id !== shot.id),
                      )
                    }
                  >
                    <Ionicons name="close" size={18} color={C.paper} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color={C.slate}
            />
            <Text style={styles.infoText}>
              A description of what happened and what you expected can help us
              understand the issue.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit problem report"
            accessibilityState={{
              disabled: !canSubmit || submitting || picking,
              busy: submitting,
            }}
            disabled={!canSubmit || submitting || picking}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || submitting || picking) &&
                styles.submitButtonDisabled,
              pressed && canSubmit && !submitting && styles.submitButtonPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.paper} />
            ) : (
              <Ionicons name="paper-plane-outline" size={19} color={C.paper} />
            )}
            <Text style={styles.submitText}>
              {submitting ? "Sending..." : "Submit report"}
            </Text>
            {!submitting && (
              <Ionicons name="arrow-forward" size={18} color={C.paper} />
            )}
          </Pressable>
          <Text style={styles.footer}>
            THANK YOU FOR HELPING IMPROVE KITCHENBUDDY
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        transparent
        animationType="fade"
        statusBarTranslucent
        visible={preview !== null}
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            style={styles.previewClose}
            accessibilityRole="button"
            accessibilityLabel="Close screenshot preview"
            onPress={() => setPreview(null)}
          >
            <Ionicons name="close" size={25} color={C.paper} />
          </Pressable>
          {preview && (
            <Image
              source={{ uri: preview.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.previewCaption}>Screenshot preview</Text>
        </View>
      </Modal>
      <Modal
        transparent
        animationType="slide"
        statusBarTranslucent
        visible={dialog !== null}
        onRequestClose={dismissDialog}
      >
        <View style={styles.dialogBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close message"
            onPress={dismissDialog}
          />
          <View style={styles.dialogSheet} accessibilityViewIsModal>
            <View style={styles.dialogGrabber} />
            <View
              style={[
                styles.dialogIcon,
                dialog?.kind === "error" && styles.dialogIconError,
              ]}
            >
              <Ionicons
                name={
                  dialog?.kind === "success"
                    ? "checkmark-circle-outline"
                    : dialog?.kind === "error"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={26}
                color={dialog?.kind === "error" ? "#9B5550" : C.slate}
              />
            </View>
            <Text style={styles.dialogOverline}>KITCHENBUDDY REPORTS</Text>
            <Text style={styles.dialogTitle}>{dialog?.title}</Text>
            <Text style={styles.dialogMessage}>{dialog?.message}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.dialogButton}
              onPress={dismissDialog}
            >
              <Text style={styles.dialogButtonText}>
                {dialog?.kind === "success" ? "Done" : "Got it"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { padding: 18, paddingBottom: 55 },
  hero: {
    backgroundColor: C.slate,
    borderRadius: 26,
    padding: 23,
    marginBottom: 27,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  heroIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: C.ivory,
    justifyContent: "center",
    alignItems: "center",
  },
  heroPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroPillText: {
    color: C.cream,
    fontSize: 9,
    letterSpacing: 1.35,
    fontWeight: "700",
  },
  heroEyebrow: {
    color: C.cream,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 9,
  },
  heroTitle: {
    color: C.paper,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "#F0EFEB",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340,
  },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.30)",
    paddingTop: 16,
    marginTop: 25,
  },
  heroBottomText: { color: C.cream, fontSize: 12, fontWeight: "500", flex: 1 },
  sectionHeader: { marginBottom: 13, marginLeft: 3 },
  eyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 6,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 25,
    lineHeight: 30,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },
  formCard: {
    backgroundColor: C.paper,
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  field: { marginBottom: 22 },
  lastField: { marginBottom: 2 },
  fieldLabel: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 9,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  required: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 9,
  },
  optional: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.9,
    marginBottom: 9,
  },
  selector: {
    minHeight: 57,
    backgroundColor: C.row,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  smallIcon: {
    width: 35,
    height: 35,
    backgroundColor: C.paper,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  selectorText: { color: C.ink, fontSize: 15, fontWeight: "600" },
  optionsCard: {
    backgroundColor: C.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 8,
    overflow: "hidden",
  },
  option: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionSelected: { backgroundColor: C.ivory },
  optionText: { color: C.ink, fontSize: 14, flex: 1 },
  optionTextSelected: { color: C.slateDark, fontWeight: "700" },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 43,
  },
  input: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.row,
    paddingHorizontal: 15,
    fontSize: 15,
    color: C.ink,
  },
  inputFocused: { borderColor: C.slate, backgroundColor: C.paper },
  largeInput: { minHeight: 150, paddingVertical: 14, lineHeight: 21 },
  mediumInput: { minHeight: 106, paddingVertical: 14, lineHeight: 21 },
  characterCount: {
    color: C.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },
  attachmentCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 19,
  },
  attachmentIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: C.row,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentText: { flex: 1 },
  attachmentTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  attachmentSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.cream,
    padding: 17,
    borderRadius: 18,
    gap: 12,
    marginBottom: 20,
  },
  infoText: { color: C.slateDark, flex: 1, fontSize: 13, lineHeight: 19 },
  submitButton: {
    minHeight: 57,
    borderRadius: 18,
    backgroundColor: C.slate,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  submitButtonDisabled: { opacity: 0.47 },
  submitButtonPressed: { backgroundColor: C.slateDark },
  submitText: {
    color: C.paper,
    fontWeight: "800",
    fontSize: 15,
    flex: 1,
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    color: C.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginTop: 22,
  },
  pressed: { opacity: 0.72 },
  faded: { opacity: 0.5 },
  screenshotGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: -7,
    marginBottom: 19,
  },
  shotCard: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 0.85,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: C.row,
    borderColor: C.border,
    borderWidth: 1,
  },
  shotImage: { width: "100%", height: "100%" },
  shotLabel: {
    position: "absolute",
    left: 5,
    bottom: 5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(41,45,44,0.75)",
  },
  shotLabelText: { fontSize: 9, fontWeight: "800", color: C.paper },
  removeShot: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(41,45,44,0.85)",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,25,27,0.97)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewClose: {
    position: "absolute",
    top: 55,
    right: 20,
    zIndex: 2,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 15,
  },
  previewImage: { width: "100%", height: "78%" },
  previewCaption: {
    fontSize: 12,
    fontWeight: "700",
    color: C.paper,
    marginTop: 14,
  },
  dialogBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28,33,34,0.54)",
  },
  dialogSheet: {
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    paddingHorizontal: 25,
    paddingTop: 13,
    paddingBottom: 38,
    backgroundColor: C.paper,
    alignItems: "center",
  },
  dialogGrabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.taupe,
    marginBottom: 20,
  },
  dialogIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.row,
    marginBottom: 13,
  },
  dialogIconError: { backgroundColor: "#F8EEEB" },
  dialogOverline: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  dialogTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    fontSize: 27,
    color: C.ink,
    textAlign: "center",
  },
  dialogMessage: {
    marginTop: 10,
    marginBottom: 23,
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  dialogButton: {
    alignSelf: "stretch",
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: C.slate,
    alignItems: "center",
  },
  dialogButtonText: { color: C.paper, fontWeight: "800", fontSize: 15 },
});
