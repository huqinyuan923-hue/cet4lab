/**
 * 生成站点图形资产：favicon/apple 图标/社交分享图。
 * 用工作区已有的 sharp（rss-reader 依赖）把 SVG 栅格化为 PNG。
 * 用法：node scripts/gen-assets.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const SHARP_PATHS = [
  'C:/works/rss-reader/node_modules/sharp',
  'C:/works/treasury/node_modules/sharp',
];
let sharp = null;
for (const p of SHARP_PATHS) {
  try {
    sharp = require(p);
    console.log('使用 sharp:', p);
    break;
  } catch {
    /* 试下一个 */
  }
}
if (!sharp) {
  console.error('✗ 未找到可用的 sharp');
  process.exit(1);
}

const OUT = path.resolve('public');
const CJK = "'Microsoft YaHei','PingFang SC','Noto Sans CJK SC','Source Han Sans SC',sans-serif";

/** 圆角方块 + 数字 4（站点标记） */
const iconSvg = (S) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4f46e5"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <text x="32" y="33.5" text-anchor="middle" dominant-baseline="central"
        font-family="'Segoe UI',Arial,sans-serif" font-size="38" font-weight="700" fill="#ffffff">4</text>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.9" cy="-0.1" r="0.75">
      <stop offset="0" stop-color="#4f46e5" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#4f46e5" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#f7f7f5"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <rect x="64" y="58" width="68" height="68" rx="16" fill="url(#brand)"/>
  <text x="98" y="93" text-anchor="middle" dominant-baseline="central"
        font-family="'Segoe UI',Arial,sans-serif" font-size="40" font-weight="700" fill="#ffffff">4</text>
  <text x="152" y="95" font-family="'Segoe UI',Arial,sans-serif" font-size="38" font-weight="700" fill="#171717">CET4Lab</text>

  <text x="64" y="272" font-family="${CJK}" font-size="70" font-weight="700" fill="#171717">四级真题，打开就能刷</text>
  <text x="64" y="342" font-family="${CJK}" font-size="33" fill="#52525b">46 套真题 · 2530 道题 · 听力分段精听 · 逐题解析</text>

  <g font-family="${CJK}" font-size="26" font-weight="500">
    <rect x="64" y="428" width="148" height="52" rx="26" fill="#eeeeff"/><text x="86" y="461" fill="#4f46e5">整卷限时</text>
    <rect x="226" y="428" width="174" height="52" rx="26" fill="#eeeeff"/><text x="248" y="461" fill="#4f46e5">分题型练习</text>
    <rect x="414" y="428" width="148" height="52" rx="26" fill="#eeeeff"/><text x="436" y="461" fill="#4f46e5">背题模式</text>
    <rect x="576" y="428" width="122" height="52" rx="26" fill="#eeeeff"/><text x="598" y="461" fill="#4f46e5">错题本</text>
    <rect x="712" y="428" width="122" height="52" rx="26" fill="#eeeeff"/><text x="734" y="461" fill="#4f46e5">生词本</text>
    <rect x="848" y="428" width="148" height="52" rx="26" fill="#eeeeff"/><text x="870" y="461" fill="#4f46e5">打卡统计</text>
  </g>

  <text x="64" y="566" font-family="${CJK}" font-size="26" fill="#71717a">cet4.adcakeyuan.top · 免登录 · 记录只存本机</text>
</svg>`;

const jobs = [
  { file: 'icon-512.png', svg: iconSvg(512), size: 512 },
  { file: 'icon-192.png', svg: iconSvg(192), size: 192 },
  { file: 'apple-icon.png', svg: iconSvg(180), size: 180 },
  { file: 'og.png', svg: ogSvg, size: null },
];

for (const j of jobs) {
  let img = sharp(Buffer.from(j.svg));
  if (j.size) img = img.resize(j.size, j.size);
  const buf = await img.png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(OUT, j.file), buf);
  console.log(`✓ ${j.file} (${Math.round(buf.length / 1024)}KB)`);
}
