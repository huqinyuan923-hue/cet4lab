'use client';

/** 主观题面板：写作（题目/范文/译文/提纲）与翻译（原文/参考译文/逐句拆解）。 */
import type { Subjective } from '@/lib/types';
import { Collapse, Icons } from '@/components/ui';

const SENT_LABEL: Record<string, string> = {
  trunk: '主干拆解',
  downgrade: '降级表达',
  grammar: '语法点',
  target: '目标译文',
};

export default function WritingTranslation({
  subjective,
  done,
  onDoneChange,
}: {
  subjective?: Subjective;
  done: { writing: boolean; translation: boolean };
  onDoneChange: (patch: Partial<{ writing: boolean; translation: boolean }>) => void;
}) {
  if (!subjective) return <p className="text-sm text-muted">该套未收录主观题。</p>;

  const { writing, translation } = subjective;

  return (
    <div className="space-y-5">
      {writing && (
        <section className="card p-4 sm:p-5">
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 font-medium">
              <Icons.Pen className="h-4 w-4 text-brand" />
              写作 Writing
            </h3>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={done.writing}
                onChange={(e) => onDoneChange({ writing: e.target.checked })}
                className="accent-[rgb(var(--c-brand))]"
              />
              我已完成本篇写作
            </label>
          </header>
          {writing.directions && (
            <div className="mb-3 rounded-lg bg-surface-2 px-3.5 py-3">
              <p className="mb-1 text-xs font-medium text-muted">Directions</p>
              <p className="prose-en whitespace-pre-wrap text-[14.5px]">{writing.directions}</p>
            </div>
          )}
          {writing.image && (
            <img
              src={writing.image}
              alt="写作题目配图"
              loading="lazy"
              className="mb-3 block max-h-[420px] w-auto max-w-full rounded-lg border border-line"
            />
          )}
          <div className="space-y-2.5">
            {writing.outline && (
              <Collapse title="提纲思路">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{writing.outline}</p>
              </Collapse>
            )}
            {writing.model && (
              <Collapse title="参考范文（英文）" defaultOpen>
                <p className="prose-en whitespace-pre-wrap text-[14.5px]">{writing.model}</p>
              </Collapse>
            )}
            {writing.modelZh && (
              <Collapse title="范文译文">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{writing.modelZh}</p>
              </Collapse>
            )}
          </div>
        </section>
      )}

      {translation && (
        <section className="card p-4 sm:p-5">
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 font-medium">
              <Icons.Book className="h-4 w-4 text-brand" />
              翻译 Translation
            </h3>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={done.translation}
                onChange={(e) => onDoneChange({ translation: e.target.checked })}
                className="accent-[rgb(var(--c-brand))]"
              />
              我已完成本篇翻译
            </label>
          </header>
          {translation.source && (
            <div className="mb-3 rounded-lg bg-surface-2 px-3.5 py-3">
              <p className="mb-1 text-xs font-medium text-muted">原文</p>
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{translation.source}</p>
            </div>
          )}
          {translation.reference && (
            <Collapse title="参考译文" className="mb-2.5">
              <p className="prose-en whitespace-pre-wrap text-[14.5px]">{translation.reference}</p>
            </Collapse>
          )}
          {!!translation.sentences?.length && (
            <div className="space-y-2.5">
              <p className="text-sm font-medium text-muted">逐句拆解</p>
              {translation.sentences.map((s, i) => (
                <div key={i} className="rounded-xl border border-line">
                  <div className="border-b border-line bg-surface-2 px-3.5 py-2 text-[13px] font-medium">
                    第 {i + 1} 句
                  </div>
                  <div className="space-y-2 p-3.5">
                    {Object.entries(SENT_LABEL).map(([key, label]) => {
                      const val = s[key as keyof typeof s];
                      if (!val) return null;
                      return (
                        <div key={key}>
                          <p className="mb-0.5 text-[11px] font-medium text-brand">{label}</p>
                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{val}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
