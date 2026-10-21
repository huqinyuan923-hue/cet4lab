/**
 * 刷题核心纯函数守卫：渲染契约（选项归一）、判分、听力分段定位、原文切分。
 * 跑法：pnpm test（node --test，零依赖）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AudioPiece, Paper, Question } from '../lib/types.ts';
import {
  EXAM_SECONDS,
  LETTERS,
  PART_LABEL,
  PART_ORDER,
  clozeSentence,
  clozeTokens,
  correctTextFor,
  findSentence,
  fmtTime,
  letter,
  matchingParagraphs,
  normOptions,
  numberedParagraphs,
  pieceForQuestion,
  pieceQuestionRange,
  scorePaper,
  stemFor,
  stripPrefix,
  truncate,
} from '../lib/paper.ts';

const q = (o: Partial<Question>) => o as Question;

test('选项归一：听力/阅读剥离自带前缀并对齐中文', () => {
  const opts = normOptions(
    q({ part: 'listening', options: ['A) because it is cheap', 'B) 两项', 'C) ', 'D) four'], optionsZh: ['因为便宜', '两项', '', '四项'] })
  );
  assert.deepEqual(opts.map((x) => x.key), ['A', 'B', 'C', 'D']);
  assert.equal(opts[0].text, 'because it is cheap');
  assert.equal(opts[0].textZh, '因为便宜');
  assert.equal(opts[2].text, '');
  assert.equal(opts[2].textZh, undefined, '空中文不渲染成空字符串');
});

test('选项归一：选词填空取词库、长篇阅读取段落集', () => {
  const cloze = normOptions(q({ part: 'cloze', wordBank: { A: 'apple', K: 'kite' } }));
  assert.deepEqual(cloze, [
    { key: 'A', text: 'apple' },
    { key: 'K', text: 'kite' },
  ]);
  const matching = normOptions(q({ part: 'matching', paraOptions: ['A', 'G'] }));
  assert.deepEqual(matching.map((x) => x.text), ['A 段', 'G 段']);
});

test('stripPrefix 只吃行首的字母选项前缀，不吃正文里的字母', () => {
  assert.equal(stripPrefix('  C) 单词 '), '单词');
  assert.equal(stripPrefix('D、四项'), '四项');
  assert.equal(stripPrefix('P1. 段落编号不是选项前缀'), 'P1. 段落编号不是选项前缀');
  assert.equal(stripPrefix('Q) 17 段卷也要剥'), '17 段卷也要剥');
  assert.equal(stripPrefix('见 A) 项的对照'), '见 A) 项的对照');
});

test('scorePaper：未作答记 null，分题型分别累计', () => {
  const paper = {
    questions: [
      q({ no: 1, part: 'listening', answer: 'A' }),
      q({ no: 2, part: 'listening', answer: 'B' }),
      q({ no: 3, part: 'cloze', answer: 'C' }),
    ],
  } as unknown as Paper;
  const s = scorePaper(paper, { '1': 'A', '2': 'A' });
  assert.deepEqual(s.total, { c: 1, t: 3 });
  assert.deepEqual(s.byPart, { listening: { c: 1, t: 2 }, cloze: { c: 0, t: 1 } });
  assert.equal(s.details[1], true);
  assert.equal(s.details[2], false);
  assert.equal(s.details[3], null, '第 3 题没作答，不能算错');
});

test('正确答案文本：answerText 优先于选项，匹配题带段落摘要', () => {
  assert.equal(correctTextFor(q({ part: 'reading', answer: 'B', answerText: '原文依据句', options: ['B) x'] })), '原文依据句');
  assert.equal(correctTextFor(q({ part: 'listening', answer: 'B', options: ['A) one', 'B) two'] })), 'two');
  assert.equal(correctTextFor(q({ part: 'cloze', answer: 'K', wordBank: { K: 'kite' } })), 'kite');
  assert.equal(
    correctTextFor(q({ part: 'matching', answer: 'A', paraOptions: ['A'], passage: 'A) 该段落讲风力发电' })),
    'A 段 · 该段落讲风力发电'
  );
});

test('matchingParagraphs：按 A) B) 切段并保留续行', () => {
  const ps = matchingParagraphs('A) first\ncont line\n\nB) second\n');
  assert.deepEqual(ps.map((p) => p.key), ['A', 'B']);
  assert.equal(ps[0].text, 'first\ncont line');
  assert.equal(ps[1].text, 'second');
  assert.deepEqual(matchingParagraphs('没有段落标记的文本'), []);
  // 段落字母表必须到 Z：2015-06-3 是 A–Q 共 17 段，Q 还是其中一道题的答案
  assert.deepEqual(matchingParagraphs('Q) 第十七段').map((p) => p.key), ['Q']);
});

test('stemFor：cloze 空题干时从原文还原含空位的那句', () => {
  const passage = 'They can be __(26)__ resources. And parents make __(27)__ teachers of traditions. The end.';
  assert.equal(stemFor(q({ part: 'cloze', no: 27, stem: '', passage })), 'And parents make __(27)__ teachers of traditions.');
  assert.equal(stemFor(q({ part: 'cloze', no: 27, stem: '  已有题干 ', passage })), '  已有题干 ', '已有题干时原样返回');
  assert.equal(stemFor(q({ part: 'cloze', no: 99, stem: '', passage })), '', '原文里没有该空位时返回空串');
  assert.equal(stemFor(q({ part: 'reading', no: 50, stem: '', passage })), '', '非 cloze 不兜底');
  assert.equal(clozeSentence(passage, 26), 'They can be __(26)__ resources.');
  assert.equal(clozeSentence('', 26), '');
});

test('numberedParagraphs：剥掉 P1 前缀，clozeTokens：按 __(n)__ 切', () => {
  assert.deepEqual(numberedParagraphs('P1 aaa\n\nP2 bbb'), ['aaa', 'bbb']);
  assert.deepEqual(clozeTokens('He is __(26)__ tall, she is __(27)__ ok.'), [
    { type: 'text', text: 'He is ' },
    { type: 'blank', no: 26 },
    { type: 'text', text: ' tall, she is ' },
    { type: 'blank', no: 27 },
    { type: 'text', text: ' ok.' },
  ]);
  assert.deepEqual(clozeTokens('没有空位'), [{ type: 'text', text: '没有空位' }]);
});

test('听力分段：区间优先于单题，找不到返回 -1', () => {
  const range = (label: string) => pieceQuestionRange({ label } as AudioPiece);
  assert.deepEqual(range('Section A · 第 1 篇 · 1–2 题'), [1, 2]);
  assert.deepEqual(range('Section B · 长对话 19—21 题'), [19, 21]);
  assert.deepEqual(range('Recording 第 3 题'), [3, 3]);
  assert.equal(range('没有题号的标签'), null);

  const pieces = [{ label: '1–2 题' }, { label: '3 题' }, { label: '无' }] as AudioPiece[];
  assert.equal(pieceForQuestion(pieces, 2), 0);
  assert.equal(pieceForQuestion(pieces, 3), 1);
  assert.equal(pieceForQuestion(pieces, 9), -1);
});

test('fmtTime：负数归零，超过一小时补时位', () => {
  assert.equal(fmtTime(-5), '00:00');
  assert.equal(fmtTime(0), '00:00');
  assert.equal(fmtTime(65), '01:05');
  assert.equal(fmtTime(3661), '1:01:01');
  assert.equal(EXAM_SECONDS, 125 * 60);
});

test('findSentence：取包含目标词的整句，超长截断', () => {
  assert.equal(findSentence('One. The quick brown fox jumps. Two.', 'fox'), 'The quick brown fox jumps.');
  assert.equal(findSentence('', 'fox'), undefined);
  assert.equal(findSentence('abc', ''), undefined);
  assert.equal(findSentence('abc def', 'qq'), undefined);
  const long = findSentence(`x ${'y'.repeat(300)} word end. tail`, 'word');
  assert.ok(long);
  assert.equal(long.length, 261, '整句超过 260 字符要截断');

  assert.equal(truncate('  hello  ', 10), 'hello');
  assert.equal(truncate('xxxxx', 3), 'xxx…');
});

test('题型常量：顺序与中文标签必须齐全', () => {
  assert.deepEqual(PART_ORDER, ['listening', 'cloze', 'matching', 'reading']);
  for (const part of PART_ORDER) assert.ok(PART_LABEL[part], `${part} 缺中文标签`);
  assert.equal(LETTERS.length, 16);
  assert.equal(letter(0), 'A');
  assert.equal(letter(15), 'P');
});
