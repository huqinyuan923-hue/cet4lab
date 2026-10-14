import type { MetadataRoute } from 'next';
import { loadPaperIndex } from '@/lib/server-data';

const BASE = 'https://cet4.adcakeyuan.top';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ['', '/papers', '/mistakes', '/wordbook', '/stats', '/about'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : p === '/papers' ? 0.9 : 0.5,
  }));

  const papers = loadPaperIndex().flatMap((m) => [
    { url: `${BASE}/papers/${m.id}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
  ]);

  return [...staticRoutes, ...papers];
}
