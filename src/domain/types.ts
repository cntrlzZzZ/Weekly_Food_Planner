export type Unit = "g" | "ml" | "piece";

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Ingredient = {
  id: string;
  name: string;
  category:
    | "protein"
    | "veg"
    | "fruit"
    | "carb"
    | "dairy"
    | "pantry"
    | "fat"
    | "other";
  unitDefault: Unit;
  per100g?: MacroTotals;
  perPiece?: MacroTotals;
};

export type Portion = {
  ingredientId: string;
  amount: number;
  unit: Unit;
};

export type Recipe = {
  id: string;
  name: string;
  mealType: "breakfast" | "snack" | "lunch" | "dinner";
  portions: Portion[];
  tags?: string[];
};

export type ComponentGroup = "base" | "protein" | "veg" | "sauce" | "extras";

export type ComponentOption = {
  id: string;
  group: ComponentGroup;
  name: string;
  portions: Portion[];
  tags?: string[];
};

export type PortionOverrides = Record<string, number>;

export type MealSelection =
  | { kind: "recipe"; recipeId: string; overrides?: PortionOverrides }
  | { kind: "components"; optionIds: string[]; overrides?: PortionOverrides };

export type DayPlan = {
  id: string;
  label: string;
  breakfast?: MealSelection;
  preWorkoutSnack?: MealSelection;
  lunch?: MealSelection;
  dinner?: MealSelection;
  afterDinnerTreat?: MealSelection;
};

export type WeeklyPlan = {
  days: DayPlan[];
  targets: {
    kcal: number;
    protein: number;
    carbs?: number;
    fat?: number;
  };
};

export type ShoppingListItem = {
  ingredientId: string;
  name: string;
  category: Ingredient["category"];
  totalAmount: number;
  unit: Unit;
};