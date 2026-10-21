/**
 * localStorage 数据层守卫：键命名、容错读取、去重排序、备份导入导出的往返一致性。
 * 用最小 window/localStorage 桩替代浏览器。
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Mistake, Part, Progress, WordEntry } from '../lib/types.ts';
import {
  DEFAULT_SETTINGS,
  K,
  addCheckin,
  addMistakes,
  addWord,
  aggregate,
  allProgress,
  exportAll,
  getAnswers,
  getCheckins,
  getMistakes,
  getSettings,
  getSubjectiveDone,
  getWordbook,
  importAll,
  removeMistake,
  removeWord,
  setAnswers,
  setMistakeMastered,
  setProgress,
  setSettings,
  setSubjectiveDone,
  today,
  updateWord,
  wipeAll,
} from '../lib/storage.ts';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  get length() {
    return this.m.size;
  }
  raw() {
    return this.m;
  }
}

const store = new MemStorage();
const dispatched: string[] = [];
(globalThis as unknown as { window: unknown }).window = {
  localStorage: store,
  dispatchEvent: (e: Event) => {
    dispatched.push(e.type);
    return true;
  },
};

const mistake = (paperId: string, no: number, addedAt: number, mastered = false): Mistake => ({
  paperId,
  no,
  part: 'reading' as Part,
  partName: '仔细阅读',
  stem: `q${no}`,
  userAnswer: 'A',
  correctAnswer: 'B',
  addedAt,
  mastered,
});

const word = (w: string, addedAt = 1): WordEntry => ({ word: w, source: { type: 'dict' }, addedAt });

beforeEach(() => {
  store.raw().clear();
  dispatched.length = 0;
});

test('键前缀与默认值：cet4: 命名空间稳定', () => {
  assert.equal(K.answers('2026-06-3'), 'cet4:answers:2026-06-3');
  assert.equal(K.progress('2026-06-3'), 'cet4:progress:2026-06-3');
  assert.equal(K.mistakes, 'cet4:mistakes');
  assert.deepEqual(getSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(getAnswers('nope'), {});
  assert.equal(getSubjectiveDone('nope').writing, false);
});

test('坏数据不炸：JSON 解析失败一律回落默认值', () => {
  store.setItem(K.answers('p1'), '{不是 json');
  store.setItem(K.settings, '{');
  assert.deepEqual(getAnswers('p1'), {});
  assert.deepEqual(getSettings(), DEFAULT_SETTINGS);
});

test('作答与进度：写入会广播 cet4:changed', () => {
  setAnswers('p1', { '1': 'A', '2': 'B' });
  assert.deepEqual(getAnswers('p1'), { '1': 'A', '2': 'B' });
  assert.deepEqual(dispatched, ['cet4:changed']);

  setSubjectiveDone('p1', { writing: true });
  assert.deepEqual(getSubjectiveDone('p1'), { writing: true, translation: false }, '部分更新不能覆盖另一项');
});

test('错题本：按「套卷#题号」去重、按 addedAt 倒序', () => {
  addMistakes([mistake('p1', 1, 100), mistake('p1', 2, 200)]);
  addMistakes([mistake('p1', 1, 300)]); // 重答同一题，覆盖旧记录
  const list = getMistakes();
  assert.equal(list.length, 2);
  assert.equal(list[0].no, 1);
  assert.equal(list[0].addedAt, 300);
  assert.deepEqual(addMistakes([]), undefined, '空数组不写也不广播');

  setMistakeMastered('p1', 2, true);
  assert.equal(getMistakes().find((m) => m.no === 2)?.mastered, true);
  removeMistake('p1', 1);
  assert.deepEqual(getMistakes().map((m) => m.no), [2]);
});

test('生词本：大小写不敏感去重、原地更新释义', () => {
  assert.equal(addWord(word('Abandon')), true);
  assert.equal(addWord(word('ABANDON', 2)), false, '同一词不得重复收藏');
  assert.equal(getWordbook().length, 1);
  assert.equal(addWord(word('kite', 3)), true);
  assert.deepEqual(getWordbook().map((w) => w.word), ['kite', 'Abandon'], '新词置顶');

  updateWord('abandon', { trans: 'v. 放弃' });
  assert.equal(getWordbook().find((w) => w.word === 'Abandon')?.trans, 'v. 放弃');
  removeWord('KITE');
  assert.deepEqual(getWordbook().map((w) => w.word), ['Abandon']);
});

test('打卡：同一天重复打卡只记一次，列表升序', () => {
  addCheckin('2026-10-02');
  addCheckin('2026-10-01');
  const before = dispatched.length;
  addCheckin('2026-10-02');
  assert.deepEqual(getCheckins(), ['2026-10-01', '2026-10-02']);
  assert.equal(dispatched.length, before, '已存在时不写存储');
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('allProgress 只枚举进度键，aggregate 汇总正确', () => {
  const done: Progress = {
    status: 'done',
    startedAt: 10,
    finishedAt: 20,
    score: { total: { c: 40, t: 55 }, byPart: { listening: { c: 20, t: 25 }, reading: { c: 20, t: 30 } } },
  };
  const doing: Progress = { status: 'in-progress', startedAt: 5 };
  setProgress('p1', done);
  setProgress('p2', doing);
  setAnswers('p1', { '1': 'A', '2': 'B', '3': 'C' });
  store.setItem('cet4:mistakes', '[]');

  assert.deepEqual(Object.keys(allProgress()).sort(), ['p1', 'p2']);
  const agg = aggregate();
  assert.equal(agg.donePapers, 1);
  assert.equal(agg.startedPapers, 1);
  assert.equal(agg.answeredQuestions, 3);
  assert.equal(agg.lastActivity, 20);
  assert.deepEqual(agg.byPart, { listening: { c: 20, t: 25 }, reading: { c: 20, t: 30 } });
});

test('备份导出→导入可往返，非本站文件被拒', () => {
  setProgress('p1', { status: 'done', finishedAt: 1 });
  setAnswers('p1', { '1': 'A' });
  addMistakes([mistake('p1', 1, 9)]);
  addWord(word('kite'));
  addCheckin('2026-10-01');
  setSettings({ dailyNew: 40, showZh: false });

  const backup = exportAll();
  assert.equal(backup.app, 'CET4Lab');
  assert.equal(backup.version, 1);
  assert.deepEqual(Object.keys(backup.data.papers), ['p1']);

  store.setItem('user:keepme', 'not ours');
  wipeAll();
  assert.equal(getWordbook().length, 0);
  assert.equal(getMistakes().length, 0);
  assert.equal(store.raw().get('user:keepme'), 'not ours', '清理不能越出 cet4: 命名空间');

  const r = importAll(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(r, { ok: true, papers: 1 });
  assert.deepEqual(getAnswers('p1'), { '1': 'A' });
  assert.equal(getMistakes().length, 1);
  assert.equal(getWordbook()[0].word, 'kite');
  assert.deepEqual(getCheckins(), ['2026-10-01']);
  assert.equal(getSettings().dailyNew, 40);
  assert.equal(getSettings().defaultSpeed, 1, '缺失字段回落默认值');

  assert.deepEqual(importAll(null), { ok: false, error: '文件内容不是有效 JSON 对象' });
  assert.deepEqual(importAll({ app: 'Other', version: 1, data: {} }), { ok: false, error: '不是 CET4Lab 的备份文件' });
});

test('导入的打卡记录去重排序，脏键不影响后续读写', () => {
  const r = importAll({
    app: 'CET4Lab',
    version: 1,
    data: { papers: {}, mistakes: [], wordbook: [], checkins: ['2026-10-02', '2026-10-01', '2026-10-02'], settings: { theme: 'dark' } },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(getCheckins(), ['2026-10-01', '2026-10-02']);
  assert.equal(getSettings().theme, 'dark');
});
