import React, { useState } from "react";
import {
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

import { Colors } from "@/constants/theme";

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

export default function ReportProblemScreen() {
  const router = useRouter();

  const [problemType, setProblemType] =
    useState<ProblemType>("Receipt scanning");

  const [showProblemTypes, setShowProblemTypes] = useState(false);

  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");

  const canSubmit = description.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) {
      Alert.alert(
        "Tell us what happened",
        "Please describe the problem before submitting.",
      );
      return;
    }

    /*
      Later this can be sent to your backend:

      {
        problemType,
        description,
        expected,
        screenshot,
        createdAt
      }
    */

    Alert.alert("Report received", "Thanks for helping improve KitchenBuddy.", [
      {
        text: "Done",
        onPress: () => router.back(),
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Report a Problem",
          headerBackTitle: "Help",
        }}
      />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="bug-outline" size={30} color={Colors.primary} />
            </View>

            <Text style={styles.title}>Help us fix the problem</Text>

            <Text style={styles.subtitle}>
              Tell us what went wrong. The more detail you provide, the easier
              it is to investigate.
            </Text>
          </View>

          {/* Problem Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Problem type</Text>

            <Pressable
              style={styles.selector}
              onPress={() => setShowProblemTypes((current) => !current)}
            >
              <View style={styles.selectorLeft}>
                <Ionicons
                  name={getProblemIcon(problemType)}
                  size={20}
                  color={Colors.primary}
                />

                <Text style={styles.selectorText}>{problemType}</Text>
              </View>

              <Ionicons
                name={showProblemTypes ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </Pressable>

            {showProblemTypes && (
              <View style={styles.optionsCard}>
                {PROBLEM_TYPES.map((type, index) => {
                  const selected = type === problemType;

                  return (
                    <View key={type}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.option,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          setProblemType(type);
                          setShowProblemTypes(false);
                        }}
                      >
                        <Ionicons
                          name={getProblemIcon(type)}
                          size={20}
                          color={selected ? Colors.primary : "#777"}
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
                            name="checkmark"
                            size={19}
                            color={Colors.primary}
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

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>What happened?</Text>

              <Text style={styles.required}>Required</Text>
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you were doing and what went wrong..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={1500}
              style={styles.largeInput}
            />

            <Text style={styles.characterCount}>{description.length}/1500</Text>
          </View>

          {/* Expected Result */}
          <View style={styles.section}>
            <Text style={styles.label}>What did you expect to happen?</Text>

            <Text style={styles.optionalLabel}>Optional</Text>

            <TextInput
              value={expected}
              onChangeText={setExpected}
              placeholder="Tell us what you expected instead..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={750}
              style={styles.mediumInput}
            />

            <Text style={styles.characterCount}>{expected.length}/750</Text>
          </View>

          {/* Screenshot */}
          <View style={styles.section}>
            <Text style={styles.label}>Screenshot</Text>

            <Pressable
              style={({ pressed }) => [
                styles.screenshotButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                Alert.alert(
                  "Add Screenshot",
                  "Screenshot attachments will be added soon.",
                )
              }
            >
              <View style={styles.screenshotIcon}>
                <Ionicons
                  name="image-outline"
                  size={23}
                  color={Colors.primary}
                />
              </View>

              <View style={styles.screenshotText}>
                <Text style={styles.screenshotTitle}>Add a screenshot</Text>

                <Text style={styles.screenshotSubtitle}>
                  Show us exactly what you're seeing
                </Text>
              </View>

              <Ionicons name="add" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          {/* Submit */}
          <Pressable
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
          >
            <Ionicons name="paper-plane-outline" size={19} color="#fff" />

            <Text style={styles.submitText}>Submit Report</Text>
          </Pressable>

          <Text style={styles.footer}>
            Thank you for helping improve KitchenBuddy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function getProblemIcon(
  type: ProblemType,
): React.ComponentProps<typeof Ionicons>["name"] {
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(80, 140, 90, 0.10)",
    marginBottom: 12,
  },

  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    textAlign: "center",
    marginTop: 7,
  },

  section: {
    marginBottom: 20,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#444",
    marginLeft: 4,
    marginBottom: 8,
  },

  required: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
    marginRight: 4,
    marginBottom: 8,
  },

  optionalLabel: {
    position: "absolute",
    right: 4,
    top: 1,
    fontSize: 11,
    color: "#999",
  },

  selector: {
    minHeight: 54,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8d8",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectorLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  selectorText: {
    fontSize: 15,
    color: "#222",
    fontWeight: "500",
    marginLeft: 10,
  },

  optionsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    marginTop: 8,
    overflow: "hidden",
  },

  option: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  optionText: {
    flex: 1,
    fontSize: 14,
    color: "#444",
    marginLeft: 10,
  },

  optionTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },

  optionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eee",
    marginLeft: 44,
  },

  largeInput: {
    minHeight: 145,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8d8",
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: "#222",
  },

  mediumInput: {
    minHeight: 100,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8d8",
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: "#222",
  },

  characterCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    color: "#999",
    marginTop: 5,
    marginRight: 4,
  },

  screenshotButton: {
    minHeight: 68,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8d8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  screenshotIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(80, 140, 90, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  screenshotText: {
    flex: 1,
  },

  screenshotTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },

  screenshotSubtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 3,
  },

  submitButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  submitButtonDisabled: {
    opacity: 0.45,
  },

  submitButtonPressed: {
    opacity: 0.85,
  },

  submitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },

  pressed: {
    opacity: 0.7,
  },

  footer: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    marginTop: 14,
  },
});
