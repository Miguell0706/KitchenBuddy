import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  border: "#E9E5DE",
  cream: "#EDE6DA",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
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

  const canSubmit = description.trim().length >= 5;

  async function handleSubmit() {
    const descriptionTrimmed = description.trim();
    const expectedTrimmed = expected.trim();

    if (descriptionTrimmed.length < 5) {
      Alert.alert(
        "Tell us what happened",
        "Please describe the problem before submitting.",
      );
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      // Existing support API and payload are intentionally unchanged.
      const response = await fetch(
        "https://receiptchef.onrender.com/api/support",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "problem",
            category: problemType,
            message: descriptionTrimmed,
            expected: expectedTrimmed || undefined,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "Failed to send problem report.");
      }
      Alert.alert(
        "Report received",
        "Thanks for helping improve KitchenBuddy.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (error) {
      console.error("Report problem error:", error);
      Alert.alert(
        "Couldn't send report",
        "Something went wrong while sending your report. Please try again.",
      );
    } finally {
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
            <Text style={styles.sectionTitle}>Screenshot</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Screenshot attachments coming soon"
            onPress={() =>
              Alert.alert(
                "Add Screenshot",
                "Screenshot attachments will be added soon.",
              )
            }
            style={({ pressed }) => [
              styles.attachmentCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.attachmentIcon}>
              <Ionicons name="image-outline" size={23} color={C.slate} />
            </View>
            <View style={styles.attachmentText}>
              <Text style={styles.attachmentTitle}>Screenshot attachments</Text>
              <Text style={styles.attachmentSubtitle}>
                An optional feature coming soon
              </Text>
            </View>
            <Ionicons name="time-outline" size={21} color={C.muted} />
          </Pressable>

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
              disabled: !canSubmit || submitting,
              busy: submitting,
            }}
            disabled={!canSubmit || submitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || submitting) && styles.submitButtonDisabled,
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
});
