import { useMemo } from "react";
import type { WeeklyPlan, Ingredient, Recipe, ComponentOption, MealSelection, Portion } from "../../domain/types";
import { portionMacros } from "../../domain/nutrition";

import ingredientsData from "../../data/ingredients.json";
import breakfastData from "../../data/recipes/breakfast.json";
import snacksData from "../../data/recipes/snacks.json";
import bowlComponentsData from "../../data/bowlComponents.json";
import dinnerComponentsData from "../../data/dinnerComponents.json";

function toMap<T extends { id: string }>(arr: T[]) {
  return new Map(arr.map((x) => [x.id, x]));
}

function mergeMaps<T>(a: Map<string, T>, b: Map<string, T>) {
  const out = new Map(a);
  for (const [k, v] of b.entries()) out.set(k, v);
  return out;
}

function flattenSelection(
  sel: MealSelection | undefined,
  recipes: Map<string, Recipe>,
  options: Map<string, ComponentOption>
): Portion[] {
  if (!sel) return [];
  const overrides = sel.overrides ?? {};

  if (sel.kind === "recipe") {
    const r = recipes.get(sel.recipeId);
    if (!r) return [];
    return r.portions.map((p, i) => {
      const k = `${i}`;
      return overrides[k] === undefined ? p : { ...p, amount: overrides[k] };
    });
  }

  const portions: Portion[] = [];
  for (const optionId of sel.optionIds) {
    const opt = options.get(optionId);
    if (!opt) continue;
    opt.portions.forEach((p, j) => {
      const k = `${optionId}:${j}`;
      portions.push(overrides[k] === undefined ? p : { ...p, amount: overrides[k] });
    });
  }

  return portions;
}

function fmtG(n: number) {
  return `${Math.round(n)}g`;
}

function pct(n: number, d: number) {
  if (!d || d <= 0) return 0;
  return Math.max(0, Math.min(100, (n / d) * 100));
}

type ProteinRow = {
  ingredientId: string;
  name: string;
  times: number;
  foodGrams: number;
  proteinGrams: number;
};

type RuleRow = {
  id: string;
  label: string;
  target: string;
  actual: string;
  ok: boolean;
  detail?: string;
};

export default function AnalyticsPage({ plan }: { plan: WeeklyPlan }) {
  const ingredients = useMemo(() => toMap(ingredientsData as Ingredient[]), []);
  const recipes = useMemo(() => toMap([...(breakfastData as Recipe[]), ...(snacksData as Recipe[])]), []);
  const lunchOptions = useMemo(() => toMap(bowlComponentsData as ComponentOption[]), []);
  const dinnerOptions = useMemo(() => toMap(dinnerComponentsData as ComponentOption[]), []);
  const allOptions = useMemo(() => mergeMaps(lunchOptions, dinnerOptions), [lunchOptions, dinnerOptions]);

  const stats = useMemo(() => {
    const proteinMap = new Map<string, ProteinRow>();
    const ingredientOccasions = new Map<string, number>();
    const plantWeekKinds = new Set<string>();
    let eggsPerWeek = 0;

    const byDay = plan.days.map((day) => {
      const portions = [
        ...flattenSelection(day.breakfast, recipes, allOptions),
        ...flattenSelection(day.preWorkoutSnack, recipes, allOptions),
        ...flattenSelection(day.lunch, recipes, allOptions),
        ...flattenSelection(day.dinner, recipes, allOptions),
        ...flattenSelection(day.afterDinnerTreat, recipes, allOptions),
      ];

      let fruitGrams = 0;
      let vegGrams = 0;
      let proteinMacroGrams = 0;
      const dayProteinKinds = new Set<string>();
      const dayVegKinds = new Set<string>();
      const dayFruitKinds = new Set<string>();

      for (const p of portions) {
        if (p.amount <= 0) continue;
        const ing = ingredients.get(p.ingredientId);
        if (!ing) continue;

        const amount = p.unit === "piece" ? 0 : p.amount;
        ingredientOccasions.set(ing.id, (ingredientOccasions.get(ing.id) ?? 0) + 1);

        if (ing.category === "fruit") {
          fruitGrams += amount;
          dayFruitKinds.add(ing.id);
        }
        if (ing.category === "veg") {
          vegGrams += amount;
          dayVegKinds.add(ing.id);
        }

        if (ing.category === "veg" || ing.category === "fruit" || ing.category === "carb" || ing.category === "fat" || ing.category === "pantry") {
          plantWeekKinds.add(ing.id);
        }

        if (ing.id === "egg" && p.unit === "piece") {
          eggsPerWeek += p.amount;
        }

        if (ing.category === "protein") {
          const macros = portionMacros(p, ing);
          proteinMacroGrams += macros.protein;
          dayProteinKinds.add(ing.id);

          const prev = proteinMap.get(ing.id) ?? {
            ingredientId: ing.id,
            name: ing.name,
            times: 0,
            foodGrams: 0,
            proteinGrams: 0,
          };
          prev.times += 1;
          if (p.unit !== "piece") prev.foodGrams += p.amount;
          prev.proteinGrams += macros.protein;
          proteinMap.set(ing.id, prev);
        }
      }

      return {
        dayId: day.id,
        dayLabel: day.label,
        fruitGrams,
        vegGrams,
        fruitKindsCount: dayFruitKinds.size,
        vegKindsCount: dayVegKinds.size,
        proteinMacroGrams,
        proteinKindsCount: dayProteinKinds.size,
      };
    });

    const proteinRows = Array.from(proteinMap.values()).sort((a, b) => b.proteinGrams - a.proteinGrams);
    const totals = byDay.reduce(
      (acc, d) => {
        acc.fruit += d.fruitGrams;
        acc.veg += d.vegGrams;
        acc.proteinMacro += d.proteinMacroGrams;
        return acc;
      },
      { fruit: 0, veg: 0, proteinMacro: 0 }
    );

    const countOccasions = (ids: string[]) => ids.reduce((sum, id) => sum + (ingredientOccasions.get(id) ?? 0), 0);
    const steakTimes = countOccasions(["steak_lean_cooked"]);
    const salmonTimes = countOccasions(["spar_qualitaetsmarke_norwegischer_raeucherlachs"]);
    const whiteFishTimes = countOccasions(["white_fish_cooked"]);
    const seafoodTimes = countOccasions(["shrimp_cooked", "scampi_cooked", "octopus_cooked"]);
    const chickenTurkeyTimes = countOccasions(["chicken_breast_cooked", "turkey_breast_cooked"]);

    const vegGoalDays = byDay.filter((d) => d.vegKindsCount >= 4).length;
    const fruitGoalDays = byDay.filter((d) => d.fruitKindsCount >= 3).length;

    const rules: RuleRow[] = [
      {
        id: "steak",
        label: "Steak",
        target: "Max 2 times / week",
        actual: `${steakTimes} times`,
        ok: steakTimes <= 2,
      },
      {
        id: "salmon",
        label: "SPAR Räucherlachs",
        target: "3 times / week",
        actual: `${salmonTimes} times`,
        ok: salmonTimes === 3,
      },
      {
        id: "white_fish",
        label: "White fish",
        target: "2 times / week",
        actual: `${whiteFishTimes} times`,
        ok: whiteFishTimes === 2,
      },
      {
        id: "seafood_mix",
        label: "Seafood (shrimp/scampi/octopus)",
        target: "2 times / week",
        actual: `${seafoodTimes} times`,
        ok: seafoodTimes === 2,
      },
      {
        id: "chicken_turkey",
        label: "Chicken + Turkey",
        target: "5 times / week",
        actual: `${chickenTurkeyTimes} times`,
        ok: chickenTurkeyTimes === 5,
      },
      {
        id: "eggs",
        label: "Eggs",
        target: "Max 7 / week",
        actual: `${Math.round(eggsPerWeek)} eggs`,
        ok: eggsPerWeek <= 7,
      },
      {
        id: "veg_daily_variety",
        label: "Veg variety",
        target: "At least 4 kinds / day",
        actual: `${vegGoalDays}/${plan.days.length} days hit`,
        ok: vegGoalDays === plan.days.length,
        detail: byDay.map((d) => `${d.dayLabel} ${d.vegKindsCount}`).join(" • "),
      },
      {
        id: "fruit_daily_variety",
        label: "Fruit variety",
        target: "At least 3 kinds / day",
        actual: `${fruitGoalDays}/${plan.days.length} days hit`,
        ok: fruitGoalDays === plan.days.length,
        detail: byDay.map((d) => `${d.dayLabel} ${d.fruitKindsCount}`).join(" • "),
      },
      {
        id: "plant_diversity_week",
        label: "Plant diversity",
        target: "30 different plant foods / week",
        actual: `${plantWeekKinds.size} kinds`,
        ok: plantWeekKinds.size >= 30,
      },
    ];

    return { byDay, proteinRows, totals, rules };
  }, [plan.days, recipes, allOptions, ingredients]);

  const maxProduce = Math.max(1, ...stats.byDay.map((d) => d.fruitGrams + d.vegGrams));
  const maxProtein = Math.max(1, ...stats.byDay.map((d) => d.proteinMacroGrams));
  const maxSourceProtein = Math.max(1, ...stats.proteinRows.map((r) => r.proteinGrams));

  return (
    <div className="container">
      <div className="card card-pad analytics-hero">
        <div className="h1">Analytics</div>
        <div className="small">Weekly insight for produce intake and protein quality across {plan.days.length} days.</div>

        <div className="analytics-kpis">
          <div className="analytics-kpi">
            <div className="analytics-kpi-label">Veg overall</div>
            <div className="analytics-kpi-value">{fmtG(stats.totals.veg)}</div>
          </div>
          <div className="analytics-kpi">
            <div className="analytics-kpi-label">Fruit overall</div>
            <div className="analytics-kpi-value">{fmtG(stats.totals.fruit)}</div>
          </div>
          <div className="analytics-kpi">
            <div className="analytics-kpi-label">Protein overall</div>
            <div className="analytics-kpi-value">{fmtG(stats.totals.proteinMacro)}</div>
          </div>
          <div className="analytics-kpi">
            <div className="analytics-kpi-label">Protein kinds</div>
            <div className="analytics-kpi-value">{stats.proteinRows.length}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="section-title">Recommended Targets</div>
        <div className="small">Weekly and daily checks from your custom rules.</div>
        <div className="analytics-rules">
          {stats.rules.map((r) => (
            <div key={r.id} className="analytics-rule">
              <div className="analytics-rule-head">
                <div className="analytics-source-name">{r.label}</div>
                <span className={`badge ${r.ok ? "badge-ok" : "badge-warn"}`}>{r.ok ? "On target" : "Off target"}</span>
              </div>
              <div className="analytics-source-meta">Target: {r.target}</div>
              <div className="analytics-source-meta">Actual: {r.actual}</div>
              {r.detail && <div className="analytics-rule-detail">{r.detail}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-grid">
        <div className="card card-pad">
          <div className="section-title">Fruit + Veg Per Day</div>
          <div className="small">Stacked bars show daily produce split.</div>

          <div className="analytics-bars" style={{ marginTop: 12 }}>
            {stats.byDay.map((d) => {
              const total = d.fruitGrams + d.vegGrams;
              const w = pct(total, maxProduce);
              const fruitW = pct(d.fruitGrams, total || 1);
              const vegW = pct(d.vegGrams, total || 1);
              return (
                <div key={d.dayId} className="analytics-row">
                  <div className="analytics-row-label">{d.dayLabel}</div>
                  <div className="analytics-track">
                    <div className="analytics-stack" style={{ width: `${w}%` }}>
                      <span className="seg seg-veg" style={{ width: `${vegW}%` }} />
                      <span className="seg seg-fruit" style={{ width: `${fruitW}%` }} />
                    </div>
                  </div>
                  <div className="analytics-row-value">
                    {fmtG(d.vegGrams)} veg ({d.vegKindsCount} kinds), {fmtG(d.fruitGrams)} fruit ({d.fruitKindsCount} kinds)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Protein Per Day</div>
          <div className="small">Macro grams from protein-category ingredients.</div>

          <div className="analytics-bars" style={{ marginTop: 12 }}>
            {stats.byDay.map((d) => (
              <div key={d.dayId} className="analytics-row">
                <div className="analytics-row-label">{d.dayLabel}</div>
                <div className="analytics-track">
                  <div className="analytics-fill-protein" style={{ width: `${pct(d.proteinMacroGrams, maxProtein)}%` }} />
                </div>
                <div className="analytics-row-value">
                  {fmtG(d.proteinMacroGrams)} ({d.proteinKindsCount} kinds)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="section-title">Protein Source Breakdown</div>
        <div className="small">How often each source appears and total grams through the week.</div>

        <div className="analytics-sources">
          {stats.proteinRows.map((row) => (
            <div key={row.ingredientId} className="analytics-source">
              <div className="analytics-source-top">
                <div className="analytics-source-name">{row.name}</div>
                <div className="analytics-source-meta">
                  {row.times} times • {fmtG(row.foodGrams)} food • {fmtG(row.proteinGrams)} protein
                </div>
              </div>
              <div className="analytics-track">
                <div className="analytics-fill-protein" style={{ width: `${pct(row.proteinGrams, maxSourceProtein)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
