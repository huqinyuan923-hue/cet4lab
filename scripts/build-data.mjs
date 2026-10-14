/**
 * P0 数据管线：把只读源仓库的 JS 数据（__CET4_PAPERS / __CET4_INDEX / __CET4_AUDIO）
 * 转换为本站静态 JSON 产物。完整性与字段契约见 BUILD-PLAN.md §2.2 / §5。
 * 任一硬校验失败即 exit 1 并指明是那套卷的哪一项。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = process.env.CET4_SRC
  ? path.resolve(process.env.CET4_SRC)
  : 'C:/works/cet4-papers/cet4-exam-quiz/data';
const OUT = path.join(ROOT, 'public', 'data');

const EXPECT = {
  papers: 46,
  questions: 2530,
  perPaper: 55,
  parts: { listening: 25, cloze: 10, matching: 10, reading: 10 },
};

const fail = (msg) => {
  console.error(`\x1b[31m✗ 校验失败：${msg}\x1b[0m`);
  process.exit(1);
};

// 部署环境（如 Vercel）没有本地源仓库：若已提交 public/data 产物，则直接沿用。
// 强制重新生成：CET4_SRC=<源目录> pnpm build:data --force
const FORCE = process.argv.includes('--force');
const hasOutput = fs.existsSync(path.join(OUT, 'papers', 'index.json'));
if (!FORCE && !fs.existsSync(SRC) && hasOutput) {
  console.log(
    `\x1b[33m·\x1b[0m 未找到源数据目录（${SRC}），沿用已提交的 public/data 产物；如需重新生成请指定 CET4_SRC 并加 --force`
  );
  process.exit(0);
}

// ---- 1. 在干净 vm 上下文中执行源 JS ----
if (!fs.existsSync(SRC)) fail(`源数据目录不存在：${SRC}`);
const ctx = { window: {} };
vm.createContext(ctx);
const papersDir = path.join(SRC, 'papers');
const srcFiles = fs
  .readdirSync(papersDir)
  .filter((f) => f.endsWith('.js'))
  .sort();
for (const f of srcFiles) {
  try {
    vm.runInContext(fs.readFileSync(path.join(papersDir, f), 'utf8'), ctx, { filename: f });
  } catch (e) {
    fail(`执行 ${f} 抛错：${e.message}`);
  }
}
vm.runInContext(fs.readFileSync(path.join(SRC, 'index.js'), 'utf8'), ctx, { filename: 'index.js' });
vm.runInContext(fs.readFileSync(path.join(SRC, 'audio.js'), 'utf8'), ctx, { filename: 'audio.js' });

const PAPERS = ctx.window.__CET4_PAPERS;
const INDEX = ctx.window.__CET4_INDEX;
const AUDIO = ctx.window.__CET4_AUDIO;
if (!PAPERS || !INDEX || !AUDIO) fail('源数据缺少 __CET4_PAPERS / __CET4_INDEX / __CET4_AUDIO 之一');

const indexById = new Map((Array.isArray(INDEX) ? INDEX : Object.values(INDEX)).map((e) => [e.id, e]));

/* ---------- 源数据清洗 ----------
 * 源仓库由 PDF 转制，解析时会把题干/选项之后的文本（下一段听力原文、
 * "Questions 5 to 7 are based on…" 之类的指导语、或 "Section B" 页眉）黏到
 * 前一段的最后一行。实测 46 套中共 47 个选项 + 12 个题干受影响，形态固定为
 * 「句末标点 + 空白 + 后续块首特征」，因此按边界剥离。
 */
const APPEND_BOUNDARY =
  /([.!?]["')\]]?)\s+(?=\d{1,3}\s+["'\u201c]?[A-Z]|Questions?\s+\d|Section\s+[ABC]\b|Directions\s*:)/;
const stripAppended = (s) => {
  if (typeof s !== 'string') return s;
  const m = APPEND_BOUNDARY.exec(s);
  return m ? s.slice(0, m.index + m[1].length).trim() : s;
};

// ---- 2. 校验 + 收集 ----
const ids = Object.keys(PAPERS).sort();
if (ids.length !== EXPECT.papers) fail(`试卷数 ${ids.length} ≠ 期望 ${EXPECT.papers}`);

let totalQuestions = 0;
let cleaned = 0;
const metas = [];
const audioOut = {};
const warn = [];

for (const id of ids) {
  const paper = PAPERS[id];
  const meta = indexById.get(id);
  if (!meta) fail(`${id} 缺少 index 元信息`);

  if (!Array.isArray(paper.questions)) fail(`${id} 缺少 questions 数组`);
  const qs = paper.questions;
  if (qs.length !== EXPECT.perPaper) fail(`${id} 题数 ${qs.length} ≠ ${EXPECT.perPaper}`);

  const nos = qs.map((q) => q.no).sort((a, b) => a - b);
  for (let i = 0; i < EXPECT.perPaper; i++) {
    if (nos[i] !== i + 1) fail(`${id} 题号不连续：期望 ${i + 1}，实际 ${nos[i]}`);
  }

  const counts = {};
  for (const q of qs) {
    // 先清洗（剥离黏连的后续文本），再做校验，保证校验作用于最终产物
    const stemBefore = q.stem;
    q.stem = stripAppended(q.stem);
    if (q.stem !== stemBefore) cleaned++;
    if (Array.isArray(q.options)) {
      q.options = q.options.map((o) => {
        const next = stripAppended(o);
        if (next !== o) cleaned++;
        return next;
      });
    }
    if (APPEND_BOUNDARY.test(q.stem) || (Array.isArray(q.options) && q.options.some((o) => APPEND_BOUNDARY.test(o)))) {
      fail(`${id} 第 ${q.no} 题清洗后仍残留黏连文本`);
    }

    counts[q.part] = (counts[q.part] || 0) + 1;
    if (!q.answer) fail(`${id} 第 ${q.no} 题 answer 为空`);

    // 答案必须落在该题型的有效选项集内
    let valid;
    if (q.part === 'matching') valid = (q.paraOptions || []).includes(q.answer);
    else if (q.part === 'cloze') valid = Object.prototype.hasOwnProperty.call(q.wordBank || {}, q.answer);
    else valid = /^[A-D]$/.test(q.answer);
    if (!valid) fail(`${id} 第 ${q.no} 题 answer="${q.answer}" 不在有效选项内（${q.part}）`);

    // 字段缺口只在预期范围内告警，不阻断
    if (q.part === 'reading' && !q.answerText) warn.push(`${id}#${q.no} reading 无 answerText（预期，用 explain["选项"]）`);
    if (q.part === 'cloze' && !q.stemZh) void 0; // cloze 全模块无中文，属预期
    if (q.part === 'listening' && !q.optionsZh) warn.push(`${id}#${q.no} listening 缺 optionsZh`);
    if (q.part === 'reading' && !q.optionsZh) warn.push(`${id}#${q.no} reading 缺 optionsZh`);
  }
  for (const [part, n] of Object.entries(EXPECT.parts)) {
    if ((counts[part] || 0) !== n) fail(`${id} ${part} 题数 ${counts[part] || 0} ≠ ${n}`);
  }
  totalQuestions += qs.length;

  // 音频解析：27 套直连 + 19 套经 index.share 一跳
  const direct = AUDIO[id];
  const shareId = meta.share || '';
  const viaShare = !direct?.m3u8 && shareId ? AUDIO[shareId] : null;
  const src = direct?.m3u8 ? direct : viaShare;
  if (!src?.m3u8) fail(`${id} 音频解析失败（直连与 share="${shareId}" 均无 m3u8）`);
  const { pathname } = new URL(src.m3u8);
  if (!/^\/cet4\/\d+\/index\.m3u8$/.test(pathname)) fail(`${id} m3u8 路径形态异常：${pathname}`);
  audioOut[id] = {
    id,
    label: src.label || meta.label + ' ' + meta.set,
    page: src.page || '',
    m3u8: src.m3u8,
    proxyPath: pathname,
    from: direct?.m3u8 ? 'self' : shareId,
    pieces: Array.isArray(src.pieces) ? src.pieces.map((p) => ({ label: p.label, start: p.start, end: p.end })) : [],
  };

  const hasSubjective = !!(paper.subjective && (paper.subjective.writing || paper.subjective.translation));
  metas.push({
    ...meta,
    count: qs.length,
    parts: counts,
    hasAudio: true,
    audioId: id,
    hasSubjective,
  });
}

if (totalQuestions !== EXPECT.questions) fail(`总题数 ${totalQuestions} ≠ ${EXPECT.questions}`);

// ---- 3. 写出产物 ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'papers'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'audio'), { recursive: true });

metas.sort((a, b) => (a.id < b.id ? 1 : -1)); // 新卷在前
fs.writeFileSync(path.join(OUT, 'papers', 'index.json'), JSON.stringify(metas, null, 1), 'utf8');

let bytes = 0;
for (const id of ids) {
  const file = path.join(OUT, 'papers', `${id}.json`);
  const body = JSON.stringify(PAPERS[id]);
  fs.writeFileSync(file, body, 'utf8');
  bytes += Buffer.byteLength(body);
}
fs.writeFileSync(path.join(OUT, 'audio', 'index.json'), JSON.stringify(audioOut, null, 1), 'utf8');

const directCount = Object.values(audioOut).filter((a) => a.from === 'self').length;
console.log(
  `\x1b[32m✓\x1b[0m 数据管线完成：${ids.length} 套 / ${totalQuestions} 题 / ${(bytes / 1048576).toFixed(2)}MB` +
    ` · 音频 ${directCount} 直连 + ${ids.length - directCount} 经 share → ${Object.keys(audioOut).length}/${ids.length} 可播` +
    ` · 清洗黏连文本 ${cleaned} 处`
);
if (warn.length) {
  const shown = warn.slice(0, 3).join('；');
  console.log(`\x1b[33m·\x1b[0m 预期内字段缺口告警 ${warn.length} 条（不阻断）：${shown}${warn.length > 3 ? ' …' : ''}`);
}
