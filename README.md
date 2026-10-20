# CET4Lab · 四级真题刷题

大学英语四级（CET-4）历年真题在线刷题站：**免登录、零数据库、移动端优先**。
收录 2015 年 6 月 – 2026 年 6 月共 **76 套真题、3980 道客观题**，含听力音频、逐题解析与写作翻译范文。

线上地址：https://cet4.adcakeyuan.top

## 功能

- **三种模式**：整卷限时（125 分钟倒计时）/ 分题型练习（可单题对答案）/ 背题（直接看解析）
- **中文开关**：一键隐藏题干与选项的中文翻译（偏好持久化，随备份导出）
- **答题卡**：55 题一屏总览，已答/答对/答错三色状态，点击题号直接跳转；另有「下一题未答」快捷跳转
- **作答与批改**：客观题自动判分、分题型正确率、逐题解析（听力 `定位/信号/排除/替换`、完形 `词性槽/依据/竞争词/易错`、匹配 `定位/改写/辨邻`、阅读 `判型/拆句/定位/信号/替换/选项`）
- **听力**：分段精听（点击跳段）、本段循环、倍速、进度记忆；听力区块内播放器吸顶，做到第 25 题也能随时操作
- **错题本**：交卷自动收录答错题，按题型/套卷筛选、重练模式、标记已掌握
- **生词本**：真题原文点词收藏（自动保存所在原句），搜索与排序，按 SM-2 间隔重复复习
- **统计**：12 周打卡热力图、各题型正确率、正确率最低的套卷排行、数据导出 / 导入
- 深浅色主题、移动端优先布局、键盘可操作、尊重系统「减少动态效果」

## 技术栈

Next.js 15（App Router）+ TypeScript strict + Tailwind CSS，pnpm。
页面全部构建期静态预渲染（`generateStaticParams` 覆盖 76 套卷），用户数据仅存浏览器 localStorage。
音频源 CDN 未开放跨域，因此提供一个服务端代理路由 `app/api/listen/[...path]`（host 白名单，只转发不落盘）供非 Safari 浏览器播放；
该 CDN 只服务国内线路，代理固定 Node 运行时执行，命中 Vercel 边缘缓存后分片读取约 0.4s。

```
app/                    页面与唯一服务端路由（/api/listen）；robots/sitemap/manifest 同处
components/paper/       刷题核心：PaperRunner / AudioPlayer / ClozeBoard / PassagePane / QuestionCard / AnswerSheet ...
components/             列表、错题本、统计、生词本等视图
lib/                    数据层（storage/srs/paper/stats 工具）与类型
scripts/build-data.mjs  P0 数据管线：源 JS → public/data 静态 JSON（含清洗与完整性校验）
scripts/import-legacy-papers.mjs  2015–2019 旧卷转换：旧题库 JS → public/data（格式归一、解析映射）
scripts/legacy-ids.json  旧卷 id 清单；build-data 重建 2020+ 产物时据此保留旧卷
scripts/audit-quality.mjs  数据体检：选项黏连、译文缺失、答案一致性等
scripts/gen-assets.mjs 生成 favicon / apple icon / 社交分享图
```

## 本地开发

```bash
pnpm install
pnpm dev          # 自动生成数据后启动，http://localhost:3457
```

数据源默认取本地 `C:/works/cet4-papers/cet4-exam-quiz/data`（可用 `CET4_SRC=<目录>` 覆盖）。
仓库已提交 `public/data` 产物，若本地没有源数据，`pnpm build` 会直接沿用已提交数据；
需要重新生成时：`CET4_SRC=<源目录> pnpm build:data --force`。

2015–2019 旧卷源数据不同，单独导入：

```bash
LEGACY_SRC=<旧题库目录> LEGACY_AUDIO_META=<listeningMeta.js> node scripts/import-legacy-papers.mjs
```

导入脚本会合并进已有的 `public/data`，并更新 `scripts/legacy-ids.json`；之后 `pnpm build:data` 重建 2020+ 产物时会自动保留这些旧卷。
2016–2019 年第三套源数据缺少听力部分（听力与同场次第一套共用），保留其阅读与写作翻译，共 30 道客观题；列表与刷题页会按实际题型自适应显示。

```bash
pnpm typecheck    # tsc --noEmit
pnpm build        # 生产构建
pnpm start        # 生产服务
```

## 数据来源与版权

题目与解析整理自社区项目 [123xzw999/cet4-exam-quiz](https://github.com/123xzw999/cet4-exam-quiz)（2020–2026 年，该项目未附带 LICENSE、未声明内容许可）；
2015–2019 年部分整理自 [gongyining0601/cet4](https://github.com/gongyining0601/cet4)，缺失的阅读原文与个别选项由
[galio111/context-reader](https://github.com/galio111/context-reader) 等公开资料补齐。

**大学英语四、六级考试真题版权归教育部教育考试院所有。** 本项目为个人非商业学习用途，不售卖任何内容；
听力音频不存储于本仓库，仅外链或经代理实时转发，不提供下载。如权利人提出异议将立即下线相关内容。
