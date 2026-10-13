'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, exportAll, getCheckins, getMistakes, getWordbook, importAll, today, wipeAll, type Aggregate } from '@/lib/storage';
import { PART_LABEL, PART_ORDER } from '@/lib/paper';
import { Icons, cn } from '@/components/ui';

export default function StatsView() {
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [words, setWords] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setAgg(aggregate());
      setCheckins(getCheckins());
      const ms = getMistakes();
      setMistakes(ms.length);
      setMastered(ms.filter((m) => m.mastered).length);
      setWords(getWordbook().length);
    };
    refresh();
    window.addEventListener('cet4:changed', refresh);
    return () => window.removeEventListener('cet4:changed', refresh);
  }, []);

  const streak = useMemo(() => {
    const set = new Set(checkins);
    let n = 0;
    const d = new Date();
    if (!set.has(today())) d.setDate(d.getDate() - 1); // 今天还没打卡不算断
    for (;;) {
      const p = (x: number) => String(x).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (!set.has(key)) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [checkins]);

  const totalAnswered = agg?.answeredQuestions ?? 0;
  const acc = useMemo(() => {
    if (!agg) return [];
    return PART_ORDER.map((p) => {
      const s = agg.byPart[p];
      return { part: p, c: s?.c ?? 0, t: s?.t ?? 0, pct: s && s.t ? Math.round((s.c / s.t) * 100) : 0 };
    });
  }, [agg]);

  if (!agg) return <div className="card h-40 animate-pulse bg-surface-2/60" />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">学习统计</h1>
        <p className="mt-1 text-sm text-muted">数据保存在本机浏览器，可随时导出备份或换设备导入。</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: '完成套卷', value: agg.donePapers, sub: '套' },
          { label: '累计答题', value: totalAnswered, sub: '道' },
          { label: '连续打卡', value: streak, sub: '天' },
          { label: '错题', value: mistakes, sub: `道（已掌握 ${mastered}）` },
          { label: '生词', value: words, sub: '个' },
        ].map((s) => (
          <div key={s.label} className="card p-3.5">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{s.value}</span>
              <span className="text-xs text-muted">{s.sub}</span>
            </p>
          </div>
        ))}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Icons.Target className="h-4 w-4 text-brand" />
          打卡记录（近 12 周）
        </h2>
        <Heatmap days={checkins} />
        <p className="mt-2 text-xs text-muted">交卷当天记为一次打卡；颜色越深受当天完成的套数影响。</p>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Icons.Chart className="h-4 w-4 text-brand" />
          各题型正确率
        </h2>
        {totalAnswered === 0 ? (
          <p className="text-sm text-muted">完成并交卷至少一套真题后，这里会显示分题型正确率。</p>
        ) : (
          <div className="space-y-3">
            {acc.map((a) => (
              <div key={a.part}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{PART_LABEL[a.part]}</span>
                  <span className="font-mono text-xs text-muted">
                    {a.c}/{a.t} · {a.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn('h-full rounded-full', a.pct >= 70 ? 'bg-ok' : a.pct >= 50 ? 'bg-warn' : 'bg-bad')}
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DataTransfer />
    </div>
  );
}

const WEEKS = 12;

function Heatmap({ days }: { days: string[] }) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of days) m[d] = (m[d] || 0) + 1;
    return m;
  }, [days]);

  const cells = useMemo(() => {
    const out: { key: string; count: number; label: string }[] = [];
    const end = new Date();
    // 对齐到本周周日
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const p = (x: number) => String(x).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      out.push({ key, count: counts[key] || 0, label: key });
    }
    return out;
  }, [counts]);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {cells.map((c) => (
          <div
            key={c.key}
            title={`${c.label}${c.count ? ` · 打卡 ${c.count} 次` : ''}`}
            className={cn(
              'h-3.5 w-3.5 rounded-[3px]',
              c.count === 0 && 'bg-surface-2',
              c.count === 1 && 'bg-brand/35',
              c.count === 2 && 'bg-brand/60',
              c.count >= 3 && 'bg-brand'
            )}
          />
        ))}
      </div>
    </div>
  );
}

function DataTransfer() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doExport = () => {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const p = (x: number) => String(x).padStart(2, '0');
    const d = new Date();
    a.href = url;
    a.download = `cet4lab-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: '已导出备份文件' });
  };

  const doImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const res = importAll(raw);
      setMsg(res.ok ? { ok: true, text: `导入成功，恢复 ${res.papers} 套卷的记录` } : { ok: false, text: res.error });
    } catch {
      setMsg({ ok: false, text: '文件不是合法 JSON' });
    }
  };

  const doWipe = () => {
    if (!window.confirm('确定清空本机所有学习记录吗？此操作不可撤销，建议先导出备份。')) return;
    wipeAll();
    setMsg({ ok: true, text: '已清空本机记录' });
  };

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Icons.Spark className="h-4 w-4 text-brand" />
        数据备份
      </h2>
      <p className="mb-3 text-xs text-muted">
        做题记录只存在本机浏览器。换设备、清理浏览器数据前请先导出备份；导入会覆盖同名的套卷记录。
      </p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn text-sm" onClick={doExport}>
          <Icons.Download className="h-4 w-4" />
          导出备份
        </button>
        <button type="button" className="btn text-sm" onClick={() => fileRef.current?.click()}>
          <Icons.Upload className="h-4 w-4" />
          导入备份
        </button>
        <button type="button" className="btn text-sm text-bad" onClick={doWipe}>
          <Icons.Trash className="h-4 w-4" />
          清空本机记录
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && <p className={cn('mt-2.5 text-sm', msg.ok ? 'text-ok' : 'text-bad')}>{msg.text}</p>}
    </section>
  );
}
