# CET-4 四级真题学习站 · 完整构建任务书 v2

> **v2.0 变更记录（2026-10-08，基于对源数据的字段级实测修订）**
> 1. 总题数勘误：**2530**（46×55），非 2677。v1 的 2677 来自对 `"no":` 的子串计数污染，作废。
> 2. 音频方案重定：源 CDN（腾讯 COS）无任何 CORS 头、预检 403 → hls.js 直连在非 Safari 浏览器必挂。主方案改为 **Safari 原生直链 + 自建 Edge 代理（B+A 混合）+ 外链兜底**，见 §6 P1-3；`output:'export'` 相应取消（页面仍 100% 静态预渲染）。
> 3. 接入现成索引：源 `data/index.js` 已有 46 条元信息（`__CET4_INDEX`），P0 直接转存，不再自行拼装。
> 4. 音频解析规则修正：`share` 指针在 **index.js** 上（一跳指向同场次另一套），audio.js 中 19 套**无记录**。实测 27 直连 + 19 经 share = **46/46 全部可解析**。v1 的"按 audio.js 判 hasAudio"会导致 19 套误标无音频，已修正。
> 5. 字段级修正：answerText 非公共字段（reading 460/460 无）；explain 键名按题型固定（见 §2.2，解析面板必须遍历渲染）；matching 的 options 恒为 null、anchor 是中文段落大意；补录 cloze.pos、writing.modelZh/outline、translation.sentences 等可用字段。
> 6. 合规措辞收紧：源仓库无 LICENSE、未声明内容许可，不得表述为"开源授权"，见 §12。
> 7. 体量勘误：源文件实测 **11.2MB**（约 250KB/卷）。
>
> 本文档自包含。按顺序执行 P0 → P2，每阶段做完先跑「验收」再进下一阶段。P3 不实施。

---

## 1. 项目概述

- **做什么**：大学英语四级（CET-4）历年真题刷题学习网站，打开即用、无需登录、零数据库、移动端流畅。
- **给谁用**：备考四级的大学生（站长本人 + mengke.me 博客访客）。
- **差异化**：无需下载 App / 注册账号，手机浏览器直接刷真题、看解析、听听力、攒错题本和打卡。
- **项目目录**：`C:\works\cet4lab`（下文相对路径以此为根）。
- **站点名**：CET4Lab，域名 `cet4.adcakeyuan.top`（与站长其他项目一致，Vercel 部署）。
- **合规底线（必须遵守，见 §12）**：真题版权归教育部教育考试院；项目仅个人学习、非商用；页面标注数据来源；**音频只做外链/实时代理转发，禁止落地存储或二次分发**。

## 2. 环境与数据源（已就绪，禁止重复采集）

### 2.1 已有资产

| 资产 | 位置 | 说明 |
|---|---|---|
| 结构化真题库 | `C:\works\cet4-papers\cet4-exam-quiz` | 已 clone 的仓库，**只读，禁止修改** |
| 试卷数据 | 上述 `data/papers/*.js` | 46 套（2020-07-1 → 2026-06-3），每套 55 题无一例外，源文件共 11.2MB（约 250KB/卷） |
| 现成索引 | 上述 `data/index.js` | 全局 `__CET4_INDEX`：46 条 `{id,label,set,count,nos,parts,period,year,half,month,share}` |
| 听力数据 | 上述 `data/audio.js` | 全局 `__CET4_AUDIO`：27 套有 `{label,page,m3u8,aid,ok,segs,pieces}`；另 19 套无记录，靠 index 的 `share` 解析（§2.2） |
| 审计脚本 | 本项目 `scripts/audit-source.mjs` | `node scripts/audit-source.mjs` 可复跑全部数据断言（题数/字段缺口/share 解析/体量） |

数据真实性已双重验证：2024 年 6 月第一套听力原文与新东方在线发布的官方原文一致；音频 CDN 实测可访问（GET 200，10s 标准 HLS VOD 分片）。

### 2.2 数据格式（字段级实测，按此解析，不要猜）

**试卷**：`data/papers/{id}.js` 挂载 `(window.__CET4_PAPERS=…)[id] = {id,label,set,questions,subjective}`。
总题数 **2530**：listening 1150 + cloze 460 + matching 460 + reading 460（每套 25/10/10/10，题号 1–55 连续，answer 全非空且落在有效选项内）。

公共字段：`no, part, partName, stem, stemZh, options, answer, answerText, type, explain`。
**注意三个"非公共"陷阱**：① `answerText` —— reading 460/460 **没有**，阅读的答案原文与逐项干扰分析在 `explain["选项"]` 里；② `stemZh` —— cloze **全模块** 460/460 为空（本来就不需要中文）；③ `optionsZh` —— listening 缺 17 题、reading 缺 10 题。UI 规则：**空字段整行不渲染**，不显示占位符。

**explain 键名按题型固定**（实测 46 套零例外，解析面板必须 `Object.entries()` 遍历渲染，键名即小标题，**禁止硬编码键名**）：

| part | explain 键（实测） |
|---|---|
| listening（25 题） | `定位 \| 信号 \| 排除 \| 替换` |
| cloze（10 题） | `词性槽 \| 依据 \| 竞争词 \| 易错` |
| matching（10 题） | `定位 \| 改写 \| 辨邻` |
| reading（10 题） | `判型 \| 拆句 \| 定位 \| 信号 \| 替换 \| 选项` |

**各题型特有字段**：

- `listening`：`options`（A–D 英文）、`optionsZh`（中文翻译，可能缺）。
- `cloze`：`wordBank`（字母→单词对象）、`options`（形如 `"A) constitutes"`）、`pos`（词性，460/460 有）、`passage`（原文，题干以 `__(26)__` 占位）。
- `matching`：`options` **恒为 null**，不要读它；`paraOptions` 是字母数组（长度 9–16 不等，随卷变化）；`passage` 内段落以 `"A) "` 前缀逐段拼接（460/460），前端按正则 `/^([A-P])\)/m` 切段展示；`anchor` 是**中文段落大意**（如"把职场社交当作发展私人关系的机会"），展示为"答案段落大意"，不是英文定位原文。
- `reading`：`passage`、`passageNo`、`options/optionsZh`。

**主观题** `subjective`（46/46 齐全）：

```js
{ writing:    { directions, model, modelZh, outline },            // 题目/范文/范文译文/提纲
  translation:{ directions, source, reference,
               sentences: [ { trunk, downgrade, grammar, target } ] } // 逐句:主干拆解/降级表达/语法点/目标译文
}
```

**索引与音频解析规则**（P0 必须实现，前端不得自行理解 share）：

```
audio(id) = audioJS[id]?.m3u8                                  // 27 套直连
          ?? audioJS[ INDEX[id].share ]?.m3u8                  // 19 套，share 恒为一跳，实测 0 失败
```

19 套缺记录的全是各场次第 2/3 套（另含 2023-03 加考场次），与"同场次共用一段录音"一致。audio 条目里的 `page`（来源站外链）保留，作播放兜底入口。

### 2.3 环境注意

- node v24 ✓、pnpm 11.21 ✓、git 2.55 ✓、npm registry 与 api.github.com 直连 200 ✓。
- **PowerShell 下 `pnpm.ps1` 被执行策略拦截，须用 `pnpm.cmd`**；Git Bash 下 `pnpm` 正常。脚本统一用 `node scripts/xxx.mjs` 直跑，避免 shell shim 差异。
- 音频 CDN：GET 200 但**无任何 `Access-Control-Allow-Origin`，OPTIONS 预检 403**（腾讯 COS 未配跨域规则）——这是 §6 P1-3 播放方案的前提事实。

## 3. 技术方案

- **框架**：Next.js 15（App Router）+ TypeScript strict + Tailwind CSS，pnpm，Node ≥ 20。
- **渲染**：**不使用 `output:'export'`**，但所有页面仍为构建期静态预渲染（`generateStaticParams` 覆盖 46 套卷，无任何请求时数据获取）。放弃纯静态导出的唯一原因是音频代理路由（§6 P1-3），部署在 Vercel 上依然是"静态站 + 一个 Edge 函数"，依旧零数据库。
- **数据加载**：P0 产物 JSON 构建期 `import`；试卷页整卷静态化；列表页只读 index。禁止把全库 11MB 打进客户端 bundle。
- **用户数据**：全部 localStorage（§9），导出/导入 JSON 是 P1 必做功能。
- **部署**：Vercel，`cet4.mengke.me`。

## 4. 信息架构与路由

```
/                    首页：最近刷题进度、连续打卡天数、套卷入口
/papers              套卷列表：倒序、完成状态/得分、筛选（年份/状态）
/papers/[id]         刷题页（核心，§6 P1-2），generateStaticParams 预渲染 46 套
/papers/[id]/review  整卷回顾（交卷后看全部题+解析）
/mistakes            错题本：分组/重练/移除/已掌握
/wordbook            生词本（P2 扩展为背单词）
/stats               统计：12 周打卡热力图、题型正确率、导入导出
/about               关于 + 数据来源与版权声明（§12）+ 数据导入导出
/api/listen/[...path]  Edge 音频代理（§6 P1-3，唯一的服务端路由）
```

## 5. P0 · 数据管线（约半天）

写 `scripts/build-data.mjs`，从源仓库转换出本项目的静态 JSON：

1. 用 `node:vm` 干净上下文执行源 JS，取 `__CET4_PAPERS / __CET4_INDEX / __CET4_AUDIO`。
2. 产出 `public/data/`：
   - `papers/index.json`：由 `__CET4_INDEX` **转存**（46 条，保留全部字段），并补充计算字段 `hasAudio` 与解析后的 `audioId`；
   - `papers/{id}.json`：每套卷完整数据，**原样保留所有字段**（含 explain 全部键、subjective），不做有损删减；
   - `audio/index.json`：`{id → {m3u8, page, pieces}}`，**share 已在此解析掉**，前端拿到的每条都直接可播。
3. 完整性校验（任一不满足即 exit 1 并指明是哪套哪项）：
   - 46 套、总题数 **2530**、每套 55（25/10/10/10）、题号 1–55 连续；
   - answer 非空且落在有效选项内（matching 的答案必须落在该卷 `paraOptions` 内）；
   - 音频解析 46/46 成功（直连或一跳 share）。
4. `package.json`：`"build:data": "node scripts/build-data.mjs"`，并作为 `build` 前置。

**验收**：一键转换通过；`index.json` 46 条且 `hasAudio` 全 true；抽 3 套（2024-06-1 / 2022-12-2 / 2020-07-1）与源文件字段比对一致；`scripts/audit-source.mjs` 复跑结论与 P0 产物一致。

## 6. P1 · MVP：真题刷题闭环（核心，约 4 天）

### P1-1 套卷列表 `/papers`
卡片列表：label + set + 题量 + 状态徽标（未开始/进行中/已完成+得分，读 localStorage）；按年份/状态筛选；移动端一列、桌面两列。

### P1-2 刷题页 `/papers/[id]`
- 顶部：标题、听力播放器（P1-3）、整卷进度条、模式切换。
- 模式：① 整卷限时（默认 125 分钟倒计时）② 分题型练习 ③ 背题模式（直接显示答案）。
- 做题：客观题点选即存（实时写 localStorage，断点续做）；cloze 与 matching 必须先展示 `passage`（移动端"原文/题目"双 tab，桌面分栏），cloze 显示 wordBank（含 `pos` 词性），matching 按 `A)` 切段展示、`paraOptions` 作为选项集。
- 交卷：客观题自动判分；逐题显示对/错/未答、正确答案、`answerText`（reading 无此字段，改用 `explain["选项"]`）、**explain 按 `Object.entries()` 遍历渲染全部键**；错题的解析默认展开。
- matching 额外展示 `anchor`（中文段落大意）。
- 主观题：写作展示 directions + 范文 `model` + 译文 `modelZh` + 提纲 `outline`；翻译展示 `source` 原文、`reference` 参考译文、`sentences` 逐句（trunk 主干拆解 / downgrade 降级表达 / grammar 语法点 / target 目标译文）；用户自评完成/未完成，不计分。
- 错题自动写入错题本（§9）。

### P1-3 听力播放（三层降级，唯一涉及服务端的部分）
**前提事实**：CDN 无 CORS 头（GET 200 但无 ACAO、预检 403）→ hls.js 的 XHR 直连在 Chrome/Edge/Firefox/Android Chrome 全部失败；原生 HLS 仅 Safari 系支持（**注意：Android Chrome 不支持原生 HLS**，勿按"安卓也能原生播"设计）。

1. **Safari 系**（`audio.canPlayType('application/vnd.apple.mpegurl') !== ''`）：原生 `<audio>` 直连 CDN m3u8（不经代理，零函数开销）。
2. **其余浏览器**：hls.js（动态 import）指向本站代理 `/api/listen/cet4/{aid}/index.m3u8`。
3. **兜底**：两层都失败 → 展示 audio 条目的 `page` 外链"去来源页收听"，并在 UI 上说明原因。

**代理路由规格**（`app/api/listen/[...path]/route.ts`，`runtime: 'edge'`）：
- 仅允许 GET；目标 URL 固定为 `https://listening.lazynote.cn/{path}`，**host 白名单硬编码**，path 校验：仅允许 `/cet4/[0-9]+/` 前缀与 `[a-zA-Z0-9/._-]` 字符，拒绝 `..`；不跟随跨 host 重定向；拒绝 localhost/私有/保留地址目标。
- `.m3u8` 请求：取回文本，把其中相对分片 URI 重写为 `/api/listen/cet4/{aid}/...` 后返回，`Content-Type: application/x-mpegurl`。
- `.ts` 分片：流式转发（透传 `Range`，返回 `Access-Control-Allow-Origin: *` 与原 Content-Type）；单响应上限约 10MB。
- 设置合理 Cache-Control，代理自身可加短时缓存头。
- 播放器通用能力：基于 `pieces` 的分段列表（点击跳转 start→end）、"本段循环"开关（精听）、倍速 0.8/1.0/1.25/1.5、播放进度记忆。

### P1-4 错题本 `/mistakes`
按题型分组；每条含题干摘要、我的答案 vs 正确答案、来源卷、解析折叠；支持重练（临时练习组）、移除、标记已掌握（默认隐藏可切换）。

### P1-5 统计 `/stats`
12 周打卡热力图（交卷日=打卡）；各题型正确率条形图；数据导出/导入。

### P1-6 全局
移动端优先（375px 起步）+ 桌面适配；深浅色跟随系统；favicon + og 图；about 页放 §12 声明与导入导出。

**P1 验收清单**：
- [ ] 46 套卷全部可打开、可作答、可交卷、断点续做
- [ ] 抽查 3 套判分正确（人工对照）；explain 面板四种题型键名全部渲染、无空白
- [ ] 46/46 套可定位到音频：Safari 原生播、Chrome 走代理播、代理失败显示外链兜底（三类路径各自验证）
- [ ] 代理路由：host 白名单生效（改 host/path 注入返回 4xx），m3u8 重写后分片可加载
- [ ] 错题自动入库、重练走通
- [ ] 导出 → 清空 localStorage → 导入，数据完整还原
- [ ] 移动端无横向滚动、无布局错乱；Lighthouse 移动端 Performance ≥ 85（真机与 Lighthouse 由站长执行，见 §11）

## 7. P2 · 背单词模块（约 3 天，P1 验收后开始）

- 词库来源：https://github.com/kajweb/dict 的 CET-4 词书 JSON（音标/释义/例句），走 `build-data.mjs` 生成 `public/data/words/` 分片按需加载；不可用时备选 `yiyisheh/CET4-vocabulary`（真题词频统计）。
- 功能：词表浏览/搜索；学习卡片（回忆→翻开→自评）；每日新词+到期复习队列（默认 20/天可设置）。
- **SM-2**（纯函数 `lib/srs.ts` + 单测）：自评 q：认识=5、模糊=3、不认识=1；q≥3 时 interval 第 1 次 1 天、第 2 次 6 天、之后 `round(prev×EF)`；`EF += 0.1 − (5−q)×0.08`，clamp [1.3, 2.8]，初始 2.5；q<3 重置 reps=0、interval=1、EF 同式更新；`due = now + interval`。
- 真题联动：刷题页阅读原文点词收藏 → 进生词本与 SRS 队列，来源标记区分。

**验收**：SM-2 单测覆盖 q∈{1,3,5} 与连续序列；复习队列按 due 排序；真题收词 → 进队列 → 复习后间隔变化符合算法。

## 8. P3 · 上线后迭代（本文档不实施）

云同步（Neon + Drizzle + jose，参考 `C:\works\rss-reader`）；主观题 AI 批改（LLM API）；考试倒计时与学习提醒。

## 9. localStorage 数据模型（前缀 `cet4:`）

```
cet4:answers:{paperId}   { [qNo]: "B" }                            // 实时作答
cet4:progress:{paperId}  { status:"in-progress"|"done", startedAt, finishedAt,
                           score:{ total:{c,t}, byPart:{listening:{c,t},...} }, timed:boolean }
cet4:mistakes            [{ paperId,no,part,stem,userAnswer,correctAnswer,
                            answerTextOrExplain,addedAt,mastered }]
cet4:wordbook            [{ word, source:{type:"paper"|"dict",paperId?,no?}, addedAt }]
cet4:srs                 { [word]: { ef,interval,reps,due } }
cet4:checkins            string[]   // "2026-10-08"，交卷时生成
cet4:settings            { dailyNew, defaultSpeed, theme }
```

导出格式 `{version:1, exportedAt, data:{…}}`；导入按 version 校验、缺省字段合并默认值。

## 10. UI / 性能要求

Tailwind；一主色 + 中性灰，克制配色；解析排版清晰（英文原文与中文解析字体区分）。长文（阅读/匹配原文）分栏或双 tab。性能预算：首页 JS < 150KB gzip；试卷 JSON 按卷加载；CLS < 0.1；Lighthouse 移动端 ≥ 85。可访问性：选项为真实 button/input、键盘可操作。

## 11. 部署与发布

1. Vercel 项目指向仓库；所有页面静态预渲染 + `/api/listen` Edge 函数。
2. 绑定 `cet4.mengke.me`（DNS 加 CNAME 指向 Vercel）——**由站长在域名后台操作**。
3. metadata：title「CET4Lab · 四级真题刷题」、description、og 图、favicon、robots 允许。
4. mengke.me 作品集列表收录入口。
5. 站长侧验收：iPhone Safari / 安卓 Chrome 真机走查听力与做题全流程；Lighthouse 移动端报告。

## 12. 合规与来源声明（硬性要求）

1. 本站内容为**社区整理的历年 CET-4 真题**（来源：github.com/123xzw999/cet4-exam-quiz，该项目**无 LICENSE 文件、未声明内容许可**，不得表述为"已获开源授权"）。真题版权归**教育部教育考试院**所有。
2. 本站为非商业个人学习项目，不售卖任何内容；`/about` 与套卷列表页脚必须包含上述声明。
3. **音频只外链或经代理实时转发，禁止下载音频文件入库或二次分发**；代理仅转发、不缓存落盘。
4. 不得移除/篡改解析内容后以原创名义发布。

## 13. 附录 · 真实数据样例（解析器联调）

```jsonc
// listening（explain 键: 定位|信号|排除|替换）
{ "no":1, "part":"listening", "stem":"Why did the six residents have to find another place to stay?",
  "answer":"B", "answerText":"Because of the smoke and heat damage.",
  "explain":{ "定位":"Due to smoke and heat damage, the four apartments were declared uninhabitable, and the six residents had to move to another place, officials said. 由于烟雾和高温造成的损坏……", "信号":"因果信号 Due to 引出原因。……" } }

// reading：无 answerText；答案原文在 explain["选项"]（逐选项干扰分析）
{ "part":"reading", "explain":{ "判型":"…","拆句":"…","定位":"…","信号":"…","替换":"…",
  "选项":"A) 把比喻当字面属偷换概念 … B) 张冠李戴 …" } }

// matching
{ "part":"matching", "options":null, "paraOptions":/* 长度 9–16 的字母数组 */,
  "anchor":"把职场社交当作发展私人关系的机会",
  "explain":{ "定位":"…","改写":"…","辨邻":"…" } }

// translation.sentences[0]（46/46 齐全）
{ "trunk":"四合院是一种传统住宅建筑……故主干直接定为 The siheyuan is a traditional Chinese residential building……",
  "downgrade":"…", "grammar":"…", "target":"…" }

// audio：27 套直连；19 套按 INDEX[id].share 一跳解析（实测 46/46）
{ "label":"2024年6月 第1套", "m3u8":"https://listening.lazynote.cn/cet4/197/index.m3u8",
  "page":"https://english-exam.lazynote.cn/cet4/paper/2024-06-1/listening/",
  "pieces":[{ "label":"Section A · 第 1 篇 · 1–2 题", "start":40.5, "end":142.933 }] }
```

---

**执行顺序重申**：P0 → P1（含验收）→ P2 → P3 不实施。个别试卷数据与 §2.2 不符时"容错跳过 + 日志记录"，不要中断整批转换；字段空缺按 §2.2 的兜底规则处理。
