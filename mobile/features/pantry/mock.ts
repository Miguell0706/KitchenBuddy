import type { PantryItem, CategoryKey } from "./types";

export const MOCK_PANTRY: Record<CategoryKey, PantryItem[]> = {
  produce: [
    { id: "1", name: "Apples", quantity: "6", expiresInDays: 7 },
    { id: "2", name: "Spinach", quantity: "1 bag", expiresInDays: 2 },
  ],
  meatSeafood: [
    { id: "3", name: "Chicken Breast", quantity: "2 lbs", expiresInDays: 3 },
    { id: "4", name: "Ground Beef", quantity: "1 lb", expiresInDays: 1 },
  ],
  dairyEggs: [
    { id: "5", name: "Milk", quantity: "1 gal", expiresInDays: 4 },
    { id: "6", name: "Cheddar Cheese", quantity: "0.5 lb", expiresInDays: 14 },
    { id: "6b", name: "Eggs", quantity: "12 count", expiresInDays: 10 },
  ],
  bakery: [{ id: "10", name: "Sourdough Bread", quantity: "1 loaf", expiresInDays: 3 }],
  pantry: [
    { id: "7", name: "Rice", quantity: "5 lbs", expiresInDays: 120 },
    { id: "8", name: "Black Beans (canned)", quantity: "4 cans", expiresInDays: 365 },
  ],
  condiments: [
    { id: "11", name: "Mayo", quantity: "1 jar", expiresInDays: -2 },
    { id: "12", name: "Soy Sauce", quantity: "1 bottle", expiresInDays: 180 },
  ],
  spices: [
    { id: "13", name: "Garlic Powder", quantity: "1 jar", expiresInDays: 365 },
    { id: "14", name: "Cinnamon", quantity: "1 jar", expiresInDays: 365 },
  ],
  beverages: [
    { id: "15", name: "Orange Juice", quantity: "1 bottle", expiresInDays: 6 },
    { id: "16", name: "Coffee", quantity: "1 bag", expiresInDays: 90 },
  ],
  frozen: [{ id: "9", name: "Frozen Berries", quantity: "1 bag", expiresInDays: 60 }],
  snacks: [
    { id: "17", name: "Tortilla Chips", quantity: "1 bag", expiresInDays: 21 },
    { id: "18", name: "Dark Chocolate", quantity: "2 bars", expiresInDays: 180 },
  ],
  pet: [],
  household: [
    { id: "19", name: "Paper Towels", quantity: "6 rolls", expiresInDays: 9999 },
    { id: "20", name: "Dish Soap", quantity: "1 bottle", expiresInDays: 9999 },
  ],
  supplements: [{ id: "21", name: "Creatine", quantity: "1 tub", expiresInDays: 9999 }],
};
