import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '关于 CET4Lab',
  description: 'CET4Lab 是什么、数据从哪来、版权与隐私说明。',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">关于 CET4Lab</h1>
        <p className="mt-1 text-sm text-muted">一个打开就能刷四级真题的小站。</p>
      </header>

      <section className="card space-y-3 p-4 text-sm leading-relaxed sm:p-5">
        <h2 className="font-semibold">这是什么</h2>
        <p>
          CET4Lab 收录 2015 年 6 月至 2026 年 6 月的大学英语四级历年真题，共 76 套 3980 道客观题，含听力音频、逐题解析与写作翻译范文。
          支持整卷限时、分题型练习、背题三种模式，并自动记录错题与打卡。
        </p>
        <p>
          设计原则是「免登录、免下载、零上传」：所有做题记录、错题、生词都存在你自己浏览器的 localStorage 里，
          不会上传到任何服务器。换设备或清理浏览器数据前，请在
          <Link href="/stats" className="link mx-1">
            统计页
          </Link>
          导出备份 JSON。
        </p>
      </section>

      <section className="card space-y-3 p-4 text-sm leading-relaxed sm:p-5">
        <h2 className="font-semibold">数据来源与版权</h2>
        <p>
          真题内容整理自社区开源项目：
          <a className="link ml-1" href="https://github.com/123xzw999/cet4-exam-quiz" target="_blank" rel="noreferrer noopener">
            github.com/123xzw999/cet4-exam-quiz
          </a>
          （2020–2026 年，该项目通过两本真题 PDF 转制为结构化题库，其仓库未附带 LICENSE 文件、未声明内容许可）；
          2015–2019 年部分整理自
          <a className="link mx-1" href="https://github.com/gongyining0601/cet4" target="_blank" rel="noreferrer noopener">
            github.com/gongyining0601/cet4
          </a>
          ，缺失的阅读原文与个别选项由
          <a className="link mx-1" href="https://github.com/galio111/context-reader" target="_blank" rel="noreferrer noopener">
            galio111/context-reader
          </a>
          等公开资料补齐。
        </p>
        <p className="text-muted">
          说明：2016–2019 年的第三套缺少听力部分（听力与同场次第一套共用），本站收录其选词填空、长篇阅读、仔细阅读与写作翻译，共 30 道客观题。
        </p>
        <p>
          <strong>大学英语四、六级考试真题的版权归教育部教育考试院所有</strong>
          。本站为个人非商业学习项目，不销售任何内容、不投放广告，仅用于本人及访客备考学习。
          如权利人认为本站内容侵犯其权益，请联系站长，我们会在收到通知后立即下线相关内容。
        </p>
        <p>
          听力音频不存储于本站：Safari 浏览器直接引用原始音频地址播放，其他浏览器经本站的边缘函数
          <span className="mx-1 font-mono text-[13px]">/api/listen</span>
          实时转发（只透传、不落盘、不缓存到磁盘）。本站不提供音频下载功能。
        </p>
      </section>

      <section className="card space-y-3 p-4 text-sm leading-relaxed sm:p-5">
        <h2 className="font-semibold">技术说明</h2>
        <ul className="list-inside list-disc space-y-1.5 text-muted">
          <li>Next.js 静态预渲染 + 一个用于听力转发的边缘函数，无数据库、无账号体系。</li>
          <li>76 套卷的题目数据在构建期生成，按卷懒加载。</li>
          <li>生词复习采用 SM-2 间隔重复算法（认识 / 模糊 / 不认识三档自评）。</li>
          <li>解析面板按数据实际结构渲染，四种题型的解析维度各不相同（定位 / 信号 / 排除 / 选项等）。</li>
        </ul>
      </section>

      <section className="card space-y-2 p-4 text-sm leading-relaxed sm:p-5">
        <h2 className="font-semibold">反馈</h2>
        <p className="text-muted">
          题目解析中的错漏、功能建议，欢迎在博客
          <a className="link mx-1" href="https://adcakeyuan.top" target="_blank" rel="noreferrer noopener">
            adcakeyuan.top
          </a>
          留言，或提交到对应的 GitHub 仓库。
        </p>
      </section>
    </div>
  );
}
