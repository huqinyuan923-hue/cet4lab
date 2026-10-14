'use client';

/**
 * 单题卡片：四种题型的作答 / 批改展示。
 * reveal = true 时显示正误、正确答案与解析（交卷后、背题模式、练习模式点「查看答案」后）。
 */
import { useState } from 'react';
import type { AudioPiece, Question } from '@/lib/types';
import { correctTextFor, normOptions, pieceForQuestion } from '@/lib/paper';
import ExplainPanel from './ExplainPanel';
import { Icons, cn } from '@/components/ui';

interface Props {
  q: Question;
  answers: Record<string, string>;
  revealed: boolean;
  /** 还能改答案（未交卷且非背题模式） */
  editable: boolean;
  onAnswer: (no: number, key: string) => void;
  /** 练习模式：交卷前手动揭晓单题 */
  allowPeek?: boolean;
  pieces?: AudioPiece[];
  onPlayPiece?: (idx: number) => void;
  idPrefix?: string;
  compactStem?: boolean;
  /** 是否显示题干/选项的中文翻译与段落大意提示 */
  showZh?: boolean;
}

export default function QuestionCard({
  q,
  answers,
  revealed,
  editable,
  onAnswer,
  allowPeek = false,
  pieces,
  onPlayPiece,
  compactStem = false,
  showZh = true,
}: Props) {
  const [peek, setPeek] = useState(false);
  const show = revealed || peek;
  const mine = answers[String(q.no)] || null;
  const options = normOptions(q);
  const isMatching = q.part === 'matching';
  const pieceIdx = pieces && q.part === 'listening' ? pieceForQuestion(pieces, q.no) : -1;

  return (
    <article
      id={`q-${q.no}`}
      className={cn(
        'card scroll-mt-24 p-4 transition sm:p-5',
        show && mine && mine !== q.answer && 'border-bad/40',
        show && mine === q.answer && 'border-ok/40'
      )}
    >
      {/* 题头 */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-grid h-6 min-w-6 place-items-center rounded-md bg-brand-soft px-1.5 font-semibold text-brand">
          {q.no}
        </span>
        <span className="text-muted">{q.partName}</span>
        {q.type && <span className="chip">{q.type}</span>}
        {showZh && isMatching && q.anchor && <span className="chip">大意：{q.anchor}</span>}
        {pieceIdx >= 0 && onPlayPiece && (
          <button
            type="button"
            onClick={() => onPlayPiece(pieceIdx)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-brand/50 hover:text-brand"
          >
            <Icons.Headphones className="h-3.5 w-3.5" />
            听本段
          </button>
        )}
        {(revealed || allowPeek) && !show && (
          <button
            type="button"
            onClick={() => setPeek(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-brand/50 hover:text-brand"
          >
            <Icons.Eye className="h-3.5 w-3.5" />
            查看答案
          </button>
        )}
        {show && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
              mine === q.answer ? 'bg-ok/12 text-ok' : mine ? 'bg-bad/12 text-bad' : 'bg-surface-2 text-muted'
            )}
          >
            {mine === q.answer ? <Icons.Check className="h-3.5 w-3.5" /> : <Icons.Cross className="h-3.5 w-3.5" />}
            {mine ? (mine === q.answer ? '答对' : `你选 ${mine}`) : '未作答'}
          </span>
        )}
      </div>

      {/* 题干 */}
      <div className={cn('mb-3', compactStem && 'mb-2')}>
        {isMatching ? (
          <>
            <p className="text-[15px] leading-relaxed">{q.stem}</p>
            {showZh && q.stemZh && <p className="mt-0.5 text-[13px] text-muted">{q.stemZh}</p>}
          </>
        ) : (
          <>
            <p className="font-serif text-[15.5px] leading-relaxed">{q.stem}</p>
            {showZh && q.stemZh && <p className="mt-0.5 text-[13px] text-muted">{q.stemZh}</p>}
          </>
        )}
      </div>

      {/* 选项：匹配题为字母选择器，其余为列表 */}
      {isMatching ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const isMine = mine === o.key;
            const isRight = show && q.answer === o.key;
            const isWrongPick = show && isMine && !isRight;
            return (
              <button
                key={o.key}
                type="button"
                disabled={!editable}
                onClick={() => onAnswer(q.no, o.key)}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-lg border text-sm font-medium transition',
                  isRight && 'border-ok bg-ok/10 text-ok',
                  isWrongPick && 'border-bad bg-bad/10 text-bad',
                  !show && isMine && 'border-brand bg-brand text-white dark:text-[rgb(9_11_17)]',
                  !show && !isMine && 'border-line hover:border-brand/60 hover:text-brand',
                  !editable && 'cursor-default'
                )}
              >
                {o.key}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2" role="radiogroup" aria-label={`第 ${q.no} 题选项`}>
          {options.map((o) => {
            const isMine = mine === o.key;
            const isRight = show && q.answer === o.key;
            const isWrongPick = show && isMine && !isRight;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isMine}
                  disabled={!editable}
                  onClick={() => onAnswer(q.no, o.key)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition',
                    isRight && 'border-ok bg-ok/[0.08]',
                    isWrongPick && 'border-bad bg-bad/[0.07]',
                    !show && isMine && 'border-brand bg-brand/[0.07]',
                    !show && !isMine && 'border-line bg-surface hover:border-brand/40',
                    (!editable || show) && 'cursor-default'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-semibold',
                      isRight
                        ? 'bg-ok text-white'
                        : isWrongPick
                          ? 'bg-bad text-white'
                          : isMine
                            ? 'bg-brand text-white dark:text-[rgb(9_11_17)]'
                            : 'bg-surface-2 text-muted'
                    )}
                  >
                    {o.key}
                  </span>
                  <span className="flex-1">
                    <span className="block font-serif text-[15px] leading-relaxed">{o.text}</span>
                    {showZh && o.textZh && (
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{o.textZh}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 批改：正确答案 + 解析 */}
      {show && (
        <div className="mt-3.5 space-y-2.5">
          <div className="rounded-lg border border-ok/30 bg-ok/[0.07] px-3 py-2 text-sm">
            <span className="font-semibold text-ok">正确答案：{q.answer}</span>
            <span className="ml-2 text-ink/80">{correctTextFor(q)}</span>
          </div>
          {q.explain ? (
            <ExplainPanel q={q} />
          ) : (
            <p className="text-xs text-muted">该题暂无解析。</p>
          )}
        </div>
      )}
    </article>
  );
}
