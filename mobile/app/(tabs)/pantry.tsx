import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  TextInput,
  StyleSheet,
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
import {
  matchesQuery,
  getExpiresInDays,
  setExpiryDaysFromToday,
  addDaysToExpiryDate,
} from "@/features/pantry/utils";
import { usePantryStore } from "@/features/pantry/store";
import { QuickAddSheet } from "@/features/pantry/components/QuickAddSheet";
import { EditItemSheet } from "@/features/pantry/components/EditItemSheet";
import { Colors, Spacing } from "@/constants/theme";
import { BulkExpirySheet } from "@/features/pantry/components/BulkExpirySheet";
import { BulkMoveSheet } from "@/features/pantry/components/BulkMoveSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendPantryHistory,
  removePantryHistoryEntry,
} from "@/features/pantry/history";

const PANTRY_KEY = "pantry_items_v1";

type ExpiringRow = PantryItem & {
  categoryLabel: string;
  expiresInDays: number; // derived
};
type Category = (typeof CATEGORIES)[number];

function buildEmptyPantry(): Record<CategoryKey, PantryItem[]> {
  return ALL_CATEGORY_KEYS.reduce(
    (acc, k) => {
      acc[k] = [];
      return acc;
    },
    {} as Record<CategoryKey, PantryItem[]>,
  );
}

function isValidPantryShape(
  v: unknown,
): v is Record<CategoryKey, PantryItem[]> {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return ALL_CATEGORY_KEYS.every((k) => Array.isArray(obj[k]));
}

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
    historyEntryId?: string;
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
      ALL_CATEGORY_KEYS.reduce(
        (acc, k) => {
          acc[k] = new Set<string>();
          return acc;
        },
        {} as Record<CategoryKey, Set<string>>,
      ),
  );

  // ✅ Search
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim().toLowerCase();
  const isSearching = q.length > 0;

  const allOpen = ALL_CATEGORY_KEYS.every((k) => openCategories[k]);

  // -------------------- ✅ AsyncStorage (load) --------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PANTRY_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);

        if (cancelled) return;

        if (isValidPantryShape(parsed)) {
          setPantry(parsed);
        } else {
          // fallback: if corrupted/old shape, don't crash
          setPantry(buildEmptyPantry());
        }
      } catch (e) {
        // if JSON parse fails or storage fails, keep current pantry
        console.warn("Failed to load pantry from storage", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setPantry]);

  // -------------------- ✅ AsyncStorage (save) --------------------
  useEffect(() => {
    // small debounce to avoid hammering storage during fast edits
    const t = setTimeout(() => {
      (async () => {
        try {
          await AsyncStorage.setItem(PANTRY_KEY, JSON.stringify(pantry));
        } catch (e) {
          console.warn("Failed to save pantry to storage", e);
        }
      })();
    }, 250);

    return () => clearTimeout(t);
  }, [pantry]);

  // -------------------- Undo timer --------------------
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
      ALL_CATEGORY_KEYS.reduce(
        (acc, k) => {
          acc[k] = new Set<string>();
          return acc;
        },
        {} as Record<CategoryKey, Set<string>>,
      ),
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
  async function handleMarkUsed(item: PantryItem) {
    markUsed(item.categoryKey, item.id);

    const historyEntryId = await appendPantryHistory(item, "used");

    setUndo((u) =>
      u && u.item.id === item.id && u.categoryKey === item.categoryKey
        ? { ...u, historyEntryId }
        : u,
    );
  }

  async function handleDelete(item: PantryItem) {
    deleteItem(item.categoryKey, item.id, "delete");

    const historyEntryId = await appendPantryHistory(item, "deleted");

    setUndo((u) =>
      u && u.item.id === item.id && u.categoryKey === item.categoryKey
        ? { ...u, historyEntryId }
        : u,
    );
  }

  const bulkDeleteSelected = () => {
    setUndo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1) Capture the items being deleted (BEFORE setPantry changes state)
    const deleted: PantryItem[] = [];
    for (const k of ALL_CATEGORY_KEYS) {
      console.log(selected[k]);
      if (selected[k].size === 0) continue;
      for (const it of pantry[k]) {
        if (selected[k].has(it.id)) deleted.push(it);
      }
    }

    // 2) Update pantry
    setPantry((prev) => {
      const next: Record<CategoryKey, PantryItem[]> = { ...prev };
      for (const k of ALL_CATEGORY_KEYS) {
        if (selected[k].size === 0) continue;
        next[k] = prev[k].filter((it) => !selected[k].has(it.id));
      }
      return next;
    });

    // 3) Write history entries (don’t await; your queue handles ordering)
    for (const it of deleted) {
      appendPantryHistory(it, "deleted"); // <-- use your actual action string/union value
    }

    clearSelection();
    setBulkMode(false);
  };

  const applyToSelected = (
    updater: (item: PantryItem, categoryKey: CategoryKey) => PantryItem | null,
    moveToCategoryKey?: CategoryKey,
  ) => {
    setPantry((prev) => {
      const next: Record<CategoryKey, PantryItem[]> = { ...prev };
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

          if (updated === null) continue;

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

    // capture items BEFORE mutation
    const used: PantryItem[] = [];
    for (const k of ALL_CATEGORY_KEYS) {
      if (selected[k].size === 0) continue;
      for (const it of pantry[k]) {
        if (selected[k].has(it.id)) used.push(it);
      }
    }

    // perform the actual update
    applyToSelected(() => null);

    // write history
    for (const it of used) {
      appendPantryHistory(it, "used"); // <- use your real action value
    }

    clearSelection();
    setBulkMode(false);
  };

  const bulkAddExpiryDays = (delta: number) => {
    Haptics.selectionAsync();
    applyToSelected((it) => ({
      ...it,
      expiryDate: addDaysToExpiryDate(it.expiryDate, delta),
    }));
  };

  const bulkSetExpiryDays = (value: number) => {
    Haptics.selectionAsync();
    applyToSelected((it) => ({
      ...it,
      // If it had "no expiry", keep it no expiry (matches your old sentinel behavior)
      expiryDate: it.expiryDate ? setExpiryDaysFromToday(value) : null,
    }));
  };

  const openEdit = (categoryKey: CategoryKey, id: string) => {
    setEditTarget({ categoryKey, id });
    setEditOpen(true);
  };

  function confirmDelete(categoryKey: string, item: PantryItem) {
    Alert.alert("Delete item?", "This cannot be undone", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDelete(item), // <- logs + deletes
      },
    ]);
  }

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
    action: "delete" | "used" = "delete",
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

  const undoDelete = async () => {
    if (!undo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setPantry((prev) => {
      const list = prev[undo.categoryKey];
      const nextList = list.slice();
      nextList.splice(undo.index, 0, undo.item);
      return { ...prev, [undo.categoryKey]: nextList };
    });

    // ✅ undo the history record (only if we have the id)
    if (undo.historyEntryId) {
      await removePantryHistoryEntry(undo.historyEntryId);
    }

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
                  (i) => i.id !== item.id,
                );
              });

              return next;
            });
          },
        },
      ],
    );
  };
  const remindLater = () => {
    setPantry((prev) => {
      const next = { ...prev };

      expiringSoon.forEach((row) => {
        next[row.categoryKey] = next[row.categoryKey].map((i) =>
          i.id === row.id
            ? { ...i, expiryDate: addDaysToExpiryDate(i.expiryDate, 3) }
            : i,
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
        const d = getExpiresInDays(item);

        if (d <= 0 && matchesQuery(item, q)) {
          flat.push({
            ...item,
            expiresInDays: d, // keep this in the row if UI uses it
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
        const d = getExpiresInDays(item);

        if (d >= 9999) continue; // no expiry
        if (d <= 0) continue; // expired → goes to exp iredItems
        if (d > 7) continue; // out of “soon” window
        if (!matchesQuery(item, q)) continue;

        flat.push({
          ...item,
          expiresInDays: d, // again, keep it updated if needed
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

  const visibleCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const items = pantry[cat.key].filter((it) => matchesQuery(it, q));
      return { cat, items };
    }).filter(({ items }) => {
      if (!isSearching) return true;
      return items.length > 0;
    });
  }, [pantry, q, isSearching]);
  return (
    <View style={Screen.full}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header row */}
        <View style={[Layout.rowBetween, styles.headerRow]}>
          <View style={styles.headerLeft}>
            <Text style={TextStyles.screenTitle}>Pantry</Text>
            <Text style={TextStyles.bodyMuted}>
              Track what you have before it goes bad.
            </Text>
          </View>

          <TouchableOpacity
            style={[ButtonStyles.primary, styles.addBtn]}
            activeOpacity={0.8}
            onPress={() => router.push("/add-item")}
          >
            <View style={Layout.rowCenter}>
              <Ionicons
                name="add"
                size={18}
                color="#FFFFFF"
                style={styles.addIcon}
              />
              <Text style={ButtonStyles.primaryText}>Add item</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={styles.searchRelative}>
            <Ionicons
              name="search-outline"
              size={18}
              color={Colors.textLight}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search pantry…"
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              style={styles.searchInput}
            />
          </View>

          {isSearching && (
            <View style={[Layout.rowBetween, styles.searchMetaRow]}>
              <Text style={TextStyles.small}>
                Showing results for “{searchQuery.trim()}”
              </Text>

              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={10}
                style={styles.searchClearBtn}
              >
                <Text style={[TextStyles.small, styles.searchClearText]}>
                  Clear
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Pills */}
        <View style={styles.pillsRow}>
          {/* Bulk */}
          <TouchableOpacity
            onPress={toggleBulkMode}
            activeOpacity={0.85}
            style={[
              styles.pill,
              bulkMode ? styles.pillActive : styles.pillInactive,
            ]}
          >
            <Ionicons
              name={bulkMode ? "checkbox" : "square-outline"}
              size={18}
              color={Colors.text}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {bulkMode ? `Bulk ${selectedCount}` : "Bulk"}
            </Text>
          </TouchableOpacity>

          {/* Quick add */}
          <TouchableOpacity
            onPress={() => setQuickAddOpen(true)}
            activeOpacity={0.85}
            style={[styles.pill, styles.pillInactive]}
          >
            <Ionicons name="add" size={18} color={Colors.text} />
            <Text style={styles.pillText} numberOfLines={1}>
              Add
            </Text>
          </TouchableOpacity>

          {/* Expand / Collapse */}
          <TouchableOpacity
            onPress={toggleAll}
            activeOpacity={0.85}
            style={[styles.pill, styles.pillInactive, styles.pillLast]}
          >
            <Ionicons
              name={allOpen ? "contract-outline" : "expand-outline"}
              size={18}
              color={Colors.text}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {allOpen ? "Collapse" : "Expand"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expired */}
        {expiredItems.length > 0 && (
          <View style={styles.sectionWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOpenExpired((v) => !v)}
              style={[
                CardStyles.subtle,
                Layout.rowBetween,
                styles.expiredHeaderCard,
              ]}
            >
              <View style={Layout.row}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={"rgba(60,60,60,0.85)"}
                  style={styles.sectionIcon}
                />
                <View>
                  <Text style={[TextStyles.sectionTitle, styles.expiredTitle]}>
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
                  style={styles.menuBtn}
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
              <View style={styles.sectionListTop}>
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
                    onPressUsed={() => handleMarkUsed(item)}
                    onPressEdit={() => openEdit(item.categoryKey, item.id)}
                    onPressDelete={() => confirmDelete(item.categoryKey, item)} // log inside confirm
                    onSwipeDelete={() => handleDelete(item)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Expiring soon */}
        {expiringSoon.length > 0 && (
          <View style={styles.sectionWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOpenExpiring((v) => !v)}
              style={[
                CardStyles.subtle,
                Layout.rowBetween,
                styles.expiringHeaderCard,
              ]}
            >
              <View style={Layout.row}>
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color={"rgba(140, 70, 0, 0.95)"}
                  style={styles.sectionIcon}
                />
                <View>
                  <Text style={[TextStyles.sectionTitle, styles.expiringTitle]}>
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
                  style={styles.menuBtn}
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
              <View style={styles.sectionListTop}>
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
                    onPressUsed={() => handleMarkUsed(item)}
                    onPressEdit={() => openEdit(item.categoryKey, item.id)}
                    onPressDelete={() => confirmDelete(item.categoryKey, item)} // log inside confirm
                    onSwipeDelete={() => handleDelete(item)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Categories */}
        {visibleCategories.map(({ cat, items }) => {
          const isOpen = openCategories[cat.key];
          return (
            <View key={cat.key} style={styles.sectionWrap}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleCategory(cat.key)}
                style={[
                  CardStyles.subtle,
                  Layout.rowBetween,
                  styles.categoryHeaderCard,
                  isSearching ? styles.categoryHeaderSearching : null,
                ]}
              >
                <View style={Layout.row}>
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color={Colors.text}
                    style={styles.sectionIcon}
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
                    style={styles.menuBtn}
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
                <View style={styles.sectionListTop}>
                  {items
                    .slice()
                    .sort((a, b) => getExpiresInDays(a) - getExpiresInDays(b))
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
                        onPressUsed={() => handleMarkUsed(item)}
                        onPressEdit={() => openEdit(cat.key, item.id)}
                        onPressDelete={() => confirmDelete(cat.key, item)}
                        onSwipeDelete={() => handleDelete(item)}
                      />
                    ))}
                </View>
              )}

              {isOpen && items.length === 0 && !isSearching && (
                <View style={[CardStyles.subtle, styles.emptyCatCard]}>
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
            <View style={[CardStyles.subtle, styles.emptySearchCard]}>
              <Text style={TextStyles.small}>No items match your search.</Text>
            </View>
          )}
      </ScrollView>

      {bulkMode && selectedCount > 0 && (
        <View
          style={[
            styles.bulkBar,
            { bottom: undo ? Spacing.lg + 56 : Spacing.lg },
          ]}
        >
          <Text
            style={[TextStyles.small, styles.bulkBarText]}
            numberOfLines={1}
          >
            {selectedCount} selected
          </Text>

          <Pressable onPress={bulkMarkUsed} style={styles.bulkActionBtn}>
            <Text style={[TextStyles.small, styles.bulkActionText]}>Used</Text>
          </Pressable>

          <Pressable onPress={openBulkExpiryMenu} style={styles.bulkActionBtn}>
            <Text style={[TextStyles.small, styles.bulkActionText]}>
              Expiry
            </Text>
          </Pressable>

          <Pressable onPress={openBulkMoveMenu} style={styles.bulkActionBtn}>
            <Text style={[TextStyles.small, styles.bulkActionText]}>Move</Text>
          </Pressable>

          <Pressable onPress={clearSelection} style={styles.bulkActionBtn}>
            <Text style={[TextStyles.small, styles.bulkActionText]}>Clear</Text>
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
                ],
              );
            }}
            style={styles.bulkActionBtn}
          >
            <Text style={[TextStyles.small, styles.bulkActionText]}>
              Delete
            </Text>
          </Pressable>
        </View>
      )}

      {undo && (
        <View style={styles.undoBar}>
          <Text style={[TextStyles.small, styles.undoText]} numberOfLines={2}>
            {undo.action === "used" ? "Marked used " : "Deleted "}
            {undo.item.name}
          </Text>

          <Pressable onPress={undoDelete} style={styles.undoBtn}>
            <Text style={[TextStyles.small, styles.undoBtnText]}>UNDO</Text>
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
/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  headerRow: { marginBottom: Spacing.lg, columnGap: Spacing.md },
  headerLeft: { flex: 1, paddingRight: Spacing.sm },
  addBtn: { flexShrink: 0 },
  addIcon: { marginRight: 4 },

  searchWrap: { marginBottom: Spacing.md },
  searchRelative: { position: "relative" },
  searchIcon: { position: "absolute", left: 12, top: 12, zIndex: 1 },
  searchInput: {
    backgroundColor: "rgba(120,120,120,0.10)",
    borderColor: "rgba(120,120,120,0.18)",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 38,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  searchMetaRow: { marginTop: 8 },
  searchClearBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  searchClearText: { fontWeight: "700" },

  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: Spacing.xs,
  },
  pillLast: { marginRight: 0 },
  pillActive: { backgroundColor: "rgba(0,0,0,0.10)" },
  pillInactive: { backgroundColor: "rgba(0,0,0,0.05)" },
  pillText: { fontSize: 15, marginLeft: 6, color: Colors.text },

  sectionWrap: { marginBottom: Spacing.md },
  sectionIcon: { marginRight: Spacing.sm },
  sectionListTop: { marginTop: Spacing.sm },

  menuBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6 },

  expiredHeaderCard: {
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(120, 120, 120, 0.12)",
    borderColor: "rgba(120, 120, 120, 0.22)",
    borderWidth: 1,
  },
  expiredTitle: { color: "rgba(60,60,60,0.9)" },

  expiringHeaderCard: {
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255, 149, 0, 0.14)",
    borderColor: "rgba(140, 70, 0, 0.18)",
    borderWidth: 1,
  },
  expiringTitle: { color: "rgba(140, 70, 0, 0.95)" },

  categoryHeaderCard: {
    paddingVertical: Spacing.sm,
  },
  categoryHeaderSearching: { opacity: 0.95 },

  emptyCatCard: { marginTop: Spacing.sm },
  emptySearchCard: { marginTop: Spacing.sm },

  bulkBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: 18,
    backgroundColor: "rgba(20,20,20,0.92)",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  bulkBarText: { color: "#fff" },
  bulkActionBtn: { paddingHorizontal: 10, paddingVertical: 8, marginRight: 6 },
  bulkActionText: { color: "#fff", fontWeight: "700" },

  undoBar: {
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
  },
  undoText: { color: "#fff", flex: 1 },
  undoBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8 },
  undoBtnText: { color: "rgba(255,255,255,0.95)", fontWeight: "700" },
});
