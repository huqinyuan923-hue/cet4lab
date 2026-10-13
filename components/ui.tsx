'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

/* ---------------- 图标（内联 SVG，无依赖） ---------------- */

type IconProps = { className?: string };
const svg = (path: ReactNode, extra?: Record<string, string>) =>
  function Icon({ className = 'h-4 w-4' }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...extra}
      >
        {path}
      </svg>
    );
  };

export const Icons = {
  Play: svg(<path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor" stroke="none" />),
  Pause: svg(
    <>
      <rect x="6.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  Check: svg(<path d="M4.5 12.5l5 5 10-11" />),
  Cross: svg(<path d="M6 6l12 12M18 6L6 18" />),
  Chevron: svg(<path d="M6 9l6 6 6-6" />),
  ChevronRight: svg(<path d="M9 6l6 6-6 6" />),
  ArrowLeft: svg(<path d="M19 12H5m0 0l6-6m-6 6l6 6" />),
  Headphones: svg(<path d="M4 14v-2a8 8 0 1116 0v2M4 14h2.5a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm16 0h-2.5a1 1 0 00-1 1v4a1 1 0 001 1H19a1 1 0 001-1v-5z" />),
  Clock: svg(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  List: svg(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  Book: svg(<path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5v-15zM4 18.5A2.5 2.5 0 016.5 16H19v5H6.5A2.5 2.5 0 014 18.5z" />),
  Chart: svg(<path d="M4 20V10m5.5 10V4M15 20v-7m5.5 7V8" />),
  Trash: svg(<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h8a1 1 0 001-1V7M10 11v6M14 11v6" />),
  Download: svg(<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />),
  Upload: svg(<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 5h16" />),
  Sun: svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  Moon: svg(<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />),
  Volume: svg(<path d="M11 5L6.5 8.5H3v7h3.5L11 19V5zm4.5 3.5a5 5 0 010 7M18 6a8 8 0 010 12" />),
  Star: svg(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />),
  Refresh: svg(<path d="M20 11a8 8 0 10-2.3 6.3M20 5v6h-6" />),
  Spark: svg(<path d="M12 3l1.8 4.9L18.5 9l-4.7 1.1L12 15l-1.8-4.9L5.5 9l4.7-1.1L12 3zM19 15l.9 2.4 2.1.6-2.1.6L19 21l-.9-2.4-2.1-.6 2.1-.6L19 15z" />),
  Target: svg(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  Info: svg(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  Loop: svg(<path d="M17 2.5l3 3-3 3M7 21.5l-3-3 3-3M20 5.5H8a4 4 0 00-4 4v1m0 8h12a4 4 0 004-4v-1" />),
  Eye: svg(
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  Pen: svg(<path d="M4 20h4l11-11a2.1 2.1 0 00-3-3L5 17v3zM14.5 6.5l3 3" />),
};

/* ---------------- 基元 ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[6px] font-medium transition',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-ink'
          )}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Collapse({
  title,
  children,
  defaultOpen = false,
  badge,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <Icons.Chevron className={cn('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
        <span className="flex-1">{title}</span>
        {badge}
      </button>
      {open && <div className="border-t border-line px-3.5 py-3">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function useIsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
