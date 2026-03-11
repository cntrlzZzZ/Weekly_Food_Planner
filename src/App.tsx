import { useMemo, useState } from "react";
import WeeklyPlanner from "./features/planner/WeeklyPlanner";
import ShoppingListPage from "./features/shopping/ShoppingListPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import { makeDefaultPlan, makeDefaultDays } from "./state/planStore";
import type { WeeklyPlan, Ingredient, Recipe, ComponentOption, Portion, MealSelection } from "./domain/types";
import { sumPortions } from "./domain/nutrition";
import { jsPDF } from "jspdf";

import ingredientsData from "./data/ingredients.json";
import breakfastData from "./data/recipes/breakfast.json";
import snacksData from "./data/recipes/snacks.json";
import bowlComponentsData from "./data/bowlComponents.json";
import dinnerComponentsData from "./data/dinnerComponents.json";

function toMap<T extends { id: string }>(arr: T[]) {
  return new Map(arr.map((x) => [x.id, x]));
}

function mergeMaps<T>(a: Map<string, T>, b: Map<string, T>) {
  const out = new Map(a);
  for (const [k, v] of b.entries()) out.set(k, v);
  return out;
}

function clampInt(s: string, fallback: number) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
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

function resizePlanDays(plan: WeeklyPlan, dayCount: 5 | 7): WeeklyPlan {
  const nextDays = makeDefaultDays(dayCount);
  const existingById = new Map(plan.days.map((d) => [d.id, d]));
  const merged = nextDays.map((d) => {
    const old = existingById.get(d.id);
    return old ? { ...d, ...old } : d;
  });
  return { ...plan, days: merged };
}

export default function App() {
  const [plan, setPlan] = useState<WeeklyPlan>(() => makeDefaultPlan(7));
  const [tab, setTab] = useState<"planner" | "shopping" | "analytics">("planner");
  const [selectedDayId, setSelectedDayId] = useState<string>(() => makeDefaultDays(7)[0].id);

  const ingredients = useMemo(() => toMap(ingredientsData as Ingredient[]), []);
  const recipes = useMemo(
    () => toMap([...(breakfastData as Recipe[]), ...(snacksData as Recipe[])]),
    []
  );
  const lunchOptions = useMemo(() => toMap(bowlComponentsData as ComponentOption[]), []);
  const dinnerOptions = useMemo(() => toMap(dinnerComponentsData as ComponentOption[]), []);
  const allOptions = useMemo(() => mergeMaps(lunchOptions, dinnerOptions), [lunchOptions, dinnerOptions]);

  const dayTotals = useMemo(() => {
    return plan.days.map((day) => {
      const portions = [
        ...flattenSelection(day.breakfast, recipes, allOptions),
        ...flattenSelection(day.preWorkoutSnack, recipes, allOptions),
        ...flattenSelection(day.lunch, recipes, allOptions),
        ...flattenSelection(day.dinner, recipes, allOptions),
        ...flattenSelection(day.afterDinnerTreat, recipes, allOptions),
      ];
      return sumPortions(portions, ingredients);
    });
  }, [plan.days, recipes, ingredients, allOptions]);

  function mealName(sel: MealSelection | undefined) {
    if (!sel) return "—";
    if (sel.kind === "recipe") return recipes.get(sel.recipeId)?.name ?? sel.recipeId;
    const names = sel.optionIds.map((id) => allOptions.get(id)?.name ?? id);
    return names.length ? names.join(" + ") : "—";
  }

  function exportWeekText() {
    const lines: string[] = [];
    lines.push(`Weekly plan (${plan.days.length} days)`);
    lines.push(`Targets: ${plan.targets.kcal} kcal, ${plan.targets.protein}g protein`);
    lines.push("");

    plan.days.forEach((d, idx) => {
      const t = dayTotals[idx];
      lines.push(`${d.label} — ${Math.round(t.kcal)} kcal, ${Math.round(t.protein)}g protein`);
      lines.push(`  Breakfast: ${mealName(d.breakfast)}`);
      lines.push(`  Pre-workout: ${mealName(d.preWorkoutSnack)}`);
      lines.push(`  Lunch: ${mealName(d.lunch)}`);
      lines.push(`  Dinner: ${mealName(d.dinner)}`);
      lines.push(`  Treat: ${mealName(d.afterDinnerTreat)}`);
      lines.push("");
    });

    return lines.join("\n");
  }

  async function copyWeek() {
    await navigator.clipboard.writeText(exportWeekText());
    alert("Copied weekly plan.");
  }

  function downloadWeekPdf() {
    const doc = new jsPDF();
    const text = exportWeekText();
    const lines = doc.splitTextToSize(text, 180);

    doc.setFontSize(16);
    doc.text("Weekly plan", 14, 18);
    doc.setFontSize(10);

    let y = 28;
    for (const line of lines) {
      if (y > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 5;
    }

    doc.save("weekly-plan.pdf");
  }

  const dayCount = plan.days.length === 5 ? 5 : 7;

  function setDays(n: 5 | 7) {
    setPlan((p) => {
      const next = resizePlanDays(p, n);
      if (!next.days.some((d) => d.id === selectedDayId)) {
        setSelectedDayId(next.days[0].id);
      }
      return next;
    });
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-inner">
          <button
            className={`btn ${tab === "planner" ? "btn-primary" : ""}`}
            onClick={() => setTab("planner")}
          >
            Planner
          </button>
          <button
            className={`btn ${tab === "shopping" ? "btn-primary" : ""}`}
            onClick={() => setTab("shopping")}
          >
            Shopping list
          </button>
          <button
            className={`btn ${tab === "analytics" ? "btn-primary" : ""}`}
            onClick={() => setTab("analytics")}
          >
            Analytics
          </button>

          <div className="divider" />

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="small">Days</span>
            <select value={dayCount} onChange={(e) => setDays(clampInt(e.target.value, 7) as 5 | 7)}>
              <option value={5}>5</option>
              <option value={7}>7</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="small">Target kcal</span>
            <input
              className="input"
              style={{ width: 90 }}
              value={plan.targets.kcal}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  targets: { ...p.targets, kcal: clampInt(e.target.value, p.targets.kcal) },
                }))
              }
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="small">Protein</span>
            <input
              className="input"
              style={{ width: 80 }}
              value={plan.targets.protein}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  targets: { ...p.targets, protein: clampInt(e.target.value, p.targets.protein) },
                }))
              }
            />
            <span className="small">g</span>
          </label>

          <div className="divider" />

          <button className="btn btn-ghost" onClick={copyWeek}>
            Copy week
          </button>
          <button className="btn btn-ghost" onClick={downloadWeekPdf}>
            Week PDF
          </button>
        </div>
      </div>

      {tab === "shopping" ? (
        <ShoppingListPage plan={plan} />
      ) : tab === "analytics" ? (
        <AnalyticsPage plan={plan} />
      ) : (
        <div className="dashboard">
          <div>
            <div className="section-title">Week</div>
            <WeeklyPlanner
              plan={plan}
              setPlan={setPlan}
              selectedDayId={selectedDayId}
              setSelectedDayId={setSelectedDayId}
            />
          </div>

          <div className="sidebar">
            <div className="section-title">Week summary</div>

            <div className="grid" style={{ gap: 10 }}>
              {plan.days.map((day, idx) => {
                const t = dayTotals[idx];
                const selected = day.id === selectedDayId;

                const kcalDelta = Math.round(t.kcal - plan.targets.kcal);
                const proteinShort = Math.max(0, Math.round(plan.targets.protein - t.protein));

                return (
                  <div
                    key={day.id}
                    className="card card-pad"
                    style={{
                      borderColor: selected ? "rgba(55,185,125,0.55)" : undefined,
                      boxShadow: selected ? "var(--shadow-md)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedDayId(day.id)}
                  >
                    {/* Compact header */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{day.label}</div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{Math.round(t.kcal)} kcal</div>
                    </div>

                    {/* Compact macros */}
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                      P <b>{Math.round(t.protein)}g</b> • C <b>{Math.round(t.carbs)}g</b> • F <b>{Math.round(t.fat)}g</b>
                    </div>

                    {/* Badges */}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className={`badge ${kcalDelta <= 0 ? "badge-ok" : "badge-warn"}`}>
                        {kcalDelta >= 0 ? "+" : ""}{kcalDelta} kcal
                      </span>
                      <span className={`badge ${proteinShort === 0 ? "badge-ok" : "badge-warn"}`}>
                        {proteinShort === 0 ? "Protein hit" : `Short ${proteinShort}g`}
                      </span>
                    </div>

                    {/* Expanded meals only for selected day */}
                    {selected && (
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        <div>
                          <div className="small">Breakfast</div>
                          <div style={{ fontSize: 13 }}>{mealName(day.breakfast)}</div>
                        </div>
                        <div>
                          <div className="small">Pre-workout</div>
                          <div style={{ fontSize: 13 }}>{mealName(day.preWorkoutSnack)}</div>
                        </div>
                        <div>
                          <div className="small">Lunch</div>
                          <div style={{ fontSize: 13 }}>{mealName(day.lunch)}</div>
                        </div>
                        <div>
                          <div className="small">Dinner</div>
                          <div style={{ fontSize: 13 }}>{mealName(day.dinner)}</div>
                        </div>
                        <div>
                          <div className="small">Treat</div>
                          <div style={{ fontSize: 13 }}>{mealName(day.afterDinnerTreat)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ height: 12 }} />

            <div className="card card-pad">
              <div className="section-title">Tip</div>
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
                This panel is now scroll-safe. Click a day to expand its meal list.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
