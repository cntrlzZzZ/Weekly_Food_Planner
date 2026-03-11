import type { Unit } from "./types";

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function round0(n: number) {
  return Math.round(n);
}

export function normaliseUnit(unit: Unit): Unit {
  return unit;
}