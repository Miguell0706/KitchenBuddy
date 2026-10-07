import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const PREMIUM_STORAGE_KEY = "kitchenbuddy_premium";

type PremiumContextType = {
  isPremium: boolean;
  isLoading: boolean;
  activatePremium: () => Promise<void>;
  deactivatePremium: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

type PremiumProviderProps = {
  children: ReactNode;
};

export function PremiumProvider({ children }: PremiumProviderProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved Premium status when the app starts.
  useEffect(() => {
    async function loadPremiumStatus() {
      try {
        const savedStatus = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);

        setIsPremium(savedStatus === "true");
      } catch (error) {
        console.error("Failed to load Premium status:", error);

        setIsPremium(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadPremiumStatus();
  }, []);

  // Temporary simulated purchase.
  // Later this will be replaced by Google Play purchase verification.
  async function activatePremium() {
    try {
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, "true");

      setIsPremium(true);
    } catch (error) {
      console.error("Failed to activate Premium:", error);

      throw error;
    }
  }

  // Development/testing only.
  // Lets us switch back to the Free experience.
  async function deactivatePremium() {
    try {
      await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);

      setIsPremium(false);
    } catch (error) {
      console.error("Failed to deactivate Premium:", error);

      throw error;
    }
  }

  return (
    <PremiumContext.Provider
      value={{
        isPremium,
        isLoading,
        activatePremium,
        deactivatePremium,
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
