import type { Metadata } from 'next';
import StatsView from '@/components/StatsView';

export const metadata: Metadata = {
  title: '学习统计',
  description: '四级备考打卡热力图、各题型正确率与数据备份导入导出。',
};

export default function StatsPage() {
  return <StatsView />;
}
