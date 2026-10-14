/**
 * 数据医生：全面体检 46 套卷的数据质量。只读，不改数据。
 * 用法：node scripts/audit-quality.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

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

    // 4) 题干
    if (!q.stem || !q.stem.trim()) issues.题干异常.push({ tag, note: '题干为空' });
    else if (CONTAM.test(q.stem)) issues.题干异常.push({ tag, note: '题干含后续文本', head: q.stem.slice(0, 70) });
    else if (MARKER_HEAD.test(q.stem)) issues.段落标记残留.push({ tag, field: 'stem', head: q.stem.slice(0, 50) });

    // 5) 原文
    const psg = q.passage || '';
    if (psg) {
      if (CONTAM.test(psg)) issues.原文异常.push({ tag, note: '原文含 Questions/Directions 残留' });
      if (DIRTY.test(psg)) issues.脏字符.push({ tag, field: 'passage' });
      // 阅读/匹配原文段落标记是否成体系
      if (q.part === 'reading' && !/^P\d+/.test(psg)) issues.原文异常.push({ tag, note: '阅读原文缺 P 段标记' });
      if (q.part === 'matching' && !/^[A-P]\)/.test(psg)) issues.原文异常.push({ tag, note: '匹配原文缺 A) 段标记' });
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

  // 9) 主观题
  const s = p.subjective || {};
  const texts = [s.writing?.directions, s.writing?.model, s.writing?.modelZh, s.translation?.source, s.translation?.reference];
  if (!s.writing?.directions) issues.主观题异常.push({ tag: p.id, note: '缺写作题目' });
  if (!s.translation?.source) issues.主观题异常.push({ tag: p.id, note: '缺翻译原文' });
  texts.forEach((t) => { if (typeof t === 'string' && CONTAM.test(t)) issues.主观题异常.push({ tag: p.id, note: '主观题含后续文本残留' }); });
  if (issues.主观题异常.length && !Array.isArray(s.translation?.sentences)) issues.主观题异常.push({ tag: p.id, note: '缺逐句拆解' });
}

let total = 0;
for (const [name, list] of Object.entries(issues)) {
  total += list.length;
  if (!list.length) { console.log(`✓ ${name}: 0`); continue; }
  console.log(`\n⚠ ${name}: ${list.length}`);
  const shown = list.slice(0, 8);
  for (const it of shown) console.log('   ', JSON.stringify(it).slice(0, 150));
  if (list.length > shown.length) console.log(`    …还有 ${list.length - shown.length} 条`);
}
console.log(`\n===== 问题总计: ${total} 条 =====`);
