'use client';

/**
 * 原文面板：阅读（P1/P2 分段）/ 匹配（A) 逐段）/ 完形（__(n)__ 内联空位）。
 * 附带「点词收藏」：选中英文单词弹出浮层可加入生词本或朗读。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Paper, Question } from '@/lib/types';
import { clozeTokens, findSentence, matchingParagraphs, numberedParagraphs } from '@/lib/paper';
import { addWord } from '@/lib/storage';
import { Icons, cn } from '@/components/ui';

interface Props {
  paper: Paper;
  q: Question;
  answers: Record<string, string>;
  reveal?: boolean;
  activeNo?: number | null;
  onPick?: (no: number) => void;
  className?: string;
}

export default function PassagePane({ paper, q, answers, reveal = false, activeNo, onPick, className }: Props) {
  const [pop, setPop] = useState<{ word: string; x: number; y: number; saved: boolean } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const clozeAnswer = useMemo(() => {
    const map: Record<number, string> = {};
    for (const item of paper.questions) if (item.part === 'cloze') map[item.no] = item.answer;
    return map;
  }, [paper]);

  const collect = useCallback(() => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) return setPop(null);
    const raw = sel.toString().trim();
    if (!/^[A-Za-z][A-Za-z'-]{1,24}$/.test(raw)) return setPop(null);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = boxRef.current?.getBoundingClientRect();
    if (!host || rect.width === 0) return;
    // 夹在面板宽度内，避免靠边选词时浮层溢出屏幕
    const x = Math.min(Math.max(rect.left + rect.width / 2 - host.left, 78), Math.max(host.width - 78, 78));
    setPop({ word: raw, x, y: rect.top - host.top - 10, saved: false });
  }, []);

  const speak = (word: string) => {
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* 忽略：部分浏览器无 TTS */
    }
  };

  const save = () => {
    if (!pop) return;
    const sentence = findSentence(q.passage || '', pop.word);
    const ok = addWord({
      word: pop.word,
      source: { type: 'paper', paperId: paper.id, no: q.no },
      addedAt: Date.now(),
      context: sentence,
    });
    setPop({ ...pop, saved: ok });
  };

  const body = useMemo(() => {
    const passage = q.passage || '';

    if (q.part === 'matching') {
      const paras = matchingParagraphs(passage);
      return (
        <div className="space-y-2.5">
          {paras.map((p) => {
            const isAnswer = reveal && p.key === q.answer;
            return (
              <div key={p.key} className={cn('rounded-lg px-2.5 py-2', isAnswer && 'bg-ok/10 ring-1 ring-ok/40')}>
                <span
                  className={cn(
                    'mr-2 inline-grid h-6 w-6 shrink-0 place-items-center rounded-md align-top text-xs font-semibold',
                    isAnswer ? 'bg-ok/20 text-ok' : 'bg-surface-2 text-muted'
                  )}
                >
                  {p.key}
                </span>
                <span lang="en" className="prose-en inline text-[15px]">{p.text}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (q.part === 'cloze') {
      const bank = q.wordBank || {};
      const tokens = clozeTokens(passage);
      return (
        <div lang="en" className="prose-en preserve text-[15px] leading-[2.2]">
          {tokens.map((t, i) => {
            if (t.type === 'text') return <span key={i}>{t.text}</span>;
            const picked = answers[String(t.no)];
            const right = picked && picked === clozeAnswer[t.no];
            const wrong = reveal && picked && !right;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick?.(t.no)}
                className={cn(
                  'mx-0.5 inline-flex min-w-[5.5rem] items-baseline justify-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium transition',
                  reveal && right && 'bg-ok/15 text-ok ring-1 ring-ok/40',
                  wrong && 'bg-bad/10 text-bad ring-1 ring-bad/40',
                  !reveal && activeNo === t.no && 'bg-brand text-white dark:text-[rgb(9_11_17)]',
                  !reveal && activeNo !== t.no && picked && 'bg-brand-soft text-brand',
                  !reveal && !picked && 'bg-surface-2 text-muted hover:text-brand'
                )}
              >
                <span className="opacity-70">{t.no}.</span>
                {picked ? bank[picked] : '____'}
              </button>
            );
          })}
        </div>
      );
    }

    const paras = numberedParagraphs(passage);
    return (
      <div lang="en" className="prose-en space-y-4">
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }, [q, answers, reveal, activeNo, onPick, clozeAnswer, paper.id]);

  return (
    <div ref={boxRef} className={cn('relative', className)} onMouseUp={collect} onTouchEnd={collect}>
      {body}
      {pop && (
        <div className="absolute z-20 -translate-x-1/2 -translate-y-full animate-rise" style={{ left: pop.x, top: pop.y }}>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 shadow-card">
            <span className="mr-1 max-w-[9rem] truncate font-serif text-sm font-semibold">{pop.word}</span>
            {pop.saved ? (
              <span className="flex items-center gap-1 text-xs text-ok">
                <Icons.Check className="h-3.5 w-3.5" />
                已加入
              </span>
            ) : (
              <button type="button" onClick={save} className="rounded px-1.5 py-0.5 text-xs text-brand hover:bg-brand-soft">
                加生词
              </button>
            )}
            <button
              type="button"
              onClick={() => speak(pop.word)}
              className="rounded px-1.5 py-0.5 text-muted hover:bg-surface-2 hover:text-ink"
              title="朗读"
            >
              <Icons.Volume className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPop(null)}
              className="rounded px-1 py-0.5 text-muted hover:text-ink"
              aria-label="关闭"
            >
              <Icons.Cross className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
