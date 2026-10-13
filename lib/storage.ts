'use client';

/**
 * localStorage 数据层（键前缀 cet4:，模型见 BUILD-PLAN.md §9）。
 * 所有写入都会派发 'cet4:changed' 事件，供同页其他组件刷新。
 */
import type { Mistake, PartScore, Progress, Settings, WordEntry } from './types';

const P = 'cet4:';
export const K = {
  answers: (id: string) => `${P}answers:${id}`,
  progress: (id: string) => `${P}progress:${id}`,
  mistakes: `${P}mistakes`,
  wordbook: `${P}wordbook`,
  srs: `${P}srs`,
  checkins: `${P}checkins`,
  settings: `${P}settings`,
} as const;

export const DEFAULT_SETTINGS: Settings = { dailyNew: 20, defaultSpeed: 1, theme: 'auto' };

const isBrowser = () => typeof window !== 'undefined';

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('cet4:changed'));
  } catch {
    // 容量超限等异常不阻断做题
  }
}

function remove(key: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new Event('cet4:changed'));
}

/* ---------- 作答 ---------- */

export type AnswerMap = Record<string, string>;

export const getAnswers = (paperId: string): AnswerMap => read<AnswerMap>(K.answers(paperId), {});
export const setAnswers = (paperId: string, a: AnswerMap) => write(K.answers(paperId), a);

/* ---------- 主观题完成自评 ---------- */

export interface SubjectiveDone {
  writing: boolean;
  translation: boolean;
}

export const getSubjectiveDone = (paperId: string): SubjectiveDone =>
  read<SubjectiveDone>(`${P}subj:${paperId}`, { writing: false, translation: false });

export const setSubjectiveDone = (paperId: string, patch: Partial<SubjectiveDone>) =>
  write(`${P}subj:${paperId}`, { ...getSubjectiveDone(paperId), ...patch });

/* ---------- 进度 ---------- */

export const getProgress = (paperId: string): Progress | null => read<Progress | null>(K.progress(paperId), null);
export const setProgress = (paperId: string, p: Progress) => write(K.progress(paperId), p);

export function allProgress(): Record<string, Progress> {
  const out: Record<string, Progress> = {};
  if (!isBrowser()) return out;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(`${P}progress:`)) {
      out[key.slice(`${P}progress:`.length)] = read<Progress>(key, { status: 'in-progress' });
    }
  }
  return out;
}

/* ---------- 打卡 ---------- */

export const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const getCheckins = (): string[] => read<string[]>(K.checkins, []);
export function addCheckin(day = today()) {
  const list = getCheckins();
  if (!list.includes(day)) write(K.checkins, [...list, day].sort());
}

/* ---------- 错题本 ---------- */

export const getMistakes = (): Mistake[] => read<Mistake[]>(K.mistakes, []);

export function addMistakes(items: Mistake[]) {
  if (!items.length) return;
  const list = getMistakes();
  const map = new Map(list.map((m) => [`${m.paperId}#${m.no}`, m]));
  for (const it of items) map.set(`${it.paperId}#${it.no}`, it);
  write(K.mistakes, [...map.values()].sort((a, b) => b.addedAt - a.addedAt));
}

export function removeMistake(paperId: string, no: number) {
  write(K.mistakes, getMistakes().filter((m) => !(m.paperId === paperId && m.no === no)));
}

export function setMistakeMastered(paperId: string, no: number, mastered: boolean) {
  write(
    K.mistakes,
    getMistakes().map((m) => (m.paperId === paperId && m.no === no ? { ...m, mastered } : m))
  );
}

/* ---------- 生词本 ---------- */

export const getWordbook = (): WordEntry[] => read<WordEntry[]>(K.wordbook, []);

export function addWord(entry: WordEntry): boolean {
  const list = getWordbook();
  const key = entry.word.toLowerCase();
  if (list.some((w) => w.word.toLowerCase() === key)) return false;
  write(K.wordbook, [entry, ...list]);
  return true;
}

export function removeWord(word: string) {
  write(K.wordbook, getWordbook().filter((w) => w.word.toLowerCase() !== word.toLowerCase()));
}

export function updateWord(word: string, patch: Partial<WordEntry>) {
  write(
    K.wordbook,
    getWordbook().map((w) => (w.word.toLowerCase() === word.toLowerCase() ? { ...w, ...patch } : w))
  );
}

/* ---------- 设置 ---------- */

export const getSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) });
export const setSettings = (patch: Partial<Settings>) => write(K.settings, { ...getSettings(), ...patch });

/* ---------- 汇总统计 ---------- */

export interface Aggregate {
  donePapers: number;
  startedPapers: number;
  byPart: Record<string, PartScore>;
  answeredQuestions: number;
  lastActivity?: number;
}

export function aggregate(): Aggregate {
  const out: Aggregate = { donePapers: 0, startedPapers: 0, byPart: {}, answeredQuestions: 0 };
  for (const [id, p] of Object.entries(allProgress())) {
    void id;
    if (p.status === 'done') out.donePapers++;
    else out.startedPapers++;
    const answers = getAnswers(id);
    out.answeredQuestions += Object.keys(answers).length;
    if (p.score) {
      for (const [part, s] of Object.entries(p.score.byPart)) {
        const prev = out.byPart[part] || { c: 0, t: 0 };
        out.byPart[part] = { c: prev.c + s.c, t: prev.t + s.t };
      }
    }
    const ts = p.finishedAt ?? p.startedAt;
    if (ts && (!out.lastActivity || ts > out.lastActivity)) out.lastActivity = ts;
  }
  return out;
}

/* ---------- 导出 / 导入 ---------- */

export const EXPORT_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  app: string;
  data: {
    papers: Record<string, { answers: AnswerMap; progress: Progress | null }>;
    mistakes: Mistake[];
    wordbook: WordEntry[];
    checkins: string[];
    settings: Settings;
  };
}

export function exportAll(): BackupFile {
  const papers: BackupFile['data']['papers'] = {};
  for (const [id, progress] of Object.entries(allProgress())) {
    papers[id] = { answers: getAnswers(id), progress };
  }
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'CET4Lab',
    data: {
      papers,
      mistakes: getMistakes(),
      wordbook: getWordbook(),
      checkins: getCheckins(),
      settings: getSettings(),
    },
  };
}

export function importAll(raw: unknown): { ok: true; papers: number } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '文件内容不是有效 JSON 对象' };
  const f = raw as Partial<BackupFile>;
  if (f.app !== 'CET4Lab' || typeof f.version !== 'number' || !f.data) {
    return { ok: false, error: '不是 CET4Lab 的备份文件' };
  }
  const d = f.data;
  let n = 0;
  for (const [id, entry] of Object.entries(d.papers || {})) {
    if (entry?.answers) write(K.answers(id), entry.answers);
    if (entry?.progress) write(K.progress(id), entry.progress);
    n++;
  }
  if (d.mistakes) write(K.mistakes, d.mistakes);
  if (d.wordbook) write(K.wordbook, d.wordbook);
  if (d.checkins) write(K.checkins, [...new Set(d.checkins)].sort());
  if (d.settings) write(K.settings, { ...DEFAULT_SETTINGS, ...d.settings });
  return { ok: true, papers: n };
}

export function wipeAll() {
  if (!isBrowser()) return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(P)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
  window.dispatchEvent(new Event('cet4:changed'));
}
