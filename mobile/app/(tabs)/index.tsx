import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    { id: "11", name: "Mayo", quantity: "1 jar", expiresInDays: 30 },
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
    return {
      container: TagStyles.danger,
      text: TagStyles.textLight,
      label: "Expired",
    };
  }

  // "never expires" look (for household/supplements etc.)
  if (d >= 9999) {
    return {
      container: TagStyles.base,
      text: TagStyles.textDark,
      label: "No expiry",
    };
  }

  if (d <= 2) {
    return {
      container: TagStyles.danger,
      text: TagStyles.textLight,
      label: `${d} day${d === 1 ? "" : "s"} left`,
    };
  }

  if (d <= 5) {
    return {
      container: TagStyles.base,
      text: TagStyles.textDark,
      label: `${d} days left`,
    };
  }

  return {
    container: TagStyles.success,
    text: TagStyles.textLight,
    label: `${d} days`,
  };
}

export default function PantryScreen() {
  const [openCategories, setOpenCategories] = useState<
    Record<CategoryKey, boolean>
  >({
    // core: open
    produce: true,
    meatSeafood: true,
    dairyEggs: false,
    bakery: false,
    pantry: false,
    frozen: false,

    // others: closed by default
    condiments: false,
    spices: false,
    beverages: false,
    snacks: false,
    pet: false,
    household: false,
    supplements: false,
  });
  const allOpen = ALL_CATEGORY_KEYS.every((k) => openCategories[k]);

  const toggleAll = () => {
    setOpenCategories(setAllCategories(!allOpen));
  };
  const toggleCategory = (key: CategoryKey) => {
    setOpenCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <View style={Screen.full}>
      <ScrollView
        style={{ flex: 1 }}
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
            {
              marginBottom: Spacing.lg,
              columnGap: Spacing.md,
            },
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
            onPress={() => {
              // later: open "Add item" modal
            }}
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

        {/* Category sections */}
        {CATEGORIES.map((cat) => {
          const items = MOCK_PANTRY[cat.key];
          const isOpen = openCategories[cat.key];

          return (
            <View key={cat.key} style={{ marginBottom: Spacing.md }}>
              {/* Category header */}
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
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name={isOpen ? "chevron-up-outline" : "chevron-down-outline"}
                  size={20}
                  color={Colors.textLight}
                />
              </TouchableOpacity>

              {/* Items list (collapsible) */}
              {isOpen && items.length > 0 && (
                <View style={{ marginTop: Spacing.sm }}>
                  {items.map((item) => {
                    const badge = getExpiryBadge(item);

                    return (
                      <View key={item.id} style={CardStyles.pantryItem}>
                        <View style={Layout.rowBetween}>
                          <View>
                            <Text style={TextStyles.body}>{item.name}</Text>
                            <Text style={TextStyles.small}>
                              {item.quantity}
                            </Text>
                          </View>

                          <View style={badge.container}>
                            <Text style={badge.text}>{badge.label}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {isOpen && items.length === 0 && (
                <View style={[CardStyles.subtle, { marginTop: Spacing.sm }]}>
                  <Text style={TextStyles.small}>
                    No items in this category yet.
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
