import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { loadPantry } from "@/features/pantry/storage";
import { Colors, Spacing } from "@/constants/theme";

import {
  GROCERY_STORAGE_KEY,
  ingredientKey,
  isGroceryItem,
  parseIngredient,
  type GroceryItem,
} from "@/features/grocery/groceryIngredients";

type Candidate = {
  label: string;
  key: string;
  present: boolean;
  selected: boolean;
};

type Props = {
  ingredients: string[];
  recipeTitle?: string;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Only match exact names or a basic singular/plural variation.
// Compare already-normalized ingredient keys.
function sameIngredient(a: string, b: string): boolean {
  return !!a && !!b && a === b;
}

export default function AddRecipeToGroceryButton({
  ingredients,
  recipeTitle,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const selectedCount = useMemo(
    () => candidates.filter((item) => item.selected).length,
    [candidates],
  );

  const openReview = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pantry = await loadPantry();
      const pantryKeys = Object.values(pantry)
        .flat()
        .flatMap((item) => [item.name, item.recipeSearchName ?? ""])
        .map(ingredientKey)
        .filter(Boolean);

      const seen = new Set<string>();
      const next: Candidate[] = [];

      for (const ingredient of ingredients) {
        if (typeof ingredient !== "string") continue;
        const label = ingredient.trim();
        const key = ingredientKey(label);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const present = pantryKeys.some((pantryKey) =>
          sameIngredient(key, pantryKey),
        );
        next.push({ label, key, present, selected: !present });
      }

      setCandidates(next);
      setVisible(true);
    } catch (error) {
      console.warn("Unable to compare recipe with pantry", error);
      Alert.alert("Couldn't check pantry", "Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, ingredients]);

  const addSelected = useCallback(async () => {
    if (busy || selectedCount === 0) return;
    setBusy(true);
    try {
      const raw = await AsyncStorage.getItem(GROCERY_STORAGE_KEY);
      const decoded: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(decoded)) throw new Error("Invalid grocery list data");

      const previous = decoded.filter(isGroceryItem);
      const existingKeys = previous.map((item) => ingredientKey(item.name));
      const additions: GroceryItem[] = [];

      for (const candidate of candidates) {
        if (!candidate.selected) continue;

        // Prevent adding ingredients already on the grocery list.
        if (existingKeys.some((key) => sameIngredient(key, candidate.key))) {
          continue;
        }

        // Separate the ingredient name, quantity and measurement.
        const parsed = parseIngredient(candidate.label);

        console.log("[GROCERY DEBUG]", {
          received: candidate.label,
          parsedName: parsed.name,
          parsedQuantity: parsed.quantity,
          parsedUnit: parsed.unit,
        });

        additions.push({
          id: uid(),

          // Store only the ingredient name here.
          name: parsed.name,

          // Store measurements separately.
          ...(parsed.quantity !== undefined
            ? { quantity: parsed.quantity }
            : {}),

          ...(parsed.unit !== undefined ? { unit: parsed.unit } : {}),

          // Preserve the original recipe text.
          originalText: candidate.label,

          ...(recipeTitle ? { sourceRecipe: recipeTitle } : {}),

          checked: false,
          createdAt: Date.now(),
        });

        existingKeys.push(candidate.key);
      }

      if (additions.length > 0) {
        await AsyncStorage.setItem(
          GROCERY_STORAGE_KEY,
          JSON.stringify([...additions, ...previous]),
        );
      }
      setVisible(false);
      Alert.alert(
        "Grocery list updated",
        additions.length
          ? `Added ${additions.length} ingredient${additions.length === 1 ? "" : "s"}.` +
              (additions.length < selectedCount
                ? ` Skipped ${selectedCount - additions.length} already on your list.`
                : "")
          : "All selected ingredients are already on your list.",
      );
    } catch (error) {
      console.warn("Unable to add recipe ingredients", error);
      Alert.alert("Couldn't save groceries", "Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, candidates, recipeTitle, selectedCount]);

  return (
    <>
      <TouchableOpacity
        onPress={() => void openReview()}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={{
          backgroundColor: Colors.primary,
          padding: Spacing.md,
          borderRadius: 12,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy && !visible ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Ionicons name="cart-outline" size={19} color={Colors.background} />
        )}
        <Text
          style={{
            color: Colors.background,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Add missing ingredients to grocery list
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setVisible(false);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <View
            style={{
              backgroundColor: Colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: Spacing.lg,
              maxHeight: "80%",
            }}
          >
            <Text
              style={{
                color: Colors.text,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              Review recipe ingredients
            </Text>
            <Text style={{ color: Colors.textLight, marginBottom: 12 }}>
              Ingredients not found in your pantry are selected. Matching uses
              ingredient text, not available quantities. Review before adding.
            </Text>
            <ScrollView>
              {candidates.map((candidate, index) => (
                <Pressable
                  key={`${candidate.key}-${index}`}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: candidate.selected,
                    disabled: busy,
                  }}
                  onPress={() =>
                    setCandidates((old) =>
                      old.map((item, i) =>
                        i === index
                          ? { ...item, selected: !item.selected }
                          : item,
                      ),
                    )
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(0,0,0,0.07)",
                  }}
                >
                  <Ionicons
                    name={candidate.selected ? "checkbox" : "square-outline"}
                    size={23}
                    color={Colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 15 }}>
                      {candidate.label}
                    </Text>
                    <Text style={{ color: Colors.textLight, fontSize: 12 }}>
                      {candidate.present
                        ? "Found in pantry"
                        : "Not found in pantry"}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {candidates.length === 0 && (
                <Text style={{ color: Colors.textLight }}>
                  No ingredients listed in this recipe.
                </Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                disabled={busy}
                onPress={() => setVisible(false)}
                style={{ flex: 1, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: Colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy || selectedCount === 0}
                onPress={() => void addSelected()}
                style={{
                  flex: 2,
                  backgroundColor: Colors.primary,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  opacity: busy || selectedCount === 0 ? 0.5 : 1,
                }}
              >
                <Text style={{ color: Colors.background, fontWeight: "700" }}>
                  {busy ? "Saving..." : `Add ${selectedCount} to list`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
