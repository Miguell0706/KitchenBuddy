export type PantryItem = {
  id: string;
  name: string;
  quantity: string;
  categoryKey: CategoryKey;
  expiryDate: string | null;
};

export type CategoryKey =
  | "produce"
  | "meatSeafood"
  | "dairyEggs"
  | "bakery"
  | "pantry"
  | "condiments"
  | "spices"
  | "beverages"
  | "frozen"
  | "snacks"
  | "pet"
  | "household"
  | "supplements";
