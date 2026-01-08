import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  CATEGORIES,
  CATEGORY_DEFAULT_EXPIRY,
} from "@/features/pantry/constants";
import type { CategoryKey } from "@/features/pantry/types";
import { useSettingsStore } from "@/features/settings/store";

export default function DefaultExpirySettingsScreen() {
  const [hydrated, setHydrated] = useState(false);

  const expiryOverrides = useSettingsStore((s) => s.expiryOverrides);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const setExpiryOverride = useSettingsStore((s) => s.setExpiryOverride);
  const resetExpiryOverride = useSettingsStore((s) => s.resetExpiryOverride);

  useEffect(() => {
    (async () => {
      try {
        await hydrate();
      } finally {
        setHydrated(true);
      }
    })();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Default Expiry by Category</Text>
        <Text style={styles.subtitle}>
          These values are used to auto-fill expiry dates when adding items.
          Changes are saved on this device.
        </Text>

        {CATEGORIES.map((cat) => {
          const defaultVal = CATEGORY_DEFAULT_EXPIRY[cat.key];
          const override = expiryOverrides[cat.key];
          const effective = override ?? defaultVal;
          const isOverridden = override !== undefined;

          return (
            <View key={cat.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color="#666"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.cardTitle}>{cat.label}</Text>
                </View>

                {isOverridden && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Overridden</Text>
                  </View>
                )}
              </View>

              <Text style={styles.defaultText}>
                Default:{" "}
                <Text style={styles.defaultStrong}>
                  {defaultVal === "none"
                    ? "No automatic expiry"
                    : `${defaultVal} days`}
                </Text>
              </Text>

              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.label}>Override (days)</Text>
                  <TextInput
                    keyboardType="numeric"
                    style={styles.input}
                    value={
                      effective === "none" || effective == null
                        ? ""
                        : String(effective)
                    }
                    placeholder={
                      defaultVal === "none" ? "No expiry" : String(defaultVal)
                    }
                    onChangeText={(txt) => {
                      const trimmed = txt.trim();
                      if (!trimmed) {
                        // empty = no automatic expiry
                        setExpiryOverride(cat.key, "none");
                        return;
                      }
                      const num = Number(trimmed);
                      if (!isNaN(num) && num > 0) {
                        setExpiryOverride(cat.key, num);
                      }
                    }}
                  />
                  <Text style={styles.helper}>
                    Leave empty for no automatic expiry.
                  </Text>
                </View>

                <View style={styles.buttonsCol}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setExpiryOverride(cat.key, "none")}
                  >
                    <Text style={styles.secondaryButtonText}>No expiry</Text>
                  </Pressable>

                  <Pressable
                    style={styles.textButton}
                    onPress={() => resetExpiryOverride(cat.key)}
                  >
                    <Text style={styles.textButtonText}>Reset</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#444",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    color: "#111",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDD",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EEE",
  },
  badgeText: {
    fontSize: 11,
    color: "#555",
  },
  defaultText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 8,
  },
  defaultStrong: {
    fontWeight: "600",
    color: "#222",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 13,
    color: "#333",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#FFF",
  },
  helper: {
    marginTop: 4,
    fontSize: 11,
    color: "#777",
  },
  buttonsCol: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CCC",
    marginBottom: 4,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: "#222",
  },
  textButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  textButtonText: {
    fontSize: 13,
    color: "#007AFF",
  },
});
