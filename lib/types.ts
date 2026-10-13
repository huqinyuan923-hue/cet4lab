/** 共享类型：字段契约见 BUILD-PLAN.md §2.2 */

export type Part = 'listening' | 'cloze' | 'matching' | 'reading';

export interface Question {
  no: number;
  part: Part;
  partName: string;
  stem: string;
  stemZh?: string;
  options?: string[] | null;
  optionsZh?: string[] | null;
  answer: string;
  answerText?: string;
  type?: string;
  explain?: Record<string, string> | null;
  passage?: string;
  passageNo?: number;
  wordBank?: Record<string, string>;
  pos?: string;
  paraOptions?: string[];
  anchor?: string;
}

export interface TranslationSentence {
  trunk?: string;
  downgrade?: string;
  grammar?: string;
  target?: string;
}

export interface Subjective {
  writing?: { directions?: string; model?: string; modelZh?: string; outline?: string };
  translation?: {
    directions?: string;
    source?: string;
    reference?: string;
    sentences?: TranslationSentence[];
  };
}

export interface Paper {
  id: string;
  label: string;
  set: string;
  questions: Question[];
  subjective?: Subjective;
}

export interface PaperMeta {
  id: string;
  label: string;
  set: string;
  count: number;
  nos: number[];
  parts: Record<string, number>;
  period?: string;
  year?: number;
  half?: string;
  month?: number;
  share?: string;
  hasAudio: boolean;
  audioId: string;
  hasSubjective: boolean;
}

export interface AudioPiece {
  label: string;
  start: number;
  end: number;
}

export interface AudioEntry {
  id: string;
  label: string;
  page: string;
  m3u8: string;
  proxyPath: string;
  from: string;
  pieces: AudioPiece[];
}

export interface PartScore {
  c: number;
  t: number;
}

export interface Progress {
  status: 'in-progress' | 'done';
  startedAt?: number;
  finishedAt?: number;
  timed?: boolean;
  examDeadline?: number;
  score?: { total: PartScore; byPart: Record<string, PartScore> };
}

export interface Mistake {
  paperId: string;
  no: number;
  part: Part;
  partName: string;
  stem: string;
  stemZh?: string;
  userAnswer: string | null;
  correctAnswer: string;
  correctText?: string;
  options?: string[] | null;
  optionsZh?: string[] | null;
  paraOptions?: string[];
  anchor?: string;
  explain?: Record<string, string> | null;
  addedAt: number;
  mastered: boolean;
}

export interface SrsState {
  ef: number;
  interval: number;
  reps: number;
  due: string; // YYYY-MM-DD
}

export interface WordEntry {
  word: string;
  source: { type: 'paper' | 'dict'; paperId?: string; no?: number };
  addedAt: number;
  /** 收藏时所在真题原句，复习卡片用 */
  context?: string;
  /** 词库释义（若已导入词库数据） */
  trans?: string;
  phonetic?: string;
  srs?: SrsState;
}

export interface Settings {
  dailyNew: number;
  defaultSpeed: number;
  theme: 'auto' | 'light' | 'dark';
}
