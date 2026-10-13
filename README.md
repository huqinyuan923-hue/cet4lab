# CET4Lab · 四级真题刷题

大学英语四级（CET-4）历年真题在线刷题站：**免登录、零数据库、移动端优先**。
收录 2020 年 7 月 – 2026 年 6 月共 **46 套真题、2530 道客观题**，含听力音频、逐题解析与写作翻译范文。

线上地址：https://cet4.adcakeyuan.top

## 功能

- **三种模式**：整卷限时（125 分钟倒计时）/ 分题型练习（可单题对答案）/ 背题（直接看解析）
- **作答与批改**：客观题自动判分、分题型正确率、逐题解析（听力 `定位/信号/排除/替换`、完形 `词性槽/依据/竞争词/易错`、匹配 `定位/改写/辨邻`、阅读 `判型/拆句/定位/信号/替换/选项`）
- **听力**：分段精听（点击跳段）、本段循环、倍速、进度记忆
- **错题本**：交卷自动收录答错题，按题型复习、重练模式、标记已掌握
- **生词本**：真题原文点词收藏（自动保存所在原句），按 SM-2 间隔重复复习
- **统计**：12 周打卡热力图、各题型正确率、数据导出 / 导入（localStorage 备份）
- 深浅色主题、移动端优先布局、键盘可操作

## 技术栈

Next.js 15（App Router）+ TypeScript strict + Tailwind CSS，pnpm。
页面全部构建期静态预渲染（`generateStaticParams` 覆盖 46 套卷），用户数据仅存浏览器 localStorage。
音频源 CDN 未开放跨域，因此提供一个 Edge 代理路由 `app/api/listen/[...path]`（host 白名单，只转发不落盘）供非 Safari 浏览器播放。

```
app/                    页面与唯一服务端路由（/api/listen）
components/paper/       刷题核心：PaperRunner / AudioPlayer / ClozeBoard / PassagePane / QuestionCard ...
components/             列表、错题本、统计、生词本等视图
lib/                    数据层（storage/srs/paper 工具）与类型
scripts/build-data.mjs  P0 数据管线：源 JS → public/data 静态 JSON（含完整性校验）
```

## 本地开发

```bash
pnpm install
pnpm dev          # 自动生成数据后启动，http://localhost:3457
```

数据源默认取本地 `C:/works/cet4-papers/cet4-exam-quiz/data`（可用 `CET4_SRC=<目录>` 覆盖）。
仓库已提交 `public/data` 产物，若本地没有源数据，`pnpm build` 会直接沿用已提交数据；
需要重新生成时：`CET4_SRC=<源目录> pnpm build:data --force`。

```bash
pnpm typecheck    # tsc --noEmit
pnpm build        # 生产构建
pnpm start        # 生产服务
```

## 数据来源与版权

题目与解析整理自社区项目 [123xzw999/cet4-exam-quiz](https://github.com/123xzw999/cet4-exam-quiz)（该项目未附带 LICENSE、未声明内容许可）。

**大学英语四、六级考试真题版权归教育部教育考试院所有。** 本项目为个人非商业学习用途，不售卖任何内容；
听力音频不存储于本仓库，仅外链或经代理实时转发，不提供下载。如权利人提出异议将立即下线相关内容。
