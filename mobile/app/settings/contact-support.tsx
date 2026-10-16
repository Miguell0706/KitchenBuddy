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

// Matches KitchenBuddy's redesigned About, Settings, and Grocery screens.
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

function getTopicIcon(topic: SupportTopic): IoniconName {
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

export default function ContactSupportScreen() {
  const router = useRouter();
  const [topic, setTopic] = useState<SupportTopic>("General help");
  const [showTopics, setShowTopics] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

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
      // Retains the existing support submission payload and backend route.
      const response = await fetch(
        "https://receiptchef.onrender.com/api/support",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        [{ text: "Done", onPress: () => router.back() }],
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
                <Ionicons name="mail-outline" size={29} color={C.slate} />
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>WE'RE HERE TO HELP</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>A NOTE TO KITCHENBUDDY</Text>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroSubtitle}>
              Questions, hiccups, or something on your mind? Send a note to
              KitchenBuddy Support.
            </Text>
            <View style={styles.heroBottom}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={17}
                color={C.cream}
              />
              <Text style={styles.heroBottomText}>
                A little help goes a long way.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.eyebrow}>YOUR REQUEST</Text>
            <Text style={styles.sectionTitle}>Tell us a little more.</Text>
          </View>
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>What do you need help with?</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Support topic: ${topic}`}
                accessibilityState={{
                  expanded: showTopics,
                  disabled: submitting,
                }}
                disabled={submitting}
                onPress={() => setShowTopics((current) => !current)}
                style={({ pressed }) => [
                  styles.selector,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.selectorLeft}>
                  <View style={styles.smallIcon}>
                    <Ionicons
                      name={getTopicIcon(topic)}
                      size={20}
                      color={C.slate}
                    />
                  </View>
                  <Text style={styles.selectorText}>{topic}</Text>
                </View>
                <Ionicons
                  name={showTopics ? "chevron-up" : "chevron-down"}
                  size={19}
                  color={C.slate}
                />
              </Pressable>
              {showTopics && (
                <View style={styles.optionsCard}>
                  {SUPPORT_TOPICS.map((supportTopic, index) => {
                    const selected = supportTopic === topic;
                    return (
                      <View key={supportTopic}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Choose ${supportTopic}`}
                          accessibilityState={{ selected }}
                          style={({ pressed }) => [
                            styles.option,
                            selected && styles.optionSelected,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => {
                            setTopic(supportTopic);
                            setShowTopics(false);
                          }}
                        >
                          <Ionicons
                            name={getTopicIcon(supportTopic)}
                            size={19}
                            color={C.slate}
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
                              name="checkmark-circle"
                              size={19}
                              color={C.slate}
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

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Your email</Text>
                <Text style={styles.required}>REQUIRED</Text>
              </View>
              <TextInput
                accessibilityLabel="Your email address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#95958E"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={150}
                editable={!submitting}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={[styles.input, emailFocused && styles.inputFocused]}
              />
              <Text style={styles.helperText}>
                We'll use this address to reply to your request.
              </Text>
            </View>

            <View style={[styles.field, styles.lastField]}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>How can we help?</Text>
                <Text style={styles.required}>REQUIRED</Text>
              </View>
              <TextInput
                accessibilityLabel="Your support message"
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what you need help with..."
                placeholderTextColor="#95958E"
                multiline
                textAlignVertical="top"
                maxLength={1500}
                editable={!submitting}
                onFocus={() => setMessageFocused(true)}
                onBlur={() => setMessageFocused(false)}
                style={[
                  styles.input,
                  styles.messageInput,
                  messageFocused && styles.inputFocused,
                ]}
              />
              <Text style={styles.characterCount}>{message.length}/1500</Text>
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
            <Ionicons name="mail-open-outline" size={21} color={C.slate} />
            <Text style={styles.infoText}>
              Support will reply using the email address you provide above.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contact Support"
            accessibilityState={{
              disabled: !canSubmit || submitting,
              busy: submitting,
            }}
            disabled={!canSubmit || submitting}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || submitting) && styles.submitButtonDisabled,
              pressed && canSubmit && !submitting && styles.submitButtonPressed,
            ]}
            onPress={() => void handleSubmit()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.paper} />
            ) : (
              <Ionicons name="paper-plane-outline" size={19} color={C.paper} />
            )}
            <Text style={styles.submitText}>
              {submitting ? "Sending..." : "Send your message"}
            </Text>
            {!submitting && (
              <Ionicons name="arrow-forward" size={18} color={C.paper} />
            )}
          </Pressable>
          <Text style={styles.footer}>KITCHENBUDDY SUPPORT</Text>
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
  heroBottomText: { color: C.cream, fontSize: 12, fontWeight: "500" },
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
  },
  required: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
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
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.row,
    paddingHorizontal: 15,
    fontSize: 15,
    color: C.ink,
  },
  inputFocused: { borderColor: C.slate, backgroundColor: C.paper },
  helperText: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    marginHorizontal: 2,
  },
  messageInput: { minHeight: 150, paddingVertical: 14, lineHeight: 21 },
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
    letterSpacing: 1.8,
    marginTop: 22,
  },
  pressed: { opacity: 0.72 },
});
