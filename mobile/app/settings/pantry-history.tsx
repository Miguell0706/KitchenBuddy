import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { CATEGORIES } from "@/features/pantry/constants";
import type { CategoryKey } from "@/features/pantry/types";
import {
  getPantryHistory,
  updatePantryHistoryEntry,
  deletePantryHistoryEntry,
  clearPantryHistoryStrict,
  type PantryHistoryAction,
  type PantryHistoryEntry,
} from "@/features/pantry/history";

// Shared visual language with the redesigned KitchenBuddy Settings screens.
const PALETTE = {
  ivory: "#F8F6F0",
  paper: "#FFFEFB",
  slate: "#586D77",
  slateDark: "#405660",
  slatePale: "#E8EEF0",
  charcoal: "#30373B",
  muted: "#768087",
  taupe: "#AC9C89",
  line: "#E8E3DA",
  soft: "#F1EEE7",
  white: "#FFFFFF",
  red: "#9B5550",
  paleRed: "#F8EEEB",
};

type Filter = "all" | PantryHistoryAction;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "purchased", label: "Purchased" },
  { key: "added", label: "Added" },
  { key: "used", label: "Used" },
  { key: "expired", label: "Expired" },
  { key: "removed", label: "Removed" },
];

export default function PantryHistoryScreen() {
  const [entries, setEntries] = useState<PantryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const [selected, setSelected] = useState<PantryHistoryEntry | null>(null);
  const [dialog, setDialog] = useState<
    "details" | "edit" | "delete" | "clear" | "clearFinal" | "error" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [outcome, setOutcome] = useState<PantryHistoryAction>("used");
  const [showCategories, setShowCategories] = useState(false);
  const [clearPhrase, setClearPhrase] = useState("");

  const refresh = useCallback(async () => {
    const data = await getPantryHistory();
    setEntries(data);
    return data;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void getPantryHistory()
        .then((data) => {
          if (active) {
            setEntries(data);
            setLoading(false);
          }
        })
        .catch((error) => {
          console.warn("Could not refresh pantry history", error);
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setShowCategories(false);
  };
  const openEntry = (entry: PantryHistoryEntry) => {
    setSelected(entry);
    setDialog("details");
  };
  const openEdit = () => {
    if (!selected) return;
    setName(selected.name);
    setQuantity(selected.quantity);
    setCategory(selected.categoryKey);
    setOutcome(selected.action);
    setShowCategories(false);
    setDialog("edit");
  };
  const showError = (error: unknown, fallback: string) => {
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setDialog("error");
  };
  const saveEdit = async () => {
    if (busy || !selected || !category) return;
    setBusy(true);
    try {
      const result = await updatePantryHistoryEntry(selected.entryId, {
        name,
        quantity,
        categoryKey: category,
        action: outcome,
      });
      await refresh();
      setSelected(result);
      setDialog("details");
    } catch (error) {
      console.warn("History correction failed", error);
      showError(error, "Your change could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const deleteOne = async () => {
    if (busy || !selected) return;
    setBusy(true);
    try {
      const deleted = await deletePantryHistoryEntry(selected.entryId);
      if (!deleted)
        throw new Error("This entry no longer exists. Please refresh.");
      await refresh();
      setSelected(null);
      setDialog(null);
    } catch (error) {
      console.warn("History delete failed", error);
      showError(error, "The entry could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const clearAll = async () => {
    if (busy || clearPhrase !== "CLEAR") return;
    setBusy(true);
    try {
      await clearPantryHistoryStrict();
      await refresh();
      setSelected(null);
      setClearPhrase("");
      setFilter("all");
      setDialog(null);
    } catch (error) {
      console.warn("History clear failed", error);
      showError(
        error,
        "Pantry history could not be cleared. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const isExit =
    selected?.action === "used" ||
    selected?.action === "expired" ||
    selected?.action === "removed";

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((entry) => entry.action === filter);
  }, [entries, filter]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.entryId}
        renderItem={({ item }) => (
          <HistoryRow entry={item} onPress={() => openEntry(item)} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="time-outline" size={15} color="#F0E7DB" />
                <Text style={styles.eyebrow}>YOUR PANTRY JOURNAL</Text>
              </View>
              <Text style={styles.heroTitle}>
                A little history, a lot of insight.
              </Text>
              <Text style={styles.heroSubtitle}>
                See how groceries have moved through your kitchen, one item at a
                time.
              </Text>
              <View style={styles.heroBottom}>
                <View style={styles.heroCountIcon}>
                  <Ionicons name="receipt-outline" size={17} color="#F8F6F0" />
                </View>
                <Text style={styles.heroCount}>
                  {loading
                    ? "Loading your activity"
                    : `${entries.length} recorded ${entries.length === 1 ? "event" : "events"}`}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>YOUR ACTIVITY</Text>
                <Text style={styles.sectionTitle}>Pantry history</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage pantry history"
                disabled={busy || loading || entries.length === 0}
                style={[
                  styles.manageButton,
                  (busy || loading || entries.length === 0) && styles.disabled,
                ]}
                onPress={() => setDialog("clear")}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={PALETTE.slateDark}
                />
              </Pressable>
            </View>
            <View style={styles.filterRow}>
              {FILTERS.map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  active={filter === option.key}
                  onPress={() => setFilter(option.key)}
                />
              ))}
            </View>
            {!loading && filtered.length > 0 && (
              <Text style={styles.resultsLabel}>
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                {filter === "all"
                  ? ""
                  : ` · ${FILTERS.find((option) => option.key === filter)?.label ?? filter}`}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator color={PALETTE.slate} />
              <Text style={styles.emptyDescription}>
                Loading pantry history...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="time-outline" size={27} color={PALETTE.slate} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "all"
                  ? "Your story starts here"
                  : "Nothing in this category yet"}
              </Text>
              <Text style={styles.emptyDescription}>
                {filter === "all"
                  ? "As you add, use, or remove pantry items, their activity will appear here."
                  : "Try another filter to see more of your pantry activity."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && filtered.length > 0 ? (
            <Text style={styles.footer}>
              A thoughtful record of your everyday kitchen.
            </Text>
          ) : null
        }
      />
      <Modal
        visible={dialog !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeDialog}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.scrim}
            onPress={closeDialog}
            accessibilityLabel="Close dialog"
          />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            {dialog === "details" && selected ? (
              <>
                <Text style={styles.sheetEyebrow}>PANTRY JOURNAL</Text>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetBody}>
                  {getActionAppearance(selected.action).label} ·{" "}
                  {selected.quantity} · {formatCategory(selected.categoryKey)}
                </Text>
                <Text style={styles.sheetMeta}>
                  {new Date(selected.at).toLocaleString()}
                </Text>
                <View style={styles.sheetRule} />
                <Pressable
                  accessibilityRole="button"
                  style={styles.sheetAction}
                  onPress={openEdit}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={PALETTE.slateDark}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetActionTitle}>
                      Correct this record
                    </Text>
                    <Text style={styles.sheetActionHint}>
                      Fix details or the recorded outcome
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={PALETTE.muted}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.sheetAction}
                  onPress={() => setDialog("delete")}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={PALETTE.red}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.sheetActionTitle, { color: PALETTE.red }]}
                    >
                      Delete this entry
                    </Text>
                    <Text style={styles.sheetActionHint}>
                      Remove this event from Analytics, too
                    </Text>
                  </View>
                </Pressable>
                <Text style={styles.sheetFoot}>
                  Editing history does not change the item currently in your
                  Pantry.
                </Text>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeDialog}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </>
            ) : dialog === "edit" && selected ? (
              <>
                <Text style={styles.sheetEyebrow}>CORRECT AN ENTRY</Text>
                <Text style={styles.sheetTitle}>Make it accurate.</Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.editScroll}
                  contentContainerStyle={{ paddingBottom: 10 }}
                >
                  <Text style={styles.inputLabel}>ITEM NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={name}
                    onChangeText={setName}
                    maxLength={120}
                    editable={!busy}
                    placeholder="Item name"
                    placeholderTextColor={PALETTE.muted}
                  />
                  <Text style={styles.inputLabel}>RECORDED QUANTITY</Text>
                  <TextInput
                    style={styles.textInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    maxLength={60}
                    editable={!busy}
                    placeholder="e.g. 1 carton"
                    placeholderTextColor={PALETTE.muted}
                  />
                  <Text style={styles.inputLabel}>CATEGORY</Text>
                  <Pressable
                    style={styles.categoryPicker}
                    onPress={() => setShowCategories((v) => !v)}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.categoryPickerText}>
                      {CATEGORIES.find((item) => item.key === category)
                        ?.label ??
                        (category
                          ? formatCategory(category)
                          : "Choose category")}
                    </Text>
                    <Ionicons
                      name={showCategories ? "chevron-up" : "chevron-down"}
                      size={17}
                      color={PALETTE.slateDark}
                    />
                  </Pressable>
                  {showCategories && (
                    <View style={styles.categoryOptions}>
                      {CATEGORIES.map((item) => (
                        <Pressable
                          key={item.key}
                          disabled={busy}
                          accessibilityRole="button"
                          onPress={() => {
                            setCategory(item.key);
                            setShowCategories(false);
                          }}
                          style={[
                            styles.categoryOption,
                            category === item.key && styles.categorySelected,
                          ]}
                        >
                          <Text style={styles.categoryPickerText}>
                            {item.label}
                          </Text>
                          {category === item.key && (
                            <Ionicons
                              name="checkmark"
                              size={17}
                              color={PALETTE.slate}
                            />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {isExit ? (
                    <>
                      <Text style={styles.inputLabel}>
                        WHAT ACTUALLY HAPPENED?
                      </Text>
                      {(["used", "expired", "removed"] as const).map(
                        (action) => (
                          <Pressable
                            key={action}
                            disabled={busy}
                            accessibilityRole="radio"
                            accessibilityState={{
                              selected: outcome === action,
                            }}
                            style={[
                              styles.outcomeOption,
                              outcome === action && styles.outcomeSelected,
                            ]}
                            onPress={() => setOutcome(action)}
                          >
                            <Text style={styles.categoryPickerText}>
                              {getActionAppearance(action).label}
                            </Text>
                            <Ionicons
                              name={
                                outcome === action
                                  ? "radio-button-on"
                                  : "radio-button-off"
                              }
                              size={19}
                              color={PALETTE.slate}
                            />
                          </Pressable>
                        ),
                      )}
                    </>
                  ) : (
                    <Text style={styles.sheetFoot}>
                      Arrival type ({getActionAppearance(selected.action).label}
                      ) stays unchanged to preserve purchase and lifecycle
                      tracking.
                    </Text>
                  )}
                  <Text style={styles.sheetFoot}>
                    Correcting the name and category also updates the recorded
                    history for this same Pantry item. Other shopping
                    occurrences are unaffected.
                  </Text>
                </ScrollView>
                <Pressable
                  disabled={
                    busy || !name.trim() || !quantity.trim() || !category
                  }
                  style={[
                    styles.primaryButton,
                    (busy || !name.trim() || !quantity.trim() || !category) &&
                      styles.disabled,
                  ]}
                  onPress={() => void saveEdit()}
                  accessibilityRole="button"
                >
                  {busy && (
                    <ActivityIndicator size="small" color={PALETTE.paper} />
                  )}
                  <Text style={styles.primaryText}>Save correction</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.cancelButton}
                  onPress={() => setDialog("details")}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Back</Text>
                </Pressable>
              </>
            ) : dialog === "delete" && selected ? (
              <>
                <View style={styles.dangerIcon}>
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={PALETTE.red}
                  />
                </View>
                <Text style={styles.sheetTitle}>
                  Delete this history entry?
                </Text>
                <Text style={styles.sheetBody}>
                  Remove the{" "}
                  {getActionAppearance(selected.action).label.toLowerCase()}{" "}
                  event for {selected.name} from your journal and Analytics
                  calculations?
                </Text>
                <Text style={styles.sheetFoot}>
                  This does not alter your current Pantry. Removing a
                  purchase/arrival event can also affect related purchase and
                  usage statistics. This action cannot be undone.
                </Text>
                <Pressable
                  disabled={busy}
                  style={[styles.dangerButton, busy && styles.disabled]}
                  onPress={() => void deleteOne()}
                  accessibilityRole="button"
                >
                  {busy && (
                    <ActivityIndicator size="small" color={PALETTE.white} />
                  )}
                  <Text style={styles.dangerText}>Delete entry</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.cancelButton}
                  onPress={() => setDialog("details")}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Keep entry</Text>
                </Pressable>
              </>
            ) : dialog === "clear" ? (
              <>
                <View style={styles.dangerIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color={PALETTE.red}
                  />
                </View>
                <Text style={styles.sheetTitle}>Manage history</Text>
                <Text style={styles.sheetBody}>
                  Your journal contains {entries.length} recorded events. You
                  can delete an individual event by opening it, or erase all
                  history below.
                </Text>
                <Text style={styles.sheetFoot}>
                  Clearing erases the source data for Pantry Analytics,
                  rankings, trends, and historical insights. Your live Pantry
                  remains unchanged.
                </Text>
                <Pressable
                  style={styles.dangerOutline}
                  onPress={() => {
                    setClearPhrase("");
                    setDialog("clearFinal");
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.dangerOutlineText}>
                    Erase all history…
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={closeDialog}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : dialog === "clearFinal" ? (
              <>
                <View style={styles.dangerIcon}>
                  <Ionicons
                    name="warning-outline"
                    size={24}
                    color={PALETTE.red}
                  />
                </View>
                <Text style={styles.sheetTitle}>
                  Permanently erase all history?
                </Text>
                <Text style={styles.sheetBody}>
                  This deletes all {entries.length} history records. Analytics
                  will start over from an empty event history. This cannot be
                  undone.
                </Text>
                <Text style={styles.inputLabel}>TYPE CLEAR TO CONFIRM</Text>
                <TextInput
                  style={styles.textInput}
                  value={clearPhrase}
                  onChangeText={setClearPhrase}
                  editable={!busy}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="CLEAR"
                  placeholderTextColor={PALETTE.muted}
                />
                <Pressable
                  disabled={busy || clearPhrase !== "CLEAR"}
                  style={[
                    styles.dangerButton,
                    (busy || clearPhrase !== "CLEAR") && styles.disabled,
                  ]}
                  onPress={() => void clearAll()}
                  accessibilityRole="button"
                >
                  {busy && (
                    <ActivityIndicator size="small" color={PALETTE.white} />
                  )}
                  <Text style={styles.dangerText}>Erase all history</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.cancelButton}
                  onPress={closeDialog}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : dialog === "error" ? (
              <>
                <View style={styles.dangerIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color={PALETTE.red}
                  />
                </View>
                <Text style={styles.sheetTitle}>Couldn't update history</Text>
                <Text style={styles.sheetBody}>{errorMessage}</Text>
                <Pressable
                  disabled={busy}
                  style={styles.primaryButton}
                  onPress={closeDialog}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Okay</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function HistoryRow({
  entry,
  onPress,
}: {
  entry: PantryHistoryEntry;
  onPress: () => void;
}) {
  const appearance = getActionAppearance(entry.action);
  const subtitleParts: string[] = [];
  if (entry.quantity) subtitleParts.push(entry.quantity);
  if (entry.categoryKey) subtitleParts.push(formatCategory(entry.categoryKey));
  if (entry.action === "purchased" && entry.source === "receipt") {
    subtitleParts.push("Receipt");
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${entry.name} history details`}
      onPress={onPress}
      style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
    >
      <View
        style={[styles.actionIcon, { backgroundColor: appearance.background }]}
      >
        <Ionicons name={appearance.icon} size={21} color={appearance.color} />
      </View>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={2}>
          {entry.name}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>
          {subtitle || "Pantry item"}
        </Text>
        <Text style={styles.timeText}>{timeAgo(entry.at)}</Text>
      </View>
      <View
        style={[styles.actionBadge, { backgroundColor: appearance.background }]}
      >
        <Text style={[styles.actionBadgeText, { color: appearance.color }]}>
          {appearance.label}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getActionAppearance(action: PantryHistoryAction): {
  label: string;
  icon: IconName;
  color: string;
  background: string;
} {
  switch (action) {
    case "purchased":
      return {
        label: "Purchased",
        icon: "bag-check-outline",
        color: "#516B78",
        background: "#E8EEF0",
      };
    case "added":
      return {
        label: "Added",
        icon: "add-circle-outline",
        color: "#516B78",
        background: "#E8EEF0",
      };
    case "used":
      return {
        label: "Used",
        icon: "checkmark-circle-outline",
        color: "#617C68",
        background: "#E9F0E7",
      };
    case "expired":
      return {
        label: "Expired",
        icon: "calendar-outline",
        color: "#997348",
        background: "#F5EBDE",
      };
    case "removed":
      return {
        label: "Removed",
        icon: "trash-outline",
        color: "#98706C",
        background: "#F4E9E6",
      };
  }
}

function formatCategory(categoryKey: string): string {
  switch (categoryKey) {
    case "meatSeafood":
      return "Meat & Seafood";
    case "dairyEggs":
      return "Dairy & Eggs";
    default:
      return categoryKey
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase());
  }
}

function timeAgo(ts: number): string {
  const diffMs = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return day === 1 ? "1 day ago" : `${day} days ago`;
  if (hr > 0) return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
  if (min > 0) return min === 1 ? "1 min ago" : `${min} mins ago`;
  return "Just now";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.ivory },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 50,
    flexGrow: 1,
  },
  hero: {
    backgroundColor: PALETTE.slate,
    borderRadius: 24,
    padding: 22,
    marginBottom: 27,
    overflow: "hidden",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
    color: "#F0E7DB",
  },
  heroTitle: {
    color: PALETTE.paper,
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 9,
  },
  heroSubtitle: {
    color: "#E2E7E7",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 310,
  },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 23,
  },
  heroCountIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#718590",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCount: { color: PALETTE.paper, fontWeight: "600", fontSize: 12 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    paddingHorizontal: 2,
  },
  sectionEyebrow: {
    color: PALETTE.taupe,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "Georgia",
    fontSize: 24,
    color: PALETTE.charcoal,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  filterChip: {
    backgroundColor: PALETTE.paper,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.line,
  },
  filterChipActive: {
    backgroundColor: PALETTE.slate,
    borderColor: PALETTE.slate,
  },
  filterChipText: { color: PALETTE.muted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: PALETTE.white },
  pressed: { opacity: 0.75 },
  resultsLabel: {
    marginBottom: 12,
    marginLeft: 3,
    color: PALETTE.muted,
    fontSize: 12,
  },
  rowCard: {
    backgroundColor: PALETTE.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLeft: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: PALETTE.charcoal,
    marginBottom: 3,
  },
  rowSubtitle: { fontSize: 12, color: PALETTE.muted, lineHeight: 17 },
  timeText: {
    color: PALETTE.taupe,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  actionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  actionBadgeText: { fontSize: 10, fontWeight: "800" },
  emptyCard: {
    backgroundColor: PALETTE.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.line,
    paddingHorizontal: 24,
    paddingVertical: 42,
    alignItems: "center",
    marginTop: 12,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: PALETTE.slatePale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  emptyTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    color: PALETTE.charcoal,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    textAlign: "center",
    marginTop: 9,
  },
  footer: {
    color: PALETTE.taupe,
    textAlign: "center",
    fontSize: 11,
    marginTop: 17,
  },
  disabled: { opacity: 0.42 },
  manageButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PALETTE.paper,
    borderWidth: 1,
    borderColor: PALETTE.line,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,34,39,0.52)",
  },
  sheet: {
    backgroundColor: PALETTE.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 23,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "90%",
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 3,
    alignSelf: "center",
    backgroundColor: PALETTE.line,
    marginBottom: 21,
  },
  sheetEyebrow: {
    fontSize: 10,
    color: PALETTE.slate,
    letterSpacing: 1.8,
    fontWeight: "800",
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 26,
    lineHeight: 32,
    color: PALETTE.charcoal,
    marginBottom: 9,
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 22,
    color: PALETTE.muted,
    marginBottom: 12,
  },
  sheetMeta: { color: PALETTE.taupe, fontSize: 12, marginBottom: 7 },
  sheetRule: { height: 1, backgroundColor: PALETTE.line, marginVertical: 12 },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
  },
  sheetActionTitle: {
    color: PALETTE.charcoal,
    fontWeight: "700",
    fontSize: 14,
  },
  sheetActionHint: { color: PALETTE.muted, fontSize: 11, marginTop: 4 },
  sheetFoot: {
    fontSize: 12,
    lineHeight: 19,
    color: PALETTE.muted,
    marginTop: 11,
    marginBottom: 15,
  },
  primaryButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: PALETTE.slate,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 11,
  },
  primaryText: { fontWeight: "800", color: PALETTE.paper, fontSize: 14 },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 47,
    marginTop: 6,
  },
  cancelText: { fontWeight: "700", color: PALETTE.slateDark, fontSize: 13 },
  dangerIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: PALETTE.paleRed,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  dangerButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: PALETTE.red,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  dangerText: { fontWeight: "800", color: PALETTE.white, fontSize: 14 },
  dangerOutline: {
    minHeight: 49,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EBD7D2",
    backgroundColor: PALETTE.paleRed,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 11,
  },
  dangerOutlineText: { fontWeight: "800", color: PALETTE.red, fontSize: 14 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: PALETTE.slate,
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.ivory,
    color: PALETTE.charcoal,
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    minHeight: 46,
  },
  editScroll: { flexGrow: 0, flexShrink: 1 },
  categoryPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 12,
    backgroundColor: PALETTE.ivory,
  },
  categoryPickerText: {
    fontSize: 13,
    color: PALETTE.charcoal,
    fontWeight: "600",
  },
  categoryOptions: {
    marginTop: 5,
    backgroundColor: PALETTE.ivory,
    borderRadius: 13,
    padding: 4,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 9,
  },
  categorySelected: { backgroundColor: PALETTE.slatePale },
  outcomeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 12,
    marginBottom: 7,
  },
  outcomeSelected: {
    backgroundColor: PALETTE.slatePale,
    borderColor: PALETTE.slate,
  },
});
