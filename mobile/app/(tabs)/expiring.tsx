import { View, Text, StyleSheet } from "react-native";

export default function ExpiringSoonScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expiring Soon</Text>
      <Text style={styles.text}>
        Items nearing expiration will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    alignItems: "center",
    backgroundColor: "#fdfdfc",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: "#666",
  },
});
