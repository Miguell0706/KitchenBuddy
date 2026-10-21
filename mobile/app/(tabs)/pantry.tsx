import React, { useMemo, useState, useEffect, useRef } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";

import * as Haptics from "expo-haptics";

import { Ionicons } from "@expo/vector-icons";

import { router, useLocalSearchParams } from "expo-router";
import { parseGroupedReminderIds } from "@/features/reminders/groupedReminderRoute";

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

import { syncExpiryReminders } from "@/features/reminders/pantryReminderSync";

import { QuickAddSheet } from "@/features/pantry/components/QuickAddSheet";

import { EditItemSheet } from "@/features/pantry/components/EditItemSheet";

import { BulkExpirySheet } from "@/features/pantry/components/BulkExpirySheet";

import { BulkMoveSheet } from "@/features/pantry/components/BulkMoveSheet";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  appendPantryHistory,
  removePantryHistoryEntry,
} from "@/features/pantry/history";

const PANTRY_KEY = "pantry_items_v1";

let nextPantryInstanceId = 0;

type ExpiringRow = PantryItem & {
  categoryLabel: string;

  expiresInDays: number; // derived
};

type Category = (typeof CATEGORIES)[number];

type MenuCategory =
  | { type: "normal"; cat: Category }
  | { type: "expired" }
  | { type: "expiring" };

export default function PantryScreen() {
  const instanceId = useRef<number | null>(null);

  if (instanceId.current === null) {
    instanceId.current = ++nextPantryInstanceId;
  }
  const [bulkExpiryOpen, setBulkExpiryOpen] = useState(false);

  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  const [categoryMenu, setCategoryMenu] = useState<MenuCategory | null>(null);

  // One reason picker for inline trash, swipe-to-delete, and bulk Delete.
  // The recorded action is what Pantry Analytics uses for utilization/waste.
  const [removalTarget, setRemovalTarget] = useState<
    | { kind: "single"; item: PantryItem }
    | { kind: "bulk"; count: number }
    | null
  >(null);
  const removalChoiceInProgress = useRef(false);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [confirmCategoryAction, setConfirmCategoryAction] = useState(false);

  const pantry = usePantryStore((s) => s.pantry);

  const setPantry = usePantryStore((s) => s.setPantry);

  // Stage 4E: a notification supplies IDs, never names. This intentionally
  // ignores search and the <=7-day expiring section: the alert may be opened
  // later, after some ingredients have expired or been removed.
  const reminderParams = useLocalSearchParams<{
    kbGroupIds?: string | string[];
    kbNotificationId?: string | string[];
  }>();
  const groupedIds = useMemo(
    () => parseGroupedReminderIds(reminderParams.kbGroupIds),
    [reminderParams.kbGroupIds],
  );
  const groupView = groupedIds !== null;
  const groupedItems = useMemo(() => {
    if (!groupedIds) return [] as PantryItem[];
    const byId = new Map<string, PantryItem>();
    for (const category of ALL_CATEGORY_KEYS) {
      for (const item of pantry[category]) byId.set(item.id, item);
    }
    return groupedIds
      .map((id) => byId.get(id))
      .filter((item): item is PantryItem => Boolean(item));
  }, [pantry, groupedIds]);
  const missingGroupedCount = groupedIds
    ? groupedIds.length - groupedItems.length
    : 0;
  const clearGroupView = () => {
    // Clearing the route params also prevents stale group filters on later tab visits.
    router.setParams({ kbGroupIds: "", kbNotificationId: "" });
  };

  const [undo, setUndo] = useState<{
    item: PantryItem;

    categoryKey: CategoryKey;

    index: number;

    action: "removed" | "expired" | "used";

    historyEntryId?: string;

    operationId: number;
  } | null>(null);

  const nextUndoOperationId = useRef(0);

  const pendingHistoryWrites = useRef(new Map<number, Promise<string>>());

  const undoInProgress = useRef(false);

  const [openExpiring, setOpenExpiring] = useState(true);

  const [openExpired, setOpenExpired] = useState(true);

  const [pantryLoaded, setPantryLoaded] = useState(false);

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
  // -------------------- Undo timer --------------------
  useEffect(() => {
    if (!undo) return;

    const t = setTimeout(() => {
      pendingHistoryWrites.current.delete(undo.operationId);

      setUndo((current) =>
        current?.operationId === undo.operationId ? null : current,
      );
    }, 4000);

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

  // Track the history write by operation, not item ID. The same item may be
  // removed, restored, and removed again before an earlier write completes.
  function recordUndoableRemoval(
    item: PantryItem,

    action: "used" | "removed" | "expired",
  ) {
    const operationId = ++nextUndoOperationId.current;

    const currentList = usePantryStore.getState().pantry[item.categoryKey];

    const index = currentList.findIndex((entry) => entry.id === item.id);

    if (index === -1) return;

    setUndo({
      item,

      categoryKey: item.categoryKey,

      index,

      action,

      operationId,
    });

    setPantry((prev) => ({
      ...prev,

      [item.categoryKey]: prev[item.categoryKey].filter(
        (entry) => entry.id !== item.id,
      ),
    }));

    // Store the promise immediately so an immediate Undo can await it.
    pendingHistoryWrites.current.clear();

    const write = appendPantryHistory(item, action);

    pendingHistoryWrites.current.set(operationId, write);

    void write

      .then((historyEntryId) => {
        setUndo((current) =>
          current?.operationId === operationId
            ? { ...current, historyEntryId }
            : current,
        );
      })

      .catch((error) => console.warn("Failed to record pantry history", error));
  }

  function handleMarkUsed(item: PantryItem) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    recordUndoableRemoval(item, "used");
  }

  function handleRemove(item: PantryItem, reason: "removed" | "expired") {
    recordUndoableRemoval(item, reason);
  }

  const bulkDeleteSelected = (reason: "used" | "expired" | "removed") => {
    setUndo(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1) Capture the items being deleted (BEFORE setPantry changes state)
    const deleted: PantryItem[] = [];

    for (const k of ALL_CATEGORY_KEYS) {
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
      void appendPantryHistory(it, reason).catch((error) =>
        console.warn("Failed to record bulk pantry removal", error),
      );
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

  function openRemovalSheet(item: PantryItem) {
    removalChoiceInProgress.current = false;
    void Haptics.selectionAsync();
    setRemovalTarget({ kind: "single", item });
  }

  function openBulkRemovalSheet() {
    if (selectedCount === 0) return;
    removalChoiceInProgress.current = false;
    void Haptics.selectionAsync();
    setRemovalTarget({ kind: "bulk", count: selectedCount });
  }

  function closeRemovalSheet() {
    if (removalChoiceInProgress.current) return;
    setRemovalTarget(null);
  }

  function chooseRemovalReason(reason: "used" | "expired" | "removed") {
    if (!removalTarget || removalChoiceInProgress.current) return;
    removalChoiceInProgress.current = true;
    const target = removalTarget;
    setRemovalTarget(null);
    if (target.kind === "bulk") {
      bulkDeleteSelected(reason);
    } else if (reason === "used") {
      handleMarkUsed(target.item); // Retains the existing four-second Undo behavior.
    } else {
      handleRemove(target.item, reason);
    }
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

  const undoDelete = async () => {
    const current = undo;

    if (!current || undoInProgress.current) return;

    undoInProgress.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Hide Undo while processing; restore it if the history cleanup fails.
    setUndo(null);

    try {
      const write = pendingHistoryWrites.current.get(current.operationId);

      const historyEntryId = write ? await write : current.historyEntryId;

      if (!historyEntryId) throw new Error("Missing history entry for Undo");

      await removePantryHistoryEntry(historyEntryId);

      pendingHistoryWrites.current.delete(current.operationId);

      setPantry((prev) => {
        const list = prev[current.categoryKey];

        if (list.some((entry) => entry.id === current.item.id)) return prev;

        const nextList = list.slice();

        nextList.splice(
          Math.min(current.index, nextList.length),

          0,

          current.item,
        );

        return { ...prev, [current.categoryKey]: nextList };
      });
    } catch (error) {
      console.warn("Unable to undo pantry removal", error);

      setUndo(current);

      setInfoDialog({
        title: "Undo failed",
        message:
          "Could not reverse the pantry history change. Please try again.",
      });
    } finally {
      undoInProgress.current = false;
    }
  };

  // This preserves the original behavior: when searching, the Expired section
  // operates on its currently displayed (filtered) items.
  const performDeleteExpired = () => {
    const itemsToExpire = [...expiredItems];
    if (itemsToExpire.length === 0) return;

    setPantry((prev) => {
      const next = { ...prev };
      for (const item of itemsToExpire) {
        next[item.categoryKey] = next[item.categoryKey].filter(
          (row) => row.id !== item.id,
        );
      }
      return next;
    });

    for (const item of itemsToExpire) {
      void appendPantryHistory(item, "expired");
    }
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

  const showCategoryMenu = (menu: MenuCategory) => {
    void Haptics.selectionAsync();
    setConfirmCategoryAction(false);
    setCategoryMenu(menu);
    setCategoryMenuVisible(true);
  };

  const closeCategoryMenu = () => {
    // Keep the sheet contents mounted until the closing slide completes.
    setCategoryMenuVisible(false);
  };

  const handleCategoryMenuAction = () => {
    if (!categoryMenu) return;
    if (categoryMenu.type === "expiring") {
      remindLater();
      closeCategoryMenu();
      return;
    }
    setConfirmCategoryAction(true);
  };

  const confirmCategoryMenuAction = () => {
    if (!categoryMenu) return;
    if (categoryMenu.type === "normal") {
      const key = categoryMenu.cat.key;
      const removedItems = [...pantry[key]];
      if (removedItems.length > 0) {
        setPantry((prev) => ({ ...prev, [key]: [] }));
        for (const item of removedItems) {
          void appendPantryHistory(item, "removed");
        }
      }
    } else if (categoryMenu.type === "expired") {
      performDeleteExpired();
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    closeCategoryMenu();
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

  const totalItems = ALL_CATEGORY_KEYS.reduce(
    (sum, categoryKey) => sum + pantry[categoryKey].length,
    0,
  );
  const visibleItemCount = ALL_CATEGORY_KEYS.reduce(
    (sum, categoryKey) =>
      sum + pantry[categoryKey].filter((item) => matchesQuery(item, q)).length,
    0,
  );

  const categoryMenuCount =
    categoryMenu?.type === "normal"
      ? pantry[categoryMenu.cat.key].length
      : categoryMenu?.type === "expired"
        ? expiredItems.length
        : expiringSoon.length;

  const categoryMenuTitle =
    categoryMenu?.type === "normal"
      ? categoryMenu.cat.label
      : categoryMenu?.type === "expired"
        ? "Expired items"
        : "Expiring soon";

  const categoryMenuIcon: React.ComponentProps<typeof Ionicons>["name"] =
    categoryMenu?.type === "normal"
      ? categoryMenu.cat.icon
      : categoryMenu?.type === "expired"
        ? "time-outline"
        : "alarm-outline";

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          (bulkMode && selectedCount > 0) || undo
            ? styles.scrollContentWithAction
            : null,
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroEyebrowRow}>
              <Ionicons
                name="basket-outline"
                size={15}
                color={PALETTE.heroMuted}
              />
              <Text style={styles.heroEyebrow}>YOUR KITCHEN, ORGANIZED</Text>
            </View>
            <TouchableOpacity
              style={styles.heroAddButton}
              activeOpacity={0.8}
              onPress={() => router.push("/add-item")}
              accessibilityRole="button"
              accessibilityLabel="Add pantry item"
            >
              <Ionicons name="add" size={19} color={PALETTE.slateDark} />
              <Text style={styles.heroAddText}>Add item</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>Your pantry.</Text>
          <Text style={styles.heroDescription}>
            Keep track of what's on hand and use more of what you buy.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{totalItems}</Text>
              <Text style={styles.heroMetricLabel}>ITEMS TRACKED</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{expiringSoon.length}</Text>
              <Text style={styles.heroMetricLabel}>
                {isSearching ? "SOON · FILTERED" : "EXPIRING SOON"}
              </Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{expiredItems.length}</Text>
              <Text style={styles.heroMetricLabel}>
                {isSearching ? "EXPIRED · FILTERED" : "EXPIRED"}
              </Text>
            </View>
          </View>
        </View>

        {groupView ? (
          <View style={styles.reminderSection}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderHeading}>
                <Ionicons
                  name="notifications-outline"
                  size={19}
                  color={PALETTE.slateDark}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>Your expiry reminder</Text>
                  <Text style={styles.reminderSubtitle}>
                    {groupedItems.length} of {groupedIds.length} ingredients
                    still in Pantry
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={clearGroupView}
                accessibilityRole="button"
                accessibilityLabel="Show full pantry"
                style={styles.reminderClearButton}
              >
                <Text style={styles.reminderClearText}>All Pantry</Text>
                <Ionicons name="close" size={15} color={PALETTE.slateDark} />
              </Pressable>
            </View>
            {missingGroupedCount > 0 && (
              <Text style={styles.reminderNote}>
                {missingGroupedCount}{" "}
                {missingGroupedCount === 1
                  ? "ingredient is"
                  : "ingredients are"}{" "}
                no longer in your Pantry and{" "}
                {missingGroupedCount === 1 ? "was" : "were"} omitted.
              </Text>
            )}
            {groupedItems.length ? (
              <View style={styles.itemList}>
                {groupedItems.map((item) => (
                  <PantryRow
                    key={`${item.categoryKey}:${item.id}`}
                    item={item}
                    bulkMode={false}
                    isSearching={false}
                    checked={false}
                    onToggleSelect={() => undefined}
                    onPressUsed={() => handleMarkUsed(item)}
                    onPressEdit={() => openEdit(item.categoryKey, item.id)}
                    onPressDelete={() => openRemovalSheet(item)}
                    onSwipeDelete={() => openRemovalSheet(item)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.reminderEmpty}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={26}
                  color={PALETTE.slate}
                />
                <Text style={styles.reminderTitle}>Nothing left to review</Text>
                <Text style={styles.reminderNote}>
                  These ingredients have already been removed or used.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={19} color={PALETTE.muted} />
              <TextInput
                placeholder="Search your pantry"
                placeholderTextColor={PALETTE.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                style={styles.searchInput}
                accessibilityLabel="Search pantry items"
              />
              {isSearching && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear pantry search"
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={PALETTE.muted}
                  />
                </Pressable>
              )}
            </View>
            {isSearching && (
              <Text style={styles.searchCaption}>
                {visibleItemCount} matching{" "}
                {visibleItemCount === 1 ? "item" : "items"} for “
                {searchQuery.trim()}”
              </Text>
            )}

            <View style={styles.toolbar}>
              <Pressable
                onPress={toggleBulkMode}
                accessibilityRole="button"
                accessibilityState={{ selected: bulkMode }}
                style={[styles.toolButton, bulkMode && styles.toolButtonActive]}
              >
                <Ionicons
                  name={bulkMode ? "checkbox" : "checkbox-outline"}
                  size={17}
                  color={bulkMode ? PALETTE.paper : PALETTE.slate}
                />
                <Text
                  style={[styles.toolText, bulkMode && styles.toolTextActive]}
                >
                  {bulkMode ? `Selected (${selectedCount})` : "Select"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setQuickAddOpen(true)}
                accessibilityRole="button"
                style={styles.toolButton}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={PALETTE.slate}
                />
                <Text style={styles.toolText}>Quick add</Text>
              </Pressable>
              <Pressable
                onPress={toggleAll}
                accessibilityRole="button"
                style={styles.toolButton}
              >
                <Ionicons
                  name={allOpen ? "contract-outline" : "expand-outline"}
                  size={17}
                  color={PALETTE.slate}
                />
                <Text style={styles.toolText}>
                  {allOpen ? "Collapse" : "Expand"}
                </Text>
              </Pressable>
            </View>

            {expiredItems.length > 0 && (
              <View style={styles.sectionWrap}>
                <View style={[styles.sectionHeaderCard, styles.expiredHeader]}>
                  <Pressable
                    onPress={() => setOpenExpired((v) => !v)}
                    style={styles.sectionHeaderMain}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: openExpired }}
                  >
                    <View style={[styles.sectionIcon, styles.expiredIcon]}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={PALETTE.expired}
                      />
                    </View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.sectionHeading}>Expired</Text>
                      <Text style={styles.sectionCount}>
                        {expiredItems.length}{" "}
                        {expiredItems.length === 1 ? "item" : "items"} to review
                      </Text>
                    </View>
                    <Ionicons
                      name={openExpired ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={PALETTE.muted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => showCategoryMenu({ type: "expired" })}
                    style={styles.sectionMenu}
                    accessibilityRole="button"
                    accessibilityLabel="Expired items options"
                    hitSlop={8}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={19}
                      color={PALETTE.muted}
                    />
                  </Pressable>
                </View>
                {openExpired && (
                  <View style={styles.itemList}>
                    {expiredItems.map((item) => (
                      <PantryRow
                        key={`${item.categoryKey}:${item.id}`}
                        item={item}
                        bulkMode={bulkMode}
                        isSearching={isSearching}
                        checked={isSelected(item.categoryKey, item.id)}
                        onToggleSelect={() => {
                          void Haptics.selectionAsync();
                          toggleSelected(item.categoryKey, item.id);
                        }}
                        onPressUsed={() => handleMarkUsed(item)}
                        onPressEdit={() => openEdit(item.categoryKey, item.id)}
                        onPressDelete={() => openRemovalSheet(item)}
                        onSwipeDelete={() => openRemovalSheet(item)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {expiringSoon.length > 0 && (
              <View style={styles.sectionWrap}>
                <View style={[styles.sectionHeaderCard, styles.expiringHeader]}>
                  <Pressable
                    onPress={() => setOpenExpiring((v) => !v)}
                    style={styles.sectionHeaderMain}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: openExpiring }}
                  >
                    <View style={[styles.sectionIcon, styles.expiringIcon]}>
                      <Ionicons
                        name="alarm-outline"
                        size={20}
                        color={PALETTE.amber}
                      />
                    </View>
                    <View style={styles.sectionHeadingCopy}>
                      <Text style={styles.sectionHeading}>Expiring soon</Text>
                      <Text style={styles.sectionCount}>
                        {expiringSoon.length}{" "}
                        {expiringSoon.length === 1 ? "item" : "items"} within 7
                        days
                      </Text>
                    </View>
                    <Ionicons
                      name={openExpiring ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={PALETTE.muted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => showCategoryMenu({ type: "expiring" })}
                    style={styles.sectionMenu}
                    accessibilityRole="button"
                    accessibilityLabel="Expiring soon options"
                    hitSlop={8}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={19}
                      color={PALETTE.muted}
                    />
                  </Pressable>
                </View>
                {openExpiring && (
                  <View style={styles.itemList}>
                    {expiringSoon.map((item) => (
                      <PantryRow
                        key={`${item.categoryKey}:${item.id}`}
                        item={item}
                        bulkMode={bulkMode}
                        isSearching={isSearching}
                        checked={isSelected(item.categoryKey, item.id)}
                        onToggleSelect={() => {
                          void Haptics.selectionAsync();
                          toggleSelected(item.categoryKey, item.id);
                        }}
                        onPressUsed={() => handleMarkUsed(item)}
                        onPressEdit={() => openEdit(item.categoryKey, item.id)}
                        onPressDelete={() => openRemovalSheet(item)}
                        onSwipeDelete={() => openRemovalSheet(item)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.groupHeadingRow}>
              <View>
                <Text style={styles.eyebrow}>BROWSE YOUR FOOD</Text>
                <Text style={styles.groupHeading}>Categories</Text>
              </View>
              <Text style={styles.groupHeadingMeta}>
                {isSearching
                  ? `${visibleCategories.length} matching`
                  : `${CATEGORIES.length} groups`}
              </Text>
            </View>

            {visibleCategories.map(({ cat, items: categoryItems }) => {
              const isOpen = openCategories[cat.key];
              return (
                <View key={cat.key} style={styles.sectionWrap}>
                  <View style={styles.sectionHeaderCard}>
                    <Pressable
                      onPress={() => toggleCategory(cat.key)}
                      style={styles.sectionHeaderMain}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <View style={styles.sectionIcon}>
                        <Ionicons
                          name={cat.icon}
                          size={20}
                          color={PALETTE.slate}
                        />
                      </View>
                      <View style={styles.sectionHeadingCopy}>
                        <Text style={styles.sectionHeading}>{cat.label}</Text>
                        <Text style={styles.sectionCount}>
                          {categoryItems.length}{" "}
                          {categoryItems.length === 1 ? "item" : "items"}
                          {isSearching &&
                          pantry[cat.key].length !== categoryItems.length
                            ? ` · ${pantry[cat.key].length} total`
                            : ""}
                        </Text>
                      </View>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={PALETTE.muted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => showCategoryMenu({ type: "normal", cat })}
                      style={styles.sectionMenu}
                      accessibilityRole="button"
                      accessibilityLabel={`${cat.label} options`}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={19}
                        color={PALETTE.muted}
                      />
                    </Pressable>
                  </View>
                  {isOpen && categoryItems.length > 0 && (
                    <View style={styles.itemList}>
                      {categoryItems
                        .slice()
                        .sort(
                          (a, b) => getExpiresInDays(a) - getExpiresInDays(b),
                        )
                        .map((item) => (
                          <PantryRow
                            key={`${cat.key}:${item.id}`}
                            item={item}
                            bulkMode={bulkMode}
                            isSearching={isSearching}
                            checked={isSelected(cat.key, item.id)}
                            onToggleSelect={() => {
                              void Haptics.selectionAsync();
                              toggleSelected(cat.key, item.id);
                            }}
                            onPressUsed={() => handleMarkUsed(item)}
                            onPressEdit={() => openEdit(cat.key, item.id)}
                            onPressDelete={() => openRemovalSheet(item)}
                            onSwipeDelete={() => openRemovalSheet(item)}
                          />
                        ))}
                    </View>
                  )}
                  {isOpen && categoryItems.length === 0 && !isSearching && (
                    <View style={styles.emptyCategory}>
                      <Ionicons
                        name="leaf-outline"
                        size={17}
                        color={PALETTE.muted}
                      />
                      <Text style={styles.emptyCategoryText}>
                        Nothing here yet. Add an item anytime.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {isSearching &&
              expiredItems.length === 0 &&
              expiringSoon.length === 0 &&
              visibleCategories.length === 0 && (
                <View style={styles.emptySearchCard}>
                  <Ionicons
                    name="search-outline"
                    size={27}
                    color={PALETTE.slate}
                  />
                  <Text style={styles.emptySearchTitle}>No matching items</Text>
                  <Text style={styles.emptySearchText}>
                    Try a different name or clear the search.
                  </Text>
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    style={styles.emptySearchButton}
                  >
                    <Text style={styles.emptySearchButtonText}>
                      Clear search
                    </Text>
                  </Pressable>
                </View>
              )}
          </>
        )}
        <Text style={styles.footer}>KITCHENBUDDY · A LITTLE LESS WASTE</Text>
      </ScrollView>

      {bulkMode && selectedCount > 0 && (
        <View style={[styles.bulkBar, { bottom: undo ? 100 : 18 }]}>
          <View style={styles.bulkTopRow}>
            <View style={styles.bulkCountIcon}>
              <Ionicons name="checkbox" size={18} color={PALETTE.paper} />
            </View>
            <Text style={styles.bulkBarTitle}>{selectedCount} selected</Text>
            <Pressable
              onPress={clearSelection}
              accessibilityRole="button"
              style={styles.bulkClearButton}
            >
              <Text style={styles.bulkClearText}>Clear selection</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bulkActions}
          >
            <Pressable onPress={bulkMarkUsed} style={styles.bulkAction}>
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={PALETTE.paper}
              />
              <Text style={styles.bulkActionText}>Used</Text>
            </Pressable>
            <Pressable onPress={openBulkExpiryMenu} style={styles.bulkAction}>
              <Ionicons
                name="calendar-outline"
                size={17}
                color={PALETTE.paper}
              />
              <Text style={styles.bulkActionText}>Expiry</Text>
            </Pressable>
            <Pressable onPress={openBulkMoveMenu} style={styles.bulkAction}>
              <Ionicons
                name="swap-horizontal-outline"
                size={17}
                color={PALETTE.paper}
              />
              <Text style={styles.bulkActionText}>Move</Text>
            </Pressable>
            <Pressable
              onPress={openBulkRemovalSheet}
              style={[styles.bulkAction, styles.bulkDeleteAction]}
            >
              <Ionicons name="trash-outline" size={17} color={PALETTE.paper} />
              <Text style={styles.bulkActionText}>Delete</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {undo && (
        <View style={styles.undoBar}>
          <Ionicons name="arrow-undo-outline" size={19} color={PALETTE.paper} />
          <Text style={styles.undoText} numberOfLines={2}>
            {undo.action === "used"
              ? "Marked used: "
              : undo.action === "expired"
                ? "Marked expired: "
                : "Removed: "}
            {undo.item.name}
          </Text>
          <Pressable
            onPress={() => void undoDelete()}
            style={styles.undoButton}
            accessibilityRole="button"
          >
            <Text style={styles.undoButtonText}>UNDO</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={categoryMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCategoryMenu}
        statusBarTranslucent
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeCategoryMenu}
            accessibilityRole="button"
            accessibilityLabel="Dismiss category options"
          />
          {categoryMenu && (
            <View style={styles.menuSheet}>
              <View style={styles.menuGrabber} />
              <View style={styles.menuHeadingRow}>
                <View style={styles.menuTitleIcon}>
                  <Ionicons
                    name={categoryMenuIcon}
                    size={22}
                    color={PALETTE.slateDark}
                  />
                </View>
                <View style={styles.menuHeadingCopy}>
                  <Text style={styles.menuEyebrow}>
                    {confirmCategoryAction
                      ? "PLEASE CONFIRM"
                      : "PANTRY OPTIONS"}
                  </Text>
                  <Text style={styles.menuTitle} numberOfLines={2}>
                    {confirmCategoryAction
                      ? categoryMenu.type === "normal"
                        ? "Clear this category?"
                        : "Delete expired items?"
                      : categoryMenuTitle}
                  </Text>
                </View>
                <Pressable
                  onPress={closeCategoryMenu}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close category options"
                  style={styles.menuClose}
                >
                  <Ionicons name="close" size={19} color={PALETTE.slateDark} />
                </Pressable>
              </View>

              <View style={styles.menuInfoRow}>
                <Ionicons
                  name="layers-outline"
                  size={16}
                  color={PALETTE.slate}
                />
                <Text style={styles.menuInfoText}>
                  {categoryMenuCount}{" "}
                  {categoryMenuCount === 1 ? "item" : "items"}
                  {categoryMenu.type !== "normal" && isSearching
                    ? " matching your search"
                    : ""}
                </Text>
              </View>

              {confirmCategoryAction ? (
                <>
                  <View style={styles.menuWarningBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={21}
                      color={PALETTE.expired}
                    />
                    <Text style={styles.menuWarningText}>
                      {categoryMenu.type === "normal"
                        ? `Remove all ${categoryMenuCount} ${categoryMenuCount === 1 ? "item" : "items"} from ${categoryMenu.cat.label}? Each removal will be recorded in Pantry History.`
                        : `Remove ${categoryMenuCount} expired ${categoryMenuCount === 1 ? "item" : "items"}${isSearching ? " matching your search" : ""}? Each will be recorded as expired in Pantry History.`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={confirmCategoryMenuAction}
                    style={({ pressed }) => [
                      styles.menuPrimaryDanger,
                      pressed && styles.menuPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={PALETTE.paper}
                    />
                    <Text style={styles.menuPrimaryDangerText}>
                      {categoryMenu.type === "normal"
                        ? "Yes, clear category"
                        : "Yes, delete expired"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmCategoryAction(false)}
                    style={styles.menuCancel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.menuCancelText}>Go back</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.menuDescription}>
                    {categoryMenu.type === "normal"
                      ? "Manage all the items stored in this category."
                      : categoryMenu.type === "expired"
                        ? "Review or remove the expired items shown in your pantry."
                        : "Give these ingredients a little more time before they expire."}
                  </Text>
                  <Pressable
                    disabled={categoryMenuCount === 0}
                    onPress={handleCategoryMenuAction}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: categoryMenuCount === 0 }}
                    style={({ pressed }) => [
                      styles.menuOption,
                      categoryMenu.type === "expiring"
                        ? styles.menuOptionNeutral
                        : styles.menuOptionDanger,
                      categoryMenuCount === 0 && styles.menuOptionDisabled,
                      pressed && styles.menuPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.menuOptionIcon,
                        categoryMenu.type === "expiring"
                          ? styles.menuOptionIconNeutral
                          : styles.menuOptionIconDanger,
                      ]}
                    >
                      <Ionicons
                        name={
                          categoryMenu.type === "expiring"
                            ? "calendar-outline"
                            : "trash-outline"
                        }
                        size={21}
                        color={
                          categoryMenu.type === "expiring"
                            ? PALETTE.slateDark
                            : PALETTE.expired
                        }
                      />
                    </View>
                    <View style={styles.menuOptionCopy}>
                      <Text
                        style={[
                          styles.menuOptionTitle,
                          categoryMenu.type !== "expiring" &&
                            styles.menuDangerText,
                        ]}
                      >
                        {categoryMenu.type === "normal"
                          ? "Clear category"
                          : categoryMenu.type === "expired"
                            ? isSearching
                              ? "Delete matching expired"
                              : "Delete all expired"
                            : "Remind me later"}
                      </Text>
                      <Text style={styles.menuOptionSubtitle}>
                        {categoryMenu.type === "normal"
                          ? "Remove every item in this category"
                          : categoryMenu.type === "expired"
                            ? "Record these items as expired"
                            : "Add 3 days to the displayed items"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={PALETTE.muted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={closeCategoryMenu}
                    style={styles.menuCancel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.menuCancelText}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Classification is required before a trash/swipe removal affects analytics. */}
      <Modal
        visible={removalTarget !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeRemovalSheet}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeRemovalSheet}
            accessibilityRole="button"
            accessibilityLabel="Cancel item removal"
          />
          {removalTarget && (
            <View style={styles.menuSheet}>
              <View style={styles.menuGrabber} />
              <View style={styles.menuHeadingRow}>
                <View style={styles.menuTitleIcon}>
                  <Ionicons
                    name="help-circle-outline"
                    size={23}
                    color={PALETTE.slateDark}
                  />
                </View>
                <View style={styles.menuHeadingCopy}>
                  <Text style={styles.menuEyebrow}>
                    KEEP YOUR INSIGHTS ACCURATE
                  </Text>
                  <Text style={styles.menuTitle}>
                    What happened to{" "}
                    {removalTarget.kind === "bulk"
                      ? "these items?"
                      : "this item?"}
                  </Text>
                </View>
                <Pressable
                  onPress={closeRemovalSheet}
                  style={styles.menuClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close removal options"
                >
                  <Ionicons name="close" size={19} color={PALETTE.slateDark} />
                </Pressable>
              </View>
              <View style={styles.menuInfoRow}>
                <Ionicons
                  name={
                    removalTarget.kind === "bulk"
                      ? "layers-outline"
                      : "basket-outline"
                  }
                  size={16}
                  color={PALETTE.slate}
                />
                <Text style={styles.menuInfoText} numberOfLines={2}>
                  {removalTarget.kind === "bulk"
                    ? `${removalTarget.count} selected ${removalTarget.count === 1 ? "item" : "items"} · one reason for all`
                    : `${removalTarget.item.name}${removalTarget.item.quantity ? ` · ${removalTarget.item.quantity}` : ""}`}
                </Text>
              </View>
              <Text style={styles.menuDescription}>
                Choose the most accurate reason. This removes{" "}
                {removalTarget.kind === "bulk"
                  ? "the selected items"
                  : "the item"}{" "}
                from your pantry and records the outcome in Pantry History and
                Analytics.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Used or consumed"
                onPress={() => chooseRemovalReason("used")}
                style={({ pressed }) => [
                  styles.reasonOption,
                  styles.reasonUsed,
                  pressed && styles.menuPressed,
                ]}
              >
                <View style={[styles.reasonIcon, styles.reasonIconUsed]}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color="#516D5A"
                  />
                </View>
                <View style={styles.menuOptionCopy}>
                  <Text style={styles.reasonTitle}>Used / Consumed</Text>
                  <Text style={styles.menuOptionSubtitle}>
                    Count as food used, not wasted
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={PALETTE.muted}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expired or thrown away"
                onPress={() => chooseRemovalReason("expired")}
                style={({ pressed }) => [
                  styles.reasonOption,
                  styles.reasonExpired,
                  pressed && styles.menuPressed,
                ]}
              >
                <View style={[styles.reasonIcon, styles.reasonIconExpired]}>
                  <Ionicons
                    name="time-outline"
                    size={22}
                    color={PALETTE.expired}
                  />
                </View>
                <View style={styles.menuOptionCopy}>
                  <Text style={styles.reasonTitle}>Expired / Thrown Away</Text>
                  <Text style={styles.menuOptionSubtitle}>
                    Count as expired food / waste
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={PALETTE.muted}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Removed for another reason"
                onPress={() => chooseRemovalReason("removed")}
                style={({ pressed }) => [
                  styles.reasonOption,
                  styles.reasonRemoved,
                  pressed && styles.menuPressed,
                ]}
              >
                <View style={[styles.reasonIcon, styles.reasonIconRemoved]}>
                  <Ionicons
                    name="trash-outline"
                    size={21}
                    color={PALETTE.slateDark}
                  />
                </View>
                <View style={styles.menuOptionCopy}>
                  <Text style={styles.reasonTitle}>Removed / Correction</Text>
                  <Text style={styles.menuOptionSubtitle}>
                    Not counted as used or expired
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={PALETTE.muted}
                />
              </Pressable>
              <Pressable
                onPress={closeRemovalSheet}
                style={styles.menuCancel}
                accessibilityRole="button"
              >
                <Text style={styles.menuCancelText}>
                  Cancel · Keep in pantry
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={infoDialog !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInfoDialog(null)}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            onPress={() => setInfoDialog(null)}
          />
          {infoDialog && (
            <View style={styles.menuSheet}>
              <View style={styles.menuGrabber} />
              <View style={styles.menuHeadingRow}>
                <View style={styles.menuTitleIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={22}
                    color={PALETTE.expired}
                  />
                </View>
                <View style={styles.menuHeadingCopy}>
                  <Text style={styles.menuEyebrow}>PANTRY NOTICE</Text>
                  <Text style={styles.menuTitle}>{infoDialog.title}</Text>
                </View>
              </View>
              <Text style={styles.menuDescription}>{infoDialog.message}</Text>
              <Pressable
                style={styles.reasonGotIt}
                onPress={() => setInfoDialog(null)}
                accessibilityRole="button"
              >
                <Text style={styles.reasonGotItText}>Got it</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

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

const PALETTE = {
  bg: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDark: "#485F6A",
  heroMuted: "#DAE3E5",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  cream: "#EDE6DA",
  expired: "#965D57",
  amber: "#926C3D",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 48 },
  scrollContentWithAction: { paddingBottom: 218 },
  reminderSection: {
    padding: 16,
    backgroundColor: "#FFFEFB",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E9E5DE",
    marginBottom: 18,
    gap: 12,
  },
  reminderHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reminderHeading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderTitle: { color: "#292D2C", fontSize: 15, fontWeight: "700" },
  reminderSubtitle: { color: "#747571", fontSize: 11, marginTop: 4 },
  reminderClearButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#E8E2DA",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reminderClearText: { color: "#485F6A", fontSize: 11, fontWeight: "700" },
  reminderNote: { color: "#747571", fontSize: 12, lineHeight: 18 },
  reminderEmpty: { paddingVertical: 26, alignItems: "center", gap: 8 },

  hero: {
    backgroundColor: PALETTE.slateDark,
    borderRadius: 25,
    padding: 21,
    paddingBottom: 20,
    marginBottom: 17,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 13,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 7,
  },
  heroEyebrow: {
    color: PALETTE.heroMuted,
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: "700",
  },
  heroAddButton: {
    backgroundColor: PALETTE.paper,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroAddText: { color: PALETTE.slateDark, fontWeight: "700", fontSize: 12 },
  heroTitle: {
    color: PALETTE.paper,
    fontSize: 31,
    lineHeight: 38,
    fontFamily: "serif",
    fontWeight: "600",
  },
  heroDescription: {
    color: PALETTE.heroMuted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 285,
  },
  heroMetrics: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#82919A",
  },
  heroMetric: { flex: 1, alignItems: "center", minWidth: 0 },
  heroMetricValue: {
    color: PALETTE.paper,
    fontSize: 23,
    fontWeight: "700",
    fontFamily: "serif",
  },
  heroMetricLabel: {
    color: PALETTE.heroMuted,
    fontSize: 8,
    letterSpacing: 0.55,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  heroMetricDivider: {
    height: 31,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#82919A",
  },
  searchWrap: {
    minHeight: 51,
    backgroundColor: PALETTE.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.ink,
    paddingVertical: 11,
  },
  searchCaption: {
    color: PALETTE.muted,
    fontSize: 11,
    marginTop: 7,
    paddingHorizontal: 4,
  },
  toolbar: { flexDirection: "row", gap: 7, marginTop: 12, marginBottom: 23 },
  toolButton: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
    backgroundColor: PALETTE.paper,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 5,
    paddingHorizontal: 5,
  },
  toolButtonActive: {
    backgroundColor: PALETTE.slate,
    borderColor: PALETTE.slate,
  },
  toolText: { fontSize: 11, fontWeight: "700", color: PALETTE.slate },
  toolTextActive: { color: PALETTE.paper },
  sectionWrap: { marginBottom: 12 },
  sectionHeaderCard: {
    backgroundColor: PALETTE.paper,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 77,
    paddingLeft: 13,
    paddingRight: 7,
  },
  expiredHeader: { backgroundColor: "#F5EDEA", borderColor: "#EADBD6" },
  expiringHeader: { backgroundColor: "#F7F0E5", borderColor: "#EDE0CB" },
  sectionHeaderMain: {
    flex: 1,
    minHeight: 73,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  sectionIcon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: "#F1ECE5",
    alignItems: "center",
    justifyContent: "center",
  },
  expiredIcon: { backgroundColor: "#EEDDD8" },
  expiringIcon: { backgroundColor: "#EFE2CC" },
  sectionHeadingCopy: { flex: 1, paddingVertical: 10 },
  sectionHeading: { color: PALETTE.ink, fontSize: 15, fontWeight: "700" },
  sectionCount: { color: PALETTE.muted, fontSize: 11, marginTop: 4 },
  sectionMenu: {
    paddingHorizontal: 10,
    minHeight: 51,
    justifyContent: "center",
    alignItems: "center",
  },
  itemList: { paddingTop: 8, gap: 5 },
  groupHeadingRow: {
    marginTop: 16,
    marginBottom: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  eyebrow: {
    color: PALETTE.slate,
    fontSize: 9,
    letterSpacing: 1.45,
    fontWeight: "800",
    marginBottom: 4,
  },
  groupHeading: {
    color: PALETTE.ink,
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "serif",
    fontWeight: "600",
  },
  groupHeadingMeta: { fontSize: 11, color: PALETTE.muted, marginBottom: 4 },
  emptyCategory: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: PALETTE.paper,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 9,
  },
  emptyCategoryText: { color: PALETTE.muted, fontSize: 12, flex: 1 },
  emptySearchCard: {
    alignItems: "center",
    backgroundColor: PALETTE.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 27,
    marginTop: 10,
  },
  emptySearchTitle: {
    color: PALETTE.ink,
    fontSize: 20,
    fontFamily: "serif",
    marginTop: 11,
  },
  emptySearchText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },
  emptySearchButton: {
    backgroundColor: PALETTE.slate,
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  emptySearchButtonText: {
    color: PALETTE.paper,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    color: "#A4A099",
    fontSize: 9,
    letterSpacing: 1.25,
    textAlign: "center",
    marginTop: 23,
  },
  bulkBar: {
    position: "absolute",
    left: 13,
    right: 13,
    borderRadius: 19,
    backgroundColor: PALETTE.slateDark,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 7,
  },
  bulkTopRow: {
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  bulkCountIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: "#6D828C",
    alignItems: "center",
    justifyContent: "center",
  },
  bulkBarTitle: {
    color: PALETTE.paper,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  bulkClearButton: { padding: 5 },
  bulkClearText: { color: PALETTE.heroMuted, fontSize: 11, fontWeight: "700" },
  bulkActions: { paddingHorizontal: 12, gap: 7 },
  bulkAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#6A7F89",
  },
  bulkDeleteAction: { backgroundColor: "#8F625E" },
  bulkActionText: { color: PALETTE.paper, fontSize: 11, fontWeight: "700" },
  undoBar: {
    position: "absolute",
    bottom: 18,
    left: 13,
    right: 13,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: PALETTE.ink,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  undoText: { color: PALETTE.paper, fontSize: 12, lineHeight: 17, flex: 1 },
  undoButton: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: "#46565A",
  },
  undoButtonText: {
    color: PALETTE.paper,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28,35,37,0.44)",
  },
  menuSheet: {
    backgroundColor: PALETTE.paper,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    paddingHorizontal: 21,
    paddingTop: 11,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 16,
  },
  menuGrabber: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#D9D5CF",
    alignSelf: "center",
    marginBottom: 19,
  },
  menuHeadingRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  menuTitleIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#F1ECE5",
    justifyContent: "center",
    alignItems: "center",
  },
  menuHeadingCopy: { flex: 1, minWidth: 0 },
  menuEyebrow: {
    fontSize: 9,
    color: PALETTE.slate,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  menuTitle: {
    color: PALETTE.ink,
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "600",
    lineHeight: 29,
  },
  menuClose: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: PALETTE.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  menuInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12,
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: "#F2EDE6",
    alignSelf: "flex-start",
  },
  menuInfoText: { color: PALETTE.slateDark, fontSize: 12, fontWeight: "700" },
  menuDescription: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 18,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 76,
  },
  menuOptionDanger: { backgroundColor: "#FCF5F2", borderColor: "#EFDEDA" },
  menuOptionNeutral: {
    backgroundColor: "#F7F7F3",
    borderColor: PALETTE.border,
  },
  menuOptionDisabled: { opacity: 0.45 },
  menuOptionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  menuOptionIconDanger: { backgroundColor: "#F3E5E0" },
  menuOptionIconNeutral: { backgroundColor: PALETTE.taupe },
  menuOptionCopy: { flex: 1, minWidth: 0 },
  menuOptionTitle: { color: PALETTE.ink, fontWeight: "700", fontSize: 14 },
  menuDangerText: { color: PALETTE.expired },
  menuOptionSubtitle: {
    color: PALETTE.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  menuWarningBox: {
    marginTop: 19,
    marginBottom: 19,
    backgroundColor: "#FCF5F2",
    borderColor: "#EFDEDA",
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  menuWarningText: {
    color: PALETTE.ink,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  menuPrimaryDanger: {
    backgroundColor: PALETTE.expired,
    borderRadius: 13,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  menuPrimaryDangerText: {
    color: PALETTE.paper,
    fontWeight: "800",
    fontSize: 13,
  },
  menuCancel: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 13,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PALETTE.paper,
  },
  menuCancelText: { color: PALETTE.slateDark, fontSize: 13, fontWeight: "700" },
  menuPressed: { opacity: 0.75 },
  reasonOption: {
    minHeight: 72,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 9,
  },
  reasonUsed: { backgroundColor: "#F1F6F0", borderColor: "#DFE9DB" },
  reasonExpired: { backgroundColor: "#FCF5F2", borderColor: "#EFDEDA" },
  reasonRemoved: { backgroundColor: "#F7F7F3", borderColor: PALETTE.border },
  reasonIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonIconUsed: { backgroundColor: "#E4EDE0" },
  reasonIconExpired: { backgroundColor: "#F3E5E0" },
  reasonIconRemoved: { backgroundColor: PALETTE.taupe },
  reasonTitle: { color: PALETTE.ink, fontSize: 14, fontWeight: "700" },
  reasonGotIt: {
    backgroundColor: PALETTE.slate,
    minHeight: 49,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 3,
  },
  reasonGotItText: { color: PALETTE.paper, fontSize: 14, fontWeight: "800" },
});
