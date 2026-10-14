/** 路由级加载态：页面切换时先给骨架，避免白屏 */
export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="card h-20 animate-pulse bg-surface-2/60" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-surface-2/60" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse bg-surface-2/60" />
        ))}
      </div>
    </div>
  );
}
