'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSettings, setSettings } from '@/lib/storage';
import { Icons, cn } from '@/components/ui';

const NAV = [
  { href: '/papers', label: '真题' },
  { href: '/mistakes', label: '错题本' },
  { href: '/wordbook', label: '生词本' },
  { href: '/stats', label: '统计' },
  { href: '/about', label: '关于' },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');

  useEffect(() => {
    setTheme(getSettings().theme);
  }, []);

  const applyTheme = (t: 'auto' | 'light' | 'dark') => {
    setTheme(t);
    setSettings({ theme: t });
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  };

  const cycle = () => applyTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto');

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-content items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-[13px] font-bold text-white dark:text-[rgb(9_11_17)]">
            4
          </span>
          <span>
            CET4<span className="text-brand">Lab</span>
          </span>
        </Link>

        <nav className="no-scrollbar -mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'shrink-0 rounded-lg px-2.5 py-1.5 text-sm transition',
                  active ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={cycle}
          className="btn-ghost btn px-2"
          title={`主题：${theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}`}
          aria-label="切换主题"
        >
          {theme === 'dark' ? <Icons.Moon className="h-4 w-4" /> : theme === 'light' ? <Icons.Sun className="h-4 w-4" /> : <Icons.Spark className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
