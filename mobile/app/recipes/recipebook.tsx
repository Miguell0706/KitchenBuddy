import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRecipesStore } from "@/features/recipes/store";

const P = {
  background: "#F6F3EE",
  paper: "#FFFEFB",
  ink: "#292D2C",
  muted: "#747571",
  slate: "#586D77",
  slateDeep: "#485F6A",
  taupe: "#E8E2DA",
  border: "#E9E5DE",
  danger: "#9A5149",
  dangerSoft: "#F7EDE9",
  heroText: "#FDFBF7",
  heroMuted: "#DBE3E4",
};

type IngredientPreview = { name: string; quantity?: number; unit?: string };
type Turn = { from: number; to: number; direction: -1 | 1 };

function ingredientLabel(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<IngredientPreview>;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  const amount =
    typeof candidate.quantity === "number" &&
    Number.isFinite(candidate.quantity)
      ? String(candidate.quantity)
      : "";
  const unit =
    typeof candidate.unit === "string" &&
    candidate.unit.toLowerCase() !== "unit"
      ? candidate.unit.trim()
      : "";
  return [amount, unit, candidate.name.trim()].filter(Boolean).join(" ");
}

export default function SavedRecipesScreen() {
  const router = useRouter();
  const saved = useRecipesStore((s) => s.saved);
  const selectRecipe = useRecipesStore((s) => s.selectRecipe);
  const unsaveRecipe = useRecipesStore((s) => s.unsaveRecipe);

  // The cover is page 0; pages 1..N are the saved recipes.
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);
  const pageRef = useRef(0);
  const countRef = useRef(saved.length);
  const activeDirection = useRef<-1 | 1 | null>(null);
  const gestureProgress = useRef(0);
  countRef.current = saved.length;

  useEffect(() => {
    // Keep the book on an existing page after removing a saved recipe.
    if (busyRef.current) return;
    setPageIndex((current) => {
      const next = Math.min(current, saved.length);
      pageRef.current = next;
      return next;
    });
  }, [saved.length]);

  useEffect(() => () => progress.stopAnimation(), [progress]);

  // Mount the destination behind the moving sheet before accepting drag input.
  // The same progress value is controlled directly by a finger or by the buttons.
  function beginTurn(direction: -1 | 1): boolean {
    if (busyRef.current || pageWidth <= 0) return false;
    const from = pageRef.current;
    const to = from + direction;
    if (to < 0 || to > countRef.current) return false;

    busyRef.current = true;
    activeDirection.current = direction;
    gestureProgress.current = 0;
    progress.stopAnimation();
    progress.setValue(0);
    setTurn({ from, to, direction });
    return true;
  }

  function settleTurn(complete: boolean) {
    const direction = activeDirection.current;
    if (!busyRef.current || direction === null) return;
    const from = pageRef.current;
    const to = from + direction;
    const target = complete ? 1 : 0;
    const remaining = Math.abs(target - gestureProgress.current);

    Animated.timing(progress, {
      toValue: target,
      duration: Math.max(130, Math.round(580 * remaining)),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && complete) {
        const finalPage = Math.max(0, Math.min(to, countRef.current));
        pageRef.current = finalPage;
        setPageIndex(finalPage);
      }
      // Unmount the animated sheet without resetting progress while visible.
      // This also avoids flashing the recipe face on Android.
      setTurn(null);
      activeDirection.current = null;
      busyRef.current = false;
      gestureProgress.current = 0;
    });
  }

  function changePage(direction: -1 | 1) {
    if (!beginTurn(direction)) return;
    requestAnimationFrame(() => {
      if (!busyRef.current || activeDirection.current !== direction) return;
      gestureProgress.current = 1;
      Animated.timing(progress, {
        toValue: 1,
        duration: 760,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          const finalPage = Math.max(
            0,
            Math.min(pageRef.current + direction, countRef.current),
          );
          pageRef.current = finalPage;
          setPageIndex(finalPage);
        }
        setTurn(null);
        activeDirection.current = null;
        busyRef.current = false;
        gestureProgress.current = 0;
      });
    });
  }

  // PanResponder's callbacks are installed once, but call the latest handlers
  // through refs, so they see current page counts and layout measurements.
  const gestureCallbacks = useRef({
    beginTurn,
    settleTurn,
    pageWidth,
    progress,
  });
  gestureCallbacks.current = { beginTurn, settleTurn, pageWidth, progress };
  const moveCorner = (direction: -1 | 1, dx: number) => {
    if (activeDirection.current !== direction || !busyRef.current) return;
    const width = gestureCallbacks.current.pageWidth;
    if (!width) return;
    // Dragging toward the spine exposes the page below; dragging back unfolds it.
    const amount = direction === 1 ? -dx : dx;
    const fraction = Math.max(0, Math.min(1, amount / (width * 0.84)));
    gestureProgress.current = fraction;
    gestureCallbacks.current.progress.setValue(fraction);
  };
  const moveCornerRef = useRef(moveCorner);
  moveCornerRef.current = moveCorner;
  const releaseCornerRef = useRef(
    (_direction: -1 | 1, _dx: number, _vx: number, _cancelled = false) => {},
  );
  releaseCornerRef.current = (direction, dx, vx, cancelled = false) => {
    if (activeDirection.current !== direction) return;
    const inwardVelocity = direction === 1 ? -vx : vx;
    const shouldComplete =
      !cancelled &&
      (gestureProgress.current >= 0.46 ||
        (gestureProgress.current >= 0.13 && inwardVelocity > 0.55));
    gestureCallbacks.current.settleTurn(shouldComplete);
  };
  const forwardPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureCallbacks.current.beginTurn(1);
      },
      onPanResponderMove: (_, gesture) => moveCornerRef.current(1, gesture.dx),
      onPanResponderRelease: (_, gesture) =>
        releaseCornerRef.current(1, gesture.dx, gesture.vx),
      onPanResponderTerminate: () => releaseCornerRef.current(1, 0, 0, true),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const backwardPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureCallbacks.current.beginTurn(-1);
      },
      onPanResponderMove: (_, gesture) => moveCornerRef.current(-1, gesture.dx),
      onPanResponderRelease: (_, gesture) =>
        releaseCornerRef.current(-1, gesture.dx, gesture.vx),
      onPanResponderTerminate: () => releaseCornerRef.current(-1, 0, 0, true),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  function openRecipe(title: string) {
    if (busyRef.current) return;
    selectRecipe(title);
    router.push("/recipes/recipe");
  }

  function removeRecipe(title: string) {
    if (busyRef.current) return;
    unsaveRecipe(title);
    const remaining = Math.max(0, saved.length - 1);
    const next = Math.min(pageRef.current, remaining);
    pageRef.current = next;
    setPageIndex(next);
  }

  function renderPage(index: number, interactive: boolean) {
    const recipe = index > 0 ? saved[index - 1] : undefined;
    if (!recipe) {
      return (
        <View style={styles.cover}>
          <View style={styles.coverBorder}>
            <View style={styles.coverTop}>
              <Ionicons
                name="restaurant-outline"
                size={30}
                color={P.heroMuted}
              />
              <Text style={styles.coverEyebrow}>KITCHENBUDDY PRESENTS</Text>
            </View>
            <View style={styles.coverCenter}>
              <Text style={styles.coverTitle}>My Recipe{"\n"}Book</Text>
              <View style={styles.coverRule} />
              <Text style={styles.coverSubtitle}>
                Collected favorites, kitchen memories & meals to return to.
              </Text>
            </View>
            <View style={styles.coverBottom}>
              <Text style={styles.coverCount}>
                {saved.length} {saved.length === 1 ? "RECIPE" : "RECIPES"}{" "}
                INSIDE
              </Text>
              <Text style={styles.coverEdition}>A PERSONAL COOKBOOK</Text>
            </View>
          </View>
        </View>
      );
    }

    const rawIngredients: unknown = recipe.ingredients;
    const ingredientPreview = Array.isArray(rawIngredients)
      ? rawIngredients
          .map(ingredientLabel)
          .filter((line): line is string => line !== null)
      : [];

    return (
      <View style={styles.recipePage}>
        <View style={styles.pageTopline}>
          <Text style={styles.pageEyebrow}>FROM MY KITCHEN</Text>
          <Ionicons name="bookmark" size={16} color={P.slate} />
        </View>
        <Pressable
          disabled={!interactive}
          accessibilityRole="button"
          accessibilityLabel={`Open ${recipe.title}`}
          onPress={() => openRecipe(recipe.title)}
          style={styles.recipeOpenArea}
        >
          <View style={styles.recipeImageWrap}>
            {recipe.image?.url ? (
              <Image
                source={{ uri: recipe.image.url }}
                resizeMode="cover"
                style={styles.recipeImage}
              />
            ) : (
              <View
                style={[
                  styles.recipeImagePlaceholder,
                  { backgroundColor: recipe.image?.avgColor ?? P.taupe },
                ]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={35}
                  color={P.slateDeep}
                />
              </View>
            )}
          </View>
          <Text style={styles.recipeTitle} numberOfLines={3}>
            {recipe.title}
          </Text>
          {!!recipe.servings && (
            <View style={styles.servingsRow}>
              <Ionicons name="people-outline" size={14} color={P.muted} />
              <Text style={styles.servingsText}>{recipe.servings}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.recipeDivider} />
        <Text style={styles.ingredientsHeading}>Ingredients</Text>
        {ingredientPreview.length > 0 ? (
          <View style={styles.ingredientList}>
            {ingredientPreview.slice(0, 4).map((line, i) => (
              <View key={`${i}:${line}`} style={styles.ingredientLine}>
                <View style={styles.ingredientDot} />
                <Text style={styles.ingredientText} numberOfLines={1}>
                  {line}
                </Text>
              </View>
            ))}
            {ingredientPreview.length > 4 && (
              <Text style={styles.moreIngredients}>
                + {ingredientPreview.length - 4} more in the full recipe
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.noIngredients}>
            Open this recipe for the full details.
          </Text>
        )}
        <View style={styles.recipePageBottom}>
          <Pressable
            disabled={!interactive}
            accessibilityRole="button"
            onPress={() => openRecipe(recipe.title)}
            style={({ pressed }) => [
              styles.readButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.readButtonText}>Read full recipe</Text>
            <Ionicons name="arrow-forward" size={15} color={P.heroText} />
          </Pressable>
          <Pressable
            disabled={!interactive}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${recipe.title} from saved recipes`}
            onPress={() => removeRecipe(recipe.title)}
            style={({ pressed }) => [
              styles.removeButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="trash-outline" size={15} color={P.danger} />
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
        <View style={styles.printedPageNumber}>
          <Text style={styles.printedPageText}>
            — {String(index).padStart(2, "0")} —
          </Text>
        </View>
      </View>
    );
  }

  // A left-edge hinge turns the page forward; a right-edge hinge reverses it.
  // Offsetting by half the measured sheet width avoids the center-pivot/card look.
  const forward = !turn || turn.direction === 1;
  const angle = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", forward ? "-178deg" : "178deg"],
  });
  // Android can briefly draw BOTH 3D faces around the 90° point even when
  // backfaceVisibility is hidden. Explicitly gate the faces on the native
  // animation thread, switching while the sheet is edge-on.
  const frontOpacity = progress.interpolate({
    inputRange: [0, 0.475, 0.499, 0.501, 1],
    outputRange: [1, 1, 0, 0, 0],
  });
  const backOpacity = progress.interpolate({
    inputRange: [0, 0.499, 0.501, 0.525, 1],
    outputRange: [0, 0, 0, 1, 1],
  });
  const sheetShade = progress.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1],
    outputRange: [0, 0.08, 0.22, 0.1, 0],
  });
  const revealedShade = progress.interpolate({
    inputRange: [0, 0.3, 0.65, 1],
    outputRange: [0.27, 0.22, 0.08, 0],
  });
  const hingeOffset = forward ? -pageWidth / 2 : pageWidth / 2;
  const hingeTransform = [
    { perspective: 1300 },
    { translateX: hingeOffset },
    { rotateY: angle },
    { translateX: -hingeOffset },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bookOuter}>
          <View style={styles.pageStackBack} />
          <View style={styles.pageStackMiddle} />
          <View
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0 && width !== pageWidth) setPageWidth(width);
            }}
            style={styles.bookFrame}
          >
            {/* The next page is physically underneath the turning sheet. */}
            <View
              pointerEvents={turn ? "none" : "auto"}
              style={styles.staticPage}
            >
              {renderPage(turn ? turn.to : pageIndex, !turn)}
              {turn && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.revealShadow, { opacity: revealedShade }]}
                />
              )}
            </View>

            {turn && (
              <Animated.View
                pointerEvents="none"
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                style={[styles.turnSheet, { transform: hingeTransform }]}
              >
                <Animated.View
                  collapsable={false}
                  style={[
                    styles.sheetFace,
                    styles.sheetFront,
                    { opacity: frontOpacity },
                  ]}
                >
                  {renderPage(turn.from, false)}
                  <Animated.View
                    style={[styles.sheetFrontShade, { opacity: sheetShade }]}
                  />
                  <View
                    style={[
                      styles.paperEdge,
                      forward ? styles.paperEdgeRight : styles.paperEdgeLeft,
                    ]}
                  />
                </Animated.View>
                {/* Only the reverse paper face is visible after the hinge midpoint. */}
                <Animated.View
                  collapsable={false}
                  style={[
                    styles.sheetFace,
                    styles.sheetBack,
                    { opacity: backOpacity },
                  ]}
                >
                  <View style={styles.paperReverse}>
                    <View style={styles.reverseBorder}>
                      <Ionicons name="leaf-outline" size={29} color="#B6AFA3" />
                      <Text style={styles.reverseTitle}>KitchenBuddy</Text>
                      <View style={styles.reverseRule} />
                      <Text style={styles.reverseCaption}>
                        A PAGE FROM MY RECIPE BOOK
                      </Text>
                    </View>
                  </View>
                  <Animated.View
                    style={[styles.sheetBackShade, { opacity: sheetShade }]}
                  />
                </Animated.View>
              </Animated.View>
            )}
            {/* Keep the corner targets mounted while dragging. Removing the responder
                midway through a gesture can cancel it on Android. */}
            <View
              {...backwardPan.panHandlers}
              pointerEvents={
                pageIndex > 0 && (!turn || turn.direction === -1)
                  ? "auto"
                  : "none"
              }
              style={[
                styles.cornerHandle,
                styles.leftCorner,
                (pageIndex === 0 || (turn && turn.direction !== -1)) &&
                  styles.cornerHidden,
              ]}
              accessible
              accessibilityLabel="Drag the lower-left page corner right to turn back"
            >
              <Ionicons
                name="arrow-undo-outline"
                size={18}
                color={P.slateDeep}
              />
              <Text style={styles.cornerCaption}>FLIP</Text>
            </View>
            <View
              {...forwardPan.panHandlers}
              pointerEvents={
                pageIndex < saved.length && (!turn || turn.direction === 1)
                  ? "auto"
                  : "none"
              }
              style={[
                styles.cornerHandle,
                styles.rightCorner,
                (pageIndex >= saved.length || (turn && turn.direction !== 1)) &&
                  styles.cornerHidden,
              ]}
              accessible
              accessibilityLabel="Drag the lower-right page corner left to turn forward"
            >
              <Ionicons
                name="arrow-redo-outline"
                size={18}
                color={P.slateDeep}
              />
              <Text style={styles.cornerCaption}>FLIP</Text>
            </View>
          </View>
          <View pointerEvents="none" style={styles.bookSpine} />
        </View>

        <View style={styles.gestureHint}>
          <Ionicons name="hand-left-outline" size={14} color={P.slate} />
          <Text style={styles.gestureHintText}>
            Hold a bottom corner and drag to turn the page
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous cookbook page"
            disabled={pageIndex === 0 || !!turn}
            onPress={() => changePage(-1)}
            style={({ pressed }) => [
              styles.turnButton,
              (pageIndex === 0 || !!turn) && styles.turnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={19} color={P.slateDeep} />
            <Text style={styles.turnLabel}>Previous</Text>
          </Pressable>
          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorMain}>
              {pageIndex === 0 ? "Cover" : `Recipe ${pageIndex}`}
            </Text>
            <Text style={styles.pageIndicatorSub}>
              {pageIndex + 1} of {saved.length + 1} pages
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next cookbook page"
            disabled={pageIndex >= saved.length || !!turn}
            onPress={() => changePage(1)}
            style={({ pressed }) => [
              styles.turnButton,
              (pageIndex >= saved.length || !!turn) && styles.turnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.turnLabel}>Next</Text>
            <Ionicons name="chevron-forward" size={19} color={P.slateDeep} />
          </Pressable>
        </View>

        {saved.length === 0 && (
          <View style={styles.emptyNote}>
            <Ionicons name="bookmark-outline" size={21} color={P.slate} />
            <Text style={styles.emptyText}>
              Your book is waiting for its first recipe. Save a favorite to
              start filling its pages.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={styles.exploreButton}
              accessibilityRole="button"
            >
              <Text style={styles.exploreText}>Explore recipes</Text>
              <Ionicons name="arrow-forward" size={15} color={P.slateDeep} />
            </Pressable>
          </View>
        )}
        <Text style={styles.footer}>KITCHENBUDDY · A COLLECTION TO KEEP</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.background },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 56 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 23,
    gap: 12,
  },
  headingIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: P.taupe,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: P.slate,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headingTitle: {
    color: P.ink,
    fontFamily: "serif",
    fontSize: 29,
    fontWeight: "700",
  },
  headingDescription: {
    color: P.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  bookOuter: { paddingLeft: 7, paddingRight: 5, paddingBottom: 8 },
  pageStackBack: {
    position: "absolute",
    top: 9,
    bottom: 0,
    left: 14,
    right: 0,
    borderRadius: 17,
    backgroundColor: "#DCD5CA",
    borderWidth: 1,
    borderColor: "#D3CCC2",
  },
  pageStackMiddle: {
    position: "absolute",
    top: 5,
    bottom: 4,
    left: 10,
    right: 3,
    borderRadius: 17,
    backgroundColor: "#EEE9DF",
    borderWidth: 1,
    borderColor: "#DCD5CA",
  },
  bookFrame: { height: 530, marginLeft: 0, marginRight: 0 },
  staticPage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    elevation: 2,
  },
  turnSheet: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "visible",
    elevation: 5,
  },
  sheetFace: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: P.border,
    backfaceVisibility: "visible",
  },
  sheetFront: { backgroundColor: P.paper },
  sheetBack: { backgroundColor: "#F3EFE6", transform: [{ rotateY: "180deg" }] },
  sheetFrontShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#332E27",
  },
  sheetBackShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#332E27",
  },
  revealShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#342E27",
  },
  paperEdge: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 5,
    backgroundColor: "rgba(142,129,107,0.23)",
  },
  paperEdgeRight: {
    right: 0,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
  },
  paperEdgeLeft: {
    left: 0,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  paperReverse: { flex: 1, backgroundColor: "#F2EDE4", padding: 19 },
  reverseBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DAD2C7",
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },
  reverseTitle: {
    color: "#A59D91",
    fontFamily: "serif",
    fontSize: 27,
    marginTop: 12,
  },
  reverseRule: {
    width: 65,
    height: 1,
    backgroundColor: "#CFC5B9",
    marginTop: 20,
    marginBottom: 17,
  },
  reverseCaption: {
    color: "#A59D91",
    fontSize: 9,
    letterSpacing: 1.4,
    textAlign: "center",
  },
  cornerHandle: {
    position: "absolute",
    bottom: 0,
    width: 62,
    height: 47,
    zIndex: 20,
    elevation: 8,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 1,
    paddingBottom: 4,
    backgroundColor: "rgba(232,226,218,0.78)",
    borderTopWidth: 1,
    borderTopColor: "rgba(88,109,119,0.17)",
  },
  leftCorner: { left: 0, borderTopRightRadius: 58 },
  rightCorner: { right: 0, borderTopLeftRadius: 58 },
  cornerHidden: { opacity: 0 },
  cornerCaption: {
    fontSize: 8,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: P.slateDeep,
  },
  gestureHint: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  gestureHintText: { fontSize: 11, color: P.muted, textAlign: "center" },
  bookSpine: {
    position: "absolute",
    width: 8,
    left: 7,
    top: 5,
    bottom: 10,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: "rgba(41,45,44,0.17)",
    borderRightWidth: 1,
    borderRightColor: "rgba(41,45,44,0.1)",
  },
  cover: { flex: 1, backgroundColor: P.slateDeep, padding: 16 },
  coverBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    borderRadius: 7,
    paddingHorizontal: 20,
    paddingVertical: 26,
    justifyContent: "space-between",
  },
  coverTop: { alignItems: "center", gap: 13 },
  coverEyebrow: {
    color: P.heroMuted,
    fontSize: 9,
    letterSpacing: 2.2,
    fontWeight: "800",
    textAlign: "center",
  },
  coverCenter: { alignItems: "center", paddingVertical: 26 },
  coverTitle: {
    fontFamily: "serif",
    color: P.heroText,
    fontSize: 43,
    lineHeight: 52,
    fontWeight: "700",
    textAlign: "center",
  },
  coverRule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    width: 83,
    marginVertical: 22,
  },
  coverSubtitle: {
    color: P.heroMuted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 220,
  },
  coverBottom: { alignItems: "center", gap: 12 },
  coverCount: {
    color: P.heroText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  coverEdition: { color: P.heroMuted, fontSize: 9, letterSpacing: 1.5 },
  recipePage: {
    flex: 1,
    paddingHorizontal: 23,
    paddingTop: 20,
    paddingBottom: 47,
  },
  pageTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pageEyebrow: {
    color: P.slate,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  recipeOpenArea: { alignItems: "flex-start" },
  recipeImageWrap: {
    height: 145,
    width: "100%",
    backgroundColor: P.taupe,
    borderRadius: 11,
    overflow: "hidden",
    marginBottom: 14,
  },
  recipeImage: { width: "100%", height: "100%" },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTitle: {
    fontFamily: "serif",
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 28,
    color: P.ink,
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  servingsText: { color: P.muted, fontSize: 11 },
  recipeDivider: {
    height: 1,
    backgroundColor: P.border,
    marginTop: 12,
    marginBottom: 10,
  },
  ingredientsHeading: {
    fontFamily: "serif",
    fontSize: 17,
    color: P.ink,
    fontWeight: "700",
    marginBottom: 7,
  },
  ingredientList: { gap: 5 },
  ingredientLine: { flexDirection: "row", gap: 9, alignItems: "center" },
  ingredientDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: P.slate,
  },
  ingredientText: { flex: 1, color: P.ink, fontSize: 11, lineHeight: 16 },
  moreIngredients: {
    color: P.slate,
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 3,
  },
  noIngredients: { color: P.muted, fontSize: 11, lineHeight: 17 },
  recipePageBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 12,
    gap: 8,
  },
  readButton: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.slateDeep,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    flexShrink: 1,
  },
  readButtonText: { color: P.heroText, fontSize: 11, fontWeight: "800" },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: P.dangerSoft,
    borderRadius: 10,
  },
  removeText: { fontSize: 11, fontWeight: "700", color: P.danger },
  printedPageNumber: { alignItems: "center", paddingTop: 9 },
  printedPageText: { color: P.muted, fontFamily: "serif", fontSize: 11 },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 5,
    marginTop: 17,
  },
  turnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    minHeight: 43,
  },
  turnDisabled: { opacity: 0.36 },
  turnLabel: { fontWeight: "700", fontSize: 12, color: P.slateDeep },
  pageIndicator: { alignItems: "center", flex: 1 },
  pageIndicatorMain: {
    fontFamily: "serif",
    fontWeight: "700",
    color: P.ink,
    fontSize: 15,
  },
  pageIndicatorSub: { fontSize: 10, color: P.muted, marginTop: 3 },
  emptyNote: {
    alignItems: "center",
    padding: 19,
    backgroundColor: P.paper,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 17,
    marginTop: 24,
    gap: 10,
  },
  emptyText: {
    color: P.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  exploreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 8,
  },
  exploreText: { fontSize: 12, color: P.slateDeep, fontWeight: "800" },
  footer: {
    marginTop: 30,
    textAlign: "center",
    color: P.muted,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  pressed: { opacity: 0.7 },
});
