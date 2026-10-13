import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  metadataBase: new URL('https://cet4.adcakeyuan.top'),
  title: {
    default: 'CET4Lab · 四级真题刷题',
    template: '%s · CET4Lab',
  },
  description:
    '大学英语四级历年真题在线刷题：46 套真题、2530 道题、听力分段精听、逐题解析、错题本与打卡统计。免登录、免下载，手机打开就能做。',
  keywords: ['英语四级', 'CET-4', '四级真题', '四级听力', '四级词汇', '四级备考'],
  openGraph: {
    title: 'CET4Lab · 四级真题刷题',
    description: '46 套四级真题在线刷，免登录、免下载，带逐题解析与听力分段精听。',
    type: 'website',
    locale: 'zh_CN',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#090b11' },
  ],
};

const themeScript = `(function(){try{var raw=localStorage.getItem('cet4:settings');var t=(raw&&JSON.parse(raw).theme)||'auto';var dark=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto w-full max-w-content px-4 py-5 sm:px-6 sm:py-7">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
