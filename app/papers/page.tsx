import type { Metadata } from 'next';
import { loadPaperIndex } from '@/lib/server-data';
import PaperList from '@/components/PaperList';

export const metadata: Metadata = {
  title: '历年真题套卷',
  description: '2020 年 7 月至 2026 年 6 月大学英语四级历年真题，共 46 套 2530 题，在线刷题并自动记录进度。',
};

export default function PapersPage() {
  const metas = loadPaperIndex();
  return <PaperList metas={metas} />;
}
