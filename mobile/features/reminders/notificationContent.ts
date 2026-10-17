import type { PantryItem } from "@/features/pantry/types";

export type ReminderCopy = { title: string; body: string };

export function expiryReminderCopy(
  item: Pick<PantryItem, "name">,
  leadDays: number,
): ReminderCopy {
  const name = item.name.trim() || "A pantry item";
  if (leadDays === 1)
    return {
      title: `${name} expires tomorrow`,
      body: `A little kitchen heads-up: use ${name} while it's fresh, or find a recipe for it.`,
    };
  return {
    title: `Plan ahead: ${name}`,
    body: `${name} expires in ${leadDays} days. There is still time to put it to good use.`,
  };
}

export const WATER_MESSAGES: readonly ReminderCopy[] = [
  {
    title: "A little hydration break 💧",
    body: "Take a moment and enjoy a glass of water.",
  },
  {
    title: "Time to refresh 💧",
    body: "A gentle nudge from KitchenBuddy: have some water.",
  },
  {
    title: "Your water reminder 💧",
    body: "Pause for a few sips, then get back to your day.",
  },
  {
    title: "Make room for a sip 💧",
    body: "If it's a good moment, pour yourself some water.",
  },
];

export function waterReminderCopy(slotIndex: number): ReminderCopy {
  return WATER_MESSAGES[
    ((slotIndex % WATER_MESSAGES.length) + WATER_MESSAGES.length) %
      WATER_MESSAGES.length
  ];
}

export const EXPIRY_CATEGORY = "kbExpiryActions";
export const WATER_CATEGORY = "kbWaterActions";
export const ACTION_VIEW_PANTRY = "kbViewPantry";
export const ACTION_FIND_RECIPE = "kbFindRecipe";
export const ACTION_EXPIRY_LATER = "kbExpiryLater";
export const ACTION_WATER_DONE = "kbWaterDone";
export const ACTION_WATER_LATER = "kbWaterLater";

// Versioned sound/silent IDs: Android will not let an existing channel change its sound.
export function expiryChannelId(sound: boolean): string {
  return sound ? "kb_expiry_sound_v1" : "kb_expiry_silent_v1";
}
export function waterChannelId(sound: boolean): string {
  return sound ? "kb_water_sound_v1" : "kb_water_silent_v1";
}
