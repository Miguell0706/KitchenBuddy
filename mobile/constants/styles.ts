// constants/styles.ts
import { StyleSheet } from "react-native";
import { Colors, Spacing, Radius, FontSize, Shadow } from "@/constants/theme";

export const Screen = StyleSheet.create({
  /** Full-screen base container with app background */
  full: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /** Centered content (good for empty states, loaders, etc.) */
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },

  /** Scrollable screen padding preset (if used with ScrollView contentContainerStyle) */
  padded: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});

export const TextStyles = StyleSheet.create({
  appTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.text,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  bodyMuted: {
    fontSize: FontSize.md,
    color: Colors.textLight,
  },
  small: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  badge: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.text,
  },
});

export const Layout = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowEnd: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  column: {
    flexDirection: "column",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: Spacing.sm,
  },
});

export const CardStyles = StyleSheet.create({
  base: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  pantryItem: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  subtle: {
    backgroundColor: "#FFFFFFCC",
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
});

export const ButtonStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  ghost: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  ghostText: {
    fontSize: FontSize.md,
    fontWeight: "500",
    color: Colors.text,
  },
  iconButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    ...Shadow.card,
  },
});

export const TagStyles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  danger: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.danger,
  },
  success: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.success,
  },
  textLight: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  textDark: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.text,
  },
});
