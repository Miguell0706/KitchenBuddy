import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { usePremium } from "@/context/PremiumContext";
import { usePantryStore } from "@/features/pantry/store";
import AddRecipeToGroceryButton from "@/features/grocery/AddRecipeToGroceryButton";
import {
  getInitialIngredientIds,
  likelyInPantry,
  pantryCandidates,
} from "@/features/recipes/cookNowPremium";
import {
  getCookNowAccessToken,
  ingredientLabel,
  missingName,
  searchCookNowRecipes,
  type ApiRecipe,
  type CookNowQuery,
  type MacroLimits,
} from "@/features/recipes/cookNowApi";

const P = {
  bg: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  deep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  green: "#516D5A",
  amber: "#926C3D",
  white: "#FFFFFF",
};
const FILTERS: { key: keyof MacroLimits; label: string; unit: string }[] = [
  { key: "min_calories", label: "Minimum calories", unit: "kcal" },
  { key: "max_calories", label: "Maximum calories", unit: "kcal" },
  { key: "min_protein", label: "Minimum protein", unit: "g" },
  { key: "max_protein", label: "Maximum protein", unit: "g" },
  { key: "min_carbs", label: "Minimum carbohydrates", unit: "g" },
  { key: "max_carbs", label: "Maximum carbohydrates", unit: "g" },
  { key: "min_fat", label: "Minimum fat", unit: "g" },
  { key: "max_fat", label: "Maximum fat", unit: "g" },
  { key: "max_sugars", label: "Maximum sugars", unit: "g" },
  { key: "max_sodium", label: "Maximum sodium", unit: "mg" },
];
type ViewMode = "all" | "ready" | "almost";
function readable(value: number | undefined, unit = ""): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Number(value.toFixed(1))}${unit}`
    : "—";
}
function resultMissing(recipe: ApiRecipe): string[] | null {
  if (!recipe.pantry_match) return null;
  return (recipe.pantry_match.missing_ingredients ?? [])
    .map(missingName)
    .filter(Boolean);
}
function validNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 50000 ? n : undefined;
}

export default function CookNowScreen() {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const pantry = usePantryStore((s) => s.pantry);
  const hydrated = usePantryStore((s) => s.hydrated);
  const candidates = useMemo(() => pantryCandidates(pantry), [pantry]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const userTouched = useRef(false);
  const [title, setTitle] = useState("");
  const [pantrySearch, setPantrySearch] = useState("");
  const [servings, setServings] = useState("2");
  const [advanced, setAdvanced] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ApiRecipe[]>([]);
  const [mode, setMode] = useState<ViewMode>("all");
  const [chosen, setChosen] = useState<ApiRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [activeQuery, setActiveQuery] = useState<CookNowQuery | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (hydrated && !userTouched.current)
      setSelectedIds(getInitialIngredientIds(candidates));
  }, [hydrated, candidates]);
  const chosenCandidates = candidates.filter((x) => selectedIds.includes(x.id));
  const filteredCandidates = pantrySearch.trim()
    ? candidates.filter((x) =>
        x.name.toLowerCase().includes(pantrySearch.trim().toLowerCase()),
      )
    : candidates;
  const visible = results.filter((recipe) => {
    const missing = resultMissing(recipe);
    if (mode === "all") return true;
    if (!missing) return false;
    return mode === "ready"
      ? missing.length === 0
      : missing.length > 0 && missing.length <= 2;
  });
  const changeSelection = (id: string) => {
    userTouched.current = true;
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < 5
          ? [...current, id]
          : current,
    );
  };
  function buildQuery(): CookNowQuery | null {
    const cleanTitle = title.trim();
    const searchIngredients = chosenCandidates
      .map((x) => x.name.replace(/,/g, " ").trim())
      .slice(0, 5);
    const numeric = {} as MacroLimits;
    for (const { key } of FILTERS) {
      const raw = filters[key] ?? "";
      const parsed = validNumber(raw);
      if (raw.trim() && parsed === undefined) {
        setError("Nutrition values must be between 0 and 50,000.");
        return null;
      }
      if (parsed !== undefined) numeric[key] = parsed;
    }
    for (const [min, max] of [
      ["min_calories", "max_calories"],
      ["min_protein", "max_protein"],
      ["min_carbs", "max_carbs"],
      ["min_fat", "max_fat"],
    ] as const) {
      if (
        numeric[min] !== undefined &&
        numeric[max] !== undefined &&
        numeric[min]! > numeric[max]!
      ) {
        setError("A minimum nutrition value cannot exceed its maximum.");
        return null;
      }
    }
    const requestedServings = servings.trim() ? Number(servings) : undefined;
    if (
      requestedServings !== undefined &&
      (!Number.isInteger(requestedServings) ||
        requestedServings < 1 ||
        requestedServings > 1000)
    ) {
      setError(
        "Choose 1–1,000 servings, or leave the field blank for the original yield.",
      );
      return null;
    }
    if (
      !cleanTitle &&
      !searchIngredients.length &&
      !Object.keys(numeric).length
    ) {
      setError(
        "Choose Pantry ingredients, enter a dish name, or set a nutrition goal.",
      );
      return null;
    }
    return {
      ...(cleanTitle ? { title: cleanTitle.slice(0, 100) } : {}),
      ...(searchIngredients.length ? { ingredients: searchIngredients } : {}),
      ...(requestedServings ? { servings: requestedServings } : {}),
      filters: numeric,
      limit: 10,
      offset: 0,
    };
  }
  async function runSearch(more = false) {
    if (loading || loadingMore || !isPremium || !hydrated) return;
    const query =
      more && activeQuery
        ? { ...activeQuery, offset: activeQuery.offset + activeQuery.limit }
        : buildQuery();
    if (!query) return;
    const serial = ++searchSeq.current;
    setError("");
    setNotice("");
    more ? setLoadingMore(true) : setLoading(true);
    try {
      const token = await getCookNowAccessToken();
      if (!token)
        throw new Error(
          "Cook Now's secure Premium API connection hasn't been linked to your account yet. See the integration README.",
        );
      const data = await searchCookNowRecipes(query, token);
      if (serial !== searchSeq.current) return;
      setResults((previous) =>
        more ? [...previous, ...data.recipes] : data.recipes,
      );
      setHasMore(data.pagination.hasMore);
      setActiveQuery(query);
      if (!more) {
        setMode("all");
        setNotice(
          data.recipes.length
            ? "Results are ranked by the recipe provider for your search."
            : "No recipes found. Try a different combination.",
        );
      }
    } catch (e) {
      if (serial === searchSeq.current)
        setError(
          e instanceof Error ? e.message : "Couldn't load recipes. Try again.",
        );
    } finally {
      if (serial === searchSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ title: "Cook Now", headerBackTitle: "Recipes" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>KITCHENBUDDY · PREMIUM</Text>
            <Ionicons name="sparkles-outline" size={23} color={P.white} />
          </View>
          <Text style={styles.heroTitle}>Cook with what you have.</Text>
          <Text style={styles.heroSubtitle}>
            Smart Pantry discovery, full recipes and nutritional insight — all
            in one place.
          </Text>
          <View style={styles.heroLine} />
          <Text style={styles.heroFoot}>
            125,000+ recipes in the API provider's collection · results subject
            to subscription and availability
          </Text>
        </View>

        {premiumLoading ? (
          <View style={styles.panel}>
            <ActivityIndicator color={P.slate} />
            <Text style={styles.body}>Checking Premium access…</Text>
          </View>
        ) : !isPremium ? (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={31} color={P.deep} />
            <Text style={styles.lockedTitle}>
              Cook Now is a Premium feature
            </Text>
            <Text style={styles.body}>
              Find meals from your Pantry, see what's missing, scale servings
              and search by nutrition goals.
            </Text>
            <Pressable
              style={styles.primary}
              onPress={() => router.push("/settings/premium")}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>
                Explore KitchenBuddy Premium
              </Text>
              <Ionicons name="arrow-forward" size={18} color={P.white} />
            </Pressable>
          </View>
        ) : !hydrated ? (
          <View style={styles.panel}>
            <ActivityIndicator color={P.slate} />
            <Text style={styles.body}>Loading Pantry…</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.kicker}>01 · START WITH YOUR KITCHEN</Text>
                <Text style={styles.heading}>Choose up to 5 ingredients</Text>
              </View>
              <Text style={styles.counter}>{selectedIds.length}/5</Text>
            </View>
            <Text style={styles.body}>
              Suggested ingredients are ordered by approaching expiry. Choose
              different ones any time.
            </Text>
            <TextInput
              value={pantrySearch}
              onChangeText={setPantrySearch}
              placeholder="Find a Pantry ingredient"
              placeholderTextColor={P.muted}
              style={[styles.input, { marginTop: 12 }]}
              accessibilityLabel="Search Pantry ingredients"
            />
            <View style={styles.chips}>
              {filteredCandidates.length ? (
                filteredCandidates.slice(0, 32).map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const disabled = !selected && selectedIds.length >= 5;
                  return (
                    <Pressable
                      key={item.id}
                      disabled={disabled}
                      onPress={() => changeSelection(item.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                      style={[
                        styles.chip,
                        selected && styles.chipActive,
                        disabled && styles.dim,
                      ]}
                    >
                      <Ionicons
                        name={
                          selected ? "checkmark-circle" : "add-circle-outline"
                        }
                        size={15}
                        color={selected ? P.white : P.deep}
                      />
                      <Text
                        style={[
                          styles.chipLabel,
                          selected && styles.chipLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.daysLeft !== null &&
                        item.daysLeft >= 0 &&
                        item.daysLeft <= 3 && (
                          <Text
                            style={[
                              styles.chipHint,
                              selected && styles.chipLabelActive,
                            ]}
                          >
                            Soon
                          </Text>
                        )}
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.body}>
                  No matching Pantry ingredients. You can still search by dish
                  title or nutrition goal.
                </Text>
              )}
            </View>
            {filteredCandidates.length > 32 && (
              <Text style={styles.footnote}>
                Showing 32 matches. Refine your Pantry search to see more.
              </Text>
            )}
            <Pressable
              onPress={() => {
                userTouched.current = true;
                setSelectedIds(getInitialIngredientIds(candidates));
              }}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Use five suggested ingredients</Text>
            </Pressable>

            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={styles.kicker}>02 · PERSONALIZE</Text>
                <Text style={styles.heading}>What's the plan?</Text>
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.inputLabel}>Dish name (optional)</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. lentil soup"
                placeholderTextColor={P.muted}
                style={styles.input}
                maxLength={100}
              />
              <Text style={styles.footnote}>
                When combined with selected Pantry ingredients, the provider
                applies both search parameters.
              </Text>
              <View style={styles.separator} />
              <Text style={styles.inputLabel}>
                Scale to servings (optional)
              </Text>
              <TextInput
                value={servings}
                onChangeText={setServings}
                keyboardType="number-pad"
                placeholder="Original yield"
                placeholderTextColor={P.muted}
                style={styles.input}
                maxLength={4}
              />
              <Text style={styles.footnote}>
                Leave blank to keep the recipe's original quantities and
                nutrition.
              </Text>
            </View>
            <Pressable
              style={styles.advancedHead}
              onPress={() => setAdvanced((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: advanced }}
            >
              <Ionicons name="options-outline" size={19} color={P.deep} />
              <Text style={styles.advancedText}>Nutrition goals</Text>
              <Ionicons
                name={advanced ? "chevron-up" : "chevron-down"}
                size={18}
                color={P.deep}
              />
            </Pressable>
            {advanced && (
              <View style={styles.filterGrid}>
                {FILTERS.map((filter) => (
                  <View key={filter.key} style={styles.filterCell}>
                    <Text style={styles.filterLabel}>
                      {filter.label} ({filter.unit})
                    </Text>
                    <TextInput
                      value={filters[filter.key] ?? ""}
                      onChangeText={(value) =>
                        setFilters((old) => ({ ...old, [filter.key]: value }))
                      }
                      keyboardType="decimal-pad"
                      maxLength={7}
                      placeholder="Any"
                      placeholderTextColor={P.muted}
                      style={styles.input}
                    />
                  </View>
                ))}
              </View>
            )}
            <Pressable
              disabled={loading || loadingMore}
              style={[styles.primary, (loading || loadingMore) && styles.dim]}
              onPress={() => void runSearch()}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={P.white} />
              ) : (
                <Ionicons name="search-outline" size={18} color={P.white} />
              )}
              <Text style={styles.primaryText}>
                {loading ? "Finding recipes…" : "Find my recipes"}
              </Text>
            </Pressable>
            {error ? (
              <View style={styles.messageError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#965D57"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {notice ? <Text style={styles.footnote}>{notice}</Text> : null}

            <View style={styles.resultsTitle}>
              <Text style={styles.heading}>Your recipe matches</Text>
              <Text style={styles.counter}>{results.length} loaded</Text>
            </View>
            <View style={styles.chips}>
              {(
                [
                  ["all", "All results"],
                  ["ready", "No missing"],
                  ["almost", "Missing 1–2"],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setMode(value)}
                  style={[styles.chip, mode === value && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === value }}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      mode === value && styles.chipLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {results.length === 0 && !loading ? (
              <View style={styles.empty}>
                <Ionicons name="restaurant-outline" size={28} color={P.deep} />
                <Text style={styles.emptyTitle}>
                  Your next meal starts here
                </Text>
                <Text style={styles.body}>
                  Select Pantry ingredients and search to discover recipes from
                  the provider.
                </Text>
              </View>
            ) : null}
            {results.length > 0 && visible.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  No results in this match category
                </Text>
                <Text style={styles.body}>
                  Try All results or search with different ingredients.
                </Text>
              </View>
            ) : null}
            {visible.map((recipe, idx) => {
              const missing = resultMissing(recipe);
              const matches = recipe.pantry_match;
              return (
                <Pressable
                  key={`${recipe.title}-${idx}`}
                  onPress={() => setChosen(recipe)}
                  accessibilityRole="button"
                  style={styles.recipeCard}
                >
                  <View style={styles.recipeTop}>
                    <View style={styles.recipeIcon}>
                      <Ionicons
                        name="restaurant-outline"
                        size={23}
                        color={P.deep}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipeTitle}>{recipe.title}</Text>
                      <Text style={styles.smallMuted}>
                        {recipe.servings || "Yield unspecified"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" color={P.deep} size={18} />
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {readable(recipe.nutrition.calories, " kcal")}
                    </Text>
                    <Text style={styles.meta}>
                      {readable(recipe.nutrition.protein, "g protein")}
                    </Text>
                    {missing ? (
                      <Text
                        style={[
                          styles.meta,
                          { color: missing.length ? P.amber : P.green },
                        ]}
                      >
                        {missing.length
                          ? `${missing.length} not in search`
                          : "No missing from search"}
                      </Text>
                    ) : (
                      <Text style={styles.meta}>
                        Title search · no provider Pantry match
                      </Text>
                    )}
                  </View>
                  {matches && (
                    <Text style={styles.smallMuted}>
                      {matches.matched_count} of {matches.requested_count}{" "}
                      searched Pantry ingredients matched
                    </Text>
                  )}
                </Pressable>
              );
            })}
            {hasMore && (
              <Pressable
                disabled={loadingMore}
                style={styles.more}
                onPress={() => void runSearch(true)}
                accessibilityRole="button"
              >
                {loadingMore ? (
                  <ActivityIndicator color={P.deep} />
                ) : (
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={P.deep}
                  />
                )}
                <Text style={styles.moreText}>Load more recipes</Text>
              </Pressable>
            )}
            <Text style={styles.disclaimer}>
              The provider does not supply cook time, so this screen does not
              estimate it. Nutrition is shown for the returned recipe/yield, not
              automatically per serving. Ingredient-name matches do not verify
              quantities, allergens, or food safety.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal
        visible={chosen !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setChosen(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setChosen(null)}
            accessibilityLabel="Close recipe"
          />
          {chosen && (
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>COOK NOW · RECIPE</Text>
                  <Text style={styles.sheetTitle}>{chosen.title}</Text>
                  <Text style={styles.body}>{chosen.servings}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChosen(null)}
                  hitSlop={12}
                >
                  <Ionicons name="close-circle" size={28} color={P.deep} />
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 26 }}
              >
                {chosen.original_servings && (
                  <Text style={styles.footnote}>
                    Original: {chosen.original_servings} · Scale factor:{" "}
                    {readable(chosen.scale_factor, "×")}
                  </Text>
                )}
                <Text style={styles.heading}>
                  Nutrition for returned recipe
                </Text>
                <View style={styles.nutritionGrid}>
                  {(
                    [
                      ["Calories", chosen.nutrition.calories, " kcal"],
                      ["Protein", chosen.nutrition.protein, " g"],
                      ["Carbs", chosen.nutrition.total_carbohydrate, " g"],
                      ["Fat", chosen.nutrition.total_fat, " g"],
                      ["Fiber", chosen.nutrition.dietary_fiber, " g"],
                      ["Sodium", chosen.nutrition.sodium, " mg"],
                      ["Sugars", chosen.nutrition.sugars, " g"],
                      ["Potassium", chosen.nutrition.potassium, " mg"],
                      ["Sat. fat", chosen.nutrition.saturated_fat, " g"],
                      ["Cholesterol", chosen.nutrition.cholesterol, " mg"],
                    ] as [string, number | undefined, string][]
                  ).map(([label, value, unit]) => (
                    <View key={label} style={styles.nutritionCell}>
                      <Text style={styles.smallMuted}>{label}</Text>
                      <Text style={styles.nutritionValue}>
                        {readable(value, unit)}
                      </Text>
                    </View>
                  ))}
                </View>
                {chosen.pantry_match && (
                  <View style={styles.matchBox}>
                    <Text style={styles.inputLabel}>Provider Pantry match</Text>
                    <Text style={styles.body}>
                      {chosen.pantry_match.matched_count} searched ingredients
                      matched · {chosen.pantry_match.missing_count} additional
                      recipe ingredients
                    </Text>
                    {(resultMissing(chosen) ?? []).map((item, i) => (
                      <Text style={styles.missing} key={`${item}-${i}`}>
                        • {item}
                        {likelyInPantry(item, candidates)
                          ? " · Possible name match in full Pantry; check quantity"
                          : ""}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={styles.heading}>Ingredients</Text>
                {chosen.ingredients.map((item, i) => (
                  <View style={styles.ingredientRow} key={`${item.name}-${i}`}>
                    <Ionicons name="ellipse-outline" color={P.deep} size={15} />
                    <Text style={styles.ingredientText}>
                      {ingredientLabel(item)}
                    </Text>
                  </View>
                ))}
                <View style={styles.groceryAction}>
                  <AddRecipeToGroceryButton
                    ingredients={chosen.ingredients.map(ingredientLabel)}
                    recipeTitle={chosen.title}
                  />
                </View>
                <Text style={styles.heading}>How to make it</Text>
                {chosen.instructions.map((step, i) => (
                  <View style={styles.stepRow} key={i}>
                    <Text style={styles.stepNum}>{i + 1}.</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
                <Text style={styles.disclaimer}>
                  Provider data can contain errors. Check ingredients and
                  cooking temperatures before preparing food.
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 65 },
  hero: {
    backgroundColor: P.deep,
    borderRadius: 25,
    padding: 22,
    marginBottom: 23,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: "#DFE6E9",
  },
  heroTitle: {
    color: P.white,
    fontSize: 29,
    lineHeight: 35,
    fontFamily: "serif",
    marginTop: 20,
  },
  heroSubtitle: {
    color: "#E4EAEB",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  heroLine: { height: 1, backgroundColor: "#82919A", marginVertical: 17 },
  heroFoot: { color: "#E4EAEB", fontSize: 10, lineHeight: 15 },
  locked: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 22,
    padding: 25,
    alignItems: "center",
    gap: 13,
  },
  lockedTitle: {
    fontSize: 23,
    fontFamily: "serif",
    color: P.ink,
    textAlign: "center",
  },
  body: { color: P.muted, fontSize: 12, lineHeight: 19 },
  primary: {
    backgroundColor: P.deep,
    borderRadius: 14,
    minHeight: 51,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 15,
  },
  primaryText: { fontSize: 14, fontWeight: "800", color: P.white },
  panel: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 17,
    padding: 15,
    gap: 8,
    marginTop: 9,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 21,
    marginBottom: 8,
  },
  kicker: {
    color: P.slate,
    fontWeight: "800",
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heading: {
    color: P.ink,
    fontFamily: "serif",
    fontSize: 21,
    marginTop: 7,
    marginBottom: 12,
  },
  counter: { color: P.slate, fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginVertical: 12 },
  chip: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    maxWidth: "100%",
  },
  chipActive: { backgroundColor: P.deep, borderColor: P.deep },
  chipLabel: { color: P.deep, fontSize: 11, fontWeight: "700", flexShrink: 1 },
  chipLabelActive: { color: P.white },
  chipHint: { color: P.amber, fontSize: 9, fontWeight: "800" },
  dim: { opacity: 0.48 },
  link: { color: P.slate, fontSize: 12, fontWeight: "800", marginTop: 2 },
  inputLabel: {
    color: P.ink,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 3,
  },
  input: {
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    color: P.ink,
    fontSize: 13,
  },
  footnote: { color: P.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  separator: { height: 1, backgroundColor: P.border, marginVertical: 8 },
  advancedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: P.taupe,
    borderRadius: 13,
    padding: 14,
    marginTop: 12,
  },
  advancedText: { flex: 1, color: P.deep, fontWeight: "800", fontSize: 13 },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 11,
  },
  filterCell: { width: "48%", flexGrow: 1 },
  filterLabel: { color: P.muted, fontSize: 11, marginBottom: 5 },
  messageError: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#F8EEEB",
    borderRadius: 11,
    marginTop: 12,
    gap: 9,
    alignItems: "flex-start",
  },
  errorText: { color: "#965D57", fontSize: 12, lineHeight: 18, flex: 1 },
  resultsTitle: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 24,
  },
  recipeCard: {
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 17,
    padding: 14,
    marginBottom: 11,
  },
  recipeTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  recipeIcon: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: P.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: P.ink,
    marginBottom: 4,
  },
  smallMuted: { fontSize: 11, lineHeight: 17, color: P.muted },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 11,
    marginBottom: 4,
  },
  meta: {
    fontSize: 11,
    color: P.slate,
    backgroundColor: P.bg,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    overflow: "hidden",
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    backgroundColor: P.paper,
    borderRadius: 18,
    padding: 25,
    gap: 10,
    borderWidth: 1,
    borderColor: P.border,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 20,
    color: P.ink,
    textAlign: "center",
  },
  more: {
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  moreText: { color: P.deep, fontWeight: "800", fontSize: 12 },
  disclaimer: { color: P.muted, fontSize: 10, lineHeight: 17, marginTop: 17 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: P.bg,
    maxHeight: "90%",
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 19,
  },
  sheetHead: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 13,
  },
  sheetTitle: {
    color: P.ink,
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 29,
    marginBottom: 5,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  nutritionCell: {
    width: "30%",
    flexGrow: 1,
    backgroundColor: P.paper,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  nutritionValue: {
    color: P.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  matchBox: {
    backgroundColor: P.cream,
    borderRadius: 12,
    padding: 13,
    marginBottom: 17,
    gap: 5,
  },
  missing: { color: P.amber, fontSize: 11, lineHeight: 16 },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.border,
  },
  ingredientText: { flex: 1, color: P.ink, fontSize: 12, lineHeight: 18 },
  groceryAction: { marginVertical: 18 },
  stepRow: { flexDirection: "row", gap: 11, marginBottom: 13 },
  stepNum: { fontSize: 14, fontWeight: "800", color: P.deep },
  stepText: { fontSize: 12, color: P.ink, lineHeight: 19, flex: 1 },
});
