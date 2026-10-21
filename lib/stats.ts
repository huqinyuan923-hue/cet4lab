/** 学习统计的纯计算函数（首页与统计页共用，避免两处实现漂移） */

/** 连续打卡天数：今天没打卡不算断（从昨天往前数） */
export function calcStreak(days: string[], now = new Date()): number {
  const set = new Set(days);
  const fmt = (d: Date) => {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const cursor = new Date(now);
  if (!set.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (set.has(fmt(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export interface HeatCell {
  key: string;
  count: number;
}

/** 近 N 周打卡热力图单元格（按周对齐，周日为首格、周六为一列之末） */
export function heatmapCells(days: string[], weeks = 12, now = new Date()): HeatCell[] {
  const counts: Record<string, number> = {};
  for (const d of days) counts[d] = (counts[d] || 0) + 1;

  const end = new Date(now);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  const out: HeatCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const p = (x: number) => String(x).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    out.push({ key, count: counts[key] || 0 });
  }
  return out;
}
