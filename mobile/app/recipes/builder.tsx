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
import { pantryCandidates } from "@/features/recipes/cookNowPremium";
import {
  getCookNowAccessToken,
  ingredientLabel,
  missingName,
  searchCookNowRecipes,
  type ApiRecipe,
  type CookNowQuery,
} from "@/features/recipes/cookNowApi";
import {
  buildBuilderQuery,
  builderRecipeVisible,
  normalizeBuilderIngredient,
  rankBuilderRecipes,
  type BuilderExtraRule,
  type BuilderFocusRule,
} from "@/features/recipes/ingredientBuilder";

const C = {
  bg: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  deep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  white: "#FFFFFF",
  green: "#516D5A",
  amber: "#926C3D",
};

type Picked = {
  id: string;
  name: string;
  source: "pantry" | "manual";
  daysLeft: number | null;
};
const numberText = (value: number | undefined, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${Number(value.toFixed(1))}${suffix}`
    : "—";
const missingList = (recipe: ApiRecipe) =>
  (recipe.pantry_match?.missing_ingredients ?? [])
    .map(missingName)
    .filter(Boolean);

function ChoiceBar<T extends string>({
  value,
  choices,
  onChange,
}: {
  value: T;
  choices: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {choices.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: item.value === value }}
          onPress={() => onChange(item.value)}
          style={[styles.choice, item.value === value && styles.choiceActive]}
        >
          <Text
            style={[
              styles.choiceLabel,
              item.value === value && styles.choiceLabelActive,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function IngredientBuilderScreen() {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const pantry = usePantryStore((s) => s.pantry);
  const hydrated = usePantryStore((s) => s.hydrated);
  const candidates = useMemo(() => pantryCandidates(pantry), [pantry]);
  const [chosen, setChosen] = useState<Picked[]>([]);
  const [pantrySearch, setPantrySearch] = useState("");
  const [manual, setManual] = useState("");
  const [focus, setFocus] = useState<BuilderFocusRule>("prioritize");
  const [extras, setExtras] = useState<BuilderExtraRule>("any");
  const [servings, setServings] = useState("2");
  const [protein, setProtein] = useState("");
  const [calories, setCalories] = useState("");
  const [results, setResults] = useState<ApiRecipe[]>([]);
  const [activeQuery, setActiveQuery] = useState<CookNowQuery | null>(null);
  const [activeNames, setActiveNames] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<ApiRecipe | null>(null);
  const [spotlight, setSpotlight] = useState<ApiRecipe | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      requestId.current += 1;
    },
    [],
  );

  // Results belong to the submitted brief, not unsubmitted edits. Clearly flag changes.
  const [dirty, setDirty] = useState(false);
  function editBrief() {
    setDirty(true);
    setError("");
  }
  function togglePantry(item: {
    id: string;
    name: string;
    daysLeft: number | null;
  }) {
    const exists = chosen.some(
      (x) =>
        normalizeBuilderIngredient(x.name) ===
        normalizeBuilderIngredient(item.name),
    );
    if (!exists && chosen.length >= 5) {
      setError("You can choose up to five ingredients per search.");
      return;
    }
    setChosen((current) =>
      exists
        ? current.filter(
            (x) =>
              normalizeBuilderIngredient(x.name) !==
              normalizeBuilderIngredient(item.name),
          )
        : [
            ...current,
            {
              id: item.id,
              name: item.name,
              daysLeft: item.daysLeft,
              source: "pantry",
            },
          ],
    );
    editBrief();
  }
  function addManual() {
    const name = manual.trim().replace(/,/g, " ").replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > 65) {
      setError("Keep ingredient names to 65 characters or less.");
      return;
    }
    if (chosen.length >= 5) {
      setError("The Recipe API accepts up to five ingredients at a time.");
      return;
    }
    if (
      chosen.some(
        (x) =>
          normalizeBuilderIngredient(x.name) ===
          normalizeBuilderIngredient(name),
      )
    ) {
      setError("That ingredient is already selected.");
      return;
    }
    setChosen((current) => [
      ...current,
      { id: `manual-${Date.now()}`, name, daysLeft: null, source: "manual" },
    ]);
    setManual("");
    editBrief();
  }
  const filteredPantry = candidates.filter((candidate) =>
    candidate.name.toLowerCase().includes(pantrySearch.trim().toLowerCase()),
  );
  const shown = useMemo(
    () =>
      rankBuilderRecipes(
        results.filter((recipe) => builderRecipeVisible(recipe, focus, extras)),
      ),
    [results, focus, extras],
  );

  function optionalNumber(raw: string, label: string): number | undefined {
    if (!raw.trim()) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 50000)
      throw new Error(`${label} must be between 0 and 50,000.`);
    return value;
  }
  function newQuery(): CookNowQuery {
    const count = optionalNumber(servings, "Servings");
    return buildBuilderQuery({
      names: chosen.map((x) => x.name),
      servings: count,
      minProtein: optionalNumber(protein, "Protein goal"),
      maxCalories: optionalNumber(calories, "Calorie limit"),
    });
  }
  async function search(more = false) {
    if (!hydrated || !isPremium || busy || moreBusy) return;
    let query: CookNowQuery;
    try {
      query =
        more && activeQuery
          ? { ...activeQuery, offset: activeQuery.offset + activeQuery.limit }
          : newQuery();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Check your search choices.",
      );
      return;
    }
    const seq = ++requestId.current;
    setError("");
    if (more) setMoreBusy(true);
    else setBusy(true);
    try {
      const token = await getCookNowAccessToken();
      if (!token)
        throw new Error(
          "Secure Premium recipe access is not connected yet. Follow the Cook Now backend integration guide.",
        );
      const data = await searchCookNowRecipes(query, token);
      if (!mounted.current || seq !== requestId.current) return;
      setResults((old) => (more ? [...old, ...data.recipes] : data.recipes));
      setHasMore(data.pagination.hasMore);
      setActiveQuery(query);
      if (!more) {
        setActiveNames(query.ingredients ?? []);
        setSearched(true);
        setDirty(false);
        setSpotlight(null);
      }
    } catch (err) {
      if (mounted.current && seq === requestId.current)
        setError(
          err instanceof Error
            ? err.message
            : "Could not search recipes. Please retry.",
        );
    } finally {
      if (mounted.current && seq === requestId.current) {
        setBusy(false);
        setMoreBusy(false);
      }
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ title: "Ingredient Builder", headerBackTitle: "Recipes" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>KITCHENBUDDY / PREMIUM</Text>
            <Ionicons name="flask-outline" size={25} color={C.white} />
          </View>
          <Text style={styles.heroTitle}>
            Build a meal around your ingredients.
          </Text>
          <Text style={styles.heroSubtitle}>
            Choose what you want to use, set a few priorities, and find recipes
            that fit your kitchen.
          </Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroFine}>
            Cook Now helps you browse. Here, you choose the ingredients that
            lead the meal.
          </Text>
        </View>
        {premiumLoading ? (
          <View style={styles.panel}>
            <ActivityIndicator color={C.deep} />
            <Text style={styles.body}>Checking Premium access…</Text>
          </View>
        ) : !isPremium ? (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={33} color={C.deep} />
            <Text style={styles.lockTitle}>Your ingredient workshop</Text>
            <Text style={styles.body}>
              Ingredient Builder is part of KitchenBuddy Premium. Create a
              focused recipe search using the items you want to cook with.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.primary}
              onPress={() => router.push("/settings/premium")}
            >
              <Text style={styles.primaryText}>Explore Premium</Text>
              <Ionicons name="arrow-forward" color={C.white} size={18} />
            </Pressable>
          </View>
        ) : !hydrated ? (
          <View style={styles.panel}>
            <ActivityIndicator color={C.deep} />
            <Text style={styles.body}>Loading your Pantry…</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>01 · YOUR INGREDIENT BRIEF</Text>
                <Text style={styles.heading}>What should we use?</Text>
              </View>
              <Text style={styles.count}>{chosen.length}/5</Text>
            </View>
            <Text style={styles.body}>
              Choose up to five from Pantry, or enter something you plan to buy.
              Items expiring soon appear first; check freshness before using
              them.
            </Text>
            <View style={styles.selectedBox}>
              <Text style={styles.label}>SELECTED INGREDIENTS</Text>
              <View style={styles.chips}>
                {chosen.length ? (
                  chosen.map((item) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name}`}
                      key={item.id}
                      onPress={() => {
                        setChosen((old) => old.filter((x) => x.id !== item.id));
                        editBrief();
                      }}
                      style={[styles.chip, styles.selectedChip]}
                    >
                      <Text style={styles.selectedChipText}>{item.name}</Text>
                      <Ionicons name="close" size={15} color={C.white} />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptyHint}>
                    Your ingredient selections will appear here.
                  </Text>
                )}
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={pantrySearch}
              onChangeText={setPantrySearch}
              placeholder="Search your Pantry"
              placeholderTextColor={C.muted}
              accessibilityLabel="Find Pantry ingredients"
            />
            <View style={styles.chips}>
              {filteredPantry.slice(0, 35).map((item) => {
                const selected = chosen.some(
                  (x) =>
                    normalizeBuilderIngredient(x.name) ===
                    normalizeBuilderIngredient(item.name),
                );
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => togglePantry(item)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Ionicons
                      name={
                        selected ? "checkmark-circle" : "add-circle-outline"
                      }
                      size={16}
                      color={selected ? C.white : C.deep}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.selectedChipText,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.daysLeft !== null && item.daysLeft <= 3 && (
                      <Text
                        style={[
                          styles.expiryTag,
                          selected && { color: C.white },
                        ]}
                      >
                        {item.daysLeft === 0 ? "Today" : `${item.daysLeft}d`}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {!filteredPantry.length && (
              <Text style={styles.emptyHint}>
                No matching Pantry ingredients. You can add one manually below.
              </Text>
            )}
            {filteredPantry.length > 35 && (
              <Text style={styles.caption}>
                Showing the first 35 matches. Type a name above to narrow the
                list.
              </Text>
            )}
            <View style={styles.manualRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={manual}
                onChangeText={setManual}
                placeholder="Other ingredient…"
                placeholderTextColor={C.muted}
                maxLength={65}
                accessibilityLabel="Add an ingredient not in Pantry"
                onSubmitEditing={addManual}
                returnKeyType="done"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add custom ingredient"
                disabled={!manual.trim() || chosen.length >= 5}
                onPress={addManual}
                style={[
                  styles.addButton,
                  (!manual.trim() || chosen.length >= 5) && styles.dim,
                ]}
              >
                <Ionicons name="add" color={C.white} size={23} />
              </Pressable>
            </View>
            <Text style={styles.caption}>
              Manually added ingredients are search inputs, not changes to your
              Pantry.
            </Text>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.kicker}>02 · SET YOUR PRIORITIES</Text>
                <Text style={styles.heading}>How flexible are we?</Text>
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.label}>USE YOUR SELECTED INGREDIENTS</Text>
              <ChoiceBar
                value={focus}
                onChange={setFocus}
                choices={[
                  { value: "prioritize", label: "Prioritize" },
                  { value: "every", label: "Use every one" },
                ]}
              />
              <Text style={styles.caption}>
                “Use every one” filters returned recipes by the provider's
                matching data. Strict combinations can return no results.
              </Text>
              <View style={styles.panelDivider} />
              <Text style={styles.label}>ADDITIONAL RECIPE INGREDIENTS</Text>
              <ChoiceBar
                value={extras}
                onChange={setExtras}
                choices={[
                  { value: "any", label: "Any" },
                  { value: "two", label: "Up to 2" },
                  { value: "none", label: "None" },
                ]}
              />
              <Text style={styles.caption}>
                Counted against the five submitted ingredients, not
                automatically against your entire Pantry. These filters only
                change the displayed results.
              </Text>
              <View style={styles.panelDivider} />
              <Text style={styles.label}>HOW MANY SERVINGS?</Text>
              <TextInput
                style={styles.input}
                value={servings}
                onChangeText={(value) => {
                  setServings(value);
                  editBrief();
                }}
                keyboardType="number-pad"
                placeholder="Leave empty for original yield"
                placeholderTextColor={C.muted}
                accessibilityLabel="Number of servings"
              />
              <Text style={styles.caption}>
                The API can rescale recipe quantities and nutrition when a
                servings value is supplied (1–1,000).
              </Text>
              <View style={styles.twoInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>MIN PROTEIN (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={protein}
                    onChangeText={(value) => {
                      setProtein(value);
                      editBrief();
                    }}
                    placeholder="Optional"
                    placeholderTextColor={C.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>MAX CALORIES</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={calories}
                    onChangeText={(value) => {
                      setCalories(value);
                      editBrief();
                    }}
                    placeholder="Optional"
                    placeholderTextColor={C.muted}
                  />
                </View>
              </View>
              <Text style={styles.caption}>
                Nutrition totals refer to the API's returned recipe/yield unless
                otherwise specified.
              </Text>
            </View>
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color="#9B5550"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy || moreBusy || !chosen.length}
              onPress={() => void search()}
              style={[
                styles.primary,
                (busy || moreBusy || !chosen.length) && styles.dim,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Ionicons name="sparkles-outline" size={20} color={C.white} />
              )}
              <Text style={styles.primaryText}>
                {busy ? "Finding recipe matches…" : "Build my recipe shortlist"}
              </Text>
              {!busy && (
                <Ionicons name="arrow-forward" color={C.white} size={19} />
              )}
            </Pressable>
            {searched && (
              <>
                <View style={styles.sectionHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kicker}>03 · YOUR SHORTLIST</Text>
                    <Text style={styles.heading}>Recipes to consider</Text>
                  </View>
                  <Text style={styles.count}>{shown.length} shown</Text>
                </View>
                <Text style={styles.caption}>
                  Search based on: {activeNames.join(", ")}. Matching is based
                  on names, not guaranteed availability or quantities.
                </Text>
                {dirty && (
                  <View style={styles.hintBox}>
                    <Text style={styles.body}>
                      You've changed the ingredient brief. Tap “Build my recipe
                      shortlist” to search with those new choices.
                    </Text>
                  </View>
                )}
                <View style={styles.resultsSummary}>
                  <Text style={styles.body}>
                    {results.length} returned so far · {shown.length} fit the
                    current strictness filters
                  </Text>
                  {!!shown.length && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setSpotlight(
                          shown[Math.floor(Math.random() * shown.length)],
                        )
                      }
                    >
                      <Text style={styles.actionText}>Surprise me ↗</Text>
                    </Pressable>
                  )}
                </View>
                {spotlight && shown.includes(spotlight) && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedRecipe(spotlight)}
                    style={styles.surpriseBox}
                  >
                    <Text style={styles.kicker}>TODAY'S PICK</Text>
                    <Text style={styles.cardTitle}>{spotlight.title}</Text>
                    <Text style={styles.actionText}>Open recipe →</Text>
                  </Pressable>
                )}
                {shown.length ? (
                  shown.map((recipe, i) => (
                    <Pressable
                      key={`${recipe.title}-${i}`}
                      accessibilityRole="button"
                      onPress={() => setSelectedRecipe(recipe)}
                      style={styles.recipeCard}
                    >
                      <View style={styles.recipeRow}>
                        <View style={styles.recipeIcon}>
                          <Ionicons
                            name="restaurant-outline"
                            color={C.deep}
                            size={23}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{recipe.title}</Text>
                          <Text style={styles.caption}>
                            {recipe.servings || "Yield not specified"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          color={C.deep}
                          size={20}
                        />
                      </View>
                      {recipe.pantry_match ? (
                        <View style={styles.statRow}>
                          <Text style={styles.stat}>
                            {recipe.pantry_match.matched_count}/
                            {recipe.pantry_match.requested_count} selected
                            matched
                          </Text>
                          <Text style={styles.stat}>
                            {recipe.pantry_match.missing_count} additional
                            ingredients
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.caption}>
                          Provider matching detail unavailable
                        </Text>
                      )}
                      <Text style={styles.recipeFoot}>
                        {numberText(recipe.nutrition.calories, " kcal")} ·{" "}
                        {numberText(recipe.nutrition.protein, " g protein")} for
                        returned yield
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.emptyResults}>
                    <Ionicons name="search-outline" color={C.deep} size={25} />
                    <Text style={styles.emptyTitle}>
                      {results.length
                        ? "No matches at this strictness"
                        : "No recipes found yet"}
                    </Text>
                    <Text style={styles.body}>
                      Try “Prioritize,” allow more extra ingredients, adjust
                      your combination, or load another page if available.
                    </Text>
                  </View>
                )}
                {hasMore && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || moreBusy}
                    onPress={() => void search(true)}
                    style={[styles.more, (busy || moreBusy) && styles.dim]}
                  >
                    {moreBusy ? (
                      <ActivityIndicator color={C.deep} />
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        color={C.deep}
                        size={19}
                      />
                    )}
                    <Text style={styles.moreText}>
                      {moreBusy ? "Loading…" : "Find more matches"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            <Text style={styles.disclaimer}>
              Ingredient Builder searches existing API recipes; it does not
              generate new original recipes. Confirm quantities, food condition,
              allergens and cooking instructions yourself. Your selected
              ingredients and optional goals are sent to the recipe provider
              through KitchenBuddy's server.
            </Text>
          </>
        )}
      </ScrollView>
      <Modal
        visible={selectedRecipe !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRecipe(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close recipe details"
            style={StyleSheet.absoluteFillObject}
            onPress={() => setSelectedRecipe(null)}
          />
          {selectedRecipe && (
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>INGREDIENT BUILDER / RECIPE</Text>
                  <Text style={styles.sheetTitle}>{selectedRecipe.title}</Text>
                  <Text style={styles.body}>{selectedRecipe.servings}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setSelectedRecipe(null)}
                >
                  <Ionicons name="close-circle" color={C.deep} size={29} />
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 35 }}
              >
                {selectedRecipe.original_servings && (
                  <Text style={styles.caption}>
                    Original yield: {selectedRecipe.original_servings} · Scale:{" "}
                    {numberText(selectedRecipe.scale_factor, "×")}
                  </Text>
                )}
                <Text style={styles.heading}>Nutrition for returned yield</Text>
                <View style={styles.nutritionRow}>
                  {(
                    [
                      ["Calories", selectedRecipe.nutrition.calories, " kcal"],
                      ["Protein", selectedRecipe.nutrition.protein, " g"],
                      [
                        "Carbs",
                        selectedRecipe.nutrition.total_carbohydrate,
                        " g",
                      ],
                      ["Fat", selectedRecipe.nutrition.total_fat, " g"],
                    ] as [string, number | undefined, string][]
                  ).map(([label, value, unit]) => (
                    <View style={styles.nutritionTile} key={label}>
                      <Text style={styles.caption}>{label}</Text>
                      <Text style={styles.nutritionValue}>
                        {numberText(value, unit)}
                      </Text>
                    </View>
                  ))}
                </View>
                {selectedRecipe.pantry_match && (
                  <View style={styles.matchBox}>
                    <Text style={styles.label}>RECIPE MATCH</Text>
                    <Text style={styles.body}>
                      {selectedRecipe.pantry_match.matched_count} of{" "}
                      {selectedRecipe.pantry_match.requested_count} searched
                      ingredients matched
                    </Text>
                    <Text style={styles.caption}>
                      Additional ingredients relative to submitted selections:
                    </Text>
                    {missingList(selectedRecipe).length ? (
                      missingList(selectedRecipe).map((name, i) => (
                        <Text style={styles.missing} key={`${name}-${i}`}>
                          • {name}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.body}>
                        No additional ingredients reported.
                      </Text>
                    )}
                  </View>
                )}
                <Text style={styles.heading}>Ingredients</Text>
                {selectedRecipe.ingredients.map((ing, i) => (
                  <View style={styles.ingRow} key={`${ing.name}-${i}`}>
                    <Ionicons name="ellipse-outline" color={C.deep} size={15} />
                    <Text style={styles.ingText}>{ingredientLabel(ing)}</Text>
                  </View>
                ))}
                <View style={{ marginVertical: 16 }}>
                  <AddRecipeToGroceryButton
                    ingredients={selectedRecipe.ingredients.map(
                      ingredientLabel,
                    )}
                    recipeTitle={selectedRecipe.title}
                  />
                </View>
                <Text style={styles.heading}>Instructions</Text>
                {selectedRecipe.instructions.map((step, i) => (
                  <View style={styles.step} key={i}>
                    <Text style={styles.stepNumber}>{i + 1}.</Text>
                    <Text style={styles.stepBody}>{step}</Text>
                  </View>
                ))}
                <Text style={styles.disclaimer}>
                  Recipe data may contain errors. Check ingredient quantities,
                  allergens, safe temperatures and preparation before cooking.
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
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 70 },
  hero: {
    backgroundColor: C.deep,
    borderRadius: 25,
    padding: 22,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#E2EAEB",
    fontWeight: "800",
    letterSpacing: 1.2,
    fontSize: 10,
  },
  heroTitle: {
    color: C.white,
    fontFamily: "serif",
    fontSize: 30,
    lineHeight: 37,
    marginTop: 20,
  },
  heroSubtitle: {
    color: "#E6EAEB",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 11,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "#82939C",
    marginTop: 18,
    marginBottom: 11,
  },
  heroFine: { color: "#DBE3E4", fontSize: 10, lineHeight: 16 },
  panel: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 17,
    padding: 15,
    marginTop: 15,
  },
  locked: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    marginTop: 12,
    alignItems: "center",
    gap: 12,
  },
  lockTitle: { fontSize: 24, color: C.ink, fontFamily: "serif" },
  body: { fontSize: 12, lineHeight: 19, color: C.muted },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    color: C.slate,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heading: {
    color: C.ink,
    fontSize: 22,
    fontFamily: "serif",
    marginTop: 5,
    marginBottom: 10,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 22,
  },
  count: { color: C.deep, fontSize: 13, fontWeight: "800", paddingBottom: 12 },
  selectedBox: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    marginTop: 13,
    marginBottom: 11,
  },
  label: {
    color: C.ink,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 7,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
  },
  chipActive: { backgroundColor: C.deep, borderColor: C.deep },
  selectedChip: { backgroundColor: C.deep, borderColor: C.deep },
  chipText: { color: C.deep, fontSize: 11, fontWeight: "700", flexShrink: 1 },
  selectedChipText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  expiryTag: { color: C.amber, fontWeight: "800", fontSize: 9 },
  emptyHint: { color: C.muted, fontSize: 12, paddingVertical: 7 },
  input: {
    minHeight: 44,
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
    fontSize: 13,
    color: C.ink,
  },
  manualRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 10,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.deep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  caption: { color: C.muted, fontSize: 10, lineHeight: 17, marginTop: 4 },
  choiceRow: { flexDirection: "row", gap: 7, marginBottom: 8 },
  choice: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderColor: C.border,
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: C.bg,
  },
  choiceActive: { backgroundColor: C.deep, borderColor: C.deep },
  choiceLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.deep,
    textAlign: "center",
  },
  choiceLabelActive: { color: C.white },
  panelDivider: { height: 1, backgroundColor: C.border, marginVertical: 17 },
  twoInputs: { flexDirection: "row", gap: 10, marginTop: 14 },
  primary: {
    minHeight: 52,
    backgroundColor: C.deep,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    marginTop: 17,
  },
  primaryText: { fontSize: 13, fontWeight: "800", color: C.white },
  dim: { opacity: 0.48 },
  errorBox: {
    backgroundColor: "#F8EEEB",
    padding: 13,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
  },
  errorText: { color: "#9B5550", fontSize: 12, lineHeight: 18, flex: 1 },
  hintBox: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: C.cream,
    padding: 12,
    marginVertical: 10,
  },
  resultsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 13,
  },
  actionText: { color: C.deep, fontSize: 11, fontWeight: "800" },
  surpriseBox: {
    borderRadius: 14,
    backgroundColor: C.cream,
    padding: 15,
    marginBottom: 12,
  },
  cardTitle: { color: C.ink, fontSize: 14, fontWeight: "800", marginBottom: 5 },
  recipeCard: {
    backgroundColor: C.paper,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  recipeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  recipeIcon: {
    backgroundColor: C.cream,
    borderRadius: 12,
    height: 43,
    width: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  stat: {
    backgroundColor: C.bg,
    paddingVertical: 5,
    paddingHorizontal: 7,
    overflow: "hidden",
    borderRadius: 7,
    color: C.deep,
    fontWeight: "700",
    fontSize: 10,
  },
  recipeFoot: { color: C.muted, fontSize: 10, marginTop: 11 },
  emptyResults: {
    padding: 23,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.paper,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "serif",
    color: C.ink,
    textAlign: "center",
  },
  more: {
    padding: 13,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  moreText: { color: C.deep, fontSize: 12, fontWeight: "800" },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 25 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.46)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.bg,
    maxHeight: "90%",
    padding: 19,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: { flexDirection: "row", gap: 12, marginBottom: 13 },
  sheetTitle: {
    color: C.ink,
    fontFamily: "serif",
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 5,
  },
  nutritionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nutritionTile: {
    width: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 11,
    backgroundColor: C.paper,
    padding: 12,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    marginTop: 5,
  },
  matchBox: {
    backgroundColor: C.cream,
    padding: 13,
    borderRadius: 12,
    marginVertical: 15,
  },
  missing: { color: C.amber, fontSize: 11, lineHeight: 19 },
  ingRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
  },
  ingText: { flex: 1, fontSize: 12, color: C.ink, lineHeight: 18 },
  step: { flexDirection: "row", gap: 10, paddingVertical: 7 },
  stepNumber: { color: C.deep, fontSize: 14, fontWeight: "800" },
  stepBody: { flex: 1, fontSize: 12, lineHeight: 19, color: C.ink },
});
