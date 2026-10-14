'use client';

/** 答题卡抽屉：55 题一览、已答/正误状态、点击跳题 */
import { useEffect } from 'react';
import type { Paper } from '@/lib/types';
import { PART_LABEL, PART_ORDER } from '@/lib/paper';
import { Icons, cn } from '@/components/ui';

export default function AnswerSheet({
  paper,
  answers,
  results,
  open,
  onClose,
}: {
  paper: Paper;
  answers: Record<string, string>;
  /** 交卷后的正误（null = 未作答） */
  results?: Record<number, boolean | null> | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const jump = (no: number) => {
    document.getElementById(`q-${no}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onClose();
  };

  const answered = paper.questions.filter((q) => answers[String(q.no)]).length;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="答题卡"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-line bg-surface shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">答题卡</h2>
          <span className="chip">
            {answered}/{paper.questions.length}
          </span>
          <button type="button" onClick={onClose} className="btn-ghost btn ml-auto px-2 py-1" aria-label="关闭答题卡">
            <Icons.Cross className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {PART_ORDER.map((part) => {
            const qs = paper.questions.filter((q) => q.part === part);
            if (!qs.length) return null;
            return (
              <section key={part} className="mb-4">
                <h3 className="mb-2 text-xs font-medium text-muted">{PART_LABEL[part]}</h3>
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9">
                  {qs.map((q) => {
                    const mine = answers[String(q.no)];
                    const hit = results ? results[q.no] : undefined;
                    const state = results
                      ? hit === true
                        ? 'right'
                        : hit === false
                          ? 'wrong'
                          : 'empty'
                      : mine
                        ? 'done'
                        : 'empty';
                    return (
                      <button
                        key={q.no}
                        type="button"
                        onClick={() => jump(q.no)}
                        title={`第 ${q.no} 题${mine ? ` · 你选 ${mine}` : ' · 未作答'}`}
                        className={cn(
                          'grid h-8 place-items-center rounded-lg border text-xs font-medium transition hover:border-brand/60 hover:text-brand',
                          state === 'right' && 'border-ok/50 bg-ok/12 text-ok',
                          state === 'wrong' && 'border-bad/50 bg-bad/12 text-bad',
                          state === 'done' && 'border-brand/40 bg-brand-soft text-brand',
                          state === 'empty' && 'border-line text-muted'
                        )}
                      >
                        {q.no}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="border-t border-line px-4 py-3 text-xs text-muted">
          <span className="mr-3 inline-flex items-center gap-1">
            <i className="inline-block h-3 w-3 rounded border border-brand/40 bg-brand-soft" />
            已作答
          </span>
          {results ? (
            <>
              <span className="mr-3 inline-flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded border border-ok/50 bg-ok/20" />
                答对
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-3 w-3 rounded border border-bad/50 bg-bad/20" />
                答错
              </span>
            </>
          ) : (
            <span>点击题号可跳转</span>
          )}
        </footer>
      </aside>
    </div>
  );
}
