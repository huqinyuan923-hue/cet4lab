'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PaperMeta, Progress } from '@/lib/types';
import { getAnswers, getProgress } from '@/lib/storage';
import { Icons, ProgressBar, Segmented, cn } from '@/components/ui';

type Status = 'all' | 'todo' | 'doing' | 'done';

/** 悬停/聚焦时预取题目数据，点进去即开（每卷只取一次） */
const prefetched = new Set<string>();
function prefetchPaper(id: string) {
  if (typeof window === 'undefined' || prefetched.has(id)) return;
  prefetched.add(id);
  void fetch(`/data/papers/${id}.json`).catch(() => prefetched.delete(id));
}

export default function PaperList({ metas }: { metas: PaperMeta[] }) {
  const [status, setStatus] = useState<Status>('all');
  const [year, setYear] = useState<string>('all');
  const [prog, setProg] = useState<Record<string, Progress | null>>({});
  const [answered, setAnswered] = useState<Record<string, number>>({});

  useEffect(() => {
    const refresh = () => {
      const p: Record<string, Progress | null> = {};
      const a: Record<string, number> = {};
      for (const m of metas) {
        p[m.id] = getProgress(m.id);
        a[m.id] = Object.keys(getAnswers(m.id)).length;
      }
      setProg(p);
      setAnswered(a);
    };
    refresh();
    window.addEventListener('cet4:changed', refresh);
    return () => window.removeEventListener('cet4:changed', refresh);
  }, [metas]);

  const years = useMemo(() => Array.from(new Set(metas.map((m) => String(m.year ?? m.label.slice(0, 4))))).sort((a, b) => Number(b) - Number(a)), [metas]);

  const list = useMemo(() => {
    return metas.filter((m) => {
      const p = prog[m.id];
      const st = p?.status === 'done' ? 'done' : p?.status === 'in-progress' ? 'doing' : 'todo';
      if (status !== 'all' && st !== status) return false;
      if (year !== 'all' && String(m.year ?? m.label.slice(0, 4)) !== year) return false;
      return true;
    });
  }, [metas, status, year, prog]);

  const counts = useMemo(() => {
    let done = 0;
    let doing = 0;
    for (const m of metas) {
      const p = prog[m.id];
      if (p?.status === 'done') done++;
      else if (p?.status === 'in-progress') doing++;
    }
    return { done, doing, todo: metas.length - done - doing };
  }, [metas, prog]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">历年真题套卷</h1>
        <p className="mt-1 text-sm text-muted">
          共 {metas.length} 套 · 已完成 {counts.done} · 进行中 {counts.doing} · 未开始 {counts.todo}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={status}
          onChange={setStatus}
          size="sm"
          options={[
            { value: 'all', label: `全部` },
            { value: 'todo', label: `未开始 ${counts.todo}` },
            { value: 'doing', label: `进行中 ${counts.doing}` },
            { value: 'done', label: `已完成 ${counts.done}` },
          ]}
        />
        <select value={year} onChange={(e) => setYear(e.target.value)} className="field w-auto py-1.5 text-sm">
          <option value="all">全部年份</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((m) => {
          const p = prog[m.id];
          const done = p?.status === 'done';
          const doing = p?.status === 'in-progress';
          const ans = answered[m.id] ?? 0;
          return (
            <Link
              key={m.id}
              href={`/papers/${m.id}`}
              onMouseEnter={() => prefetchPaper(m.id)}
              onFocus={() => prefetchPaper(m.id)}
              onTouchStart={() => prefetchPaper(m.id)}
              className={cn('card group flex flex-col gap-2.5 p-4 transition hover:border-brand/50', done && 'border-ok/30')}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {m.label} · {m.set}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    听力 25 · 选词 10 · 匹配 10 · 阅读 10{m.hasSubjective ? ' · 写作翻译' : ''}
                  </p>
                </div>
                {done ? (
                  <span className="chip shrink-0 border-ok/40 text-ok">
                    <Icons.Check className="h-3 w-3" />
                    {p?.score ? `${p.score.total.c}/${p.score.total.t}` : '已完成'}
                  </span>
                ) : doing ? (
                  <span className="chip shrink-0 text-brand">进行中 {ans}/{m.count}</span>
                ) : (
                  <span className="chip shrink-0">未开始</span>
                )}
              </div>
              <ProgressBar value={done ? m.count : ans} max={m.count} />
              <div className="flex items-center gap-2 text-xs text-muted">
                <Icons.Headphones className={cn('h-3.5 w-3.5', m.hasAudio ? 'text-brand' : '')} />
                含听力音频
                <Icons.ChevronRight className="ml-auto h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>
            </Link>
          );
        })}
      </div>

      {list.length === 0 && <p className="card p-6 text-center text-sm text-muted">没有符合条件的套卷。</p>}
    </div>
  );
}
