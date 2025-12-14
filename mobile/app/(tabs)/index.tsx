import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  TextInput,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Screen,
  TextStyles,
  CardStyles,
  Layout,
  TagStyles,
  ButtonStyles,
} from "@/constants/styles";
import { Colors, Spacing } from "@/constants/theme";

type PantryItem = {
  id: string;
  name: string;
  quantity: string;
  expiresInDays: number;
};

type CategoryKey =
  | "produce"
  | "meatSeafood"
  | "dairyEggs"
  | "bakery"
  | "pantry"
  | "condiments"
  | "spices"
  | "beverages"
  | "frozen"
  | "snacks"
  | "pet"
  | "household"
  | "supplements";

type Category = {
  key: CategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Fake data for now
const MOCK_PANTRY: Record<CategoryKey, PantryItem[]> = {
  produce: [
    { id: "1", name: "Apples", quantity: "6", expiresInDays: 7 },
    { id: "2", name: "Spinach", quantity: "1 bag", expiresInDays: 2 },
  ],
  meatSeafood: [
    { id: "3", name: "Chicken Breast", quantity: "2 lbs", expiresInDays: 3 },
    { id: "4", name: "Ground Beef", quantity: "1 lb", expiresInDays: 1 },
  ],
  dairyEggs: [
    { id: "5", name: "Milk", quantity: "1 gal", expiresInDays: 4 },
    { id: "6", name: "Cheddar Cheese", quantity: "0.5 lb", expiresInDays: 14 },
    { id: "6b", name: "Eggs", quantity: "12 count", expiresInDays: 10 },
  ],
  bakery: [
    { id: "10", name: "Sourdough Bread", quantity: "1 loaf", expiresInDays: 3 },
  ],
  pantry: [
    { id: "7", name: "Rice", quantity: "5 lbs", expiresInDays: 120 },
    {
      id: "8",
      name: "Black Beans (canned)",
      quantity: "4 cans",
      expiresInDays: 365,
    },
  ],
  condiments: [
    { id: "11", name: "Mayo", quantity: "1 jar", expiresInDays: -2 },
    { id: "12", name: "Soy Sauce", quantity: "1 bottle", expiresInDays: 180 },
  ],
  spices: [
    { id: "13", name: "Garlic Powder", quantity: "1 jar", expiresInDays: 365 },
    { id: "14", name: "Cinnamon", quantity: "1 jar", expiresInDays: 365 },
  ],
  beverages: [
    { id: "15", name: "Orange Juice", quantity: "1 bottle", expiresInDays: 6 },
    { id: "16", name: "Coffee", quantity: "1 bag", expiresInDays: 90 },
  ],
  frozen: [
    { id: "9", name: "Frozen Berries", quantity: "1 bag", expiresInDays: 60 },
  ],
  snacks: [
    { id: "17", name: "Tortilla Chips", quantity: "1 bag", expiresInDays: 21 },
    {
      id: "18",
      name: "Dark Chocolate",
      quantity: "2 bars",
      expiresInDays: 180,
    },
  ],
  pet: [],
  household: [
    {
      id: "19",
      name: "Paper Towels",
      quantity: "6 rolls",
      expiresInDays: 9999,
    },
    { id: "20", name: "Dish Soap", quantity: "1 bottle", expiresInDays: 9999 },
  ],
  supplements: [
    { id: "21", name: "Creatine", quantity: "1 tub", expiresInDays: 9999 },
  ],
};

const CATEGORIES: Category[] = [
  { key: "produce", label: "Produce", icon: "leaf-outline" },
  { key: "meatSeafood", label: "Meat & Seafood", icon: "restaurant-outline" },
  { key: "dairyEggs", label: "Dairy & Eggs", icon: "ice-cream-outline" },
  { key: "bakery", label: "Bakery / Bread", icon: "nutrition-outline" },
  { key: "pantry", label: "Pantry (Dry Goods)", icon: "cube-outline" },
  { key: "condiments", label: "Condiments & Sauces", icon: "water-outline" },
  { key: "spices", label: "Spices & Seasonings", icon: "flame-outline" },
  { key: "beverages", label: "Beverages", icon: "cafe-outline" },
  { key: "frozen", label: "Frozen", icon: "snow-outline" },
  { key: "snacks", label: "Snacks & Sweets", icon: "ice-cream-outline" },
  { key: "pet", label: "Pet Food", icon: "paw-outline" },
  { key: "household", label: "Household (Non-food)", icon: "home-outline" },
  {
    key: "supplements",
    label: "Supplements / Vitamins",
    icon: "medkit-outline",
  },
];

const ALL_CATEGORY_KEYS: CategoryKey[] = CATEGORIES.map((c) => c.key);

function setAllCategories(open: boolean): Record<CategoryKey, boolean> {
  return ALL_CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = open;
    return acc;
  }, {} as Record<CategoryKey, boolean>);
}

function getExpiryBadge(item: PantryItem) {
  const d = item.expiresInDays;

  if (d <= 0) {
    const daysAgo = Math.abs(d);

    let label = "Expired";
    if (d === 0) label = "Expired today";
    else if (d === -1) label = "Expired yesterday";
    else label = `Expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;

    return {
      container: [
        TagStyles.danger,
        { backgroundColor: "rgba(255, 59, 48, 0.15)" },
      ],
      text: [TagStyles.textDark, { color: "rgb(170, 20, 20)" }],
      label,
    };
  }

  if (d >= 9999) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(120, 120, 120, 0.12)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(60,60,60,0.9)" }],
      label: "No expiry",
    };
  }

  if (d <= 2) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(255, 149, 0, 0.18)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(140, 70, 0, 0.95)" }],
      label: `${d} day${d === 1 ? "" : "s"} left`,
    };
  }

  if (d <= 5) {
    return {
      container: [
        TagStyles.base,
        { backgroundColor: "rgba(255, 204, 0, 0.18)" },
      ],
      text: [TagStyles.textDark, { color: "rgba(120, 95, 0, 0.95)" }],
      label: `${d} days left`,
    };
  }

  return {
    container: [
      TagStyles.success,
      { backgroundColor: "rgba(52, 199, 89, 0.16)" },
    ],
    text: [TagStyles.textDark, { color: "rgba(0, 110, 40, 0.95)" }],
    label: `${d} days`,
  };
}

type ExpiringRow = PantryItem & {
  categoryKey: CategoryKey;
  categoryLabel: string;
};

function matchesQuery(item: PantryItem, q: string) {
  if (!q) return true;
  const hay = `${item.name} ${item.quantity}`.toLowerCase();
  return hay.includes(q);
}

export default function PantryScreen() {
  const [pantry, setPantry] =
    useState<Record<CategoryKey, PantryItem[]>>(MOCK_PANTRY);

  const [undo, setUndo] = useState<{
    item: PantryItem;
    categoryKey: CategoryKey;
    index: number;
  } | null>(null);

  const [openExpiring, setOpenExpiring] = useState(true);
  const [openExpired, setOpenExpired] = useState(true);

  const [openCategories, setOpenCategories] = useState<
    Record<CategoryKey, boolean>
  >({
    produce: true,
    meatSeafood: true,
    dairyEggs: false,
    bakery: false,
    pantry: false,
    frozen: false,
    condiments: false,
    spices: false,
    beverages: false,
    snacks: false,
    pet: false,
    household: false,
    supplements: false,
  });

  // ✅ Search
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim().toLowerCase();
  const isSearching = q.length > 0;

  const allOpen = ALL_CATEGORY_KEYS.every((k) => openCategories[k]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 4000);
    return () => clearTimeout(t);
  }, [undo]);

  const confirmDelete = (categoryKey: CategoryKey, item: PantryItem) => {
    Alert.alert("Delete item?", item.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteItem(categoryKey, item.id);
        },
      },
    ]);
  };

  const toggleAll = () => {
    const nextOpen = !allOpen;
    setOpenCategories(setAllCategories(nextOpen));
    setOpenExpiring(nextOpen);
    setOpenExpired(nextOpen);
  };

  const toggleCategory = (key: CategoryKey) => {
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const deleteItem = (categoryKey: CategoryKey, itemId: string) => {
    setPantry((prev) => {
      const list = prev[categoryKey];
      const index = list.findIndex((x) => x.id === itemId);
      if (index === -1) return prev;

      const item = list[index];
      setUndo({ item, categoryKey, index });

      const nextList = list.filter((x) => x.id !== itemId);
      return { ...prev, [categoryKey]: nextList };
    });
  };

  const undoDelete = () => {
    if (!undo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setPantry((prev) => {
      const list = prev[undo.categoryKey];
      const nextList = list.slice();
      nextList.splice(undo.index, 0, undo.item);
      return { ...prev, [undo.categoryKey]: nextList };
    });
    setUndo(null);
  };

  const showCategoryMenu = (cat: Category) => {
    Alert.alert(cat.label, "Category options", [
      {
        text: "Clear expired items",
        onPress: () => {
          setPantry((prev) => ({
            ...prev,
            [cat.key]: prev[cat.key].filter((it) => it.expiresInDays > 0),
          }));
        },
      },
      {
        text: "Clear category (remove all items)",
        style: "destructive",
        onPress: () => {
          setPantry((prev) => ({ ...prev, [cat.key]: [] }));
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ✅ Expired filtered by search
  const expiredItems: ExpiringRow[] = useMemo(() => {
    const byKey = new Map<CategoryKey, string>();
    CATEGORIES.forEach((c) => byKey.set(c.key, c.label));

    const flat: ExpiringRow[] = [];
    for (const key of ALL_CATEGORY_KEYS) {
      for (const item of pantry[key]) {
        if (item.expiresInDays <= 0 && matchesQuery(item, q)) {
          flat.push({
            ...item,
            categoryKey: key,
            categoryLabel: byKey.get(key) ?? key,
          });
        }
      }
    }
    flat.sort((a, b) => b.expiresInDays - a.expiresInDays);
    return flat;
  }, [pantry, q]);

  // ✅ Expiring soon filtered by search
  const expiringSoon: ExpiringRow[] = useMemo(() => {
    const byKey = new Map<CategoryKey, string>();
    CATEGORIES.forEach((c) => byKey.set(c.key, c.label));

    const flat: ExpiringRow[] = [];
    for (const key of ALL_CATEGORY_KEYS) {
      for (const item of pantry[key]) {
        if (item.expiresInDays >= 9999) continue;
        if (item.expiresInDays <= 0) continue;
        if (item.expiresInDays > 7) continue;
        if (!matchesQuery(item, q)) continue;

        flat.push({
          ...item,
          categoryKey: key,
          categoryLabel: byKey.get(key) ?? key,
        });
      }
    }

    flat.sort((a, b) => a.expiresInDays - b.expiresInDays);
    return flat;
  }, [pantry, q]);

  // ✅ Categories filtered by search + auto expand when searching
  const visibleCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const items = pantry[cat.key].filter((it) => matchesQuery(it, q));
      return { cat, items };
    }).filter(({ items }) => {
      // when not searching, show all categories (even empty)
      if (!isSearching) return true;
      // when searching, show only categories with matches
      return items.length > 0;
    });
  }, [pantry, q, isSearching]);

  const InlineDeleteButton = ({ onDelete }: { onDelete: () => void }) => (
    <Pressable
      onPress={onDelete}
      hitSlop={6}
      style={({ pressed }) => ({
        marginLeft: Spacing.sm,
        padding: 6,
        borderRadius: 10,
        backgroundColor: pressed
          ? "rgba(255, 59, 48, 0.18)"
          : "rgba(255, 59, 48, 0.10)",
        justifyContent: "center",
        alignItems: "center",
      })}
    >
      <Ionicons name="trash-outline" size={16} color={"rgb(170, 20, 20)"} />
    </Pressable>
  );

  const renderRightActions = (onDelete: () => void) => (
    <View
      style={{
        width: 86,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: Spacing.sm,
      }}
    >
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [
          {
            width: 66,
            height: 44,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(255, 59, 48, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(170, 20, 20, 0.20)",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="trash-outline" size={20} color={"rgb(170, 20, 20)"} />
        <Text
          style={[
            TextStyles.small,
            { color: "rgb(170, 20, 20)", marginTop: 2 },
          ]}
        >
          Delete
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={Screen.full}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.xl,
        }}
      >
        {/* Header row */}
        <View
          style={[
            Layout.rowBetween,
            { marginBottom: Spacing.lg, columnGap: Spacing.md },
          ]}
        >
          <View style={{ flex: 1, paddingRight: Spacing.sm }}>
            <Text style={TextStyles.screenTitle}>Pantry</Text>
            <Text style={TextStyles.bodyMuted}>
              Track what you have before it goes bad.
            </Text>
          </View>

          <TouchableOpacity
            style={[ButtonStyles.primary, { flexShrink: 0 }]}
            activeOpacity={0.8}
            onPress={() => router.push("/add-item")}
          >
            <View style={Layout.rowCenter}>
              <Ionicons
                name="add"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={ButtonStyles.primaryText}>Add item</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ✅ Search bar */}
        <View style={{ marginBottom: Spacing.md }}>
          <View style={{ position: "relative" }}>
            <Ionicons
              name="search-outline"
              size={18}
              color={Colors.textLight}
              style={{ position: "absolute", left: 12, top: 12, zIndex: 1 }}
            />
            <TextInput
              placeholder="Search pantry…"
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              style={{
                backgroundColor: "rgba(120,120,120,0.10)",
                borderColor: "rgba(120,120,120,0.18)",
                borderWidth: 1,
                borderRadius: 14,
                paddingLeft: 38,
                paddingRight: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: Colors.text,
              }}
            />
          </View>

          {isSearching && (
            <View style={[Layout.rowBetween, { marginTop: 8 }]}>
              <Text style={TextStyles.small}>
                Showing results for “{searchQuery.trim()}”
              </Text>

              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={10}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={[TextStyles.small, { fontWeight: "700" }]}>
                  Clear
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Expand/Collapse all */}
        <View style={[Layout.rowEnd, { marginBottom: Spacing.md }]}>
          <TouchableOpacity
            style={[ButtonStyles.ghost, { paddingHorizontal: Spacing.md }]}
            activeOpacity={0.8}
            onPress={toggleAll}
          >
            <View style={Layout.rowCenter}>
              <Ionicons
                name={allOpen ? "contract-outline" : "expand-outline"}
                size={16}
                color={Colors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={ButtonStyles.ghostText}>
                {allOpen ? "Collapse all" : "Expand all"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Expired */}
        {expiredItems.length > 0 && (
          <View style={{ marginBottom: Spacing.md }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOpenExpired((v) => !v)}
              style={[
                CardStyles.subtle,
                Layout.rowBetween,
                {
                  paddingVertical: Spacing.sm,
                  backgroundColor: "rgba(120, 120, 120, 0.12)",
                  borderColor: "rgba(120, 120, 120, 0.22)",
                  borderWidth: 1,
                },
              ]}
            >
              <View style={Layout.row}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={"rgba(60,60,60,0.85)"}
                  style={{ marginRight: Spacing.sm }}
                />
                <View>
                  <Text
                    style={[
                      TextStyles.sectionTitle,
                      { color: "rgba(60,60,60,0.9)" },
                    ]}
                  >
                    Expired
                  </Text>
                  <Text style={TextStyles.small}>
                    {expiredItems.length} item
                    {expiredItems.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              <Ionicons
                name={
                  openExpired ? "chevron-up-outline" : "chevron-down-outline"
                }
                size={20}
                color={Colors.textLight}
              />
            </TouchableOpacity>

            {openExpired && (
              <View style={{ marginTop: Spacing.sm }}>
                {expiredItems.map((item) => {
                  const badge = getExpiryBadge(item);
                  return (
                    <Swipeable
                      key={`${item.categoryKey}:${item.id}`}
                      renderRightActions={() =>
                        renderRightActions(() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium
                          );
                          deleteItem(item.categoryKey, item.id);
                        })
                      }
                      overshootRight={false}
                      rightThreshold={40}
                    >
                      <View style={[CardStyles.pantryItem, { opacity: 0.78 }]}>
                        <View style={Layout.rowBetween}>
                          <View style={{ flex: 1, paddingRight: Spacing.md }}>
                            <Text style={TextStyles.body}>{item.name}</Text>
                            <Text style={TextStyles.small}>
                              {item.quantity} • {item.categoryLabel}
                            </Text>
                          </View>

                          <View style={Layout.row}>
                            <View style={badge.container as any}>
                              <Text style={badge.text as any}>
                                {badge.label}
                              </Text>
                            </View>
                            <InlineDeleteButton
                              onDelete={() =>
                                confirmDelete(item.categoryKey, item)
                              }
                            />
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Expiring soon */}
        {expiringSoon.length > 0 && (
          <View style={{ marginBottom: Spacing.md }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOpenExpiring((v) => !v)}
              style={[
                CardStyles.subtle,
                Layout.rowBetween,
                {
                  paddingVertical: Spacing.sm,
                  backgroundColor: "rgba(255, 149, 0, 0.14)",
                  borderColor: "rgba(140, 70, 0, 0.18)",
                  borderWidth: 1,
                },
              ]}
            >
              <View style={Layout.row}>
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color={"rgba(140, 70, 0, 0.95)"}
                  style={{ marginRight: Spacing.sm }}
                />
                <View>
                  <Text
                    style={[
                      TextStyles.sectionTitle,
                      { color: "rgba(140, 70, 0, 0.95)" },
                    ]}
                  >
                    Expiring soon
                  </Text>
                  <Text style={TextStyles.small}>
                    {expiringSoon.length} item
                    {expiringSoon.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              <Ionicons
                name={
                  openExpiring ? "chevron-up-outline" : "chevron-down-outline"
                }
                size={20}
                color={Colors.textLight}
              />
            </TouchableOpacity>

            {openExpiring && (
              <View style={{ marginTop: Spacing.sm }}>
                {expiringSoon.map((item) => {
                  const badge = getExpiryBadge(item);
                  return (
                    <Swipeable
                      key={`${item.categoryKey}:${item.id}`}
                      renderRightActions={() =>
                        renderRightActions(() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium
                          );
                          deleteItem(item.categoryKey, item.id);
                        })
                      }
                      overshootRight={false}
                      rightThreshold={40}
                    >
                      <View style={CardStyles.pantryItem}>
                        <View style={Layout.rowBetween}>
                          <View style={{ flex: 1, paddingRight: Spacing.md }}>
                            <Text style={TextStyles.body}>{item.name}</Text>
                            <Text style={TextStyles.small}>
                              {item.quantity} • {item.categoryLabel}
                            </Text>
                          </View>

                          <View style={Layout.row}>
                            <View style={badge.container as any}>
                              <Text style={badge.text as any}>
                                {badge.label}
                              </Text>
                            </View>
                            <InlineDeleteButton
                              onDelete={() =>
                                confirmDelete(item.categoryKey, item)
                              }
                            />
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Categories */}
        {visibleCategories.map(({ cat, items }) => {
          // ✅ force open while searching (power user)
          const isOpen = isSearching ? true : openCategories[cat.key];

          return (
            <View key={cat.key} style={{ marginBottom: Spacing.md }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleCategory(cat.key)}
                style={[
                  CardStyles.subtle,
                  Layout.rowBetween,
                  { paddingVertical: Spacing.sm },
                ]}
              >
                <View style={Layout.row}>
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color={Colors.text}
                    style={{ marginRight: Spacing.sm }}
                  />
                  <View>
                    <Text style={TextStyles.sectionTitle}>{cat.label}</Text>
                    <Text style={TextStyles.small}>
                      {items.length} item{items.length === 1 ? "" : "s"}
                      {isSearching && pantry[cat.key].length !== items.length
                        ? ` (of ${pantry[cat.key].length})`
                        : ""}
                    </Text>
                  </View>
                </View>

                <View style={Layout.row}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={(e) => {
                      // @ts-ignore
                      e?.stopPropagation?.();
                      showCategoryMenu(cat);
                    }}
                    style={{
                      paddingHorizontal: Spacing.sm,
                      paddingVertical: 6,
                    }}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={Colors.textLight}
                    />
                  </TouchableOpacity>

                  <Ionicons
                    name={
                      isOpen ? "chevron-up-outline" : "chevron-down-outline"
                    }
                    size={20}
                    color={Colors.textLight}
                  />
                </View>
              </TouchableOpacity>

              {isOpen && items.length > 0 && (
                <View style={{ marginTop: Spacing.sm }}>
                  {items
                    .slice()
                    .sort((a, b) => a.expiresInDays - b.expiresInDays)
                    .map((item) => {
                      const badge = getExpiryBadge(item);

                      return (
                        <Swipeable
                          key={item.id}
                          renderRightActions={() =>
                            renderRightActions(() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Medium
                              );
                              deleteItem(cat.key, item.id);
                            })
                          }
                          overshootRight={false}
                          rightThreshold={40}
                        >
                          <View style={CardStyles.pantryItem}>
                            <View style={Layout.rowBetween}>
                              <View
                                style={{ flex: 1, paddingRight: Spacing.md }}
                              >
                                <Text style={TextStyles.body}>{item.name}</Text>
                                <Text style={TextStyles.small}>
                                  {item.quantity}
                                </Text>
                              </View>

                              <View style={Layout.row}>
                                <View style={badge.container as any}>
                                  <Text style={badge.text as any}>
                                    {badge.label}
                                  </Text>
                                </View>

                                <InlineDeleteButton
                                  onDelete={() => confirmDelete(cat.key, item)}
                                />
                              </View>
                            </View>
                          </View>
                        </Swipeable>
                      );
                    })}
                </View>
              )}

              {isOpen && items.length === 0 && !isSearching && (
                <View style={[CardStyles.subtle, { marginTop: Spacing.sm }]}>
                  <Text style={TextStyles.small}>
                    No items in this category yet.
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* empty search state */}
        {isSearching &&
          expiredItems.length === 0 &&
          expiringSoon.length === 0 &&
          visibleCategories.length === 0 && (
            <View style={[CardStyles.subtle, { marginTop: Spacing.sm }]}>
              <Text style={TextStyles.small}>No items match your search.</Text>
            </View>
          )}
      </ScrollView>

      {undo && (
        <View
          style={{
            position: "absolute",
            left: Spacing.lg,
            right: Spacing.lg,
            bottom: Spacing.lg,
            padding: Spacing.md,
            borderRadius: 16,
            backgroundColor: "rgba(20,20,20,0.92)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={[TextStyles.small, { color: "#fff", flex: 1 }]}>
            Deleted {undo.item.name}
          </Text>

          <Pressable
            onPress={undoDelete}
            style={{ paddingHorizontal: Spacing.md, paddingVertical: 8 }}
          >
            <Text
              style={[
                TextStyles.small,
                { color: "rgba(255,255,255,0.95)", fontWeight: "700" },
              ]}
            >
              UNDO
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
