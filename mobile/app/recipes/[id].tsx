import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";

/**
 * Recipe detail placeholder.
 * A recipe lookup is intentionally not implemented in the original screen.
 * Keep this route ready until the detail data contract is available.
 */
export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const displayId = Array.isArray(id) ? id[0] : id;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ title: "Recipe details", headerBackTitle: "Recipes" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.eyebrowRow}>
            <Ionicons name="restaurant-outline" size={15} color={P.heroMuted} />
            <Text style={styles.eyebrow}>KITCHENBUDDY · RECIPES</Text>
          </View>
          <Text style={styles.heroTitle}>Recipe details</Text>
          <Text style={styles.heroSubtitle}>
            A dedicated space for your ingredients, preparation, and cooking
            notes.
          </Text>
          <View style={styles.heroDecoration}>
            <Ionicons name="book-outline" size={30} color={P.white} />
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>RECIPE OVERVIEW</Text>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Ionicons name="document-text-outline" size={25} color={P.slate} />
          </View>
          <Text style={styles.cardTitle}>Full recipe coming soon</Text>
          <Text style={styles.cardBody}>
            This screen is ready for the recipe details feature. The original
            route currently receives a recipe ID but does not yet look up or
            display the recipe itself.
          </Text>
          <View style={styles.separator} />
          <Text style={styles.fieldLabel}>RECIPE ID</Text>
          <Text style={styles.idText} selectable>
            {displayId || "Not provided"}
          </Text>
        </View>

        <View style={styles.noteRow}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={P.slate}
          />
          <Text style={styles.noteText}>
            Recipe ingredients and instructions will appear here when the detail
            lookup is connected.
          </Text>
        </View>
        <Text style={styles.footer}>MADE FOR YOUR KITCHEN · KITCHENBUDDY</Text>
      </ScrollView>
    </View>
  );
}

const P = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  heroMuted: "#DFE7E6",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.background },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
    flexGrow: 1,
  },
  hero: {
    minHeight: 226,
    borderRadius: 26,
    padding: 24,
    marginBottom: 30,
    overflow: "hidden",
    backgroundColor: P.slateDeep,
    justifyContent: "center",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: P.heroMuted,
  },
  heroTitle: {
    fontSize: 35,
    lineHeight: 42,
    color: P.white,
    fontFamily: "serif",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: P.heroMuted,
    maxWidth: 255,
  },
  heroDecoration: {
    position: "absolute",
    right: 18,
    bottom: 17,
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.13)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: P.muted,
    marginBottom: 12,
    marginLeft: 3,
  },
  card: {
    padding: 21,
    borderRadius: 22,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: P.taupe,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },
  cardTitle: {
    fontSize: 23,
    fontFamily: "serif",
    color: P.ink,
    marginBottom: 9,
  },
  cardBody: { fontSize: 13, lineHeight: 21, color: P.muted },
  separator: { height: 1, backgroundColor: P.border, marginVertical: 20 },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: P.muted,
    marginBottom: 7,
  },
  idText: { fontSize: 14, color: P.ink, fontWeight: "600" },
  noteRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 15,
    marginTop: 14,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 19, color: P.muted },
  footer: {
    marginTop: "auto",
    paddingTop: 35,
    fontSize: 9,
    letterSpacing: 1.6,
    color: P.muted,
    textAlign: "center",
  },
});
