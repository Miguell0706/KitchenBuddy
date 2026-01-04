import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};
import AsyncStorage from "@react-native-async-storage/async-storage";

if (__DEV__) {
  (globalThis as any).pantryDebug = {
    async get() {
      const v = await AsyncStorage.getItem("pantry_items_v1");
      console.log("pantry_items_v1:", v);
      return v;
    },
    async keys() {
      const k = await AsyncStorage.getAllKeys();
      console.log("AsyncStorage keys:", k);
      return k;
    },
    async clear() {
      await AsyncStorage.removeItem("pantry_items_v1");
      console.log("pantry_items_v1 removed");
    },
    async clearAll() {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;

      await AsyncStorage.clear();
      console.log("🔥 AsyncStorage fully cleared");
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-item"
            options={{ presentation: "modal", title: "Add item" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
