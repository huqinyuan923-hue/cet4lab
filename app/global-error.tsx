'use client';

/** 根布局级错误兜底（连 layout 都失败时使用），必须自带 html/body */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif', background: '#f7f7f5', color: '#171717' }}>
        <div style={{ maxWidth: 420, margin: '18vh auto', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 600 }}>站点加载失败</p>
          <p style={{ marginTop: 8, fontSize: 14, color: '#71717a' }}>
            请刷新页面重试。你的做题记录存在本机浏览器，不受影响。
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 18,
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid transparent',
              background: '#4f46e5',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
