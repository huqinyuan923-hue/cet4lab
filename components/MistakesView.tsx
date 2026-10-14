'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Mistake } from '@/lib/types';
import { getMistakes, getSettings, removeMistake, setMistakeMastered } from '@/lib/storage';
import { normOptions } from '@/lib/paper';
import ExplainPanel from '@/components/paper/ExplainPanel';
import { Icons, Segmented, cn } from '@/components/ui';

const PARTS = [
  { value: 'all', label: '全部' },
  { value: 'listening', label: '听力' },
  { value: 'cloze', label: '选词' },
  { value: 'matching', label: '匹配' },
  { value: 'reading', label: '阅读' },
];

export default function MistakesView() {
  const [items, setItems] = useState<Mistake[] | null>(null);
  const [part, setPart] = useState('all');
  const [showMastered, setShowMastered] = useState(false);
  const [retry, setRetry] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [showZh, setShowZh] = useState(true);
  const [paperFilter, setPaperFilter] = useState('all');

  const refresh = () => {
    setItems(getMistakes());
    setShowZh(getSettings().showZh);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('cet4:changed', refresh);
    return () => window.removeEventListener('cet4:changed', refresh);
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter(
      (m) =>
        (part === 'all' || m.part === part) &&
        (paperFilter === 'all' || m.paperId === paperFilter) &&
        (showMastered || !m.mastered)
    );
  }, [items, part, showMastered, paperFilter]);

  /** 当前错题涉及到的套卷（用于按卷筛选） */
  const papers = useMemo(() => {
    const set = new Set<string>();
    for (const m of items ?? []) if (!m.mastered || showMastered) set.add(m.paperId);
    return [...set].sort().reverse();
  }, [items, showMastered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const m of items ?? []) {
      if (m.mastered && !showMastered) continue;
      c.all++;
      c[m.part] = (c[m.part] || 0) + 1;
    }
    return c;
  }, [items, showMastered]);

  if (!items) return <div className="card h-40 animate-pulse bg-surface-2/60" />;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">错题本</h1>
          <p className="mt-1 text-sm text-muted">
            共 {counts.all} 道待复习 · 交卷时自动收录答错的题（未作答不计入）
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={showMastered}
              onChange={(e) => setShowMastered(e.target.checked)}
              className="accent-[rgb(var(--c-brand))]"
            />
            显示已掌握
          </label>
          <button type="button" className={cn('btn text-sm', retry && 'border-brand/60 bg-brand-soft text-brand')} onClick={() => setRetry((v) => !v)}>
            <Icons.Refresh className="h-4 w-4" />
            {retry ? '退出重练' : '重练模式'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented value={part} onChange={setPart} size="sm" options={PARTS.map((p) => ({ ...p, label: `${p.label} ${counts[p.value] ?? 0}` }))} />
        {papers.length > 1 && (
          <select
            value={paperFilter}
            onChange={(e) => setPaperFilter(e.target.value)}
            className="field w-auto py-1.5 text-sm"
            aria-label="按套卷筛选"
          >
            <option value="all">全部套卷</option>
            {papers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {retry && (
        <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
          重练模式：直接作答，答对可一键标记「已掌握」。
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((m) => (
          <MistakeCard
            key={`${m.paperId}#${m.no}`}
            m={m}
            retry={retry}
            showZh={showZh}
            picked={picked[`${m.paperId}#${m.no}`]}
            onPick={(key) => setPicked((p) => ({ ...p, [`${m.paperId}#${m.no}`]: key }))}
            onRemove={() => removeMistake(m.paperId, m.no)}
            onMaster={(v) => setMistakeMastered(m.paperId, m.no, v)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">
            {counts.all === 0 ? '还没有错题。去做一套真题，交卷后错题会自动收进这里。' : '当前筛选下没有错题。'}
            {counts.all === 0 && (
              <div className="mt-3">
                <Link href="/papers" className="btn btn-primary text-sm">
                  去刷题
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MistakeCard({
  m,
  retry,
  showZh,
  picked,
  onPick,
  onRemove,
  onMaster,
}: {
  m: Mistake;
  retry: boolean;
  showZh: boolean;
  picked?: string;
  onPick: (key: string) => void;
  onRemove: () => void;
  onMaster: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = normOptions({
    no: m.no,
    part: m.part,
    partName: m.partName,
    stem: m.stem,
    options: m.options,
    optionsZh: m.optionsZh,
    paraOptions: m.paraOptions,
    answer: m.correctAnswer,
  });
  const answered = picked != null;
  const right = picked === m.correctAnswer;

  return (
    <article className={cn('card p-4', m.mastered && 'opacity-70')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-grid h-6 min-w-6 place-items-center rounded-md bg-brand-soft px-1.5 font-semibold text-brand">{m.no}</span>
        <span>{m.partName}</span>
        <Link href={`/papers/${m.paperId}`} className="link">
          {m.paperId}
        </Link>
        {m.mastered && <span className="chip border-ok/40 text-ok">已掌握</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="btn-ghost btn px-2 py-1 text-xs" onClick={() => onMaster(!m.mastered)}>
            {m.mastered ? '取消已掌握' : '标记已掌握'}
          </button>
          <button type="button" className="btn-ghost btn px-2 py-1 text-xs text-bad" onClick={onRemove}>
            <Icons.Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="font-serif text-[15px] leading-relaxed">{m.stem}</p>
      {showZh && m.stemZh && <p className="mt-0.5 text-[13px] text-muted">{m.stemZh}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('rounded-md px-2 py-0.5 text-xs', m.userAnswer === m.correctAnswer ? 'bg-ok/12 text-ok' : 'bg-bad/12 text-bad')}>
          你选 {m.userAnswer ?? '—'}
        </span>
        <span className="rounded-md bg-ok/12 px-2 py-0.5 text-xs text-ok">正确 {m.correctAnswer}</span>
        {showZh && m.anchor && <span className="chip">大意：{m.anchor}</span>}
      </div>

      {retry ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const isPick = picked === o.key;
              const isRight = answered && o.key === m.correctAnswer;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={answered}
                  onClick={() => onPick(o.key)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-sm transition',
                    isRight && 'border-ok bg-ok/10 text-ok',
                    answered && isPick && !isRight && 'border-bad bg-bad/10 text-bad',
                    !answered && 'border-line hover:border-brand/50 hover:text-brand'
                  )}
                  title={o.text}
                >
                  {o.key}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
              {right ? (
                <>
                  <span className="flex items-center gap-1 text-ok">
                    <Icons.Check className="h-4 w-4" />
                    答对了
                  </span>
                  <button type="button" className="btn text-xs" onClick={() => onMaster(true)}>
                    标记已掌握
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1 text-bad">
                  <Icons.Cross className="h-4 w-4" />
                  再想想，正确答案是 {m.correctAnswer}
                </span>
              )}
            </div>
          )}
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost btn mt-2.5 px-2 py-1 text-xs">
        <Icons.Chevron className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
        {open ? '收起解析' : '查看解析'}
      </button>
      {open && (
        <div className="mt-2.5">
          {m.explain ? <ExplainPanel q={{ ...m, answer: m.correctAnswer, stem: m.stem, part: m.part, partName: m.partName, no: m.no }} dense /> : <p className="text-xs text-muted">暂无解析。</p>}
        </div>
      )}
    </article>
  );
}
