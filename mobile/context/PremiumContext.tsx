import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const PREMIUM_ENTITLEMENT = "kitchenbuddy_pro";
const PREVIEW_STORAGE_KEY = "kitchenbuddy_dev_premium_preview_v1";

// This is intentionally available ONLY in Expo Go during development.
const IS_EXPO_GO_PREVIEW =
  __DEV__ &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let revenueCatConfigured = false;

export type PurchaseOutcome = "purchased" | "cancelled";

type PremiumContextType = {
  isPremium: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  offering: PurchasesOffering | null;
  isPreviewMode: boolean;
  setPreviewPremium: (enabled: boolean) => Promise<void>;
  purchasePremium: (
    selectedPackage: PurchasesPackage,
  ) => Promise<PurchaseOutcome>;
  restorePremium: () => Promise<boolean>;
  refreshPremium: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

function hasPremium(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined;
}

function requireNativePurchases(): void {
  if (IS_EXPO_GO_PREVIEW) {
    throw new Error("Purchases are unavailable in Expo Go preview mode.");
  }
  if (!revenueCatConfigured) {
    throw new Error("RevenueCat is not ready.");
  }
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [hasRevenueCatPremium, setHasRevenueCatPremium] = useState(false);
  const [previewPremium, setPreviewPremiumState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  const isPremium = IS_EXPO_GO_PREVIEW ? previewPremium : hasRevenueCatPremium;

  const setPreviewPremium = useCallback(async (enabled: boolean) => {
    if (!IS_EXPO_GO_PREVIEW) {
      throw new Error(
        "Premium preview is only available in Expo Go development mode.",
      );
    }
    await AsyncStorage.setItem(PREVIEW_STORAGE_KEY, enabled ? "true" : "false");
    setPreviewPremiumState(enabled);
  }, []);

  const refreshPremium = useCallback(async () => {
    if (IS_EXPO_GO_PREVIEW) return;
    requireNativePurchases();
    const customerInfo = await Purchases.getCustomerInfo();
    setHasRevenueCatPremium(hasPremium(customerInfo));
  }, []);

  useEffect(() => {
    let mounted = true;

    // Expo Go has no RevenueCat native module: never configure or call it here.
    if (IS_EXPO_GO_PREVIEW) {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(PREVIEW_STORAGE_KEY);
          if (mounted) setPreviewPremiumState(saved === "true");
        } catch (error) {
          console.warn("Could not load Premium preview preference:", error);
          if (mounted) setPreviewPremiumState(false);
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }

    const updateCustomerInfo = (customerInfo: CustomerInfo) => {
      if (mounted) setHasRevenueCatPremium(hasPremium(customerInfo));
    };
    let listenerAttached = false;

    async function initializeRevenueCat() {
      try {
        const apiKey = __DEV__
          ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY
          : Platform.OS === "android"
            ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
            : undefined;

        if (!apiKey)
          throw new Error("Missing RevenueCat API key for this build.");

        if (!revenueCatConfigured) {
          if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          Purchases.configure({ apiKey });
          revenueCatConfigured = true;
        }

        Purchases.addCustomerInfoUpdateListener(updateCustomerInfo);
        listenerAttached = true;

        const [customerInfo, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (!mounted) return;
        setHasRevenueCatPremium(hasPremium(customerInfo));
        setOffering(offerings.current ?? null);
      } catch (error) {
        console.error("RevenueCat initialization failed:", error);
        if (mounted) {
          setHasRevenueCatPremium(false);
          setOffering(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void initializeRevenueCat();
    return () => {
      mounted = false;
      if (listenerAttached) {
        Purchases.removeCustomerInfoUpdateListener(updateCustomerInfo);
      }
    };
  }, []);

  async function purchasePremium(
    selectedPackage: PurchasesPackage,
  ): Promise<PurchaseOutcome> {
    requireNativePurchases();
    if (isPurchasing) throw new Error("A purchase is already in progress.");

    setIsPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      const active = hasPremium(customerInfo);
      setHasRevenueCatPremium(active);
      if (!active) {
        throw new Error("Purchase completed, but Premium is not active.");
      }
      return "purchased";
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "userCancelled" in error &&
        error.userCancelled === true
      ) {
        return "cancelled";
      }
      console.error("Premium purchase failed:", error);
      throw error;
    } finally {
      setIsPurchasing(false);
    }
  }

  async function restorePremium(): Promise<boolean> {
    requireNativePurchases();
    const customerInfo = await Purchases.restorePurchases();
    const active = hasPremium(customerInfo);
    setHasRevenueCatPremium(active);
    return active;
  }

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        isLoading,
        isPurchasing,
        offering,
        isPreviewMode: IS_EXPO_GO_PREVIEW,
        setPreviewPremium,
        purchasePremium,
        restorePremium,
        refreshPremium,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error("usePremium must be used inside a PremiumProvider");
  }
  return context;
}
