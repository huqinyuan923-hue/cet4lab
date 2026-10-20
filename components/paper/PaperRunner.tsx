'use client';

/**
 * 刷题页中枢：三种模式（整卷限时 / 分题型练习 / 背题）、实时保存、计时交卷、判分与批改。
 * 数据懒加载（/data/papers/{id}.json），用户数据全部落 localStorage。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AudioEntry, Paper, PaperMeta, Progress, Question } from '@/lib/types';
import { EXAM_SECONDS, PART_LABEL, PART_ORDER, fmtTime, scorePaper } from '@/lib/paper';
import {
  addCheckin,
  addMistakes,
  getAnswers,
  getProgress,
  getSettings,
  getSubjectiveDone,
  setAnswers as persistAnswers,
  setProgress as persistProgress,
  setSettings,
  setSubjectiveDone,
  type SubjectiveDone,
} from '@/lib/storage';
import AudioPlayer, { type AudioPlayerHandle } from './AudioPlayer';
import QuestionCard from './QuestionCard';
import ClozeBoard from './ClozeBoard';
import PassagePane from './PassagePane';
import WritingTranslation from './WritingTranslation';
import AnswerSheet from './AnswerSheet';
import ExamTimer from './ExamTimer';
import { Icons, ProgressBar, Segmented, cn } from '@/components/ui';

type Mode = 'exam' | 'practice' | 'study';

const MODE_OPTIONS: { value: Mode; label: string; title: string }[] = [
  { value: 'exam', label: '整卷', title: '整卷限时（125 分钟）' },
  { value: 'practice', label: '练习', title: '分题型练习，可单题对答案' },
  { value: 'study', label: '背题', title: '直接显示答案与解析' },
];

const SECTION_TIPS: Record<string, string> = {
  listening: '听力播放器支持分段精听与倍速；做题时可先看选项。',
  cloze: '先通读原文把握大意，再逐空选择；词库中每个词只用一次。',
  matching: '先读题干圈关键词，再回原文定位段落。',
  reading: '两篇仔细阅读，建议先看题干再读原文。',
};

export default function PaperRunner({ meta, initialMode = 'exam' }: { meta: PaperMeta; initialMode?: Mode }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [audio, setAudio] = useState<AudioEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [answers, setAnswersState] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [progress, setProgressState] = useState<Progress | null>(null);
  const [activePart, setActivePart] = useState<string>('listening');
  const [subjDone, setSubjDoneState] = useState<SubjectiveDone>({ writing: false, translation: false });
  const [showZh, setShowZh] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const submittingRef = useRef(false);

  /* ---------- 加载 ---------- */
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    (async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          fetch(`/data/papers/${meta.id}.json`),
          fetch('/data/audio/index.json'),
        ]);
        if (!pRes.ok) throw new Error(`试卷数据加载失败（${pRes.status}）`);
        const p = (await pRes.json()) as Paper;
        const aMap = aRes.ok ? ((await aRes.json()) as Record<string, AudioEntry>) : {};
        if (!alive) return;
        setPaper(p);
        setAudio(aMap[meta.id] ?? null);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : '数据加载失败');
      }
    })();
    return () => {
      alive = false;
    };
  }, [meta.id, reloadKey]);

  /* ---------- 读取本地状态 ---------- */
  useEffect(() => {
    if (!paper) return;
    setAnswersState(getAnswers(meta.id));
    setSubjDoneState(getSubjectiveDone(meta.id));
    setShowZh(getSettings().showZh);
    const prog = getProgress(meta.id);
    setProgressState(prog);
    if (prog?.status === 'done') setSubmitted(true);
  }, [paper, meta.id]);

  /* ---------- 中文翻译开关（全局偏好，持久化） ---------- */
  const toggleZh = useCallback(() => {
    setShowZh((prev) => {
      const next = !prev;
      setSettings({ showZh: next });
      return next;
    });
  }, []);

  /* ---------- 考试中防误关：有作答且未交卷时提示 ---------- */
  useEffect(() => {
    if (submitted || mode === 'study') return;
    const hasWork = Object.keys(getAnswers(meta.id)).length > 0 || Object.keys(answers).length > 0;
    if (!hasWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [submitted, mode, meta.id, answers]);

  /* ---------- 考试计时：只维护截止时间戳，秒级跳动交给 ExamTimer ---------- */
  useEffect(() => {
    if (mode !== 'exam' || submitted) return;
    if (progress?.examDeadline) return;
    const deadline = Date.now() + EXAM_SECONDS * 1000;
    const next: Progress = {
      ...(progress ?? { status: 'in-progress' }),
      status: 'in-progress',
      startedAt: progress?.startedAt ?? Date.now(),
      timed: true,
      examDeadline: deadline,
    };
    persistProgress(meta.id, next);
    setProgressState(next);
  }, [mode, submitted, progress, meta.id]);

  const questions = paper?.questions ?? [];
  const availableParts = useMemo<string[]>(() => {
    if (!paper) return PART_ORDER;
    const present = new Set(paper.questions.map((q) => q.part));
    return PART_ORDER.filter((p) => present.has(p));
  }, [paper]);
  const hasSubjective = Boolean(paper?.subjective);

  useEffect(() => {
    if (!paper) return;
    setActivePart((prev) => {
      if (prev === 'subjective') return hasSubjective ? prev : (availableParts[0] ?? prev);
      if (availableParts.includes(prev)) return prev;
      return availableParts[0] ?? (hasSubjective ? 'subjective' : prev);
    });
  }, [paper, availableParts, hasSubjective]);
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[String(q.no)]).length,
    [questions, answers]
  );
  const revealed = submitted || mode === 'study';
  const editable = !submitted && mode !== 'study';
  /** 限时模式下仍在计时才传截止时间，交卷后即停表 */
  const examDeadline = mode === 'exam' && !submitted ? (progress?.examDeadline ?? null) : null;

  /* ---------- 跳到第一个未作答的题 ---------- */
  const jumpNextUnanswered = useCallback(() => {
    const next = questions.find((q) => !answers[String(q.no)]);
    if (!next) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }
    document.getElementById(`q-${next.no}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [questions, answers]);

  const score = useMemo(() => (paper && (submitted || mode === 'study') ? scorePaper(paper, answers) : null), [paper, answers, submitted, mode]);

  /* ---------- 作答 ---------- */
  const onAnswer = useCallback(
    (no: number, key: string) => {
      if (!editable) return;
      setAnswersState((prev) => {
        const next = { ...prev, [String(no)]: key };
        persistAnswers(meta.id, next);
        return next;
      });
      if (!progress || progress.status !== 'in-progress') {
        const next: Progress = { status: 'in-progress', startedAt: progress?.startedAt ?? Date.now(), timed: mode === 'exam', examDeadline: progress?.examDeadline };
        persistProgress(meta.id, next);
        setProgressState(next);
      }
    },
    [editable, meta.id, progress, mode]
  );

  /* ---------- 交卷 ---------- */
  const submit = useCallback(() => {
    if (!paper || submittingRef.current) return;
    submittingRef.current = true;
    const s = scorePaper(paper, answers);
    const finished: Progress = {
      ...(progress ?? { status: 'done' }),
      status: 'done',
      startedAt: progress?.startedAt ?? Date.now(),
      finishedAt: Date.now(),
      timed: mode === 'exam',
      score: { total: s.total, byPart: s.byPart },
      examDeadline: undefined,
    };
    persistProgress(meta.id, finished);
    setProgressState(finished);
    addCheckin();

    const wrong = paper.questions
      .filter((q) => {
        const a = answers[String(q.no)];
        return a && a !== q.answer;
      })
      .map((q) => ({
        paperId: meta.id,
        no: q.no,
        part: q.part,
        partName: q.partName,
        stem: q.stem,
        stemZh: q.stemZh,
        userAnswer: answers[String(q.no)] ?? null,
        correctAnswer: q.answer,
        options: q.options ?? null,
        optionsZh: q.optionsZh ?? null,
        paraOptions: q.paraOptions,
        anchor: q.anchor,
        explain: q.explain ?? null,
        addedAt: Date.now(),
        mastered: false,
      }));
    addMistakes(wrong);

    setSubmitted(true);
    submittingRef.current = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paper, answers, meta.id, progress, mode]);

  const voidSubmit = useCallback(() => submit(), [submit]);

  /* ---------- 重做 ---------- */
  const restart = useCallback(() => {
    if (!window.confirm('确定重新作答吗？本卷此前的作答记录与得分将被清除（错题本不受影响）。')) return;
    persistAnswers(meta.id, {});
    setAnswersState({});
    const next: Progress = { status: 'in-progress', startedAt: Date.now(), timed: mode === 'exam', examDeadline: mode === 'exam' ? Date.now() + EXAM_SECONDS * 1000 : undefined };
    persistProgress(meta.id, next);
    setProgressState(next);
    setSubmitted(false);
  }, [meta.id, mode]);

  const onSubjDone = useCallback(
    (patch: Partial<SubjectiveDone>) => {
      setSubjectiveDone(meta.id, patch);
      setSubjDoneState(getSubjectiveDone(meta.id));
    },
    [meta.id]
  );

  /* ---------- 渲染 ---------- */
  if (loadError) {
    return (
      <div className="card p-6 text-center">
        <p className="text-bad">{loadError}</p>
        <p className="mt-1 text-xs text-muted">可能是网络波动，重试一次通常就好了。</p>
        <div className="mt-4 flex justify-center gap-2.5">
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
            <Icons.Refresh className="h-4 w-4" />
            重试
          </button>
          <Link href="/papers" className="btn">
            返回套卷列表
          </Link>
        </div>
      </div>
    );
  }
  if (!paper) return <Skeleton />;

  const sections = [...availableParts, ...(hasSubjective ? ['subjective'] : [])];
  const partsVisible = mode === 'practice' ? [activePart] : sections;
  const byPart = (p: string) => paper.questions.filter((q) => q.part === p);

  return (
    <div className="pb-24">
      {/* 顶部工具条 */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-2.5">
          <Link href="/papers" className="btn-ghost btn px-2" title="返回列表">
            <Icons.ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">
              {paper.label} · {paper.set}
            </h1>
            <p className="hidden text-xs text-muted sm:block">
              已答 {answeredCount}/{questions.length}
              {mode === 'exam' && examDeadline && (
                <ExamTimer deadline={examDeadline} onExpire={submit} className="ml-2 text-xs" withIcon />
              )}
            </p>
          </div>
          {mode === 'exam' && examDeadline && (
            <ExamTimer deadline={examDeadline} onExpire={submit} className="text-xs sm:hidden" />
          )}
          <button
            type="button"
            onClick={jumpNextUnanswered}
            title="跳到第一个未作答的题"
            className="btn hidden px-2.5 py-1.5 text-xs text-muted sm:inline-flex"
          >
            下一题未答
          </button>
          <button
            type="button"
            onClick={() => setShowSheet(true)}
            title="打开答题卡"
            className="btn px-2.5 py-1.5 text-xs"
          >
            <Icons.List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">答题卡</span>
          </button>
          <button
            type="button"
            onClick={toggleZh}
            aria-pressed={showZh}
            title={showZh ? '隐藏题目与选项的中文翻译' : '显示题目与选项的中文翻译'}
            className={cn(
              'btn px-2.5 py-1.5 text-xs',
              showZh ? 'border-brand/50 bg-brand-soft text-brand' : 'text-muted'
            )}
          >
            中文
          </button>
          <Segmented value={mode} onChange={(m) => setMode(m)} options={MODE_OPTIONS} size="sm" />
          {!submitted ? (
            <button type="button" className="btn btn-primary text-sm" onClick={submit} disabled={answeredCount === 0}>
              <Icons.Check className="h-4 w-4" />
              交卷
            </button>
          ) : (
            <button type="button" className="btn text-sm" onClick={restart}>
              <Icons.Refresh className="h-4 w-4" />
              重做
            </button>
          )}
        </div>
        <div className="mx-auto mt-2 max-w-content">
          <ProgressBar value={answeredCount} max={questions.length} />
        </div>
      </div>

      {/* 成绩单 */}
      {submitted && score && (
        <section className="card mb-5 animate-rise p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold text-brand">{score.total.c}</span>
              <span className="text-muted">/ {score.total.t}</span>
            </div>
            <div className="text-sm text-muted">
              正确率 {score.total.t ? Math.round((score.total.c / score.total.t) * 100) : 0}%
              {progress?.startedAt && progress?.finishedAt && (
                <span className="ml-2">用时 {fmtTime((progress.finishedAt - progress.startedAt) / 1000)}</span>
              )}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Link href="/mistakes" className="btn text-sm">
                <Icons.Star className="h-4 w-4" />
                错题本
              </Link>
              <Link href="/stats" className="btn text-sm">
                <Icons.Chart className="h-4 w-4" />
                统计
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {PART_ORDER.map((p) => {
              const s = score.byPart[p];
              if (!s) return null;
              const pct = s.t ? Math.round((s.c / s.t) * 100) : 0;
              return (
                <div key={p} className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{PART_LABEL[p]}</span>
                    <span className="font-mono">
                      {s.c}/{s.t}
                    </span>
                  </div>
                  <ProgressBar value={s.c} max={s.t} className="mt-1.5" />
                  <p className="mt-1 text-right text-[11px] text-muted">{pct}%</p>
                </div>
              );
            })}
          </div>
          {submitted && (
            <p className="mt-3 text-xs text-muted">
              已自动收录错题 {paper.questions.filter((q) => answers[String(q.no)] && answers[String(q.no)] !== q.answer).length} 道；未作答的题目不计入错题本。
            </p>
          )}
        </section>
      )}

      {/* 练习模式：题型切换 */}
      {mode === 'practice' && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {sections.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePart(p)}
              className={cn('btn shrink-0 text-sm', activePart === p && 'border-brand/60 bg-brand-soft text-brand')}
            >
              {PART_LABEL[p] ?? '写作翻译'}
            </button>
          ))}
        </div>
      )}

      {/* 各题型区块 */}
      {partsVisible.map((part) => {
        if (part === 'subjective') {
          return (
            <section key="subjective" className="mb-6">
              <SectionTitle part="写作与翻译" tip="主观题不计入自动判分，完成后勾选自评。" />
              <WritingTranslation subjective={paper.subjective} done={subjDone} onDoneChange={onSubjDone} />
            </section>
          );
        }
        if (part === 'listening') {
          const qs = byPart('listening');
          return (
            <section key={part} className="mb-6">
              <SectionTitle part={PART_LABEL[part]} tip={SECTION_TIPS[part]} count={qs.length} answered={qs.filter((q) => answers[String(q.no)]).length} />
              {/* 听力播放器吸顶：滚动到第 8 题以后仍可操作播放/分段 */}
              <div className="sticky top-[7.25rem] z-20 mb-3.5">
                <AudioPlayer ref={playerRef} audio={audio} storageKey={meta.id} initialSpeed={getSettings().defaultSpeed} compact />
              </div>
              <div className="space-y-3">
                {qs.map((q) => (
                  <QuestionCard
                    key={q.no}
                    q={q}
                    answers={answers}
                    revealed={revealed}
                    editable={editable}
                    onAnswer={onAnswer}
                    allowPeek={mode === 'practice'}
                      showZh={showZh}
                    pieces={audio?.pieces}
                    onPlayPiece={(i) => playerRef.current?.playPiece(i)}
                  />
                ))}
              </div>
            </section>
          );
        }
        if (part === 'cloze') {
          const qs = byPart('cloze');
          return (
            <section key={part} className="mb-6">
              <SectionTitle part={PART_LABEL[part]} tip={SECTION_TIPS[part]} count={qs.length} answered={qs.filter((q) => answers[String(q.no)]).length} />
              <ClozeBoard paper={paper} questions={qs} answers={answers} revealed={revealed} editable={editable} onAnswer={onAnswer} />
            </section>
          );
        }
        if (part === 'matching') {
          const qs = byPart('matching');
          return (
            <section key={part} className="mb-6">
              <SectionTitle part={PART_LABEL[part]} tip={SECTION_TIPS[part]} count={qs.length} answered={qs.filter((q) => answers[String(q.no)]).length} />
              <SplitPane
                passage={<PassagePane paper={paper} q={qs[0]} answers={answers} reveal={revealed} />}
                paneKey="matching"
              >
                <div className="space-y-3">
                  {qs.map((q) => (
                    <QuestionCard
                      key={q.no}
                      q={q}
                      answers={answers}
                      revealed={revealed}
                      editable={editable}
                      onAnswer={onAnswer}
                      allowPeek={mode === 'practice'}
                      showZh={showZh}
                    />
                  ))}
                </div>
              </SplitPane>
            </section>
          );
        }
        // reading
        const all = byPart('reading');
        const groups = Array.from(new Set(all.map((q) => q.passageNo ?? 1))).sort();
        return (
          <section key={part} className="mb-6">
            <SectionTitle part={PART_LABEL[part]} tip={SECTION_TIPS[part]} count={all.length} answered={all.filter((q) => answers[String(q.no)]).length} />
            <div className="space-y-5">
              {groups.map((g) => {
                const qs = all.filter((q) => (q.passageNo ?? 1) === g);
                return (
                  <SplitPane
                    key={g}
                    paneKey={`reading-${g}`}
                    title={`第 ${g} 篇`}
                    passage={<PassagePane paper={paper} q={qs[0]} answers={answers} reveal={revealed} />}
                  >
                    <div className="space-y-3">
                      {qs.map((q) => (
                        <QuestionCard
                          key={q.no}
                          q={q}
                          answers={answers}
                          revealed={revealed}
                          editable={editable}
                          onAnswer={onAnswer}
                          allowPeek={mode === 'practice'}
                      showZh={showZh}
                        />
                      ))}
                    </div>
                  </SplitPane>
                );
              })}
            </div>
          </section>
        );
      })}

      <AnswerSheet
        paper={paper}
        answers={answers}
        results={submitted && score ? score.details : null}
        open={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </div>
  );
}

/* ---------------- 局部组件 ---------------- */

function SectionTitle({ part, tip, count, answered }: { part: string; tip?: string; count?: number; answered?: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-base font-semibold">{part}</h2>
      {count != null && (
        <span className="chip">
          {answered ?? 0}/{count}
        </span>
      )}
      {tip && <p className="w-full text-xs text-muted sm:w-auto">{tip}</p>}
    </div>
  );
}

/** 原文 / 题目分栏：桌面双栏（原文吸顶），移动端 tab 切换 */
function SplitPane({
  passage,
  children,
  paneKey,
  title,
}: {
  passage: React.ReactNode;
  children: React.ReactNode;
  paneKey: string;
  title?: string;
}) {
  const [tab, setTab] = useState<'passage' | 'questions'>('passage');
  void paneKey;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 lg:hidden">
        <Segmented
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: 'passage', label: '原文' },
            { value: 'questions', label: '题目' },
          ]}
        />
        {title && <span className="text-xs text-muted">{title}</span>}
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className={cn('lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1', tab === 'passage' ? 'block' : 'hidden lg:block')}>
          <div className="card p-4 sm:p-5">{passage}</div>
        </div>
        <div className={cn('mt-3 lg:mt-0', tab === 'questions' ? 'block' : 'hidden lg:block')}>{children}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-28 animate-pulse bg-surface-2/60" />
      ))}
      <p className="text-center text-sm text-muted">正在加载试卷…</p>
    </div>
  );
}
