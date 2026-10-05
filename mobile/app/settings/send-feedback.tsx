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

type FeedbackType =
  | "Feature idea"
  | "App experience"
  | "Scanning"
  | "Pantry"
  | "Recipes"
  | "Other";

const FEEDBACK_TYPES: FeedbackType[] = [
  "Feature idea",
  "App experience",
  "Scanning",
  "Pantry",
  "Recipes",
  "Other",
];

export default function FeedbackScreen() {
  const router = useRouter();

  const [feedbackType, setFeedbackType] =
    useState<FeedbackType>("Feature idea");

  const [showFeedbackTypes, setShowFeedbackTypes] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = feedback.trim().length >= 5;

  async function handleSubmit() {
    const feedbackTrimmed = feedback.trim();

    if (feedbackTrimmed.length < 5) {
      Alert.alert(
        "Tell us what you think",
        "Please enter your feedback before submitting.",
      );
      return;
    }

    if (submitting) return;

    try {
      setSubmitting(true);

      const response = await fetch(
        "https://receiptchef.onrender.com/api/support",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "feedback",
            category: feedbackType,
            message: feedbackTrimmed,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "Failed to send feedback.");
      }

      Alert.alert(
        "Feedback received",
        "Thanks for helping make KitchenBuddy better.",
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Send feedback error:", error);

      Alert.alert(
        "Couldn't send feedback",
        "Something went wrong while sending your feedback. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Send Feedback",
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
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={30}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.title}>Help shape KitchenBuddy</Text>

            <Text style={styles.subtitle}>
              Have an idea or something you'd like to see improved? We'd love to
              hear it.
            </Text>
          </View>

          {/* Feedback Type */}
          <View style={styles.section}>
            <Text style={styles.label}>What is your feedback about?</Text>

            <Pressable
              style={styles.selector}
              onPress={() => setShowFeedbackTypes((current) => !current)}
            >
              <View style={styles.selectorLeft}>
                <Ionicons
                  name={getFeedbackIcon(feedbackType)}
                  size={20}
                  color={Colors.primary}
                />

                <Text style={styles.selectorText}>{feedbackType}</Text>
              </View>

              <Ionicons
                name={showFeedbackTypes ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </Pressable>

            {showFeedbackTypes && (
              <View style={styles.optionsCard}>
                {FEEDBACK_TYPES.map((type, index) => {
                  const selected = type === feedbackType;

                  return (
                    <View key={type}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.option,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          setFeedbackType(type);
                          setShowFeedbackTypes(false);
                        }}
                      >
                        <Ionicons
                          name={getFeedbackIcon(type)}
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

                      {index < FEEDBACK_TYPES.length - 1 && (
                        <View style={styles.optionDivider} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Feedback */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Tell us what you think</Text>

              <Text style={styles.required}>Required</Text>
            </View>

            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Share an idea, suggest an improvement, or tell us what you like..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={1500}
              style={styles.largeInput}
            />

            <Text style={styles.characterCount}>{feedback.length}/1500</Text>
          </View>

          {/* Screenshot */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Screenshot</Text>

              <Text style={styles.optional}>Optional</Text>
            </View>

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
                  Show us an idea or something you'd like improved
                </Text>
              </View>

              <Ionicons name="add" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />

            <Text style={styles.infoText}>
              Feature suggestions and feedback help guide future KitchenBuddy
              improvements.
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            disabled={!canSubmit || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || submitting) && styles.submitButtonDisabled,
              pressed && canSubmit && !submitting && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
          >
            <Ionicons
              name={submitting ? "hourglass-outline" : "paper-plane-outline"}
              size={19}
              color="#fff"
            />

            <Text style={styles.submitText}>
              {submitting ? "Sending..." : "Send Feedback"}
            </Text>
          </Pressable>

          <Text style={styles.footer}>
            Thanks for helping make KitchenBuddy better.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function getFeedbackIcon(
  type: FeedbackType,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (type) {
    case "Feature idea":
      return "bulb-outline";

    case "App experience":
      return "phone-portrait-outline";

    case "Scanning":
      return "scan-outline";

    case "Pantry":
      return "basket-outline";

    case "Recipes":
      return "restaurant-outline";

    default:
      return "chatbubble-outline";
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

  optional: {
    fontSize: 11,
    color: "#999",
    marginRight: 4,
    marginBottom: 8,
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
    minHeight: 165,
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
    paddingRight: 8,
  },

  screenshotTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },

  screenshotSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#777",
    marginTop: 3,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(80, 140, 90, 0.07)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
    marginLeft: 10,
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
