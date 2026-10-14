'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PaperMeta } from '@/lib/types';
import { aggregate, getAnswers, getCheckins, getMistakes, getProgress, type Aggregate } from '@/lib/storage';
import { calcStreak } from '@/lib/stats';
import { Icons, ProgressBar } from '@/components/ui';

interface Summary {
  done: boolean;
  correct: number;
  total: number;
  answered: number;
}

export default function HomeDashboard({ metas }: { metas: PaperMeta[] }) {
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [last, setLast] = useState<{ id: string; label: string; set: string; answered: number; total: number } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setAgg(aggregate());
      setCheckins(getCheckins());
      setMistakes(getMistakes().filter((m) => !m.mastered).length);

      const next: Record<string, Summary> = {};
      let best: { id: string; t: number } | null = null;
      for (const m of metas) {
        const p = getProgress(m.id);
        const answered = Object.keys(getAnswers(m.id)).length;
        next[m.id] = {
          done: p?.status === 'done',
          correct: p?.score?.total.c ?? 0,
          total: p?.score?.total.t ?? m.count,
          answered,
        };
        if (p?.status === 'in-progress') {
          const t = p.startedAt ?? 0;
          if (!best || t > best.t) best = { id: m.id, t };
        }
      }
      setSummaries(next);
      if (best) {
        const meta = metas.find((m) => m.id === best!.id);
        if (meta) setLast({ id: meta.id, label: meta.label, set: meta.set, answered: next[meta.id].answered, total: meta.count });
        else setLast(null);
      } else {
        setLast(null);
      }
    };
    refresh();
    window.addEventListener('cet4:changed', refresh);
    return () => window.removeEventListener('cet4:changed', refresh);
  }, [metas]);

  const stats = [
    { label: '已完成套卷', value: agg ? `${agg.donePapers}` : '–', sub: `/ ${metas.length} 套`, icon: <Icons.Check className="h-4 w-4" /> },
    {
      label: '连续打卡',
      value: agg ? `${calcStreak(checkins)}` : '–',
      sub: checkins.length ? `天（累计 ${checkins.length} 天）` : '天',
      icon: <Icons.Target className="h-4 w-4" />,
    },
    { label: '累计答题', value: agg ? `${agg.answeredQuestions}` : '–', sub: '道', icon: <Icons.List className="h-4 w-4" /> },
    { label: '待复习错题', value: agg ? `${mistakes}` : '–', sub: '道', icon: <Icons.Star className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ background: 'radial-gradient(600px 200px at 90% -20%, rgb(var(--c-brand)), transparent 70%)' }}
          />
          <p className="chip mb-3">
            <Icons.Spark className="h-3.5 w-3.5" />
            {metas.length} 套真题 · {metas.reduce((a, m) => a + m.count, 0)} 道题 · 免登录
          </p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">四级真题，打开就能刷</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            2020 年 7 月至 2026 年 6 月历年真题，听力分段精听、逐题解析、错题本与打卡统计。做题记录存在你自己的浏览器里，不需要注册，也不上传任何数据。
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/papers" className="btn btn-primary">
              <Icons.List className="h-4 w-4" />
              选择套卷
            </Link>
            {last && (
              <Link href={`/papers/${last.id}`} className="btn">
                <Icons.Play className="h-4 w-4" />
                继续：{last.label} {last.set}（{last.answered}/{last.total}）
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-3.5">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
              <span className="text-brand">{s.icon}</span>
              {s.label}
            </div>
            <p className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{s.value}</span>
              <span className="text-xs text-muted">{s.sub}</span>
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/mistakes', title: '错题本', desc: '按照题型复习做错的题，标记已掌握', icon: <Icons.Star className="h-4 w-4" /> },
          { href: '/wordbook', title: '生词本', desc: '阅读中点词收藏，按遗忘曲线复习', icon: <Icons.Book className="h-4 w-4" /> },
          { href: '/stats', title: '学习统计', desc: '打卡热力图与各题型正确率', icon: <Icons.Chart className="h-4 w-4" /> },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="card group p-4 transition hover:border-brand/50">
            <div className="mb-1.5 flex items-center gap-2 font-medium">
              <span className="text-brand">{c.icon}</span>
              {c.title}
              <Icons.ChevronRight className="ml-auto h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </div>
            <p className="text-xs leading-relaxed text-muted">{c.desc}</p>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">最新套卷</h2>
          <Link href="/papers" className="link text-sm">
            全部 {metas.length} 套 →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metas.slice(0, 6).map((m) => {
            const s = summaries[m.id];
            return (
              <Link key={m.id} href={`/papers/${m.id}`} className="card group p-4 transition hover:border-brand/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {m.label} {m.set}
                  </span>
                  {s?.done && (
                    <span className="chip text-brand">
                      {s.correct}/{s.total}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">听力 25 · 选词 10 · 匹配 10 · 阅读 10 · 写作翻译</p>
                <ProgressBar value={s?.done ? m.count : (s?.answered ?? 0)} max={m.count} className="mt-2.5" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
