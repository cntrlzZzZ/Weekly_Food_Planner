import type { DayPlan, WeeklyPlan } from "../domain/types";

export function makeDefaultDays(count: 5 | 7): DayPlan[] {
  const all: DayPlan[] = [
    { id: "mon", label: "Mon" },
    { id: "tue", label: "Tue" },
    { id: "wed", label: "Wed" },
    { id: "thu", label: "Thu" },
    { id: "fri", label: "Fri" },
    { id: "sat", label: "Sat" },
    { id: "sun", label: "Sun" },
  ];
  return all.slice(0, count);
}

export function makeDefaultPlan(dayCount: 5 | 7 = 7): WeeklyPlan {
  return {
    days: makeDefaultDays(dayCount),
    targets: { kcal: 1800, protein: 150 },
  };
}