import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line py-6">
      <div className="mx-auto max-w-content space-y-2 px-4 text-xs leading-relaxed text-muted sm:px-6">
        <p>
          CET4Lab · 个人学习项目，免登录、不收费。真题内容版权归
          <span className="text-ink/80">教育部教育考试院</span>
          所有；本站数据为社区整理的历年 CET-4 真题（
          <a className="link" href="https://github.com/123xzw999/cet4-exam-quiz" target="_blank" rel="noreferrer noopener">
            123xzw999/cet4-exam-quiz
          </a>
          与
          <a className="link mx-1" href="https://github.com/gongyining0601/cet4" target="_blank" rel="noreferrer noopener">
            gongyining0601/cet4
          </a>
          ，均未声明内容许可），仅供个人备考学习使用。
        </p>
        <p>听力音频不存储于本站，仅外链或经代理实时转发；如权利人提出异议将立即下线相关内容。</p>
        <nav aria-label="页脚导航" className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link className="link" href="/papers">
            真题
          </Link>
          <Link className="link" href="/mistakes">
            错题本
          </Link>
          <Link className="link" href="/wordbook">
            生词本
          </Link>
          <Link className="link" href="/stats">
            统计
          </Link>
          <Link className="link" href="/about">
            关于与数据来源
          </Link>
        </nav>
      </div>
    </footer>
  );
}
