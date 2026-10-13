import type { Metadata } from 'next';
import WordbookView from '@/components/WordbookView';

export const metadata: Metadata = {
  title: '生词本',
  description: '真题阅读中点词收藏的生词，按 SM-2 间隔重复复习。',
};

export default function WordbookPage() {
  return <WordbookView />;
}
