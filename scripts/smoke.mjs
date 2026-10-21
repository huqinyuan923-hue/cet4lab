/**
 * 路由冒烟检查：对运行中的站点做一组只读断言（页面、静态数据、代理护栏、响应头）。
 * 用法：node scripts/smoke.mjs [baseURL]     默认 http://127.0.0.1:3457
 * 任一断言失败 exit 1，并打印失败项——CI 里跟在 next build + next start 之后跑。
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:3457').replace(/\/$/, '');
const TIMEOUT_MS = 20_000;

/** @type {{ name: string, run: () => Promise<void> }[]} */
const checks = [];
const check = (name, run) => checks.push({ name, run });

const res = async (path, init) => {
  const r = await fetch(BASE + path, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
  return r;
};
const html = async (path) => {
  const r = await res(path);
  return { r, body: await r.text() };
};
const status = (path, expect) =>
  check(`${expect} ${path}`, async () => {
    const r = await res(path);
    if (r.status !== expect) throw new Error(`实际 ${r.status}`);
  });
const page = (path, markers, expect = 200) =>
  check(`${expect} ${path} 含关键内容`, async () => {
    const { r, body } = await html(path);
    if (r.status !== expect) throw new Error(`状态码 ${r.status}（期望 ${expect}）`);
    for (const m of markers) if (!body.includes(m)) throw new Error(`响应里找不到「${m}」`);
  });

/* ---------- 页面 ---------- */
page('/', ['四级真题，打开就能刷', '76 套四级真题在线刷']);
page('/papers', ['历年真题套卷', '共 76 套']);
// 卷页静态产物只到「正在加载试卷」的骨架，题目由客户端拉 JSON 后渲染
page('/papers/2026-06-3', ['2026年6月 第3套 四级真题', '正在加载试卷']);
page('/papers/2026-06-3/review', ['正在加载试卷']);
page('/papers/2020-07-1', ['2020年7月 第1套 四级真题']);
// 2016–2019 的「第 3 套」是笔试-only：没有听力，页面仍要正常出骨架并标明「无听力」
page('/papers/2016-06-3', ['2016年6月 第3套 · 无听力 四级真题', '正在加载试卷']);
status('/papers/2099-01-1', 404);
status('/papers/nope', 404);
status('/papers/nope/review', 404);
for (const p of ['/mistakes', '/wordbook', '/stats', '/about']) status(p, 200);

/* ---------- 静态数据产物 ---------- */
check('index.json 是 76 套且元信息自洽', async () => {
  const r = await res('/data/papers/index.json');
  if (!r.ok) throw new Error(`状态码 ${r.status}`);
  const list = await r.json();
  if (!Array.isArray(list) || list.length !== 76) throw new Error(`条目数 ${Array.isArray(list) ? list.length : '非数组'}，期望 76`);
  for (const m of list) {
    if (!m.id || !m.label) throw new Error(`元信息不完整：${JSON.stringify(m).slice(0, 80)}`);
    if (m.count !== 55 && m.count !== 30) throw new Error(`${m.id} 题数 ${m.count} 不属于任何一种套卷形态`);
    if (m.hasAudio !== Boolean(m.audioId)) throw new Error(`${m.id} hasAudio 与 audioId 矛盾`);
    if (m.hasAudio && m.parts?.listening !== 25) throw new Error(`${m.id} 有音频却没有 25 题听力`);
  }
  if (list.filter((m) => !m.hasAudio).length !== 8) throw new Error('笔试-only 旧卷应当是 8 套');
  const cc = r.headers.get('cache-control') || '';
  if (!cc.includes('max-age=3600')) throw new Error(`题目数据缓存策略变了：${cc}`);
});
check('单套 JSON 可取且 55 题', async () => {
  const r = await res('/data/papers/2026-06-3.json');
  if (!r.ok) throw new Error(`状态码 ${r.status}`);
  const p = await r.json();
  if (p.questions?.length !== 55) throw new Error(`题数 ${p.questions?.length}`);
  if (!Array.isArray(p.subjective?.writing?.outline)) throw new Error('outline 不是数组，写作面板会炸');
});
check('笔试-only 旧卷 JSON：30 题、题号从 26 起', async () => {
  const r = await res('/data/papers/2016-06-3.json');
  if (!r.ok) throw new Error(`状态码 ${r.status}`);
  const p = await r.json();
  if (p.questions?.length !== 30) throw new Error(`题数 ${p.questions?.length}，期望 30`);
  if (p.questions.some((q) => q.part === 'listening')) throw new Error('这套卷不该有听力');
  const nos = p.questions.map((q) => q.no).sort((a, b) => a - b);
  if (nos[0] !== 26 || nos.at(-1) !== 55) throw new Error(`题号 ${nos[0]}–${nos.at(-1)}，期望 26–55`);
});

/* ---------- SEO / PWA 端点 ---------- */
check('sitemap 收录 6 个固定页 + 76 套卷', async () => {
  const r = await res('/sitemap.xml');
  if (!r.ok) throw new Error(`状态码 ${r.status}`);
  const body = await r.text();
  const urls = body.match(/<loc>/g)?.length ?? 0;
  if (urls !== 82) throw new Error(`<loc> 数量 ${urls}，期望 82`);
  if (!body.includes('/papers/2026-06-3')) throw new Error('缺套卷地址，说明索引与站点不同步');
  if (!body.includes('/papers/2016-06-3')) throw new Error('缺笔试-only 旧卷地址');
});
status('/robots.txt', 200);
check('manifest 可安装', async () => {
  const r = await res('/manifest.webmanifest');
  if (!r.ok) throw new Error(`状态码 ${r.status}`);
  const m = await r.json();
  if (!m.name || !Array.isArray(m.icons) || !m.icons.length) throw new Error('manifest 缺 name/icons');
});

/* ---------- 听力代理护栏（不打上游，只验拒绝路径） ---------- */
for (const bad of ['/api/listen/cet4/abc/index.m3u8', '/api/listen/other/31/index.m3u8', '/api/listen/cet4/31/../../etc/passwd']) {
  check(`代理拒绝非法路径 ${bad}`, async () => {
    const r = await res(bad);
    if (r.status === 200) throw new Error('非法路径被放行了');
    if (![400, 403, 404].includes(r.status)) throw new Error(`状态码 ${r.status}`);
    if ((r.headers.get('content-type') || '').includes('html')) throw new Error('代理返回了 HTML 页面');
  });
}
check('代理 CORS 预检 204', async () => {
  const r = await res('/api/listen/cet4/31/index.m3u8', { method: 'OPTIONS' });
  if (r.status !== 204) throw new Error(`状态码 ${r.status}`);
  if (r.headers.get('access-control-allow-origin') !== '*') throw new Error('缺 ACAO 头，播放器跨源取不到');
  if (!(r.headers.get('access-control-allow-methods') || '').includes('GET')) throw new Error('方法白名单丢了 GET');
});

/* ---------- 安全响应头 ---------- */
check('全局响应头按 next.config 生效', async () => {
  const r = await res('/');
  const want = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  for (const [k, v] of Object.entries(want)) {
    const got = r.headers.get(k);
    if (got !== v) throw new Error(`${k} = ${JSON.stringify(got)}，期望 ${v}`);
  }
  if (r.headers.get('x-powered-by')) throw new Error('x-powered-by 未关闭');
});

/* ---------- 跑 ---------- */
let failed = 0;
for (const c of checks) {
  try {
    await c.run();
    console.log(`✓ ${c.name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${c.name} —— ${e.message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} 通过（${BASE}）`);
process.exit(failed ? 1 : 0);
