/**
 * 生词本 SM-2 排期与打卡统计的守卫（纯函数，不碰浏览器）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EF_INIT, EF_MAX, EF_MIN, QUALITY, addDays, clampEf, isDue, isoDate, newSrs, review } from '../lib/srs.ts';
import { calcStreak, heatmapCells } from '../lib/stats.ts';

const DAY = new Date(2026, 9, 21); // 本地 2026-10-21
const at = (d: Date, n: number) => isoDate(addDays(d, n));
// 只用本地日期组件解析，避免 CI 的 UTC 与时区偏移把「周几」挪一天
const local = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

test('新卡从当天到期、EF 取初值', () => {
  const s = newSrs(DAY);
  assert.deepEqual(s, { ef: EF_INIT, interval: 0, reps: 0, due: '2026-10-21' });
  assert.equal(isoDate(addDays(DAY, 10)), '2026-10-31', '跨月末补零');
  assert.equal(isoDate(addDays(new Date(2026, 10, 30), 3)), '2026-12-03');
});

test('连续「认识」按 1 → 6 → EF×旧间隔 推进', () => {
  const s1 = review(newSrs(DAY), QUALITY.know, DAY);
  assert.equal(s1.ef, 2.6, 'EF 每次 +0.1');
  assert.deepEqual({ i: s1.interval, r: s1.reps, d: s1.due }, { i: 1, r: 1, d: '2026-10-22' });

  const s2 = review(s1, QUALITY.know, DAY);
  assert.deepEqual({ e: s2.ef, i: s2.interval, r: s2.reps, d: s2.due }, { e: 2.7, i: 6, r: 2, d: '2026-10-27' });

  const s3 = review(s2, QUALITY.know, DAY);
  assert.equal(s3.ef, 2.8, 'EF 封顶 2.8');
  assert.equal(s3.interval, Math.round(6 * 2.8));
  assert.equal(s3.due, at(DAY, s3.interval));
});

test('「模糊」减 EF 但不断复习；「不认识」重置为 1 天', () => {
  const fuzzy = review(newSrs(DAY), QUALITY.fuzzy, DAY);
  assert.deepEqual({ e: fuzzy.ef, i: fuzzy.interval, r: fuzzy.reps }, { e: 2.44, i: 1, r: 1 });

  const nope = review({ ef: 2.5, interval: 30, reps: 9, due: '2026-10-21' }, QUALITY.unknown, DAY);
  assert.deepEqual({ e: nope.ef, i: nope.interval, r: nope.reps, d: nope.due }, { e: 2.28, i: 1, r: 0, d: '2026-10-22' });
});

test('EF 恒在 [1.3, 2.8] 内且保留两位', () => {
  assert.equal(clampEf(9), EF_MAX);
  assert.equal(clampEf(-1), EF_MIN);
  assert.equal(clampEf(1.456), 1.46, '区间内四舍五入到两位');
  assert.equal(clampEf(1.2), EF_MIN, '低于下限直接触底');
  let ef = EF_INIT;
  for (let i = 0; i < 40; i++) ef = review({ ef, interval: 1, reps: 1, due: '2026-10-21' }, QUALITY.unknown, DAY).ef;
  assert.equal(ef, EF_MIN, '反复不认识必须触底');
});

test('isDue 以「日」为粒度，当天到期即算到期', () => {
  assert.equal(isDue({ ef: 2.5, interval: 1, reps: 1, due: '2026-10-21' }, DAY), true);
  assert.equal(isDue({ ef: 2.5, interval: 1, reps: 1, due: '2026-10-20' }, DAY), true);
  assert.equal(isDue({ ef: 2.5, interval: 1, reps: 1, due: '2026-10-22' }, DAY), false);
});

test('连续天数：今天没打卡不算断，隔天缺口才断', () => {
  const d = (n: number) => at(DAY, n);
  assert.equal(calcStreak([], DAY), 0);
  assert.equal(calcStreak([d(0)], DAY), 1);
  assert.equal(calcStreak([d(-1)], DAY), 1, '只打了昨天的卡，今天还没打也仍连着');
  assert.equal(calcStreak([d(0), d(-1), d(-2)], DAY), 3);
  assert.equal(calcStreak([d(0), d(-2)], DAY), 1, '缺一整天就断');
  assert.equal(calcStreak([d(-1), d(-2), d(-4)], DAY), 2);
});

test('热力图固定铺满 N 周、周末对齐，重复打卡累加', () => {
  const cells = heatmapCells(['2026-10-20', '2026-10-20', '2026-01-01'], 2, DAY);
  assert.equal(cells.length, 14);
  assert.equal(local(cells.at(-1)!.key).getDay(), 6, '每列末格是周六');
  assert.equal(local(cells[0].key).getDay(), 0, '每列首格是周日');
  assert.equal(cells.filter((c) => c.count > 0).length, 1);
  assert.equal(cells.reduce((a, c) => a + c.count, 0), 2, '窗口外的一天不计入');
  for (let i = 1; i < cells.length; i++) {
    assert.equal(isoDate(addDays(local(cells[i - 1].key), 1)), cells[i].key, '日期必须逐日连续');
  }
});
