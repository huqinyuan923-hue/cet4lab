/**
 * SM-2 间隔重复（BUILD-PLAN.md §7）：纯函数，便于单测。
 * q（自评质量）：认识=5、模糊=3、不认识=1。
 */
import type { SrsState } from './types';

export const QUALITY = { know: 5, fuzzy: 3, unknown: 1 } as const;
export const EF_MIN = 1.3;
export const EF_MAX = 2.8;
export const EF_INIT = 2.5;

export function newSrs(now = new Date()): SrsState {
  return { ef: EF_INIT, interval: 0, reps: 0, due: isoDate(now) };
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function review(state: SrsState, q: number, now = new Date()): SrsState {
  const ef = clampEf(state.ef + (0.1 - (5 - q) * 0.08));
  if (q < 3) {
    return { ef, interval: 1, reps: 0, due: isoDate(addDays(now, 1)) };
  }
  const reps = state.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(state.interval * ef);
  return { ef, interval, reps, due: isoDate(addDays(now, interval)) };
}

export function clampEf(ef: number): number {
  return Math.min(EF_MAX, Math.max(EF_MIN, Number(ef.toFixed(2))));
}

export const isDue = (s: SrsState, now = new Date()) => s.due <= isoDate(now);
