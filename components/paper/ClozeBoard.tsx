'use client';

/** 选词填空专用面板：原文内联空位 + 共享词库 + 交卷后逐空批改 */
import { useEffect, useMemo, useState } from 'react';
import type { Paper, Question } from '@/lib/types';
import PassagePane from './PassagePane';
import ExplainPanel from './ExplainPanel';
import { Icons, cn } from '@/components/ui';

interface Props {
  paper: Paper;
  questions: Question[];
  answers: Record<string, string>;
  revealed: boolean;
  editable: boolean;
  onAnswer: (no: number, key: string) => void;
}

export default function ClozeBoard({ paper, questions, answers, revealed, editable, onAnswer }: Props) {
  const bank = questions[0]?.wordBank || {};
  const letters = useMemo(() => Object.keys(bank), [bank]);
  const firstOpen = questions.find((q) => !answers[String(q.no)])?.no ?? questions[0]?.no;
  const [activeNo, setActiveNo] = useState<number>(firstOpen);

  useEffect(() => {
    if (revealed) return;
    if (answers[String(activeNo)]) {
      const next = questions.find((q) => !answers[String(q.no)]);
      if (next) setActiveNo(next.no);
    }
  }, [answers, activeNo, questions, revealed]);

  const used = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) {
      const a = answers[String(q.no)];
      if (a) m.set(a, q.no);
    }
    return m;
  }, [answers, questions]);

  const filled = questions.filter((q) => answers[String(q.no)]).length;

  const pick = (key: string) => {
    if (!editable) return;
    onAnswer(activeNo, key);
  };

  const wrongCount = questions.filter((q) => {
    const a = answers[String(q.no)];
    return a && a !== q.answer;
  }).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="chip">已填 {filled}/10</span>
        {revealed && wrongCount > 0 && <span className="chip text-bad">错 {wrongCount}</span>}
        <span className="hidden sm:inline">点击原文空位可切换当前题号，再从词库选择。</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* 原文 */}
        <div className="card p-4 sm:p-5">
          <PassagePane paper={paper} q={questions[0]} answers={answers} reveal={revealed} activeNo={activeNo} onPick={setActiveNo} />
        </div>

        {/* 词库 */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">词库</span>
              <span className="text-xs text-muted">当前 {activeNo} 题</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2">
              {letters.map((k) => {
                const owner = used.get(k);
                const isMine = answers[String(activeNo)] === k;
                const isRightForActive = revealed && questions.find((q) => q.no === activeNo)?.answer === k;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!editable}
                    onClick={() => pick(k)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[13px] transition',
                      isRightForActive && 'border-ok bg-ok/10 text-ok',
                      !isRightForActive && isMine && 'border-brand bg-brand/10 text-brand',
                      !isRightForActive && !isMine && !!(owner && !isMine) && 'border-line bg-surface-2 text-muted/70',
                      !isRightForActive && !isMine && !owner && 'border-line hover:border-brand/50 hover:text-brand'
                    )}
                  >
                    <span className="font-mono text-[11px] opacity-70">{k}</span>
                    <span className="truncate">{bank[k]}</span>
                  </button>
                );
              })}
            </div>
            {revealed && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
                <Icons.Info className="h-3.5 w-3.5" />
                正确答案已在下文逐题标注
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 交卷后：逐空批改 */}
      {revealed && (
        <div className="mt-5 space-y-2.5">
          <h4 className="text-sm font-medium text-muted">逐空解析</h4>
          {questions.map((q) => {
            const mine = answers[String(q.no)];
            const ok = mine === q.answer;
            return (
              <div key={q.no} className={cn('card p-3.5', ok ? 'border-ok/30' : 'border-bad/30')}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className={cn('inline-grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-xs font-semibold', ok ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad')}>
                    {q.no}
                  </span>
                  <span className="font-medium">
                    {q.answer}. {bank[q.answer] || q.answerText}
                  </span>
                  <span className={cn('text-xs', ok ? 'text-ok' : 'text-bad')}>
                    {ok ? '答对' : mine ? `你选 ${mine}. ${bank[mine] || ''}` : '未作答'}
                  </span>
                  {q.pos && <span className="chip">{q.pos}</span>}
                </div>
                {q.explain && <ExplainPanel q={q} dense />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
