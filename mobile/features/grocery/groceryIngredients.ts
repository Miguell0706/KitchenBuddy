export type RecipeIngredient = {
  name: string;
  quantity: number;
  unit: string;
};

export type GroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  createdAt: number;
  quantity?: number;
  unit?: string;
  sourceRecipe?: string;
  originalText?: string;
};

export const GROCERY_STORAGE_KEY = "@kb_grocery_list_v1";

// Standardize ingredient names.
export function normalizeIngredient(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

// Remove preparation instructions.
// "Carrots; diced" -> "Carrots"
export function cleanIngredientName(name: string): string {
  return name.split(";")[0].trim();
}

// Recognized measurement units.
// Only remove these when they appear immediately after a quantity.
const unitAliases: Record<string, string> = {
  cup: "cup",
  cups: "cup",
  c: "cup",

  tbsp: "tablespoon",
  tbsps: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",

  tsp: "teaspoon",
  tsps: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",

  lb: "pound",
  lbs: "pound",
  pound: "pound",
  pounds: "pound",

  oz: "ounce",
  ounce: "ounce",
  ounces: "ounce",

  g: "gram",
  gram: "gram",
  grams: "gram",

  kg: "kilogram",
  kilogram: "kilogram",
  kilograms: "kilogram",

  ml: "milliliter",
  milliliter: "milliliter",
  milliliters: "milliliter",

  liter: "liter",
  liters: "liter",

  pint: "pint",
  pints: "pint",

  clove: "clove",
  cloves: "clove",

  can: "can",
  cans: "can",

  package: "package",
  packages: "package",

  bunch: "bunch",
  bunches: "bunch",

  stalk: "stalk",
  stalks: "stalk",

  slice: "slice",
  slices: "slice",

  piece: "piece",
  pieces: "piece",

  unit: "unit",
  units: "unit",
};

const fractions: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseNumber(value: string): number | undefined {
  if (value in fractions) return fractions[value];

  if (value.includes("/")) {
    const [a, b] = value.split("/").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      return a / b;
    }
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

// Separate ingredient text into name, quantity and unit.
//
// "0.5 cup Milk"
// -> { name: "Milk", quantity: 0.5, unit: "cup" }
//
// "3 Carrots; diced"
// -> { name: "Carrots", quantity: 3, unit: undefined }
export function parseIngredient(text: string): {
  name: string;
  quantity?: number;
  unit?: string;
  originalText: string;
} {
  const originalText = text.trim();
  const cleaned = cleanIngredientName(originalText);

  const match = cleaned.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)(.*)$/u,
  );

  if (!match) {
    return {
      name: cleaned,
      originalText,
    };
  }

  const amountText = match[1];
  let remaining = match[2].trim();

  let quantity: number | undefined;

  // Handle mixed fractions such as "1 1/2".
  const mixed = amountText.match(/^(\d+)\s+(\d+\/\d+)$/);

  if (mixed) {
    const whole = Number(mixed[1]);
    const fraction = parseNumber(mixed[2]);

    if (fraction !== undefined) {
      quantity = whole + fraction;
    }
  } else {
    quantity = parseNumber(amountText);
  }

  if (quantity === undefined) {
    return { name: cleaned, originalText };
  }

  let unit: string | undefined;

  const firstWord = remaining.match(/^([a-zA-Z]+)\b/);

  if (firstWord) {
    const recognizedUnit = unitAliases[firstWord[1].toLowerCase()];

    if (recognizedUnit) {
      unit = recognizedUnit;
      remaining = remaining.slice(firstWord[0].length).trim();
    }
  }

  // Handle "2 cups of flour".
  if (unit && /^of\s+/i.test(remaining)) {
    remaining = remaining.replace(/^of\s+/i, "");
  }

  // Avoid creating a grocery item with an empty name.
  if (!remaining) {
    return {
      name: cleaned,
      originalText,
    };
  }

  return {
    name: remaining,
    quantity,
    unit,
    originalText,
  };
}

const irregularPlurals: Record<string, string> = {
  tomatoes: "tomato",
  potatoes: "potato",
  berries: "berry",
  cherries: "cherry",
  leaves: "leaf",
  knives: "knife",
};

function singularize(word: string): string {
  if (irregularPlurals[word]) {
    return irregularPlurals[word];
  }

  if (word.endsWith("ies") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }

  // Conservative plural handling.
  if (
    word.length > 3 &&
    word.endsWith("s") &&
    !word.endsWith("ss") &&
    !word.endsWith("us") &&
    !word.endsWith("is")
  ) {
    return word.slice(0, -1);
  }

  return word;
}

// Generate a standardized comparison key.
//
// "3 Carrots" -> "carrot"
// "Carrots"   -> "carrot"
// "2 cup Milk" -> "milk"
export function ingredientKey(name: string): string {
  const parsed = parseIngredient(name);

  const normalized = normalizeIngredient(parsed.name);

  return normalized.split(" ").filter(Boolean).map(singularize).join(" ");
}

// Validate grocery items loaded from storage.
export function isGroceryItem(value: unknown): value is GroceryItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<GroceryItem>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.checked === "boolean" &&
    typeof item.createdAt === "number"
  );
}

// Display grocery items without duplicating quantity.
// Also supports older saved entries that contain the full
// ingredient text inside their name.
export function displayGroceryItem(item: GroceryItem): string {
  const parsed = parseIngredient(item.name);

  const name = parsed.name;

  const quantity =
    item.quantity !== undefined ? item.quantity : parsed.quantity;

  const unit = item.unit !== undefined ? item.unit : parsed.unit;

  if (quantity === undefined) return name;

  const unitText = unit && unit.toLowerCase() !== "unit" ? `${unit} ` : "";

  return `${quantity} ${unitText}${name}`;
}
