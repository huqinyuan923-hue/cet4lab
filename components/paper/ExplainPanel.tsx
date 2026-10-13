'use client';

import type { Question } from '@/lib/types';

/** 解析面板：按数据实际键名遍历渲染（四种题型键名不同，禁止硬编码） */
export default function ExplainPanel({ q, dense = false }: { q: Question; dense?: boolean }) {
  const entries = q.explain ? Object.entries(q.explain).filter(([, v]) => v && String(v).trim()) : [];
  if (!entries.length) return null;
  return (
    <div className={dense ? 'space-y-2' : 'space-y-2.5'}>
      {entries.map(([key, val]) => (
        <div key={key} className="rounded-lg bg-surface-2/70 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">{key}</span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{val}</p>
        </div>
      ))}
      {q.part === 'reading' && !q.answerText && (
        <p className="px-1 text-[11px] text-muted">* 阅读题原文答案依据见「选项」逐一对比。</p>
      )}
    </div>
  );
}
