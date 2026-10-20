/**
 * 把 2015-06 ~ 2019-12 的旧卷数据（gongyining0601/cet4 的 bank/*.js）并入本站产物。
 * 源数据与 2020+ 的 123xzw999/cet4-exam-quiz 字段不同，这里统一映射到 lib/types.ts 的契约。
 * 用法：LEGACY_SRC=<bank目录> LEGACY_AUDIO_META=<listeningMeta.js> node scripts/import-legacy-papers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = process.env.LEGACY_SRC ? path.resolve(process.env.LEGACY_SRC) : path.resolve(ROOT, '..', 'old-bank');
const META_SRC = process.env.LEGACY_AUDIO_META
  ? path.resolve(process.env.LEGACY_AUDIO_META)
  : path.resolve(ROOT, '..', 'old-listening-meta.js');
const PATCHES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'legacy-patches.json'), 'utf8'));
const OUT = path.join(ROOT, 'public', 'data');
const PAPERS_OUT = path.join(OUT, 'papers');
const AUDIO_OUT = path.join(OUT, 'audio');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'writing');
/** 记录导入的旧卷 id，供 build-data.mjs 重建时保留 */
const LEGACY_MANIFEST = path.join(ROOT, 'scripts', 'legacy-ids.json');

const fail = (msg) => {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
};
const warn = (msg) => console.warn(`\x1b[33m! ${msg}\x1b[0m`);

if (!fs.existsSync(SRC)) fail(`旧卷源目录不存在：${SRC}`);
if (!fs.existsSync(META_SRC)) fail(`听力元数据不存在：${META_SRC}`);

const PART_NAME = {
  listening: '听力理解',
  cloze: '选词填空',
  matching: '长篇阅读（信息匹配）',
  reading: '仔细阅读',
};
const POS = new Set(['名词', '动词', '形容词', '副词', '介词', '连词', '代词', '数词', '冠词', '短语']);
const ANALYSIS_HEADERS = ['答案', '定位', '信号', '排除', '替换', '词性槽', '依据', '竞争词', '易错', '锚点', '改写', '辨邻', '判型', '拆句', '选项'];
const HEADER_RE = new RegExp(`(?:^|\\n)\\s*【(${ANALYSIS_HEADERS.join('|')})】\\s*`, 'g');

function loadBanks() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
  for (const f of files) {
    try {
      vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
    } catch (e) {
      fail(`执行 ${f} 失败：${e.message}`);
    }
  }
  const banks = ctx.window.CET4_BANKS;
  if (!Array.isArray(banks) || !banks.length) fail('源数据里没有 CET4_BANKS');
  return banks;
}

function loadAudioMeta() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(META_SRC, 'utf8'), ctx, { filename: 'listeningMeta.js' });
  const meta = ctx.window.CET4_LISTEN_META;
  if (!meta || typeof meta !== 'object') fail('听力元数据里没有 CET4_LISTEN_META');
  return meta;
}

function parseAnalysis(analysis) {
  const text = String(analysis || '').replace(/\r\n/g, '\n').trim();
  const hits = [...text.matchAll(HEADER_RE)];
  if (!hits.length) return { explain: { 解析: text }, anchor: '' };

  const sections = {};
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    if (body) sections[hits[i][1]] = body;
  }
  const anchor = sections['锚点'] || '';
  delete sections['锚点'];
  delete sections['答案'];
  if (!Object.keys(sections).length) sections['解析'] = text;
  return { explain: sections, anchor };
}

/** 旧卷原文用单个换行分段，统一成空行分段，供前端按段落渲染 */
function normalizeParagraphs(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function fixClozePassage(raw) {
  const withBlanks = String(raw || '').replace(/_+\s*\(?\s*(\d+)\s*\)?\s*_+/g, (_, n) => `__(${n})__`);
  return normalizeParagraphs(withBlanks);
}

function buildWordBank(options) {
  const bank = {};
  for (const opt of options || []) {
    const m = String(opt).match(/^\s*([A-P])[).、]\s*(.+)$/);
    if (m) bank[m[1]] = m[2].trim();
  }
  return bank;
}

function optionList(q, paperId) {
  let opts = (q.options || []).map((o) => String(o).trim());
  const patch = PATCHES.options?.[paperId]?.[q.qno];
  if (patch) {
    opts = opts.map((o) => {
      const key = o.match(/^([A-P])/)?.[1];
      return key && patch[key] ? `${key}) ${patch[key]}` : o;
    });
  }
  return opts;
}

function buildPaper(b, audioMeta) {
  const [year, month, setNo] = b.id.split('-').map(Number);
  if (!year || !month || !setNo) fail(`无法解析卷号：${b.id}`);

  const questions = [];
  const readingQuestions = b.questions
    .filter((q) => q.type === 'reading')
    .sort((a, c) => a.qno - c.qno);

  const fallbackReading = PATCHES.readingPassages?.[b.id] || '';
  const readingText = new Map();
  for (const q of readingQuestions) {
    const own = b.readingPassages?.[q.qno];
    const text = normalizeParagraphs(own && own.trim() ? own : fallbackReading);
    if (!text) fail(`${b.id} 第 ${q.qno} 题缺阅读原文`);
    readingText.set(q.qno, text);
  }
  const readingGroup = new Map();
  let group = 0;
  let prevText = null;
  for (const q of readingQuestions) {
    const text = readingText.get(q.qno);
    if (text !== prevText) {
      group++;
      prevText = text;
    }
    readingGroup.set(q.qno, group);
  }

  const clozePassage = fixClozePassage(b.clozePassage);
  const blanks = [...clozePassage.matchAll(/__\((\d+)\)__/g)].map((m) => Number(m[1]));
  if (blanks.length !== 10) fail(`${b.id} 选词填空空位 ${blanks.length} ≠ 10`);
  const matchingText = [
    normalizeParagraphs(b.matchIntro),
    ...b.matchParagraphs.map((p) => `${p.label}) ${normalizeParagraphs(p.text)}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  const paraOptions = b.matchParagraphs.map((p) => p.label);
  if (!paraOptions.length) fail(`${b.id} 缺匹配段落`);

  for (const q of b.questions) {
    const part = q.type === 'match' ? 'matching' : q.type;
    if (!PART_NAME[part]) fail(`${b.id} 未知题型：${q.type}`);
    const { explain, anchor } = parseAnalysis(q.analysis);
    const item = {
      no: q.qno,
      part,
      partName: PART_NAME[part],
      stem: String(q.stem || '').trim(),
      answer: String(q.answer || '').trim(),
    };

    if (part === 'cloze') {
      const opts = optionList(q, b.id);
      const bank = buildWordBank(opts);
      if (Object.keys(bank).length !== 15) fail(`${b.id} 第 ${q.qno} 题词库 ${Object.keys(bank).length} ≠ 15`);
      if (!bank[item.answer]) fail(`${b.id} 第 ${q.qno} 题答案 ${item.answer} 不在词库中`);
      item.options = opts;
      item.wordBank = bank;
      item.passage = clozePassage;
      const pos = (q.points || []).find((p) => POS.has(p));
      if (pos) item.pos = pos;
    } else if (part === 'matching') {
      item.options = null;
      item.paraOptions = paraOptions;
      item.passage = matchingText;
      if (anchor) item.anchor = anchor;
      if (!paraOptions.includes(item.answer)) fail(`${b.id} 第 ${q.qno} 题答案 ${item.answer} 不在段落中`);
    } else if (part === 'reading') {
      item.options = optionList(q, b.id);
      item.passage = readingText.get(q.qno);
      item.passageNo = readingGroup.get(q.qno);
    } else {
      item.options = optionList(q, b.id);
    }

    const tags = (q.points || []).filter(Boolean);
    const type = [...tags].reverse().find((t) => !POS.has(t) && t !== '选词填空');
    if (type) item.type = type;
    if (Object.keys(explain).length) item.explain = explain;
    if (!item.answer) fail(`${b.id} 第 ${q.qno} 题缺答案`);
    if ((part === 'listening' || part === 'reading') && item.options?.length !== 4) {
      fail(`${b.id} 第 ${q.qno} 题选项数不是 4`);
    }
    questions.push(item);
  }

  const count = questions.length;
  if (count !== 55 && count !== 30) fail(`${b.id} 题数 ${count} 不在 55/30 之内`);
  const parts = {};
  for (const q of questions) parts[q.part] = (parts[q.part] || 0) + 1;

  const image = path.join(IMG_DIR, `${b.id}.jpg`);
  const subjective = {
    writing: {
      directions: String(b.writing?.prompt || '').trim(),
      model: String(b.writing?.sample || '').trim(),
      ...(fs.existsSync(image) ? { image: `/images/writing/${b.id}.jpg` } : {}),
    },
    translation: {
      directions: 'Directions: 将下列段落译成英文。',
      source: String(b.translation?.prompt || '').trim(),
      reference: String(b.translation?.sample || '').trim(),
    },
  };

  const label = `${year}年${month}月`;
  const partial = count < 55;
  const set = partial ? `第${setNo}套 · 无听力` : `第${setNo}套`;
  const paper = { id: b.id, label, set, questions, subjective };
  const hasAudio = Boolean(audioMeta[b.id]) && Boolean(parts.listening);
  const meta = {
    id: b.id,
    label,
    set,
    count,
    nos: questions.map((q) => q.no),
    parts,
    period: `${year}${month <= 6 ? '上半年' : '下半年'}`,
    year: String(year),
    half: month <= 6 ? '上半年' : '下半年',
    month,
    share: '',
    hasAudio,
    audioId: hasAudio ? b.id : '',
    hasSubjective: true,
  };
  return { paper, meta, hasAudio };
}

function main() {
  const banks = loadBanks().filter((b) => /^201[5-9]-/.test(b.id));
  if (banks.length !== 30) fail(`旧卷数量 ${banks.length} ≠ 30`);
  const audioMeta = loadAudioMeta();

  fs.mkdirSync(PAPERS_OUT, { recursive: true });
  fs.mkdirSync(AUDIO_OUT, { recursive: true });

  const indexFile = path.join(PAPERS_OUT, 'index.json');
  const audioFile = path.join(AUDIO_OUT, 'index.json');
  const oldIndex = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  const oldAudio = fs.existsSync(audioFile) ? JSON.parse(fs.readFileSync(audioFile, 'utf8')) : {};

  const ids = new Set(banks.map((b) => b.id));
  const kept = oldIndex.filter((m) => !ids.has(m.id));
  const metas = [];
  const audio = {};
  let totalQuestions = 0;

  for (const b of banks) {
    const { paper, meta, hasAudio } = buildPaper(b, audioMeta);
    fs.writeFileSync(path.join(PAPERS_OUT, `${b.id}.json`), JSON.stringify(paper));
    metas.push(meta);
    totalQuestions += paper.questions.length;
    if (hasAudio) {
      const src = audioMeta[b.id].src;
      const proxyPath = new URL(src).pathname;
      if (!/^\/cet4\/\d{1,6}\/index\.m3u8$/.test(proxyPath)) fail(`${b.id} 音频路径异常：${proxyPath}`);
      if (!Array.isArray(audioMeta[b.id].pieces) || !audioMeta[b.id].pieces.length) fail(`${b.id} 缺听力分段`);
      audio[b.id] = {
        id: b.id,
        label: `${meta.label} ${paper.set}`,
        page: `https://english-exam.lazynote.cn/cet4/paper/${b.id}/listening/`,
        m3u8: src,
        proxyPath,
        from: b.id,
        pieces: audioMeta[b.id].pieces,
      };
    }
  }

  const combined = [...kept, ...metas].sort((a, b) => {
    const pa = a.id.split('-').map(Number);
    const pb = b.id.split('-').map(Number);
    return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
  });
  fs.writeFileSync(indexFile, JSON.stringify(combined, null, 1));
  fs.writeFileSync(audioFile, JSON.stringify({ ...oldAudio, ...audio }, null, 1));
  fs.writeFileSync(LEGACY_MANIFEST, JSON.stringify([...ids].sort(), null, 1));

  console.log(
    `\x1b[32m✓\x1b[0m 已并入 ${metas.length} 套旧卷 / ${totalQuestions} 题；全站 ${combined.length} 套，` +
      `音频 ${Object.keys(audio).length} 套；套卷索引 ${combined.length} 条`
  );
}

main();
