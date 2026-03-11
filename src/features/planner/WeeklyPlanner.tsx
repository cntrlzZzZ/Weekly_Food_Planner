import { useMemo, useState } from "react";
import type {
  WeeklyPlan,
  Ingredient,
  Recipe,
  ComponentOption,
  MealSelection,
  ComponentGroup,
  Portion,
} from "../../domain/types";
import { sumPortions, portionMacros } from "../../domain/nutrition";

import ingredientsData from "../../data/ingredients.json";
import breakfastData from "../../data/recipes/breakfast.json";
import snacksData from "../../data/recipes/snacks.json";
import bowlComponentsData from "../../data/bowlComponents.json";
import dinnerComponentsData from "../../data/dinnerComponents.json";

type Row = { key: string; portion: Portion };

function toMap<T extends { id: string }>(arr: T[]) {
  return new Map(arr.map((x) => [x.id, x]));
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function pct(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return clamp01(current / target);
}

function MiniBar({
  label,
  current,
  target,
  variant,
}: {
  label: string;
  current: number;
  target: number;
  variant: "protein" | "neutral";
}) {
  const p = pct(current, target);
  return (
    <div className="barline">
      <span>{label}</span>
      <div className={`track ${variant === "protein" ? "track-protein" : "track-other"}`}>
        <div
          className={`fill ${variant === "protein" ? "fill-protein" : "fill-neutral"}`}
          style={{ width: `${Math.round(p * 100)}%` }}
        />
      </div>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(current)}g
      </span>
    </div>
  );
}

function setGroupOption(
  current: string[],
  options: Map<string, ComponentOption>,
  group: ComponentGroup,
  nextId: string | ""
) {
  const kept = current.filter((id) => options.get(id)?.group !== group);
  if (!nextId) return kept;
  return [...kept, nextId];
}

function toggleExtra(current: string[], extraId: string) {
  return current.includes(extraId)
    ? current.filter((x) => x !== extraId)
    : [...current, extraId];
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

function buildRows(
  sel: MealSelection | undefined,
  recipes: Map<string, Recipe>,
  options: Map<string, ComponentOption>
): Row[] {
  if (!sel) return [];
  const overrides = sel.overrides ?? {};

  if (sel.kind === "recipe") {
    const r = recipes.get(sel.recipeId);
    if (!r) return [];
    return r.portions.map((p, i) => {
      const key = `${i}`;
      const amt = overrides[key];
      return { key, portion: amt === undefined ? p : { ...p, amount: amt } };
    });
  }

  const rows: Row[] = [];
  for (const optionId of sel.optionIds) {
    const opt = options.get(optionId);
    if (!opt) continue;

    opt.portions.forEach((p, j) => {
      const key = `${optionId}:${j}`;
      const amt = overrides[key];
      rows.push({ key, portion: amt === undefined ? p : { ...p, amount: amt } });
    });
  }

  return rows;
}

function EditableRowsList({
  rows,
  ingredients,
  onChangeAmount,
  allowPieceEdit,
}: {
  rows: Row[];
  ingredients: Map<string, Ingredient>;
  onChangeAmount: (rowKey: string, next: number) => void;
  allowPieceEdit?: boolean;
}) {
  if (!rows.length) return null;

  return (
    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
      {rows.map((r) => {
        const p = r.portion;
        const ing = ingredients.get(p.ingredientId);
        const name = ing?.name ?? p.ingredientId;

        const macros = ing ? portionMacros(p, ing) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        const kcal = Math.round(macros.kcal);
        const protein = Math.round(macros.protein);

        const isPiece = p.unit === "piece";
        const canEdit = !isPiece || !!allowPieceEdit;

        return (
          <div
            key={r.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 92px 44px 140px",
              gap: 8,
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <div style={{ opacity: 0.95 }}>{name}</div>

            <input
              className="input"
              disabled={!canEdit}
              type="number"
              min={0}
              step={p.unit === "g" || p.unit === "ml" ? 5 : 1}
              value={p.amount}
              onChange={(e) => onChangeAmount(r.key, Number(e.target.value))}
            />

            <div style={{ opacity: 0.7 }}>{p.unit}</div>

            <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              protein {protein}g, {kcal} kcal
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MealTotalsInline({
  totals,
}: {
  totals: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <div className="meal-totals">
      {Math.round(totals.kcal)} kcal • P {Math.round(totals.protein)} • C {Math.round(totals.carbs)} • F{" "}
      {Math.round(totals.fat)}
    </div>
  );
}

function stripOptionPrefix(name: string) {
  // Removes "Option A — " / "Option B - " etc. if already in JSON
  return name.replace(/^Option\s+[A-Z]\s*[-—]\s*/i, "").trim();
}

function letter(i: number) {
  return String.fromCharCode(65 + i);
}

export default function WeeklyPlanner({
  plan,
  setPlan,
  selectedDayId,
  setSelectedDayId,
}: {
  plan: WeeklyPlan;
  setPlan: React.Dispatch<React.SetStateAction<WeeklyPlan>>;
  selectedDayId: string;
  setSelectedDayId: (id: string) => void;
}) {
  const ingredients = useMemo(() => toMap(ingredientsData as Ingredient[]), []);
  const recipes = useMemo(
    () => toMap([...(breakfastData as Recipe[]), ...(snacksData as Recipe[])]),
    []
  );
  const lunchOptions = useMemo(() => toMap(bowlComponentsData as ComponentOption[]), []);
  const dinnerOptions = useMemo(() => toMap(dinnerComponentsData as ComponentOption[]), []);

  const snackRecipes = useMemo(() => {
    return Array.from(recipes.values()).filter((r) => r.mealType === "snack");
  }, [recipes]);

  // Breakfast: keep the original two "Option A/B" first (if present), then the rest alphabetically
  const breakfastOptions = useMemo(() => {
    const list = Array.from(recipes.values()).filter((r) => r.mealType === "breakfast");

    const priority: Record<string, number> = {
      breakfast_option_a: 0,
      breakfast_option_b: 1,
    };

    return list.sort((a, b) => {
      const pa = priority[a.id];
      const pb = priority[b.id];
      const aHas = pa !== undefined;
      const bHas = pb !== undefined;

      if (aHas && bHas) return pa - pb;
      if (aHas) return -1;
      if (bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [recipes]);

  const preWorkoutOptions = useMemo(() => {
    return snackRecipes.filter((r) => (r.tags ?? []).includes("preworkout"));
  }, [snackRecipes]);

  const treatOptions = useMemo(() => {
    return snackRecipes.filter((r) => (r.tags ?? []).includes("treat"));
  }, [snackRecipes]);

  const lunchByGroup = useMemo(() => {
    const all = Array.from(lunchOptions.values());
    return {
      base: all.filter((o) => o.group === "base"),
      protein: all.filter((o) => o.group === "protein"),
      veg: all.filter((o) => o.group === "veg"),
      sauce: all.filter((o) => o.group === "sauce"),
      extras: all.filter((o) => o.group === "extras"),
    };
  }, [lunchOptions]);

  const dinnerByGroup = useMemo(() => {
    const all = Array.from(dinnerOptions.values());
    return {
      protein: all.filter((o) => o.group === "protein"),
      veg: all.filter((o) => o.group === "veg"),
      sauce: all.filter((o) => o.group === "sauce"),
      extras: all.filter((o) => o.group === "extras"),
    };
  }, [dinnerOptions]);

  const dayTotals = useMemo(() => {
    return plan.days.map((day) => {
      const portions = [
        ...flattenSelection(day.breakfast, recipes, lunchOptions),
        ...flattenSelection(day.preWorkoutSnack, recipes, lunchOptions),
        ...flattenSelection(day.lunch, recipes, lunchOptions),
        ...flattenSelection(day.dinner, recipes, dinnerOptions),
        ...flattenSelection(day.afterDinnerTreat, recipes, lunchOptions),
      ];
      return sumPortions(portions, ingredients);
    });
  }, [plan.days, recipes, lunchOptions, dinnerOptions, ingredients]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  function isOpen(dayId: string, mealKey: string) {
    return !!open[`${dayId}:${mealKey}`];
  }
  function toggleOpen(dayId: string, mealKey: string) {
    const k = `${dayId}:${mealKey}`;
    setOpen((s) => ({ ...s, [k]: !s[k] }));
  }

  function isCollapsed(dayId: string) {
    return !!collapsedDays[dayId];
  }

  function toggleCollapsed(dayId: string) {
    setCollapsedDays((current) => ({ ...current, [dayId]: !current[dayId] }));
  }

  function getOptionIds(sel: MealSelection | undefined) {
    return sel?.kind === "components" ? sel.optionIds : [];
  }

  function setRecipeSelection(
    dayId: string,
    key: "breakfast" | "preWorkoutSnack" | "afterDinnerTreat",
    recipeId: string | ""
  ) {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d;
        if (!recipeId) return { ...d, [key]: undefined };
        const prev = (d as any)[key] as MealSelection | undefined;
        return {
          ...d,
          [key]: { kind: "recipe", recipeId, overrides: prev?.overrides ?? {} },
        };
      }),
    }));
  }

  function updateLunch(dayId: string, updater: (ids: string[]) => string[]) {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d;
        const current = getOptionIds(d.lunch);
        const next = uniq(updater(current));
        const overrides = d.lunch?.overrides ?? {};
        return { ...d, lunch: { kind: "components", optionIds: next, overrides } };
      }),
    }));
  }

  function updateDinner(dayId: string, updater: (ids: string[]) => string[]) {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d;
        const current = getOptionIds(d.dinner);
        const next = uniq(updater(current));
        const overrides = d.dinner?.overrides ?? {};
        return { ...d, dinner: { kind: "components", optionIds: next, overrides } };
      }),
    }));
  }

  function setOverride(
    dayId: string,
    mealKey: "breakfast" | "preWorkoutSnack" | "afterDinnerTreat" | "lunch" | "dinner",
    rowKey: string,
    nextAmount: number
  ) {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== dayId) return d;
        const sel = (d as any)[mealKey] as MealSelection | undefined;
        if (!sel) return d;

        const overrides = { ...(sel.overrides ?? {}) };
        overrides[rowKey] = nextAmount;

        return { ...d, [mealKey]: { ...sel, overrides } };
      }),
    }));
  }

  const proteinTarget = plan.targets.protein;
  const carbsTarget = plan.targets.carbs ?? 250;
  const fatTarget = plan.targets.fat ?? 70;

  return (
    <div className="grid">
      {plan.days.map((day, idx) => {
        const dayT = dayTotals[idx];
        const selected = day.id === selectedDayId;
        const collapsed = isCollapsed(day.id);

        const kcalDelta = Math.round(dayT.kcal - plan.targets.kcal);
        const proteinShort = Math.max(0, Math.round(plan.targets.protein - dayT.protein));

        const lunchIds = getOptionIds(day.lunch);
        const dinnerIds = getOptionIds(day.dinner);

        const lunchBase = lunchIds.find((id) => lunchOptions.get(id)?.group === "base") ?? "";
        const lunchProtein = lunchIds.find((id) => lunchOptions.get(id)?.group === "protein") ?? "";
        const lunchVeg = lunchIds.find((id) => lunchOptions.get(id)?.group === "veg") ?? "";
        const lunchSauce = lunchIds.find((id) => lunchOptions.get(id)?.group === "sauce") ?? "";
        const lunchExtras = lunchIds.filter((id) => lunchOptions.get(id)?.group === "extras");

        const dinnerVeg = dinnerIds.find((id) => dinnerOptions.get(id)?.group === "veg") ?? "";
        const dinnerProtein = dinnerIds.find((id) => dinnerOptions.get(id)?.group === "protein") ?? "";
        const dinnerSauce = dinnerIds.find((id) => dinnerOptions.get(id)?.group === "sauce") ?? "";
        const dinnerExtras = dinnerIds.filter((id) => dinnerOptions.get(id)?.group === "extras");

        const breakfastSel = day.breakfast?.kind === "recipe" ? day.breakfast.recipeId : "";
        const preSel = day.preWorkoutSnack?.kind === "recipe" ? day.preWorkoutSnack.recipeId : "";
        const treatSel = day.afterDinnerTreat?.kind === "recipe" ? day.afterDinnerTreat.recipeId : "";

        const breakfastRows = buildRows(day.breakfast, recipes, lunchOptions);
        const preRows = buildRows(day.preWorkoutSnack, recipes, lunchOptions);
        const treatRows = buildRows(day.afterDinnerTreat, recipes, lunchOptions);
        const lunchRows = buildRows(day.lunch, recipes, lunchOptions);
        const dinnerRows = buildRows(day.dinner, recipes, dinnerOptions);

        const breakfastTotals = sumPortions(flattenSelection(day.breakfast, recipes, lunchOptions), ingredients);
        const preTotals = sumPortions(flattenSelection(day.preWorkoutSnack, recipes, lunchOptions), ingredients);
        const lunchTotals = sumPortions(flattenSelection(day.lunch, recipes, lunchOptions), ingredients);
        const dinnerTotals = sumPortions(flattenSelection(day.dinner, recipes, dinnerOptions), ingredients);
        const treatTotals = sumPortions(flattenSelection(day.afterDinnerTreat, recipes, lunchOptions), ingredients);

        const missingLunchProtein = !!day.lunch && !lunchProtein;
        const missingDinnerBase = !!day.dinner && !dinnerVeg;
        const missingDinnerProtein = !!day.dinner && !dinnerProtein;

        const warnings = [
          ...(missingLunchProtein ? ["Lunch: pick a protein"] : []),
          ...(missingDinnerBase ? ["Dinner: pick a salad base / veg side"] : []),
          ...(missingDinnerProtein ? ["Dinner: pick a protein"] : []),
        ];

        return (
          <div
            key={day.id}
            className="card card-pad"
            style={{
              borderColor: selected ? "rgba(55,185,125,0.55)" : undefined,
              boxShadow: selected ? "var(--shadow-md)" : undefined,
            }}
          >
            <div className="card-header">
              <div className="day-card-header-main">
                <button
                  className="btn btn-ghost"
                  onClick={() => setSelectedDayId(day.id)}
                  style={{ padding: 0 }}
                >
                  <span className="card-title">{day.label}</span>
                </button>
              </div>

              <div className="badges">
                <button
                  className={`day-fold-toggle ${collapsed ? "" : "day-fold-toggle-open"}`}
                  type="button"
                  aria-label={collapsed ? `Expand ${day.label}` : `Collapse ${day.label}`}
                  title={collapsed ? `Expand ${day.label}` : `Collapse ${day.label}`}
                  onClick={() => {
                    if (collapsed) setSelectedDayId(day.id);
                    toggleCollapsed(day.id);
                  }}
                >
                  &gt;
                </button>
                <span className={`badge ${kcalDelta <= 0 ? "badge-ok" : "badge-warn"}`}>
                  {kcalDelta >= 0 ? "+" : ""}
                  {kcalDelta} kcal
                </span>
                <span className={`badge ${proteinShort === 0 ? "badge-ok" : "badge-warn"}`}>
                  {proteinShort === 0 ? "Protein hit" : `Short ${proteinShort}g`}
                </span>
              </div>
            </div>

            {!collapsed && (
              <>
                <div className="day-summary">
                  <div className="day-kcal">
                    <div className="day-kcal-num">{Math.round(dayT.kcal)}</div>
                    <div className="day-kcal-unit">kcal</div>
                  </div>

                  <div className="macro-row">
                    <span className="macro-pill">
                      P <b>{Math.round(dayT.protein)}g</b>
                    </span>
                    <span className="macro-pill">
                      C <b>{Math.round(dayT.carbs)}g</b>
                    </span>
                    <span className="macro-pill">
                      F <b>{Math.round(dayT.fat)}g</b>
                    </span>
                  </div>

                  <div className="mini-bars">
                    <MiniBar label="P" current={dayT.protein} target={proteinTarget} variant="protein" />
                    <MiniBar label="C" current={dayT.carbs} target={carbsTarget} variant="neutral" />
                    <MiniBar label="F" current={dayT.fat} target={fatTarget} variant="neutral" />
                  </div>

                  {warnings.length > 0 && (
                    <div className="warn-box" style={{ marginTop: 10 }}>
                      {warnings.map((w) => (
                        <div key={w}>• {w}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BREAKFAST (sorted + lettered) */}
                <div className="meal-head">
                  <div className="meal-title">Breakfast</div>
                  <div className="meal-right">
                    {breakfastSel && <MealTotalsInline totals={breakfastTotals} />}
                    <button className={`pill ${isOpen(day.id, "breakfast") ? "pill-on" : ""}`} onClick={() => toggleOpen(day.id, "breakfast")}>
                      {isOpen(day.id, "breakfast") ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                  {breakfastOptions.map((r, i) => {
                    const active = breakfastSel === r.id;
                    const label = `Option ${letter(i)} — ${stripOptionPrefix(r.name)}`;
                    return (
                      <button
                        key={r.id}
                        className={`btn ${active ? "btn-primary" : ""}`}
                        onClick={() => setRecipeSelection(day.id, "breakfast", r.id)}
                        style={{ textAlign: "left", justifyContent: "flex-start", display: "flex" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {breakfastSel && isOpen(day.id, "breakfast") && (
                  <EditableRowsList
                    rows={breakfastRows}
                    ingredients={ingredients}
                    onChangeAmount={(k, v) => setOverride(day.id, "breakfast", k, v)}
                  />
                )}

                {/* PRE-WORKOUT */}
                <div className="meal-head">
                  <div className="meal-title">Pre-workout snack</div>
                  <div className="meal-right">
                    {preSel && <MealTotalsInline totals={preTotals} />}
                    <button className={`pill ${isOpen(day.id, "pre") ? "pill-on" : ""}`} onClick={() => toggleOpen(day.id, "pre")}>
                      {isOpen(day.id, "pre") ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                <select className="select-full" value={preSel} onChange={(e) => setRecipeSelection(day.id, "preWorkoutSnack", e.target.value)}>
                  <option value="">None</option>
                  {preWorkoutOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {preSel && isOpen(day.id, "pre") && (
                  <EditableRowsList
                    rows={preRows}
                    ingredients={ingredients}
                    onChangeAmount={(k, v) => setOverride(day.id, "preWorkoutSnack", k, v)}
                  />
                )}

                {/* LUNCH */}
                <div className="meal-head">
                  <div className="meal-title">Lunch bowl</div>
                  <div className="meal-right">
                    {day.lunch && lunchRows.length > 0 && <MealTotalsInline totals={lunchTotals} />}
                    <button className={`pill ${isOpen(day.id, "lunch") ? "pill-on" : ""}`} onClick={() => toggleOpen(day.id, "lunch")}>
                      {isOpen(day.id, "lunch") ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                <div className="grid" style={{ gap: 8, marginTop: 6 }}>
                  <select value={lunchBase} onChange={(e) => updateLunch(day.id, (ids) => setGroupOption(ids, lunchOptions, "base", e.target.value))}>
                    <option value="">Base (optional)</option>
                    {lunchByGroup.base.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <select value={lunchProtein} onChange={(e) => updateLunch(day.id, (ids) => setGroupOption(ids, lunchOptions, "protein", e.target.value))}>
                    <option value="">Protein</option>
                    {lunchByGroup.protein.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <select value={lunchVeg} onChange={(e) => updateLunch(day.id, (ids) => setGroupOption(ids, lunchOptions, "veg", e.target.value))}>
                    <option value="">Veg</option>
                    {lunchByGroup.veg.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <select value={lunchSauce} onChange={(e) => updateLunch(day.id, (ids) => setGroupOption(ids, lunchOptions, "sauce", e.target.value))}>
                    <option value="">Sauce</option>
                    {lunchByGroup.sauce.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {lunchByGroup.extras.map((o) => {
                      const on = lunchExtras.includes(o.id);
                      return (
                        <button key={o.id} className={`chip ${on ? "chip-on" : ""}`} onClick={() => updateLunch(day.id, (ids) => toggleExtra(ids, o.id))}>
                          {o.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {day.lunch && isOpen(day.id, "lunch") && (
                  <EditableRowsList
                    rows={lunchRows}
                    ingredients={ingredients}
                    onChangeAmount={(k, v) => setOverride(day.id, "lunch", k, v)}
                  />
                )}

                {/* DINNER */}
                <div className="meal-head">
                  <div className="meal-title">Light dinner</div>
                  <div className="meal-right">
                    {day.dinner && dinnerRows.length > 0 && <MealTotalsInline totals={dinnerTotals} />}
                    <button className={`pill ${isOpen(day.id, "dinner") ? "pill-on" : ""}`} onClick={() => toggleOpen(day.id, "dinner")}>
                      {isOpen(day.id, "dinner") ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                <div className="grid" style={{ gap: 8, marginTop: 6 }}>
                  <select value={dinnerVeg} onChange={(e) => updateDinner(day.id, (ids) => setGroupOption(ids, dinnerOptions, "veg", e.target.value))}>
                    <option value="">Salad base / veg side</option>
                    {dinnerByGroup.veg.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <select value={dinnerProtein} onChange={(e) => updateDinner(day.id, (ids) => setGroupOption(ids, dinnerOptions, "protein", e.target.value))}>
                    <option value="">Protein</option>
                    {dinnerByGroup.protein.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <select value={dinnerSauce} onChange={(e) => updateDinner(day.id, (ids) => setGroupOption(ids, dinnerOptions, "sauce", e.target.value))}>
                    <option value="">Dressing</option>
                    {dinnerByGroup.sauce.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {dinnerByGroup.extras.map((o) => {
                      const on = dinnerExtras.includes(o.id);
                      return (
                        <button key={o.id} className={`chip ${on ? "chip-on" : ""}`} onClick={() => updateDinner(day.id, (ids) => toggleExtra(ids, o.id))}>
                          {o.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {day.dinner && isOpen(day.id, "dinner") && (
                  <EditableRowsList
                    rows={dinnerRows}
                    ingredients={ingredients}
                    onChangeAmount={(k, v) => setOverride(day.id, "dinner", k, v)}
                  />
                )}

                {/* AFTER DINNER */}
                <div className="meal-head">
                  <div className="meal-title">After-dinner treat</div>
                  <div className="meal-right">
                    {treatSel && <MealTotalsInline totals={treatTotals} />}
                    <button className={`pill ${isOpen(day.id, "treat") ? "pill-on" : ""}`} onClick={() => toggleOpen(day.id, "treat")}>
                      {isOpen(day.id, "treat") ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                <select className="select-full" value={treatSel} onChange={(e) => setRecipeSelection(day.id, "afterDinnerTreat", e.target.value)}>
                  <option value="">None</option>
                  {treatOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {treatSel && isOpen(day.id, "treat") && (
                  <EditableRowsList
                    rows={treatRows}
                    ingredients={ingredients}
                    onChangeAmount={(k, v) => setOverride(day.id, "afterDinnerTreat", k, v)}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
