// features/pantry/useDefaultExpiry.ts
import { useSettingsStore } from "@/features/settings/store";
import { CATEGORY_DEFAULT_EXPIRY } from "@/features/pantry/constants";
import type { CategoryKey } from "@/features/pantry/types";

export function useDefaultExpiry(categoryKey: CategoryKey) {
  const overrides = useSettingsStore((s) => s.expiryOverrides);
  return overrides[categoryKey] ?? CATEGORY_DEFAULT_EXPIRY[categoryKey];
}
