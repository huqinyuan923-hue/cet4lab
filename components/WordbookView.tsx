'use client';

/**
 * 生词本 + SM-2 复习（BUILD-PLAN.md §7）。
 * 生词来自真题原文点词收藏；复习卡片展示收藏时的真题原句作为语境。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { WordEntry } from '@/lib/types';
import { getWordbook, removeWord, updateWord } from '@/lib/storage';
import { newSrs, isDue, review, type QUALITY } from '@/lib/srs';
import { Icons, Segmented, cn } from '@/components/ui';

type Q = (typeof QUALITY)[keyof typeof QUALITY];

export default function WordbookView() {
  const [items, setItems] = useState<WordEntry[] | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'new' | 'due'>('new');

  const refresh = () => setItems(getWordbook());

  useEffect(() => {
    refresh();
    window.addEventListener('cet4:changed', refresh);
    return () => window.removeEventListener('cet4:changed', refresh);
  }, []);

  const due = useMemo(() => (items ?? []).filter((w) => w.srs && isDue(w.srs)), [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? []).filter(
      (w) => !q || w.word.toLowerCase().includes(q) || (w.trans ?? '').toLowerCase().includes(q) || (w.context ?? '').toLowerCase().includes(q)
    );
    if (sort === 'due') {
      return [...list].sort((a, b) => (a.srs?.due ?? '9999').localeCompare(b.srs?.due ?? '9999'));
    }
    return [...list].sort((a, b) => b.addedAt - a.addedAt);
  }, [items, query, sort]);

  const speak = (word: string) => {
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* 忽略 */
    }
  };

  if (!items) return <div className="card h-40 animate-pulse bg-surface-2/60" />;

  if (reviewing) {
    return <ReviewSession queue={due} onExit={() => setReviewing(false)} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">生词本</h1>
          <p className="mt-1 text-sm text-muted">
            共 {items.length} 个生词 · 今日待复习 {due.length} 个
            {items.length > 0 && ' · 复习采用 SM-2 间隔重复'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn btn-primary text-sm" disabled={due.length === 0} onClick={() => setReviewing(true)}>
            <Icons.Refresh className="h-4 w-4" />
            开始复习
          </button>
        </div>
      </header>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索单词、释义或例句…"
            className="field max-w-xs flex-1 py-1.5 text-sm"
            aria-label="搜索生词"
          />
          <Segmented
            value={sort}
            onChange={setSort}
            size="sm"
            options={[
              { value: 'new', label: '按收藏时间' },
              { value: 'due', label: '按复习日期' },
            ]}
          />
          {query && <span className="text-xs text-muted">匹配 {shown.length} 个</span>}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          还没有生词。在真题原文里用鼠标选中（手机上长按选择）一个英文单词，点「加生词」即可收藏。
          <div className="mt-3">
            <Link href="/papers" className="btn btn-primary text-sm">
              去做阅读
            </Link>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">没有匹配「{query}」的生词。</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {shown.map((w) => (
            <li key={w.word} className="card flex items-start gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-[15px] font-semibold">{w.word}</span>
                  {w.phonetic && <span className="text-xs text-muted">{w.phonetic}</span>}
                  {w.srs && <span className="chip">{isDue(w.srs) ? '待复习' : `${w.srs.interval} 天后`}</span>}
                </div>
                {w.trans && <p className="mt-1 text-[13px] text-ink/85">{w.trans}</p>}
                {w.context && <p className="mt-1 line-clamp-3 font-serif text-[12.5px] leading-relaxed text-muted">{w.context}</p>}
                {w.source.paperId && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    来自{' '}
                    <Link href={`/papers/${w.source.paperId}`} className="link">
                      {w.source.paperId}
                      {w.source.no ? ` 第 ${w.source.no} 题` : ''}
                    </Link>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className="btn-ghost btn px-1.5 py-1" onClick={() => speak(w.word)} title="朗读">
                  <Icons.Volume className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="btn-ghost btn px-1.5 py-1 text-bad" onClick={() => removeWord(w.word)} title="删除">
                  <Icons.Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewSession({ queue, onExit }: { queue: WordEntry[]; onExit: () => void }) {
  const [order] = useState(() => [...queue]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ know: 0, fuzzy: 0, unknown: 0 });

  const current = order[i];

  const answer = (q: Q) => {
    if (!current) return;
    const base = current.srs ?? newSrs();
    const next = review(base, q);
    updateWord(current.word, { srs: next });
    setStats((s) => {
      const key = q === 5 ? 'know' : q === 3 ? 'fuzzy' : 'unknown';
      return { ...s, [key]: s[key] + 1 };
    });
    setFlipped(false);
    setI((v) => v + 1);
  };

  if (!current) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-medium">本轮复习完成 🎉</p>
        <p className="mt-1.5 text-sm text-muted">
          认识 {stats.know} · 模糊 {stats.fuzzy} · 不认识 {stats.unknown}
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={onExit}>
          返回生词本
        </button>
      </div>
    );
  }

  const speak = () => {
    try {
      const u = new SpeechSynthesisUtterance(current.word);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch {
      /* 忽略 */
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>
          {i + 1} / {order.length}
        </span>
        <button type="button" className="btn-ghost btn px-2 py-1 text-xs" onClick={onExit}>
          结束复习
        </button>
      </div>

      <div className="card p-6 text-center sm:p-10">
        <p className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{current.word}</p>
        <button type="button" className="btn-ghost btn mx-auto mt-2 px-2 py-1 text-xs" onClick={speak}>
          <Icons.Volume className="h-3.5 w-3.5" />
          朗读
        </button>

        {flipped ? (
          <div className="mt-5 space-y-3 text-left">
            {current.phonetic && <p className="text-sm text-muted">{current.phonetic}</p>}
            {current.trans && <p className="text-[15px]">{current.trans}</p>}
            {current.context && (
              <p className="rounded-lg bg-surface-2 px-3.5 py-3 font-serif text-[14px] leading-relaxed">
                {current.context.split(new RegExp(`(\\b${current.word}\\b)`, 'i')).map((seg, k) =>
                  seg.toLowerCase() === current.word.toLowerCase() ? (
                    <mark key={k} className="rounded bg-brand/20 px-0.5 text-ink">
                      {seg}
                    </mark>
                  ) : (
                    <span key={k}>{seg}</span>
                  )
                )}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button type="button" className="btn justify-center border-bad/40 text-bad" onClick={() => answer(1)}>
                不认识
              </button>
              <button type="button" className="btn justify-center border-warn/40 text-warn" onClick={() => answer(3)}>
                模糊
              </button>
              <button type="button" className="btn justify-center border-ok/40 text-ok" onClick={() => answer(5)}>
                认识
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={cn('btn btn-primary mx-auto mt-8 px-6')}
            onClick={() => setFlipped(true)}
          >
            显示释义与语境
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">SM-2：认识的间隔会逐步拉长（1 → 6 → 倍数递增），模糊与不认识会重新排期。</p>
    </div>
  );
}
