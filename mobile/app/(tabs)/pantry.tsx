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
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Screen,
  TextStyles,
  CardStyles,
  Layout,
  ButtonStyles,
} from "@/constants/styles";
import {
  CATEGORIES,
  ALL_CATEGORY_KEYS,
  setAllCategories,
} from "@/features/pantry/constants";
import { PantryRow } from "@/features/pantry/components/PantryRow";
import type { PantryItem, CategoryKey } from "@/features/pantry/types";
import { matchesQuery } from "@/features/pantry/utils";
import { usePantryStore } from "@/features/pantry/store";
import { QuickAddSheet } from "@/features/pantry/components/QuickAddSheet";
import { EditItemSheet } from "@/features/pantry/components/EditItemSheet";
import { Colors, Spacing } from "@/constants/theme";
import { BulkExpirySheet } from "@/features/pantry/components/BulkExpirySheet";
import { BulkMoveSheet } from "@/features/pantry/components/BulkMoveSheet";

type ExpiringRow = PantryItem & {
  categoryKey: CategoryKey;
  categoryLabel: string;
};
type Category = (typeof CATEGORIES)[number];

export default function PantryScreen() {
  const [bulkExpiryOpen, setBulkExpiryOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const pantry = usePantryStore((s) => s.pantry);
  const setPantry = usePantryStore((s) => s.setPantry);
  const [undo, setUndo] = useState<{
    item: PantryItem;
    categoryKey: CategoryKey;
    index: number;
    action: "delete" | "used";
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
  const [bulkMode, setBulkMode] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    categoryKey: CategoryKey;
  } | null>(null);
  // selected ids per category (so ids can collide across categories safely)
  const [selected, setSelected] = useState<Record<CategoryKey, Set<string>>>(
    () =>
      ALL_CATEGORY_KEYS.reduce((acc, k) => {
        acc[k] = new Set<string>();
        return acc;
      }, {} as Record<CategoryKey, Set<string>>)
  );
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
  const selectedCount = useMemo(() => {
    let n = 0;
    for (const k of ALL_CATEGORY_KEYS) n += selected[k].size;
    return n;
  }, [selected]);

  const clearSelection = () => {
    setSelected(
      ALL_CATEGORY_KEYS.reduce((acc, k) => {
        acc[k] = new Set<string>();
        return acc;
      }, {} as Record<CategoryKey, Set<string>>)
    );
  };

  const toggleBulkMode = () => {
    setBulkMode((v) => {
      const next = !v;
      if (!next) clearSelection();
      return next;
    });
  };

  const isSelected = (categoryKey: CategoryKey, id: string) =>
    selected[categoryKey].has(id);

  const toggleSelected = (categoryKey: CategoryKey, id: string) => {
    setSelected((prev) => {
      const next: Record<CategoryKey, Set<string>> = { ...prev };
      const set = new Set(next[categoryKey]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      next[categoryKey] = set;
      return next;
    });
  };
  const bulkDeleteSelected = () => {
    setUndo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPantry((prev) => {
      const next: Record<CategoryKey, PantryItem[]> = { ...prev };

      for (const k of ALL_CATEGORY_KEYS) {
        if (selected[k].size === 0) continue;
        next[k] = prev[k].filter((it) => !selected[k].has(it.id));
      }
      return next;
    });

    clearSelection();
    setBulkMode(false);
  };
  const applyToSelected = (
    updater: (item: PantryItem, categoryKey: CategoryKey) => PantryItem | null,
    moveToCategoryKey?: CategoryKey
  ) => {
    setPantry((prev) => {
      let next: Record<CategoryKey, PantryItem[]> = { ...prev };

      // optional move bucket
      const moved: PantryItem[] = [];

      for (const k of ALL_CATEGORY_KEYS) {
        if (selected[k].size === 0) continue;

        const list = prev[k];
        const out: PantryItem[] = [];

        for (const it of list) {
          if (!selected[k].has(it.id)) {
            out.push(it);
            continue;
          }

          const updated = updater(it, k);

          // null means "remove" (used)
          if (updated === null) continue;

          // move?
          if (moveToCategoryKey && moveToCategoryKey !== k) moved.push(updated);
          else out.push(updated);
        }

        next[k] = out;
      }

      if (moveToCategoryKey && moved.length > 0) {
        next[moveToCategoryKey] = [...next[moveToCategoryKey], ...moved];
      }

      return next;
    });

    clearSelection();
    setBulkMode(false);
  };
  const bulkMarkUsed = () => {
    setUndo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    applyToSelected(() => null); // null => remove
  };
  const bulkAddExpiryDays = (delta: number) => {
    Haptics.selectionAsync();
    applyToSelected((it) => ({
      ...it,
      expiresInDays:
        it.expiresInDays >= 9999
          ? it.expiresInDays
          : Math.max(0, it.expiresInDays + delta),
    }));
  };

  const bulkSetExpiryDays = (value: number) => {
    Haptics.selectionAsync();
    applyToSelected((it) => ({
      ...it,
      expiresInDays:
        it.expiresInDays >= 9999 ? it.expiresInDays : Math.max(0, value),
    }));
  };

  const openEdit = (categoryKey: CategoryKey, id: string) => {
    setEditTarget({ categoryKey, id });
    setEditOpen(true);
  };

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
  const addItem = usePantryStore((s) => s.addItem);
  const toggleAll = () => {
    const nextOpen = !allOpen;
    setOpenCategories(setAllCategories(nextOpen));
    setOpenExpiring(nextOpen);
    setOpenExpired(nextOpen);
  };

  const toggleCategory = (key: CategoryKey) => {
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const deleteItem = (
    categoryKey: CategoryKey,
    itemId: string,
    action: "delete" | "used" = "delete"
  ) => {
    setPantry((prev) => {
      const list = prev[categoryKey];
      const index = list.findIndex((x) => x.id === itemId);
      if (index === -1) return prev;

      const item = list[index];
      setUndo({ item, categoryKey, index, action });

      const nextList = list.filter((x) => x.id !== itemId);
      return { ...prev, [categoryKey]: nextList };
    });
  };
  const markUsed = (categoryKey: CategoryKey, id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deleteItem(categoryKey, id, "used");
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
  const deleteAllExpired = () => {
    Alert.alert(
      "Delete all expired?",
      "This will permanently remove all expired items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setPantry((prev) => {
              const next = { ...prev };

              expiredItems.forEach((item) => {
                next[item.categoryKey] = next[item.categoryKey].filter(
                  (i) => i.id !== item.id
                );
              });

              return next;
            });
          },
        },
      ]
    );
  };
  const remindLater = () => {
    setPantry((prev) => {
      const next = { ...prev };

      expiringSoon.forEach((item) => {
        next[item.categoryKey] = next[item.categoryKey].map((i) =>
          i.id === item.id ? { ...i, expiresInDays: i.expiresInDays + 3 } : i
        );
      });

      return next;
    });
  };
  const openBulkExpiryMenu = () => setBulkExpiryOpen(true);
  const openBulkMoveMenu = () => setBulkMoveOpen(true);

  const bulkMoveTo = (dest: CategoryKey) => {
    Haptics.selectionAsync();
    applyToSelected((it) => it, dest);
  };

  type MenuCategory =
    | { type: "normal"; cat: Category }
    | { type: "expired" }
    | { type: "expiring" };

  const showCategoryMenu = (menu: MenuCategory) => {
    if (menu.type === "normal") {
      const { cat } = menu;
      Alert.alert(cat.label, "Category options", [
        {
          text: "Clear category (remove all items)",
          style: "destructive",
          onPress: () => setPantry((prev) => ({ ...prev, [cat.key]: [] })),
        },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }

    if (menu.type === "expired") {
      Alert.alert("Expired", "Category options", [
        {
          text: "Delete all expired",
          style: "destructive",
          onPress: deleteAllExpired,
        },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }

    Alert.alert("Expiring soon", "Category options", [
      { text: "Remind later (+3 days)", onPress: remindLater },
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
  useEffect(() => {
    if (!isSearching) return;

    setOpenCategories((prev) => {
      const next = { ...prev };
      for (const c of CATEGORIES) next[c.key] = true;
      return next;
    });
  }, [isSearching]);

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: Spacing.sm,
            gap: Spacing.xs,
          }}
        >
          {/* Bulk */}
          <TouchableOpacity
            onPress={toggleBulkMode}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: bulkMode
                ? "rgba(0,0,0,0.10)"
                : "rgba(0,0,0,0.05)",
            }}
          >
            <Ionicons
              name={bulkMode ? "checkbox" : "square-outline"}
              size={18}
              color={Colors.text}
            />
            <Text
              style={{
                fontSize: 15,
                marginLeft: 6,
                color: Colors.text,
              }}
              numberOfLines={1}
            >
              {bulkMode ? `Bulk ${selectedCount}` : "Bulk"}
            </Text>
          </TouchableOpacity>

          {/* Quick add */}
          <TouchableOpacity
            onPress={() => setQuickAddOpen(true)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.05)",
            }}
          >
            <Ionicons name="add" size={18} color={Colors.text} />
            <Text
              style={{
                fontSize: 15,
                marginLeft: 6,
                color: Colors.text,
              }}
              numberOfLines={1}
            >
              Add
            </Text>
          </TouchableOpacity>

          {/* Expand / Collapse (always enabled) */}
          <TouchableOpacity
            onPress={toggleAll}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.05)",
            }}
          >
            <Ionicons
              name={allOpen ? "contract-outline" : "expand-outline"}
              size={18}
              color={Colors.text}
            />
            <Text
              style={{
                fontSize: 15,
                marginLeft: 6,
                color: Colors.text,
              }}
              numberOfLines={1}
            >
              {allOpen ? "Collapse" : "Expand"}
            </Text>
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
              <View style={Layout.row}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={(e) => {
                    // @ts-ignore
                    e?.stopPropagation?.();
                    showCategoryMenu({ type: "expired" });
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
                    openExpired ? "chevron-up-outline" : "chevron-down-outline"
                  }
                  size={20}
                  color={Colors.textLight}
                />
              </View>
            </TouchableOpacity>

            {openExpired && (
              <View style={{ marginTop: Spacing.sm }}>
                {expiredItems.map((item) => (
                  <PantryRow
                    key={`${item.categoryKey}:${item.id}`}
                    item={item}
                    bulkMode={bulkMode}
                    isSearching={isSearching}
                    checked={isSelected(item.categoryKey, item.id)}
                    onToggleSelect={() => {
                      Haptics.selectionAsync();
                      toggleSelected(item.categoryKey, item.id);
                    }}
                    onPressUsed={() => markUsed(item.categoryKey, item.id)}
                    onPressEdit={() => openEdit(item.categoryKey, item.id)}
                    onPressDelete={() => confirmDelete(item.categoryKey, item)}
                    onSwipeDelete={() => deleteItem(item.categoryKey, item.id)}
                  />
                ))}
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

              <View style={Layout.row}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={(e) => {
                    // @ts-ignore
                    e?.stopPropagation?.();
                    showCategoryMenu({ type: "expiring" });
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
                    openExpiring ? "chevron-up-outline" : "chevron-down-outline"
                  }
                  size={20}
                  color={Colors.textLight}
                />
              </View>
            </TouchableOpacity>

            {openExpiring && (
              <View style={{ marginTop: Spacing.sm }}>
                {expiringSoon.map((item) => (
                  <PantryRow
                    key={`${item.categoryKey}:${item.id}`}
                    item={item}
                    bulkMode={bulkMode}
                    isSearching={isSearching}
                    checked={isSelected(item.categoryKey, item.id)}
                    onToggleSelect={() => {
                      Haptics.selectionAsync();
                      toggleSelected(item.categoryKey, item.id);
                    }}
                    onPressUsed={() => markUsed(item.categoryKey, item.id)}
                    onPressEdit={() => openEdit(item.categoryKey, item.id)}
                    onPressDelete={() => confirmDelete(item.categoryKey, item)}
                    onSwipeDelete={() => deleteItem(item.categoryKey, item.id)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Categories */}
        {visibleCategories.map(({ cat, items }) => {
          // ✅ force catgeories open once while searching (power user)
          const isOpen = openCategories[cat.key];
          return (
            <View key={cat.key} style={{ marginBottom: Spacing.md }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  toggleCategory(cat.key);
                }}
                style={[
                  CardStyles.subtle,
                  Layout.rowBetween,
                  {
                    paddingVertical: Spacing.sm,
                    opacity: isSearching ? 0.95 : 1,
                  },
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
                      showCategoryMenu({ type: "normal", cat });
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
                    .map((item) => (
                      <PantryRow
                        key={`${cat.key}:${item.id}`}
                        item={item}
                        bulkMode={bulkMode}
                        isSearching={isSearching}
                        checked={isSelected(cat.key, item.id)}
                        onToggleSelect={() => {
                          Haptics.selectionAsync();
                          toggleSelected(cat.key, item.id);
                        }}
                        onPressUsed={() => markUsed(cat.key, item.id)}
                        onPressEdit={() => openEdit(cat.key, item.id)}
                        onPressDelete={() => confirmDelete(cat.key, item)}
                        onSwipeDelete={() => deleteItem(cat.key, item.id)}
                      />
                    ))}
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
      {bulkMode && selectedCount > 0 && (
        <View
          style={{
            position: "absolute",
            left: Spacing.lg,
            right: Spacing.lg,
            bottom: undo ? Spacing.lg + 56 : Spacing.lg,
            padding: Spacing.md,
            borderRadius: 18,
            backgroundColor: "rgba(20,20,20,0.92)",
            flexDirection: "row",
            alignItems: "center",

            // ✅ key changes:
            flexWrap: "wrap",
            justifyContent: "flex-start",
            gap: 6, // if your RN version supports gap; if not, remove it
          }}
        >
          <Text style={[TextStyles.small, { color: "#fff" }]} numberOfLines={1}>
            {selectedCount} selected
          </Text>

          <Pressable
            onPress={bulkMarkUsed}
            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text
              style={[TextStyles.small, { color: "#fff", fontWeight: "700" }]}
            >
              Used
            </Text>
          </Pressable>

          <Pressable
            onPress={openBulkExpiryMenu}
            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text
              style={[TextStyles.small, { color: "#fff", fontWeight: "700" }]}
            >
              Expiry
            </Text>
          </Pressable>

          <Pressable
            onPress={openBulkMoveMenu}
            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text
              style={[TextStyles.small, { color: "#fff", fontWeight: "700" }]}
            >
              Move
            </Text>
          </Pressable>

          <Pressable
            onPress={clearSelection}
            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text
              style={[TextStyles.small, { color: "#fff", fontWeight: "700" }]}
            >
              Clear
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert(
                "Delete selected?",
                `Delete ${selectedCount} items?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: bulkDeleteSelected,
                  },
                ]
              );
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            <Text
              style={[TextStyles.small, { color: "#fff", fontWeight: "700" }]}
            >
              Delete
            </Text>
          </Pressable>
        </View>
      )}

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
            {undo.action === "used" ? "Marked used" : "Deleted"}{" "}
            {undo.item.name}
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
      <BulkExpirySheet
        open={bulkExpiryOpen}
        onClose={() => setBulkExpiryOpen(false)}
        onAddDays={bulkAddExpiryDays}
        onSetDays={bulkSetExpiryDays}
      />

      <BulkMoveSheet
        open={bulkMoveOpen}
        onClose={() => setBulkMoveOpen(false)}
        onMoveTo={bulkMoveTo}
      />

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
      <EditItemSheet
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        target={editTarget}
      />
    </View>
  );
}
