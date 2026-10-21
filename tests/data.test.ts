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
import { PART_LABEL, PART_ORDER, clozeSentence, matchingParagraphs, numberedParagraphs, pieceQuestionRange, stemFor } from '../lib/paper.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAPER_DIR = path.join(ROOT, 'public', 'data', 'papers');
const AUDIO_FILE = path.join(ROOT, 'public', 'data', 'audio', 'index.json');

/** 与 app/api/listen/[...path]/route.ts 的白名单规则保持一致 */
const PROXY_PATH_RE = /^\/cet4\/\d{1,6}\/[A-Za-z0-9._-]+$/;
const ALLOWED_HOST = 'listening.lazynote.cn';

/**
 * 全站两种套卷形态：
 *  - 常规卷 55 题（含 25 题听力），题号 1–55
 *  - 2015–2019 的部分「第 3 套」只收录了笔试 30 题，题号沿用原卷的 26–55
 * 后者没有听力，所以也不该出现在音频表里。
 */
const EXPECT = {
  papers: 76,
  questions: 3980,
  withListening: { count: 55, nos: [1, 55] as [number, number], parts: { listening: 25, cloze: 10, matching: 10, reading: 10 } },
  writtenOnly: { count: 30, nos: [26, 55] as [number, number], parts: { cloze: 10, matching: 10, reading: 10 } },
};

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

/** 分群：有听力 = 常规卷，无听力 = 笔试-only 旧卷 */
const shapeOf = (p: Paper) => (p.questions.some((q) => q.part === 'listening') ? EXPECT.withListening : EXPECT.writtenOnly);
const nosOf = ([from, to]: [number, number]) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('套卷集合：76 套、无缺号、索引与文件一一对应', () => {
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

test('每套题量与题型分布：常规卷 55 题、笔试-only 旧卷 30 题（题号 26–55）', () => {
  let total = 0;
  let writtenOnly = 0;
  for (const id of paperIds) {
    const p = papers.get(id)!;
    assert.equal(p.id, id, `${id} 文件内 id 与文件名不一致`);
    assert.ok(p.label && p.set, `${id} 缺 label/set`);
    const shape = shapeOf(p);
    if (shape === EXPECT.writtenOnly) writtenOnly++;
    assert.equal(p.questions.length, shape.count, `${id} 题数异常`);
    total += p.questions.length;

    const nos = p.questions.map((q) => q.no).sort((a, b) => a - b);
    assert.deepEqual(nos, nosOf(shape.nos), `${id} 题号必须连续覆盖 ${shape.nos[0]}–${shape.nos[1]}`);

    const counts: Record<string, number> = {};
    for (const q of p.questions) counts[q.part] = (counts[q.part] || 0) + 1;
    assert.deepEqual(counts, shape.parts, `${id} 题型分布变了`);
  }
  assert.equal(total, EXPECT.questions);
  assert.equal(writtenOnly, 8, '笔试-only 旧卷应当只有 8 套');
});

test('题干与解析：渲染用的题干不得为空，客观题必须有解析', () => {
  for (const id of paperIds) {
    for (const q of papers.get(id)!.questions) {
      const tag = `${id}#${q.no}`;
      assert.ok(PART_ORDER.includes(q.part), `${tag} 未知题型 ${q.part}`);
      // cloze 的 stem 在 2015–2019 旧卷里是空的，靠 stemFor 从原文空位还原，这里校验还原结果
      assert.ok(stemFor(q).trim(), `${tag}(${q.part}) 题干为空且无法从原文还原`);
      assert.equal(
        q.partName.startsWith(PART_LABEL[q.part]),
        true,
        `${tag} partName「${q.partName}」与题型标签「${PART_LABEL[q.part]}」脱节`
      );
      assert.ok(q.explain && Object.keys(q.explain).length > 0, `${tag} 缺解析`);
    }
  }
});

test('原文切分：页面能切出段落、空位与选项集对得上', () => {
  // 2018-12-1 仔细阅读第二篇在转制时丢了所有换行，本机没有源仓库修不了，
  // 已由 quality-baseline.json 的「原文分段缺失」记账。除此之外的单段原文一律算回归。
  const knownFlatReading = new Set(['2018-12-1']);
  const flat = new Set<string>();
  for (const id of paperIds) {
    for (const q of papers.get(id)!.questions) {
      const tag = `${id}#${q.no}(${q.part})`;
      const psg = q.passage || '';
      if (!psg) continue;
      if (q.part === 'cloze') {
        assert.ok(clozeSentence(psg, q.no), `${tag} 原文里没有 (${q.no}) 空位，选词面板会是死的`);
      } else if (q.part === 'matching') {
        const paras = matchingParagraphs(psg);
        assert.ok(paras.length >= (q.paraOptions || []).length, `${tag} 原文切出 ${paras.length} 段 < 选项集 ${(q.paraOptions || []).length} 个`);
        assert.ok(
          q.paraOptions!.every((k) => paras.some((p) => p.key === k)),
          `${tag} 选项集里有原文不存在的段落`
        );
      } else if (q.part === 'reading') {
        if (numberedParagraphs(psg).length < 2) {
          flat.add(id);
          assert.ok(knownFlatReading.has(id), `${tag} 阅读原文切不出多段（新增缺陷，不在已知白名单里）`);
        }
      }
    }
  }
  assert.deepEqual([...flat], [...knownFlatReading], '单段原文的套卷集合变了：修好了就把白名单删掉，多了就得处理');
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

test('主观题：写作题干与范文、翻译原文与译文齐备；可选字段坏了要能崩在测试里', () => {
  for (const id of paperIds) {
    const s = papers.get(id)!.subjective;
    assert.ok(s?.writing?.directions?.trim(), `${id} 缺写作题干`);
    assert.ok(s?.writing?.model?.trim(), `${id} 缺范文`);
    assert.ok(s?.translation?.source?.trim(), `${id} 缺翻译原文`);
    assert.ok(s?.translation?.reference?.trim(), `${id} 缺翻译参考译文`);
    // 以下两项 2015–2019 旧卷源数据就没有，缺失由 scripts/quality-baseline.json 记账；
    // 一旦出现，就必须是「可以直接渲染」的形态。
    if (s?.writing?.outline !== undefined) {
      // outline 是「带编号的条目数组」，不是字符串：渲染处必须 .map()，
      // 直接把数组塞进 <p> 会触发 React error #31 并被错误边界整页接管。
      assert.ok(Array.isArray(s.writing.outline) && s.writing.outline.length > 0, `${id} writing.outline 不是非空数组`);
      for (const o of s.writing.outline) {
        assert.equal(typeof o.no, 'number', `${id} 提纲项缺数字 no`);
        assert.ok(o.text?.trim(), `${id} 提纲项 ${o.no} 正文为空`);
      }
    }
    if (s?.translation?.sentences !== undefined) {
      assert.ok(s.translation.sentences.length > 0, `${id} translation.sentences 是空数组`);
      for (const sent of s.translation.sentences) {
        for (const key of ['trunk', 'downgrade', 'grammar', 'target'] as const) {
          assert.ok(sent[key], `${id} 逐句拆解缺 ${key}`);
        }
      }
    }
  }
});

test('索引元信息与真实内容一致', () => {
  for (const m of index) {
    const p = papers.get(m.id)!;
    const shape = shapeOf(p);
    const hasListening = shape === EXPECT.withListening;
    assert.equal(m.count, p.questions.length, `${m.id} count 与实际题数不符`);
    assert.deepEqual(m.nos, p.questions.map((q) => q.no).sort((a, b) => a - b), `${m.id} nos 与题号不符`);
    const counts: Record<string, number> = {};
    for (const q of p.questions) counts[q.part] = (counts[q.part] || 0) + 1;
    assert.deepEqual(m.parts, counts, `${m.id} parts 与实际分布不符`);
    assert.equal(m.hasSubjective, Boolean(p.subjective?.writing || p.subjective?.translation), `${m.id} hasSubjective 与实际不符`);
    assert.equal(m.hasAudio, hasListening, `${m.id} hasAudio 与是否含听力不符`);
    assert.equal(m.audioId, hasListening ? m.id : '', `${m.id} audioId 应当指向自身（无听力则为空串）`);
    assert.match(String(m.year), /^\d{4}$/, `${m.id} year 必须是四位年份`);
    // 2023 年 3 月的延考卷归属 2022 下半年，年份筛选按 period 而不是按 id 前缀
    assert.equal(m.period, `${m.year}${m.half}`, `${m.id} period 与 year+half 不一致，列表分组会错`);
  }
});

test('音频表：只覆盖含听力的套卷，且路径形态满足代理白名单', () => {
  const withListening = paperIds.filter((id) => shapeOf(papers.get(id)!) === EXPECT.withListening);
  assert.deepEqual(Object.keys(audio).sort(), withListening, 'audio/index.json 与含听力的套卷集合不一致');
  for (const id of withListening) {
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
    assert.equal(expect - 1, EXPECT.withListening.parts.listening, `${id} 听力分段没覆盖到第 25 题`);
  }
});
