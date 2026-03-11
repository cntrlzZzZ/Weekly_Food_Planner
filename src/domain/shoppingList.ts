import type {
  Ingredient,
  MealSelection,
  Portion,
  Recipe,
  ShoppingListItem,
  WeeklyPlan,
  ComponentOption,
} from "./types";

function applyOverride(portions: Portion[], overrides: Record<string, number> | undefined, keyFn: (i: number) => string) {
  if (!overrides) return portions;
  return portions.map((p, i) => {
    const k = keyFn(i);
    if (overrides[k] === undefined) return p;
    return { ...p, amount: overrides[k] };
  });
}

function flattenSelection(
  sel: MealSelection | undefined,
  recipes: Map<string, Recipe>,
  options: Map<string, ComponentOption>
): Portion[] {
  if (!sel) return [];

  if (sel.kind === "recipe") {
    const r = recipes.get(sel.recipeId);
    if (!r) return [];
    return applyOverride(r.portions, sel.overrides, (i) => `${i}`);
  }

  // components
  const portions: Portion[] = [];
  for (const id of sel.optionIds) {
    const opt = options.get(id);
    if (!opt) continue;
    const withOverride = applyOverride(opt.portions, sel.overrides, (i) => `${id}:${i}`);
    portions.push(...withOverride);
  }
  return portions;
}

export function buildShoppingList(
  plan: WeeklyPlan,
  ingredients: Map<string, Ingredient>,
  recipes: Map<string, Recipe>,
  options: Map<string, ComponentOption>
): ShoppingListItem[] {
  const acc = new Map<string, ShoppingListItem>();

  for (const day of plan.days) {
    const dayPortions = [
      ...flattenSelection(day.breakfast, recipes, options),
      ...flattenSelection(day.preWorkoutSnack, recipes, options),
      ...flattenSelection(day.lunch, recipes, options),
      ...flattenSelection(day.dinner, recipes, options),
      ...flattenSelection(day.afterDinnerTreat, recipes, options),
    ];

    for (const p of dayPortions) {
      const ing = ingredients.get(p.ingredientId);
      if (!ing) continue;

      const key = `${p.ingredientId}:${p.unit}`;
      const existing = acc.get(key);

      if (!existing) {
        acc.set(key, {
          ingredientId: p.ingredientId,
          name: ing.name,
          category: ing.category,
          totalAmount: p.amount,
          unit: p.unit,
        });
      } else {
        existing.totalAmount += p.amount;
      }
    }
  }

  return Array.from(acc.values()).sort((a, b) => {
    if (a.category === b.category) return a.name.localeCompare(b.name);
    return a.category.localeCompare(b.category);
  });
}