import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CET4Lab · 四级真题刷题',
    short_name: 'CET4Lab',
    description:
      '大学英语四级历年真题在线刷题：46 套 2530 题，整卷限时 / 分题型练习 / 背题三种模式，听力分段精听与逐题解析，免登录、记录只存本机。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'zh-CN',
    background_color: '#f7f7f5',
    theme_color: '#4f46e5',
    categories: ['education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
