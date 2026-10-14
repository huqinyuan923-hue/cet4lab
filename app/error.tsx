'use client';

import { useEffect } from 'react';

/** 运行时错误边界：给用户重试入口，而不是白屏或 Next 默认页 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 便于在浏览器控制台定位；站点不采集数据，不上报
    console.error('[CET4Lab] 页面渲染出错:', error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="text-lg font-semibold">页面出了点问题</p>
      <p className="mt-1.5 text-sm text-muted">
        你的作答记录存在本地，不会因此丢失。可以重试，或返回套卷列表重新进入。
      </p>
      <div className="mt-4 flex justify-center gap-2.5">
        <button type="button" className="btn btn-primary" onClick={reset}>
          重试
        </button>
        <a className="btn" href="/papers">
          返回套卷列表
        </a>
      </div>
    </div>
  );
}
