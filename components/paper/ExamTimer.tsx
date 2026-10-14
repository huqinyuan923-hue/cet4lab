'use client';

/**
 * 考试倒计时：自持秒级状态，避免整棵试卷树每秒重渲染
 * （此前倒计时放在 PaperRunner 里，导致 55 道题每秒重渲一次，且在移动端造成布局抖动）。
 */
import { useEffect, useRef, useState } from 'react';
import { fmtTime } from '@/lib/paper';
import { Icons, cn } from '@/components/ui';

export default function ExamTimer({
  deadline,
  onExpire,
  className,
  withIcon = false,
}: {
  /** 交卷截止时间戳（毫秒） */
  deadline: number;
  onExpire: () => void;
  className?: string;
  withIcon?: boolean;
}) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1000)));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const next = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setLeft(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [deadline, onExpire]);

  return (
    <span className={cn('inline-flex items-center gap-1 font-mono tabular-nums', left < 300 && 'text-bad', className)}>
      {withIcon && <Icons.Clock className="h-3.5 w-3.5" />}
      {fmtTime(left)}
    </span>
  );
}
