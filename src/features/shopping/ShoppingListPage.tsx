import { useMemo, useState } from "react";
import type { WeeklyPlan, Ingredient, Recipe, ComponentOption } from "../../domain/types";
import { buildShoppingList } from "../../domain/shoppingList";

import ingredientsData from "../../data/ingredients.json";
import breakfastData from "../../data/recipes/breakfast.json";
import snacksData from "../../data/recipes/snacks.json";
import bowlComponentsData from "../../data/bowlComponents.json";
import dinnerComponentsData from "../../data/dinnerComponents.json";

import ShoppingListView from "./ShoppingListView";
import ExportButtons from "./ExportButtons";

function toMap<T extends { id: string }>(arr: T[]) {
  return new Map(arr.map((x) => [x.id, x]));
}

function mergeMaps<T>(a: Map<string, T>, b: Map<string, T>) {
  const out = new Map(a);
  for (const [k, v] of b.entries()) out.set(k, v);
  return out;
}

const STAPLES = new Set<string>(["olive_oil", "lemon_juice"]);

export default function ShoppingListPage({ plan }: { plan: WeeklyPlan }) {
  const [useRounded, setUseRounded] = useState(true);
  const [hideStaples, setHideStaples] = useState(false);

  const ingredients = useMemo(() => toMap(ingredientsData as Ingredient[]), []);
  const recipes = useMemo(() => toMap([...(breakfastData as Recipe[]), ...(snacksData as Recipe[])]), []);
  const lunchOptions = useMemo(() => toMap(bowlComponentsData as ComponentOption[]), []);
  const dinnerOptions = useMemo(() => toMap(dinnerComponentsData as ComponentOption[]), []);
  const allOptions = useMemo(() => mergeMaps(lunchOptions, dinnerOptions), [lunchOptions, dinnerOptions]);

  const items = useMemo(() => {
    let out = buildShoppingList(plan, ingredients, recipes, allOptions).filter((x) => x.totalAmount > 0);
    if (hideStaples) out = out.filter((x) => !STAPLES.has(x.ingredientId));
    return out;
  }, [plan, ingredients, recipes, allOptions, hideStaples]);

  return (
    <div className="container">
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h1">Shopping list</div>
            <div className="small">Built from your current {plan.days.length}-day plan.</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className={`pill ${useRounded ? "pill-on" : ""}`}
              onClick={() => setUseRounded((s) => !s)}
              title="Round to sensible pack sizes"
            >
              {useRounded ? "Rounded" : "Exact"}
            </button>

            <button
              className={`pill ${hideStaples ? "pill-on" : ""}`}
              onClick={() => setHideStaples((s) => !s)}
              title="Hide pantry staples like olive oil"
            >
              {hideStaples ? "Staples hidden" : "Show staples"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ExportButtons items={items} useRounded={useRounded} />
        </div>
      </div>

      <ShoppingListView items={items} showRounded={useRounded} />
    </div>
  );
}