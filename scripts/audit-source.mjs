// 审计脚本：逐条验证 dsh 复核报告中的数据断言。可重复运行。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SRC = 'C:/works/cet4-papers/cet4-exam-quiz/data';
const ctx = { window: {} };
vm.createContext(ctx);

const papersDir = path.join(SRC, 'papers');
const files = fs.readdirSync(papersDir).filter((f) => f.endsWith('.js')).sort();
for (const f of files) vm.runInContext(fs.readFileSync(path.join(papersDir, f), 'utf8'), ctx);
const PAPERS = ctx.window.__CET4_PAPERS;

let total = 0, papersCount = 0;
const perPart = {}, explainKeySets = {}, issues = [], rawDiff = [];
let readingNoAnswerText = 0, readingTotal = 0, readingNoOptionsZh = 0;
let clozeNoStemZh = 0, clozeTotal = 0, clozeWithPos = 0;
let listeningNoOptionsZh = 0;
let matchingNullOptions = 0, matchingTotal = 0;
const paraOptSizes = new Set();
let writingModelZh = 0, writingOutlineZh = 0, transWithSentences = 0;

for (const id of Object.keys(PAPERS).sort()) {
  papersCount++;
  const p = PAPERS[id];
  const n = p.questions.length;
  if (n !== 55) issues.push(`${id}: ${n} 题 (!=55)`);
  for (const q of p.questions) {
    total++;
    perPart[q.part] = (perPart[q.part] || 0) + 1;
    const ks = q.explain && typeof q.explain === 'object' ? Object.keys(q.explain).sort().join('|') : '(none)';
    explainKeySets[`${q.part} → ${ks}`] = (explainKeySets[`${q.part} → ${ks}`] || 0) + 1;
    if (q.part === 'reading') { readingTotal++; if (!q.answerText) readingNoAnswerText++; if (!q.optionsZh) readingNoOptionsZh++; }
    if (q.part === 'cloze') { clozeTotal++; if (!q.stemZh) clozeNoStemZh++; if (q.pos) clozeWithPos++; }
    if (q.part === 'listening' && !q.optionsZh) listeningNoOptionsZh++;
    if (q.part === 'matching') { matchingTotal++; if (q.options == null) matchingNullOptions++; paraOptSizes.add((q.paraOptions || []).length); }
  }
  const s = p.subjective || {};
  if (s.writing?.modelZh) writingModelZh++;
  if (s.writing?.outline) writingOutlineZh++;
  if (s.translation?.sentences) transWithSentences++;
  const raw = (fs.readFileSync(path.join(papersDir, id + '.js'), 'utf8').match(/"no":/g) || []).length;
  if (raw !== n) rawDiff.push(`${id}: raw="no": ${raw}, questions=${n}`);
}

console.log('== 套数/题数 ==');
console.log(`papers=${papersCount} questions=${total} perPart=${JSON.stringify(perPart)}`);
console.log('55题/套 异常:', issues.length ? issues.join(', ') : '无（46套全部=55）');
console.log(`raw 子串 "no": 总数 = ${files.reduce((a, f) => a + (fs.readFileSync(path.join(papersDir, f), 'utf8').match(/"no":/g) || []).length, 0)}（对照 parse 结果 ${total}）`);
if (rawDiff.length) console.log('raw 与 questions 不等的卷:', rawDiff.slice(0, 5).join(' ; '), rawDiff.length > 5 ? `…共${rawDiff.length}套` : '');

console.log('\n== explain 键名组合（按题型） ==');
for (const [k, v] of Object.entries(explainKeySets)) console.log(`  ${k}  x${v}`);

console.log('\n== 字段缺口抽查 ==');
console.log(`reading 缺 answerText: ${readingNoAnswerText}/${readingTotal}；缺 optionsZh: ${readingNoOptionsZh}/${readingTotal}`);
console.log(`cloze 缺 stemZh: ${clozeNoStemZh}/${clozeTotal}；有 pos: ${clozeWithPos}/${clozeTotal}`);
console.log(`listening 缺 optionsZh: ${listeningNoOptionsZh}`);
console.log(`matching options==null: ${matchingNullOptions}/${matchingTotal}；paraOptions 长度分布: ${[...paraOptSizes].sort((a, b) => a - b).join(',')}`);
console.log(`writing 有 modelZh: ${writingModelZh}/46，有 outline: ${writingOutlineZh}/46；translation 有 sentences: ${transWithSentences}/46`);

console.log('\n== 主观题 translation 字段结构（抽 2024-06-1） ==');
const s1 = PAPERS['2024-06-1'].subjective;
console.log('writing keys:', Object.keys(s1.writing || {}).join(','));
console.log('translation keys:', Object.keys(s1.translation || {}).join(','));
if (s1.translation?.sentences?.[0]) console.log('sentence[0] keys:', Object.keys(s1.translation.sentences[0]).join(','));

console.log('\n== index.js 现成索引 ==');
vm.runInContext(fs.readFileSync(path.join(SRC, 'index.js'), 'utf8'), ctx);
console.log('index.js 挂载的全局:', Object.keys(ctx.window).filter((k) => k.startsWith('__')).join(', '));
const idxGlobal = Object.entries(ctx.window).find(([k]) => k.startsWith('__') && k !== '__CET4_PAPERS' && k !== '__CET4_AUDIO');
const IDX = idxGlobal && ctx.window[idxGlobal[0]];
if (IDX) {
  const arr = Array.isArray(IDX) ? IDX : IDX.list || IDX.papers || Object.values(IDX);
  const e0 = Array.isArray(arr) ? arr[0] : arr;
  console.log('index 条目数:', Array.isArray(arr) ? arr.length : '(非数组，顶层键: ' + Object.keys(IDX).slice(0, 8).join(',') + ')');
  if (e0) console.log('首条字段:', JSON.stringify(Object.keys(e0)), '示例 share:', JSON.stringify(e0.share ?? null));
}

console.log('\n== audio.js share 解析 ==');
vm.runInContext(fs.readFileSync(path.join(SRC, 'audio.js'), 'utf8'), ctx);
const AU = ctx.window.__CET4_AUDIO;
let direct = 0, viaShare = 0, none = 0; const noAudio = [];
for (const id of Object.keys(PAPERS)) {
  const a = AU[id];
  if (!a) { none++; noAudio.push(id + '(无记录)'); continue; }
  if (a.m3u8) direct++;
  else if (a.share) {
    const t = typeof a.share === 'string' ? AU[a.share] : null;
    if (t && t.m3u8) viaShare++;
    else { none++; noAudio.push(`${id}(share=${JSON.stringify(a.share)} 不可解析)`); }
  } else { none++; noAudio.push(id + '(无 m3u8 无 share)'); }
}
const sampleNoM3u8 = Object.values(AU).find((a) => !a.m3u8);
console.log(`直接 m3u8: ${direct}，经 share 解析: ${viaShare}，缺失: ${none} ${noAudio.join(', ')}`);
console.log('无 m3u8 条目的字段:', sampleNoM3u8 ? JSON.stringify(Object.keys(sampleNoM3u8)) : '（不存在）');

console.log('\n== 体量（真实字节） ==');
let bytes = 0;
for (const f of files) bytes += fs.statSync(path.join(papersDir, f)).size;
console.log(`papers/*.js 合计 ${(bytes / 1048576).toFixed(2)} MB，均值 ${(bytes / files.length / 1024).toFixed(0)} KB/卷`);
