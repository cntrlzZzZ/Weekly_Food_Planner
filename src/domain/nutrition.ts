import type { Ingredient, MacroTotals, Portion } from "./types";
import { round1 } from "./units";

export const ZERO: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function add(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scale(m: MacroTotals, factor: number): MacroTotals {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  };
}

export function portionMacros(portion: Portion, ingredient: Ingredient): MacroTotals {
  const { amount, unit } = portion;

  if (unit === "piece") {
    if (!ingredient.perPiece) return ZERO;
    return ingredient.perPiece;
  }

  if (!ingredient.per100g) return ZERO;
  const factor = amount / 100;
  return scale(ingredient.per100g, factor);
}

export function sumPortions(portions: Portion[], ingredientMap: Map<string, Ingredient>): MacroTotals {
  let total = { ...ZERO };
  for (const p of portions) {
    const ing = ingredientMap.get(p.ingredientId);
    if (!ing) continue;
    total = add(total, portionMacros(p, ing));
  }
  return {
    kcal: round1(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  };
}