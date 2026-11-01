import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { EntranceOverlay } from '@/components/entrance-overlay';

export const metadata: Metadata = {
  metadataBase: new URL('https://cet4.adcakeyuan.top'),
  title: {
    default: 'CET4Lab · 四级真题刷题',
    template: '%s · CET4Lab',
  },
  description:
    '大学英语四级历年真题在线刷题：2015–2026 年 76 套真题、3980 道题、听力分段精听、逐题解析、错题本与打卡统计。免登录、免下载，手机打开就能做。',
  keywords: ['英语四级', 'CET-4', '四级真题', '四级听力', '四级词汇', '四级备考'],
  openGraph: {
    title: 'CET4Lab · 四级真题刷题',
    description: '76 套四级真题在线刷，覆盖 2015–2026 年，免登录、免下载，带逐题解析与听力分段精听。',
    type: 'website',
    locale: 'zh_CN',
    siteName: 'CET4Lab',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'CET4Lab · 四级真题刷题' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CET4Lab · 四级真题刷题',
    description: '76 套四级真题在线刷，覆盖 2015–2026 年，免登录、免下载，带逐题解析与听力分段精听。',
    images: ['/og.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
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
        {/* 进站动画会话标记：水合前执行（每会话一次）。
            看过 → done；首访 → playing（遮罩立即上屏），等首帧真正可见再切 go 起播，
            慢网络下动画不会被截断；水合迟迟不来时 go 后 6s（未起播 10s）淡出兜底。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,s=sessionStorage;if(s.getItem('boot-seen')){d.dataset.boot='done'}else if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){d.dataset.boot='done';s.setItem('boot-seen','1')}else{s.setItem('boot-seen','1');d.dataset.boot='playing';var cap=function(){if(d.dataset.boot==='playing'||d.dataset.boot==='go'){d.classList.add('boot-exiting');setTimeout(function(){if(d.dataset.boot!=='done')d.dataset.boot='done'},800)}};var capTimer=setTimeout(cap,10000);var start=function(){if(d.dataset.boot!=='playing')return;d.dataset.boot='go';window.__bootT0=performance.now();clearTimeout(capTimer);capTimer=setTimeout(cap,6000)};var go=function(){if(d.dataset.boot!=='playing')return;if(!document.querySelector('.c4-boot')){if(go.n++!==100){setTimeout(go,30);return}}var r=window.requestAnimationFrame;if(r){r(function(){r(start)})}else{setTimeout(start,32)}};go.n=0;go()}}catch(e){}`,
          }}
        />
        {/* Safari 直连音频源站：提前建连可减少首播等待 */}
        <link rel="preconnect" href="https://listening.lazynote.cn" crossOrigin="" />
        <link rel="dns-prefetch" href="https://listening.lazynote.cn" />
      </head>
      <body className="min-h-screen">
        <EntranceOverlay />
        <SiteHeader />
        <main className="mx-auto w-full max-w-content px-4 py-5 sm:px-6 sm:py-7">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
