import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="text-3xl font-semibold text-brand">404</p>
      <p className="mt-2 text-sm text-muted">没有找到这个页面，也可能这套试卷不存在。</p>
      <div className="mt-4 flex justify-center gap-2.5">
        <Link href="/" className="btn">
          返回首页
        </Link>
        <Link href="/papers" className="btn btn-primary">
          全部套卷
        </Link>
      </div>
    </div>
  );
}
