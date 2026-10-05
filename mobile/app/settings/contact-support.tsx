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

type SupportTopic =
  | "General help"
  | "Account"
  | "Premium & billing"
  | "Receipt scanning"
  | "Pantry"
  | "Recipes"
  | "Other";

const SUPPORT_TOPICS: SupportTopic[] = [
  "General help",
  "Account",
  "Premium & billing",
  "Receipt scanning",
  "Pantry",
  "Recipes",
  "Other",
];

export default function ContactSupportScreen() {
  const router = useRouter();

  const [topic, setTopic] = useState<SupportTopic>("General help");

  const [showTopics, setShowTopics] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailTrimmed = email.trim();
  const messageTrimmed = message.trim();

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

  const canSubmit = emailLooksValid && messageTrimmed.length >= 5;

  async function handleSubmit() {
    if (!emailLooksValid) {
      Alert.alert(
        "Enter your email",
        "Please enter a valid email address so support can reply to you.",
      );
      return;
    }

    if (messageTrimmed.length < 5) {
      Alert.alert("Enter a message", "Please tell us what you need help with.");
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
            type: "support",
            category: topic,
            email: emailTrimmed,
            message: messageTrimmed,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "Failed to send support message.");
      }

      Alert.alert(
        "Message sent",
        "Your message has been sent to KitchenBuddy Support.",
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Contact support error:", error);

      Alert.alert(
        "Couldn't send message",
        "Something went wrong while sending your message. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Contact Support",
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
              <Ionicons name="mail-outline" size={30} color={Colors.primary} />
            </View>

            <Text style={styles.title}>How can we help?</Text>

            <Text style={styles.subtitle}>
              Send a message to KitchenBuddy Support and we'll help with your
              question.
            </Text>
          </View>

          {/* Support Topic */}
          <View style={styles.section}>
            <Text style={styles.label}>What do you need help with?</Text>

            <Pressable
              style={styles.selector}
              onPress={() => setShowTopics((current) => !current)}
            >
              <View style={styles.selectorLeft}>
                <Ionicons
                  name={getTopicIcon(topic)}
                  size={20}
                  color={Colors.primary}
                />

                <Text style={styles.selectorText}>{topic}</Text>
              </View>

              <Ionicons
                name={showTopics ? "chevron-up" : "chevron-down"}
                size={18}
                color="#777"
              />
            </Pressable>

            {showTopics && (
              <View style={styles.optionsCard}>
                {SUPPORT_TOPICS.map((supportTopic, index) => {
                  const selected = supportTopic === topic;

                  return (
                    <View key={supportTopic}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.option,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          setTopic(supportTopic);
                          setShowTopics(false);
                        }}
                      >
                        <Ionicons
                          name={getTopicIcon(supportTopic)}
                          size={20}
                          color={selected ? Colors.primary : "#777"}
                        />

                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionTextSelected,
                          ]}
                        >
                          {supportTopic}
                        </Text>

                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={19}
                            color={Colors.primary}
                          />
                        )}
                      </Pressable>

                      {index < SUPPORT_TOPICS.length - 1 && (
                        <View style={styles.optionDivider} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Email */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Your email</Text>

              <Text style={styles.required}>Required</Text>
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={150}
              style={styles.emailInput}
            />

            <Text style={styles.helperText}>
              We'll use this email to reply to your support request.
            </Text>
          </View>

          {/* Message */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>How can we help?</Text>

              <Text style={styles.required}>Required</Text>
            </View>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what you need help with..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={1500}
              style={styles.messageInput}
            />

            <Text style={styles.characterCount}>{message.length}/1500</Text>
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
                  Include an image if it helps explain your question
                </Text>
              </View>

              <Ionicons name="add" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          {/* Response notice */}
          <View style={styles.infoCard}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={Colors.primary}
            />

            <Text style={styles.infoText}>
              Support will reply using the email address you provide above.
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
              {submitting ? "Sending..." : "Contact Support"}
            </Text>
          </Pressable>

          <Text style={styles.footer}>KitchenBuddy Support</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function getTopicIcon(
  topic: SupportTopic,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (topic) {
    case "General help":
      return "help-circle-outline";

    case "Account":
      return "person-outline";

    case "Premium & billing":
      return "card-outline";

    case "Receipt scanning":
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

  emailInput: {
    minHeight: 52,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d8d8d8",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#222",
  },

  helperText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#888",
    marginTop: 6,
    marginLeft: 4,
  },

  messageInput: {
    minHeight: 150,
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
