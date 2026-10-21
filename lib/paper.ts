import type { AudioPiece, Paper, Part, PartScore, Question } from './types';

export const LETTERS = 'ABCDEFGHIJKLMNOP'.split('');
export const letter = (i: number) => String.fromCharCode(65 + i);
export const PART_ORDER: Part[] = ['listening', 'cloze', 'matching', 'reading'];
export const PART_LABEL: Record<string, string> = {
  listening: '听力理解',
  cloze: '选词填空',
  matching: '长篇阅读',
  reading: '仔细阅读',
};
export const PART_SHORT: Record<string, string> = {
  listening: '听力',
  cloze: '选词',
  matching: '匹配',
  reading: '阅读',
};

export function partsSummary(parts: Record<string, number> | undefined): string {
  if (!parts) return '';
  return PART_ORDER.filter((p) => parts[p]).map((p) => `${PART_SHORT[p]} ${parts[p]}`).join(' · ');
}

export interface NormOption {
  key: string;
  text: string;
  textZh?: string;
}

/** 把各题型的选项/词库统一成 {key, text, textZh} 列表 */
export function normOptions(q: Question): NormOption[] {
  if (q.part === 'matching') {
    return (q.paraOptions || []).map((k) => ({ key: k, text: `${k} 段` }));
  }
  if (q.part === 'cloze') {
    const bank = q.wordBank || {};
    return Object.keys(bank).map((k) => ({ key: k, text: bank[k] }));
  }
  const opts = q.options || [];
  const zh = q.optionsZh || [];
  return opts.map((text, i) => ({ key: letter(i), text: stripPrefix(text), textZh: zh[i]?.trim() || undefined }));
}

/** 有些选项字符串自带 "A) xxx" 前缀，剥离以保证渲染一致 */
export function stripPrefix(s: string): string {
  return s.replace(/^\s*[A-Z][).、]\s*/, '').trim();
}

/** 正确答案的展示文本 */
export function correctTextFor(q: Question): string {
  if (q.part === 'matching') {
    const seg = matchingParagraphs(q.passage || '').find((p) => p.key === q.answer);
    return seg ? `${q.answer} 段 · ${truncate(seg.text, 90)}` : q.answerText || `${q.answer} 段`;
  }
  if (q.answerText) return q.answerText;
  const opt = normOptions(q).find((o) => o.key === q.answer);
  return opt ? opt.text : q.answer;
}

export function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/** 在原文中找出包含该词的那一句（收藏生词时留作复习语境） */
export function findSentence(passage: string, word: string): string | undefined {
  if (!passage || !word) return undefined;
  const flat = passage.replace(/\s+/g, ' ');
  const re = new RegExp(`[^.!?]*\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^.!?]*[.!?]`, 'i');
  const m = flat.match(re);
  const s = m ? m[0] : undefined;
  return s ? truncate(s.trim(), 260) : undefined;
}

/** 取出含 `__(no)__` 空位的那一句：2015–2019 旧卷的 cloze stem 是空的，错题本需要语境 */
export function clozeSentence(passage: string, no: number): string {
  if (!passage) return '';
  const flat = passage.replace(/\s+/g, ' ');
  const blank = new RegExp(`_{0,}\\(${no}\\)_{1,}`);
  const sentence = (flat.match(/[^.!?]+[.!?]*/g) ?? []).find((s) => blank.test(s));
  return sentence ? truncate(sentence.trim(), 260) : '';
}

/** 展示用题干：空 stem 时按题型兜底，避免错题本出现空白题面 */
export function stemFor(q: Question): string {
  if (q.stem?.trim()) return q.stem;
  return q.part === 'cloze' ? clozeSentence(q.passage || '', q.no) : '';
}

/**
 * 长篇阅读原文按 "A) " 段落标记切分。
 * 字母表必须到 Z：2015-06-3 有 A–Q 共 17 段，用 [A-P] 会把 Q 段整段吞掉，
 * 而 Q 恰好是一道题的正确答案，页面上就变成「答案无处可寻」。
 */
export function matchingParagraphs(passage: string): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const re = /^([A-Z])\)\s*/;
  let cur: { key: string; text: string } | null = null;
  for (const line of passage.split('\n')) {
    const m = line.match(re);
    if (m) {
      if (cur) out.push(cur);
      cur = { key: m[1], text: line.slice(m[0].length).trim() };
    } else if (cur) {
      cur.text += line.trim() ? '\n' + line.trim() : '';
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** 仔细阅读原文按 P1/P2… 段落标记切分 */
export function numberedParagraphs(passage: string): string[] {
  const parts = passage
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((p) => p.replace(/^P\d+\s*/, ''));
}

export type ClozeToken = { type: 'text'; text: string } | { type: 'blank'; no: number };

/** 选词填空原文按空位占位切分，兼容 `__(26)__` 与 `(26)______` 两种来源格式 */
export function clozeTokens(passage: string): ClozeToken[] {
  const out: ClozeToken[] = [];
  const re = /_{0,}\((\d+)\)_{1,}/g;
  let last = 0;
  for (const m of passage.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: 'text', text: passage.slice(last, idx) });
    out.push({ type: 'blank', no: Number(m[1]) });
    last = idx + m[0].length;
  }
  if (last < passage.length) out.push({ type: 'text', text: passage.slice(last) });
  return out;
}

/** 听力分段标签（"Section A · 第 1 篇 · 1–2 题"）解析出覆盖的题号 */
export function pieceQuestionRange(piece: AudioPiece): [number, number] | null {
  const m = piece.label.match(/(\d+)\s*[–\-—~]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = piece.label.match(/(\d+)\s*题/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

export function pieceForQuestion(pieces: AudioPiece[], no: number): number {
  return pieces.findIndex((p) => {
    const r = pieceQuestionRange(p);
    return r ? no >= r[0] && no <= r[1] : false;
  });
}

export interface Score {
  total: PartScore;
  byPart: Record<string, PartScore>;
  details: Record<number, boolean | null>; // null = 未作答
}

export function scorePaper(paper: Paper, answers: Record<string, string>): Score {
  const byPart: Record<string, PartScore> = {};
  const details: Record<number, boolean | null> = {};
  let correct = 0;
  for (const q of paper.questions) {
    const a = answers[String(q.no)];
    const hit = a ? a === q.answer : null;
    details[q.no] = hit;
    if (hit) correct++;
    const s = (byPart[q.part] ||= { c: 0, t: 0 });
    s.t++;
    if (hit) s.c++;
  }
  return { total: { c: correct, t: paper.questions.length }, byPart, details };
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export const EXAM_SECONDS = 125 * 60;
