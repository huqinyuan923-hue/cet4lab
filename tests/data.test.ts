/**
 * 已提交数据产物的契约守卫（public/data）。
 * 为什么必须单独测：Vercel 构建机上没有源仓库，scripts/build-data.mjs 会直接沿用
 * public/data 里的 JSON（见该脚本的「沿用已提交产物」分支），线上跑的就是这些文件本身。
 * 这里只读，不改。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Paper, PaperMeta } from '../lib/types.ts';
import { PART_LABEL, PART_ORDER, pieceQuestionRange } from '../lib/paper.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAPER_DIR = path.join(ROOT, 'public', 'data', 'papers');
const AUDIO_FILE = path.join(ROOT, 'public', 'data', 'audio', 'index.json');

/** 与 app/api/listen/[...path]/route.ts 的白名单规则保持一致 */
const PROXY_PATH_RE = /^\/cet4\/\d{1,6}\/[A-Za-z0-9._-]+$/;
const ALLOWED_HOST = 'listening.lazynote.cn';

const EXPECT = { papers: 46, questions: 2530, perPaper: 55, parts: { listening: 25, cloze: 10, matching: 10, reading: 10 } };

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

const paperIds = fs
  .readdirSync(PAPER_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();
const index = readJson<PaperMeta[]>(path.join(PAPER_DIR, 'index.json'));
const audio = readJson<Record<string, { id: string; label: string; m3u8: string; proxyPath: string; from: string; pieces: { label: string; start: number; end: number }[] }>>(
  AUDIO_FILE
);
const papers = new Map(paperIds.map((id) => [id, readJson<Paper>(path.join(PAPER_DIR, `${id}.json`))] as const));

test('套卷集合：46 套、无缺号、索引与文件一一对应', () => {
  assert.equal(paperIds.length, EXPECT.papers);
  assert.equal(new Set(paperIds).size, EXPECT.papers);
  assert.equal(index.length, EXPECT.papers);
  assert.deepEqual(
    index.map((m) => m.id).slice().sort(),
    paperIds,
    'index.json 与 papers/*.json 必须同集合'
  );
  assert.deepEqual(
    index.map((m) => m.id),
    index.map((m) => m.id).slice().sort().reverse(),
    '列表默认新卷在前'
  );
});

test('每套题量与题型分布：55 题 = 25 听力 + 10 完形 + 10 匹配 + 10 阅读', () => {
  let total = 0;
  for (const id of paperIds) {
    const p = papers.get(id)!;
    assert.equal(p.id, id, `${id} 文件内 id 与文件名不一致`);
    assert.ok(p.label && p.set, `${id} 缺 label/set`);
    assert.equal(p.questions.length, EXPECT.perPaper, `${id} 题数异常`);
    total += p.questions.length;

    const nos = p.questions.map((q) => q.no).sort((a, b) => a - b);
    assert.deepEqual(nos, Array.from({ length: 55 }, (_, i) => i + 1), `${id} 题号必须连续覆盖 1–55`);

    const counts: Record<string, number> = {};
    for (const q of p.questions) counts[q.part] = (counts[q.part] || 0) + 1;
    assert.deepEqual(counts, EXPECT.parts, `${id} 题型分布变了`);
  }
  assert.equal(total, EXPECT.questions);
});

test('题干与解析：不得出现空题干、未知题型或无解析的客观题', () => {
  for (const id of paperIds) {
    for (const q of papers.get(id)!.questions) {
      const tag = `${id}#${q.no}`;
      assert.ok(PART_ORDER.includes(q.part), `${tag} 未知题型 ${q.part}`);
      assert.ok(q.stem?.trim(), `${tag} 题干为空`);
      assert.equal(
        q.partName.startsWith(PART_LABEL[q.part]),
        true,
        `${tag} partName「${q.partName}」与题型标签「${PART_LABEL[q.part]}」脱节`
      );
      assert.ok(q.explain && Object.keys(q.explain).length > 0, `${tag} 缺解析`);
    }
  }
});

test('答案必须落在该题可用选项内', () => {
  for (const id of paperIds) {
    for (const q of papers.get(id)!.questions) {
      const tag = `${id}#${q.no}(${q.part})`;
      assert.ok(q.answer, `${tag} answer 为空`);
      if (q.part === 'listening' || q.part === 'reading') {
        assert.equal(q.options?.length, 4, `${tag} 选项数不是 4`);
        assert.match(q.answer, /^[A-D]$/, `${tag} 答案「${q.answer}」不在 A–D`);
      } else if (q.part === 'cloze') {
        assert.equal(Object.keys(q.wordBank || {}).length, 15, `${tag} 词库不是 15 项`);
        assert.ok(Object.hasOwn(q.wordBank || {}, q.answer), `${tag} 答案「${q.answer}」不在词库`);
      } else {
        assert.ok((q.paraOptions || []).includes(q.answer), `${tag} 答案「${q.answer}」不在段落集`);
      }
    }
  }
});

test('主观题：写作与翻译必须齐备，翻译带逐句拆解', () => {
  for (const id of paperIds) {
    const s = papers.get(id)!.subjective;
    assert.ok(s?.writing?.directions?.trim(), `${id} 缺写作题干`);
    assert.ok(s?.writing?.model?.trim(), `${id} 缺范文`);
    assert.ok(s?.writing?.modelZh?.trim(), `${id} 缺范文译文`);
    assert.ok(s?.translation?.source?.trim(), `${id} 缺翻译原文`);
    assert.ok(s?.translation?.reference?.trim(), `${id} 缺翻译参考译文`);
    assert.ok((s?.translation?.sentences?.length ?? 0) > 0, `${id} 缺逐句拆解`);
    // outline 是「带编号的条目数组」，不是字符串：渲染处必须 .map()，
    // 直接把数组塞进 <p> 会触发 React error #31 并被错误边界整页接管。
    assert.ok(Array.isArray(s?.writing?.outline) && s!.writing!.outline!.length > 0, `${id} writing.outline 不是非空数组`);
    for (const o of s!.writing!.outline!) {
      assert.equal(typeof o.no, 'number', `${id} 提纲项缺数字 no`);
      assert.ok(o.text?.trim(), `${id} 提纲项 ${o.no} 正文为空`);
    }
    for (const sent of s!.translation!.sentences!) {
      for (const key of ['trunk', 'downgrade', 'grammar', 'target'] as const) {
        assert.ok(sent[key], `${id} 逐句拆解缺 ${key}`);
      }
    }
  }
});

test('索引元信息与真实内容一致', () => {
  for (const m of index) {
    const p = papers.get(m.id)!;
    assert.equal(m.count, p.questions.length, `${m.id} count 与实际题数不符`);
    assert.deepEqual(m.nos, p.questions.map((q) => q.no).sort((a, b) => a - b), `${m.id} nos 与题号不符`);
    const counts: Record<string, number> = {};
    for (const q of p.questions) counts[q.part] = (counts[q.part] || 0) + 1;
    assert.deepEqual(m.parts, counts, `${m.id} parts 与实际分布不符`);
    assert.equal(m.hasSubjective, Boolean(p.subjective?.writing || p.subjective?.translation), `${m.id} hasSubjective 与实际不符`);
    assert.equal(m.audioId, m.id, `${m.id} audioId 应指向自身`);
    assert.equal(m.hasAudio, true, `${m.id} hasAudio 必须为真`);
    assert.match(String(m.year), /^\d{4}$/, `${m.id} year 必须是四位年份`);
    // 2023 年 3 月的延考卷归属 2022 下半年，年份筛选按 period 而不是按 id 前缀
    assert.equal(m.period, `${m.year}${m.half}`, `${m.id} period 与 year+half 不一致，列表分组会错`);
  }
});

test('音频表：每套卷可播，且路径形态满足代理白名单', () => {
  assert.deepEqual(Object.keys(audio).sort(), paperIds, 'audio/index.json 与套卷集合不一致');
  for (const id of paperIds) {
    const a = audio[id];
    assert.equal(a.id, id, `${id} 音频条目 id 不一致`);
    assert.ok(a.label, `${id} 缺音频标签`);
    assert.ok(a.m3u8.startsWith(`https://${ALLOWED_HOST}/`), `${id} m3u8 主机不在白名单：${a.m3u8}`);
    assert.match(a.proxyPath, PROXY_PATH_RE, `${id} proxyPath 会被 /api/listen 判 400：${a.proxyPath}`);
    assert.equal(new URL(a.m3u8).pathname, a.proxyPath, `${id} proxyPath 与 m3u8 路径不一致`);
    if (a.from !== 'self') assert.ok(paperIds.includes(a.from), `${id} 借用不存在的套卷 ${a.from}`);

    const ranges = a.pieces
      .map((p) => pieceQuestionRange({ label: p.label, start: p.start, end: p.end }))
      .filter((r): r is [number, number] => r !== null)
      .sort((x, y) => x[0] - y[0]);
    assert.ok(ranges.length > 0, `${id} 分段标签解析不出题号，精听面板会是空的`);
    let expect = 1;
    for (const [s, e] of ranges) {
      assert.equal(s, expect, `${id} 听力分段不连续：期望从 ${expect} 题开始，实际 ${s}`);
      expect = e + 1;
    }
    assert.equal(expect - 1, EXPECT.parts.listening, `${id} 听力分段没覆盖到第 25 题`);
  }
});
