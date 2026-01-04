import type { CategoryKey } from "./types";

/**
 * Ordered keyword rules.
 * First match wins.
 * Keep this file data-driven and dumb.
 */
const IGNORE_EXACT = new Set([
  "meat",
  "produce",
  "dairy",
  "bakery",
  "seafood",
]);

const IGNORE_CONTAINS: readonly string[] = [
  "memphis",
  "tennessee",
  "store",
  "manager",
  "receipt",
  "subtotal",
  "total",
  "balance due",
  "change",
  "survey",
];

const BRAND_ONLY: readonly string[] = [
  "starbucks",
  "pillsbury",
  "silk",
  "nasoya",
  // add more as you encounter them
];

function isProbablyNotAnItem(nSpaced: string) {
  if (IGNORE_EXACT.has(nSpaced)) return true;

  // “brand-only” heuristic: single token that matches known brands
  if (!nSpaced.includes(" ")) {
    if (BRAND_ONLY.includes(nSpaced)) return true;
  }

  for (const bad of IGNORE_CONTAINS) {
    if (nSpaced.includes(bad)) return true;
  }
  return false;
}

export const CATEGORY_RULES: ReadonlyArray<{
  category: CategoryKey;
  keywords: readonly string[];
}> = [
  // ---------------- PRODUCE ----------------
  {
    category: "produce",
    keywords: [
      // fruits
      "apple", "banana", "orange", "lemon", "lime",
      "grape", "pear", "peach", "plum", "nectarine",
      "strawberry", "blueberry", "raspberry", "blackberry",
      "melon", "watermelon", "cantaloupe",
      "pineapple", "mango", "kiwi",

      // vegetables
      "lettuce", "spinach", "kale", "arugula",
      "onion", "red onion", "white onion", "yellow onion",
      "tomato", "roma tomato", "cherry tomato",
      "garlic", "ginger",
      "bell pepper", "jalapeno", "serrano", "habanero",
      "carrot", "celery", "cucumber", "zucchini",
      "broccoli", "cauliflower", "asparagus",
      "avocado", "eggplant",
      "potato", "sweet potato", "yam",
      "mushroom", "portobello", "shiitake",
      "corn", "green bean", "snap pea",'salad','salads'
    ],
  },

  // ---------------- MEAT & SEAFOOD ----------------
  {
    category: "meatSeafood",
    keywords: [
      "chicken", "chicken breast", "chicken thigh",
      "beef", "ground beef", "steak",
      "pork", "pork chop", "ham", "bacon",
      "sausage", "bratwurst",
      "turkey", "ground turkey",
      "lamb", "veal","bbq chunks",
      "chunks","tenders","nuggets","wings",
      "chicken","pork","beef",

      // seafood
      "fish", "salmon", "tuna", "cod", "tilapia",
      "shrimp", "prawn", "crab", "lobster",
      "scallop", "mussel",
    ],
  },

  // ---------------- DAIRY & EGGS ----------------
  {
    category: "dairyEggs",
    keywords: [
      "milk", "whole milk", "skim milk", "2% milk",
      "cheese", "shredded cheese", "slice cheese",
      "cheddar", "mozzarella", "parmesan", "swiss",
      "butter", "margarine",
      "cream", "heavy cream", "half and half",
      "yogurt", "greek yogurt",
      "egg", "eggs", "egg whites",
      "sour cream", "cream cheese","silk oat", "silk almond", "silk soy",
    ],
  },

  // ---------------- BAKERY ----------------
  {
    category: "bakery",
    keywords: [
      "bread", "white bread", "wheat bread",
      "bun", "burger bun", "hot dog bun",
      "bagel", "roll", "loaf",
      "tortilla", "flour tortilla", "corn tortilla",
      "naan", "pita",
      "croissant", "danish", "muffin",
      "cake", "cupcake", "donut",
    ],
  },

  // ---------------- CONDIMENTS & SAUCES ----------------
  {
    category: "condiments",
    keywords: [
      "ketchup", "mustard", "mayo", "mayonnaise",
      "soy sauce", "teriyaki",
      "hot sauce", "sriracha",
      "bbq", "barbecue",
      "dressing", "ranch", "vinaigrette",
      "vinegar", "balsamic",
      "relish", "chutney",
    ],
  },

  // ---------------- SPICES & SEASONINGS ----------------
  {
    category: "spices",
    keywords: [
      "salt", "sea salt", "kosher salt",
      "pepper", "black pepper",
      "paprika", "cumin", "coriander",
      "oregano", "basil", "thyme", "rosemary",
      "cinnamon", "nutmeg",
      "chili powder", "garlic powder", "onion powder",
       "seasoning", "rub",
    ],
  },

  // ---------------- BEVERAGES ----------------
  {
    category: "beverages",
    keywords: [
      "water", "sparkling water", "mineral water",
      "juice", "orange juice", "apple juice",
      "soda", "cola", "pop",
      "coffee", "ground coffee", "coffee beans",
      "tea", "green tea", "black tea",
      "energy drink",
      "beer", "wine", "cider",
    ],
  },

  // ---------------- FROZEN ----------------
  {
    category: "frozen",
    keywords: [
      "frozen",
      "ice cream", "icecream",
      "popsicle", "frozen bar",
      "frozen pizza",
      "frozen dinner",
      "frozen vegetable",
    ],
  },

  // ---------------- SNACKS & SWEETS ----------------
  {
    category: "snacks",
    keywords: [
      "chip", "chips", "potato chip",
      "cracker", "crackers",
      "cookie", "cookies",
      "candy", "chocolate",
      "snack", "snack bar",
      "granola", "granola bar",
      "pretzel", "popcorn",
    ],
  },

  // ---------------- PET ----------------
  {
    category: "pet",
    keywords: [
      "dog", "dog food", "dog treat",
      "cat", "cat food", "cat litter",
      "pet", "kibble",
    ],
  },

  // ---------------- HOUSEHOLD ----------------
  {
    category: "household",
    keywords: [
      "soap", "dish soap", "hand soap",
      "detergent", "laundry detergent",
      "cleaner", "disinfectant",
      "paper towel", "toilet paper",
      "napkin", "tissue",
      "trash bag", "garbage bag",
      "foil", "aluminum foil",
      "plastic wrap", "cling wrap",
      "sponge",
    ],
  },

  // ---------------- SUPPLEMENTS ----------------
  {
    category: "supplements",
    keywords: [
      "vitamin", "multivitamin",
      "supplement",
      "protein", "protein powder",
      "omega", "omega 3",
      "collagen",
      "creatine",
    ],
  },
];

function normalizeForMatch(s: string) {
  // lower + keep letters/numbers/spaces, turn everything else into spaces
  const lower = s.toLowerCase();
  const spaced = lower.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const compact = spaced.replace(/\s+/g, ""); // remove spaces entirely
  return { spaced, compact };
}

function keywordForms(keyword: string) {
  const { spaced, compact } = normalizeForMatch(keyword);
  return { spaced, compact };
}
export function inferCategoryFromName(name: string): CategoryKey {
  const { spaced: nSpaced, compact: nCompact } = normalizeForMatch(name);
  if (!nSpaced) return "pantry";
  if (isProbablyNotAnItem(nSpaced)) return "pantry";

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      const { spaced: kSpaced, compact: kCompact } = keywordForms(kw);

      // match with spaces OR without spaces
      if (nSpaced.includes(kSpaced) || nCompact.includes(kCompact)) {
        return rule.category;
      }
    }
  }

  return "pantry";
}