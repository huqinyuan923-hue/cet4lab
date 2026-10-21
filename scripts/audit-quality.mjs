/**
 * 数据医生：全面体检全部套卷的数据质量。只读，不改数据。
 * 用法：node scripts/audit-quality.mjs            # 人工排查，打印明细
 *       node scripts/audit-quality.mjs --gate    # CI 闸门，超出基线即 exit 1
 * 基线 scripts/quality-baseline.json 只约束「中文译文缺失」这类源数据固有缺口，
 * 其余维度必须为 0；数据修复后请把基线改小，闸门只许变好不许变坏。
 * 注意：原文/题干的校验刻意复用 lib/paper.ts 的渲染函数——闸门要保的是「页面渲染得出来」，
 * 而不是某种来源格式。
 */
import fs from 'node:fs';
import path from 'node:path';
import { clozeSentence, matchingParagraphs, numberedParagraphs } from '../lib/paper.ts';

const GATE = process.argv.includes('--gate');
const BASELINE_FILE = path.resolve('scripts/quality-baseline.json');
const SOFT = ['中文译文缺失', '主观题内容缺失', '原文分段缺失'];

const DIR = path.resolve('public/data/papers');
const files = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d\.json$/.test(f)).sort();

const issues = {
  选项尾部混入后续文本: [],
  选项数异常: [],
  选项重复: [],
  题干异常: [],
  原文异常: [],
  中文译文缺失: [],
  译文与英文不匹配: [],
  答案异常: [],
  脏字符: [],
  段落标记残留: [],
  主观题异常: [],
  主观题内容缺失: [],
  原文分段缺失: [],
};

const CONTAM = /([.!?]["')\]]?)\s+(?=\d{1,3}\s+["'\u201c]?[A-Z]|Questions?\s+\d|Directions:|Section\s+[ABC]\b)/;
const MARKER_HEAD = /^(\d{1,3}|P\d+)\s+["'\u201c]?[A-Z]/;
const DIRTY = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\ufeff]/;

const optsOf = (q) => (Array.isArray(q.options) ? q.options.filter((x) => typeof x === 'string') : []);

for (const f of files) {
  const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const q of p.questions) {
    const opts = optsOf(q);
    const zh = Array.isArray(q.optionsZh) ? q.optionsZh : [];
    const tag = `${p.id}#${q.no}(${q.part})`;

    // 1) 选项尾部混入
    opts.forEach((o, i) => {
      const m = CONTAM.exec(o);
      if (m) issues.选项尾部混入后续文本.push({ tag, i, keep: o.slice(0, m.index + m[1].length), drop: o.slice(m.index + m[1].length).trim().slice(0, 60) });
    });

    // 2) 选项数
    if ((q.part === 'listening' || q.part === 'reading') && opts.length !== 4) issues.选项数异常.push({ tag, n: opts.length });
    if (q.part === 'cloze' && Object.keys(q.wordBank || {}).length !== 15) issues.选项数异常.push({ tag, n: Object.keys(q.wordBank || {}).length, note: '词库非 15' });

    // 3) 选项重复
    const seen = new Map();
    opts.forEach((o) => { const k = o.trim().toLowerCase(); if (k) seen.set(k, (seen.get(k) || 0) + 1); });
    for (const [k, c] of seen) if (c > 1) issues.选项重复.push({ tag, text: k.slice(0, 50), c });

    // 4) 题干：cloze 允许 stem 为空，但必须能从原文空位还原出语境（错题本依赖它）
    const effectiveStem = (q.stem || '').trim() || (q.part === 'cloze' ? clozeSentence(q.passage || '', q.no) : '');
    if (!effectiveStem) issues.题干异常.push({ tag, note: q.part === 'cloze' ? '题干为空且原文取不到空位所在句' : '题干为空' });
    else if (CONTAM.test(effectiveStem)) issues.题干异常.push({ tag, note: '题干含后续文本', head: effectiveStem.slice(0, 70) });
    else if (MARKER_HEAD.test(effectiveStem)) issues.段落标记残留.push({ tag, field: 'stem', head: effectiveStem.slice(0, 50) });

    // 5) 原文：直接问渲染函数能不能切出段，切不出来页面才是真坏的
    const psg = q.passage || '';
    if (psg) {
      if (CONTAM.test(psg)) issues.原文异常.push({ tag, note: '原文含 Questions/Directions 残留' });
      if (DIRTY.test(psg)) issues.脏字符.push({ tag, field: 'passage' });
      // 切成一整段只是「读起来累」，段落信息在转制时就丢了、本机源也没有，故列为固有缺口而非硬伤
      if (q.part === 'reading' && numberedParagraphs(psg).length < 2) issues.原文分段缺失.push({ tag, note: '阅读原文切不出多段，整卷糊成一面墙' });
      if (q.part === 'matching' && matchingParagraphs(psg).length < (q.paraOptions || []).length)
        issues.原文异常.push({ tag, note: `匹配原文只切出 ${matchingParagraphs(psg).length} 段，选项集有 ${(q.paraOptions || []).length} 个` });
      if (q.part === 'cloze' && !clozeSentence(psg, q.no)) issues.原文异常.push({ tag, note: `原文里没有 (${q.no}) 空位` });
    }

    // 6) 中文译文缺失 / 不匹配
    if (!q.stemZh && q.part !== 'cloze') issues.中文译文缺失.push({ tag, field: 'stemZh' });
    opts.forEach((o, i) => {
      const z = (zh[i] || '').trim();
      if (!z && q.part !== 'cloze') issues.中文译文缺失.push({ tag, field: `optionsZh[${i}]` });
      else if (z && o.length > 60 && z.length < o.length / 6) issues.译文与英文不匹配.push({ tag, i, en: o.length, zh: z.length, zhText: z.slice(0, 28) });
    });

    // 7) 答案
    if (!q.answer) issues.答案异常.push({ tag, note: '无答案' });
    else if (q.part === 'matching' && !(q.paraOptions || []).includes(q.answer)) issues.答案异常.push({ tag, note: `答案 ${q.answer} 不在段落集` });
    else if (q.part === 'cloze' && !Object.prototype.hasOwnProperty.call(q.wordBank || {}, q.answer)) issues.答案异常.push({ tag, note: `答案 ${q.answer} 不在词库` });

    // 8) 脏字符
    for (const [k, v] of Object.entries(q)) {
      if (typeof v === 'string' && DIRTY.test(v)) issues.脏字符.push({ tag, field: k });
    }
  }

  // 9) 主观题：结构坏了算硬伤，源数据本来就没收录算固有缺口
  const s = p.subjective || {};
  const texts = [s.writing?.directions, s.writing?.model, s.writing?.modelZh, s.translation?.source, s.translation?.reference];
  texts.forEach((t) => { if (typeof t === 'string' && CONTAM.test(t)) issues.主观题异常.push({ tag: p.id, note: '主观题含后续文本残留' }); });
  if ('outline' in (s.writing || {}) && !Array.isArray(s.writing.outline)) {
    issues.主观题异常.push({ tag: p.id, note: `writing.outline 不是数组而是 ${typeof s.writing.outline}，展开即整页崩` });
  }
  if (Array.isArray(s.writing?.outline)) {
    for (const o of s.writing.outline) {
      if (typeof o?.no !== 'number' || !o?.text) issues.主观题异常.push({ tag: p.id, note: `提纲项缺 no/text：${JSON.stringify(o).slice(0, 40)}` });
    }
  }
  if (Array.isArray(s.translation?.sentences)) {
    for (const sent of s.translation.sentences) {
      if (!sent?.trunk || !sent?.downgrade || !sent?.grammar || !sent?.target) {
        issues.主观题异常.push({ tag: p.id, note: '逐句拆解缺字段' });
        break;
      }
    }
  }
  if (!s.writing?.directions) issues.主观题内容缺失.push({ tag: p.id, note: '缺写作题目' });
  if (!s.writing?.model) issues.主观题内容缺失.push({ tag: p.id, note: '缺范文' });
  if (!s.writing?.modelZh) issues.主观题内容缺失.push({ tag: p.id, note: '缺范文译文' });
  if (!s.translation?.source) issues.主观题内容缺失.push({ tag: p.id, note: '缺翻译原文' });
  if (!s.translation?.reference) issues.主观题内容缺失.push({ tag: p.id, note: '缺参考译文' });
  if (!Array.isArray(s.translation?.sentences) || !s.translation.sentences.length) {
    issues.主观题内容缺失.push({ tag: p.id, note: '缺逐句拆解' });
  }
}

let total = 0;
const hard = [];
const soft = [];
for (const [name, list] of Object.entries(issues)) {
  total += list.length;
  if (!list.length) { console.log(`✓ ${name}: 0`); continue; }
  console.log(`\n⚠ ${name}: ${list.length}`);
  const shown = list.slice(0, 8);
  for (const it of shown) console.log('   ', JSON.stringify(it).slice(0, 150));
  if (list.length > shown.length) console.log(`    …还有 ${list.length - shown.length} 条`);
  (SOFT.includes(name) ? soft : hard).push({ name, n: list.length });
}
console.log(`\n===== 问题总计: ${total} 条 =====`);

if (!GATE) process.exit(0);

if (!fs.existsSync(BASELINE_FILE)) {
  console.error(`\x1b[31m✗ 闸门需要基线文件：${path.relative(process.cwd(), BASELINE_FILE)}\x1b[0m`);
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const problems = hard.map(({ name, n }) => `${name} ${n} 条（硬指标，必须为 0）`);
for (const { name, n } of soft) {
  const allow = baseline[name] ?? 0;
  if (n > allow) problems.push(`${name} ${n} 条 > 基线 ${allow} 条`);
}
if (problems.length) {
  console.error(`\x1b[31m✗ 数据闸门失败：\n  - ${problems.join('\n  - ')}\x1b[0m`);
  process.exit(1);
}
const softLabel = soft.map((s) => `${s.name} ${s.n}/${baseline[s.name] ?? 0}`).join('、') || '无';
console.log(`\x1b[32m✓\x1b[0m 数据闸门通过（固有缺口：${softLabel}）`);
