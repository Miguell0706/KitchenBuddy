import React from "react";
import { View, Text, StyleSheet } from "react-native";

function ToastCard({
  icon,
  title,
  message,
}: {
  icon: string;
  title?: string;
  message?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>

      <View style={{ flex: 1 }}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <ToastCard icon="🍳" title={text1} message={text2} />
  ),

  error: ({ text1, text2 }: any) => (
    <ToastCard icon="⚠️" title={text1} message={text2} />
  ),

  info: ({ text1, text2 }: any) => (
    <ToastCard icon="ℹ️" title={text1} message={text2} />
  ),
};

const styles = StyleSheet.create({
  card: {
    width: "90%",
    minHeight: 64,
    backgroundColor: "#111",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    color: "#ddd",
    marginTop: 2,
    fontSize: 13,
  },
});
