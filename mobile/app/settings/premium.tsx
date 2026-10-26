import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePremium } from "@/context/PremiumContext";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type PremiumDialog = {
  kind: "info" | "success" | "error";
  title: string;
  message: string;
};

const C = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  row: "#F2F0EC",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  red: "#9B5550",
  redWash: "#F8EEEB",
};

export default function PremiumScreen() {
  const router = useRouter();
  const {
    isPremium,
    isLoading,
    isPurchasing,
    offering,
    purchasePremium,
    restorePremium,
    isPreviewMode,
    setPreviewPremium,
  } = usePremium();
  const [dialog, setDialog] = useState<PremiumDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const operationInProgress = useRef(false);
  const working = busy || isPurchasing;

  function closeDialog() {
    if (!operationInProgress.current) setDialog(null);
  }

  async function handlePreviewChange(enabled: boolean) {
    if (!isPreviewMode || operationInProgress.current || isLoading || busy)
      return;
    operationInProgress.current = true;
    setBusy(true);
    try {
      await setPreviewPremium(enabled);
    } catch (error) {
      console.warn("Could not change Premium preview:", error);
      setDialog({
        kind: "error",
        title: "Preview unavailable",
        message: "Could not save the preview setting. Please try again.",
      });
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function handlePremium() {
    if (operationInProgress.current || isLoading || isPurchasing || isPremium)
      return;
    // First integration test: monthly only. Annual plan selection comes next.
    const selectedPackage = offering?.monthly;
    if (!selectedPackage) {
      setDialog({
        kind: "error",
        title: "Subscription unavailable",
        message: "We couldn't load the monthly subscription. Please try again.",
      });
      return;
    }
    operationInProgress.current = true;
    setBusy(true);
    try {
      const result = await purchasePremium(selectedPackage);
      if (result === "cancelled") return;
      setDialog({
        kind: "success",
        title: "Welcome to Premium!",
        message: "Your KitchenBuddy Premium membership is now active.",
      });
    } catch (error) {
      console.error("Premium purchase error:", error);
      setDialog({
        kind: "error",
        title: "Purchase unsuccessful",
        message: "We couldn't complete your purchase. Please try again.",
      });
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function handleRestorePurchase() {
    if (operationInProgress.current || isLoading || isPurchasing) return;
    operationInProgress.current = true;
    setBusy(true);
    try {
      const restored = await restorePremium();
      setDialog({
        kind: "info",
        title: restored ? "Purchase restored" : "No active subscription found",
        message: restored
          ? "Your KitchenBuddy Premium membership has been restored."
          : "We couldn't find an active Premium membership to restore.",
      });
    } catch (error) {
      console.error("Restore purchase error:", error);
      setDialog({
        kind: "error",
        title: "Restore unsuccessful",
        message: "We couldn't restore your purchases. Please try again.",
      });
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "KitchenBuddy Premium",
          headerBackTitle: "Settings",
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
        }}
      />
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="star-outline" size={28} color={C.cream} />
              </View>
              <View style={styles.heroTag}>
                <Ionicons name="sparkles-outline" size={13} color={C.cream} />
                <Text style={styles.heroTagText}>KITCHENBUDDY PREMIUM</Text>
              </View>
            </View>
            <Text style={styles.heroEyebrow}>
              A LITTLE MORE OF WHAT YOU LOVE
            </Text>
            <Text style={styles.heroTitle}>
              Make more of every grocery trip.
            </Text>
            <Text style={styles.heroDescription}>
              Smarter recipes, thoughtful shopping, and a clearer picture of
              what happens in your pantry.
            </Text>
            <View style={styles.heroFooter}>
              <Ionicons name="leaf-outline" size={16} color={C.cream} />
              <Text style={styles.heroFooterText}>
                Less waste. More good food.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>YOUR MEMBERSHIP</Text>
            <Text style={styles.sectionTitle}>Your current plan</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                {isLoading ? (
                  <ActivityIndicator color={C.slate} />
                ) : (
                  <Ionicons
                    name={
                      isPremium ? "checkmark-circle-outline" : "person-outline"
                    }
                    size={24}
                    color={C.slate}
                  />
                )}
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusEyebrow}>CURRENT PLAN</Text>
                <Text style={styles.statusTitle}>
                  {isLoading
                    ? "Checking your plan..."
                    : isPremium
                      ? "KitchenBuddy Premium"
                      : "KitchenBuddy Free"}
                </Text>
                <Text style={styles.statusDescription}>
                  {isLoading
                    ? "Your membership status is loading."
                    : isPremium
                      ? "Premium features are unlocked."
                      : "The everyday essentials are yours, free."}
                </Text>
              </View>
              {!isLoading && isPremium && (
                <Ionicons name="sparkles" size={20} color={C.slate} />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>MORE POSSIBILITIES</Text>
            <Text style={styles.sectionTitle}>The Premium collection</Text>
            <Text style={styles.sectionDescription}>
              Thoughtful extras to help make the most of the food you have.
            </Text>
            <PremiumFeature
              icon="restaurant-outline"
              title="Advanced Recipes"
              description="Get better recipe ideas built around the food you already have, including ingredients that need to be used soon."
            />
            <PremiumFeature
              icon="cart-outline"
              title="Smart Grocery List"
              description="Build smarter shopping lists using your pantry and recipes, so you know what you have and what you're missing."
            />
            <PremiumFeature
              icon="analytics-outline"
              title="Pantry Analytics"
              description="See useful insights about your pantry, food usage, expiration patterns, and grocery habits over time."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>ALWAYS INCLUDED</Text>
            <Text style={styles.sectionTitle}>The essentials stay free.</Text>
            <View style={styles.freeCard}>
              <FreeFeature text="Receipt scanning" />
              <FreeFeature text="Pantry management" />
              <FreeFeature text="Expiration tracking" />
              <FreeFeature text="Expiration reminders" />
              <FreeFeature text="Basic recipe search" />
            </View>
          </View>

          {isPreviewMode && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons
                  name="construct-outline"
                  size={19}
                  color={C.slateDark}
                />
                <Text style={styles.previewTitle}>Developer controls</Text>
                <Text style={styles.previewPill}>EXPO GO ONLY</Text>
              </View>
              <Text style={styles.previewDescription}>
                Simulate your membership while designing KitchenBuddy. This does
                not create a purchase or change RevenueCat.
              </Text>
              <View style={styles.previewChoices}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Preview Free membership"
                  accessibilityState={{
                    selected: !isPremium,
                    disabled: isLoading || working,
                  }}
                  disabled={isLoading || working}
                  onPress={() => void handlePreviewChange(false)}
                  style={[
                    styles.previewChoice,
                    !isPremium && styles.previewChoiceSelected,
                  ]}
                >
                  <Ionicons
                    name={!isPremium ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={C.slateDark}
                  />
                  <Text style={styles.previewChoiceText}>Free</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Preview Premium membership"
                  accessibilityState={{
                    selected: isPremium,
                    disabled: isLoading || working,
                  }}
                  disabled={isLoading || working}
                  onPress={() => void handlePreviewChange(true)}
                  style={[
                    styles.previewChoice,
                    isPremium && styles.previewChoiceSelected,
                  ]}
                >
                  <Ionicons
                    name={isPremium ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={C.slateDark}
                  />
                  <Text style={styles.previewChoiceText}>Premium</Text>
                </Pressable>
              </View>
              <Text style={styles.previewFootnote}>
                UI preview only. Paid backend requests still require verified
                access.
              </Text>
            </View>
          )}

          {!isPreviewMode && !isLoading && !isPremium && (
            <View style={styles.actionSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get KitchenBuddy Premium"
                accessibilityState={{ disabled: working || !offering?.monthly }}
                disabled={working || !offering?.monthly}
                onPress={() => void handlePremium()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  (working || !offering?.monthly) && { opacity: 0.55 },
                ]}
              >
                {working ? (
                  <ActivityIndicator color={C.paper} />
                ) : (
                  <Ionicons name="star-outline" size={19} color={C.paper} />
                )}
                <Text style={styles.primaryButtonText}>
                  {working ? "Processing..." : "Get Premium"}
                </Text>
                {!working && (
                  <Ionicons name="arrow-forward" size={18} color={C.paper} />
                )}
              </Pressable>
              <Text style={styles.developmentNote}>
                Test Store mode — subscriptions are simulated. No real payment
                will be charged. Monthly test package only.
              </Text>
            </View>
          )}

          {!isLoading && isPremium && (
            <View style={styles.activeCard}>
              <View style={styles.activeIcon}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={23}
                  color={C.slate}
                />
              </View>
              <View style={styles.activeContent}>
                <Text style={styles.activeTitle}>Premium is active</Text>
                <Text style={styles.activeDescription}>
                  {isPreviewMode
                    ? "Premium interface preview is enabled. No subscription was purchased."
                    : "Advanced Recipes, Smart Grocery List, and Pantry Analytics are unlocked."}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.purchaseLinks}>
            {!isPreviewMode && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restore Purchase"
                accessibilityState={{ disabled: working || isLoading }}
                disabled={working || isLoading}
                onPress={() => void handleRestorePurchase()}
                style={styles.linkTap}
              >
                <Text style={styles.link}>Restore Purchase</Text>
              </Pressable>
            )}
            {!isPreviewMode && <Text style={styles.dot}>•</Text>}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings/terms-of-use")}
              style={styles.linkTap}
            >
              <Text style={styles.link}>Terms</Text>
            </Pressable>
            <Text style={styles.dot}>•</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings/privacy-policy")}
              style={styles.linkTap}
            >
              <Text style={styles.link}>Privacy</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>
            KITCHENBUDDY · MORE OF THE GOOD STUFF
          </Text>
        </ScrollView>

        <Modal
          visible={dialog !== null}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeDialog}
        >
          <View style={styles.dialogOverlay}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={closeDialog}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              disabled={working}
            />
            {dialog && (
              <View style={styles.dialogSheet}>
                <View style={styles.dialogGrabber} />
                <View style={styles.dialogHeader}>
                  <View
                    style={[
                      styles.dialogIcon,
                      dialog.kind === "error" && styles.dialogIconError,
                    ]}
                  >
                    <Ionicons
                      name={
                        dialog.kind === "success"
                          ? "checkmark-circle-outline"
                          : dialog.kind === "error"
                            ? "alert-circle-outline"
                            : "information-circle-outline"
                      }
                      size={25}
                      color={dialog.kind === "error" ? C.red : C.slateDark}
                    />
                  </View>
                  <Pressable
                    onPress={closeDialog}
                    hitSlop={10}
                    disabled={working}
                    accessibilityRole="button"
                    accessibilityLabel="Close message"
                    style={styles.dialogClose}
                  >
                    <Ionicons name="close" size={20} color={C.slateDark} />
                  </Pressable>
                </View>
                <Text style={styles.dialogEyebrow}>KITCHENBUDDY PREMIUM</Text>
                <Text style={styles.dialogTitle}>{dialog.title}</Text>
                <Text style={styles.dialogMessage}>{dialog.message}</Text>
                <Pressable
                  onPress={closeDialog}
                  disabled={working}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.dialogPrimaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.dialogPrimaryText}>Got it</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </>
  );
}

function PremiumFeature({
  icon,
  title,
  description,
}: {
  icon: IoniconName;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={23} color={C.slate} />
      </View>
      <View style={styles.featureContent}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featurePill}>PREMIUM</Text>
        </View>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function FreeFeature({ text }: { text: string }) {
  return (
    <View style={styles.freeFeature}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={13} color={C.slate} />
      </View>
      <Text style={styles.freeFeatureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { padding: 16, paddingBottom: 52 },
  hero: {
    padding: 22,
    paddingTop: 23,
    borderRadius: 25,
    backgroundColor: C.slate,
    marginBottom: 27,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 27,
    gap: 12,
  },
  heroIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 1,
  },
  heroTagText: {
    color: C.cream,
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 9,
  },
  heroEyebrow: {
    color: C.cream,
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 9,
  },
  heroTitle: {
    color: C.paper,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Georgia",
    marginBottom: 11,
  },
  heroDescription: {
    color: "#F0EFEB",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.25)",
    marginTop: 24,
    paddingTop: 15,
  },
  heroFooterText: { fontSize: 12, color: C.cream, fontWeight: "600" },
  section: { marginBottom: 25 },
  eyebrow: {
    color: C.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
    marginLeft: 3,
  },
  sectionTitle: {
    color: C.ink,
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 12,
    marginLeft: 2,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    marginBottom: 13,
    marginLeft: 2,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.paper,
    borderRadius: 19,
    borderColor: C.border,
    borderWidth: 1,
    padding: 15,
    gap: 12,
  },
  statusIcon: {
    backgroundColor: C.taupe,
    borderRadius: 14,
    height: 47,
    width: 47,
    alignItems: "center",
    justifyContent: "center",
  },
  statusContent: { flex: 1 },
  statusEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: C.slate,
    marginBottom: 4,
  },
  statusTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  statusDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
    marginTop: 3,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    padding: 15,
    marginBottom: 10,
    gap: 12,
  },
  featureIcon: {
    height: 47,
    width: 47,
    backgroundColor: C.row,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: { flex: 1 },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 6,
  },
  featureTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },
  featurePill: {
    backgroundColor: C.cream,
    color: C.slateDark,
    borderRadius: 99,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 9,
    letterSpacing: 0.6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  featureDescription: { color: C.muted, fontSize: 13, lineHeight: 19 },
  freeCard: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 19,
  },
  freeFeature: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 39,
    gap: 11,
  },
  checkCircle: {
    backgroundColor: C.row,
    borderRadius: 11,
    height: 22,
    width: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  freeFeatureText: { color: C.ink, fontSize: 14 },
  previewCard: {
    backgroundColor: C.cream,
    borderColor: C.taupe,
    borderWidth: 1,
    borderRadius: 19,
    padding: 16,
    marginBottom: 22,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
    flexWrap: "wrap",
  },
  previewTitle: { color: C.ink, fontSize: 15, fontWeight: "700", flex: 1 },
  previewPill: {
    color: C.slateDark,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  previewDescription: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 13,
  },
  previewChoices: { flexDirection: "row", gap: 9 },
  previewChoice: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
  },
  previewChoiceSelected: { borderColor: C.slate, backgroundColor: C.row },
  previewChoiceText: { color: C.ink, fontSize: 14, fontWeight: "700" },
  previewFootnote: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 11,
  },
  actionSection: { marginBottom: 18 },
  primaryButton: {
    backgroundColor: C.slate,
    minHeight: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: C.paper, fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.82 },
  developmentNote: {
    color: C.muted,
    marginTop: 9,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
  },
  activeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.cream,
    borderRadius: 18,
    padding: 16,
    marginBottom: 13,
    gap: 12,
  },
  activeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  activeContent: { flex: 1 },
  activeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 4,
  },
  activeDescription: { fontSize: 12, lineHeight: 18, color: C.muted },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    borderRadius: 14,
    minHeight: 47,
    marginBottom: 12,
  },
  resetButtonText: { color: C.slate, fontSize: 13, fontWeight: "700" },
  purchaseLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 6,
  },
  linkTap: { paddingHorizontal: 3, paddingVertical: 10 },
  link: { color: C.slateDark, fontSize: 12, fontWeight: "700" },
  dot: { color: C.muted, fontSize: 12, marginHorizontal: 7 },
  footer: {
    color: C.muted,
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 1.1,
    marginTop: 14,
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24,30,32,0.44)",
  },
  dialogSheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingHorizontal: 23,
    paddingTop: 11,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  dialogGrabber: {
    width: 39,
    height: 4,
    borderRadius: 99,
    alignSelf: "center",
    backgroundColor: C.taupe,
    marginBottom: 21,
  },
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  dialogIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.cream,
  },
  dialogIconError: { backgroundColor: C.redWash },
  dialogIconWarning: { backgroundColor: C.redWash },
  dialogClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.row,
    borderRadius: 11,
  },
  dialogEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.55,
    color: C.slate,
    marginBottom: 7,
  },
  dialogTitle: {
    color: C.ink,
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 10,
  },
  dialogMessage: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  dialogPrimaryButton: {
    minHeight: 53,
    borderRadius: 15,
    backgroundColor: C.slate,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  dialogDangerButton: {
    minHeight: 53,
    borderRadius: 15,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  dialogPrimaryText: { fontSize: 14, fontWeight: "800", color: C.paper },
  dialogSecondaryButton: {
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },
  dialogSecondaryText: { color: C.slateDark, fontSize: 13, fontWeight: "700" },
});
