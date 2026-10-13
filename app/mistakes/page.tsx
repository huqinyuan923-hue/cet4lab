import type { Metadata } from 'next';
import MistakesView from '@/components/MistakesView';

export const metadata: Metadata = {
  title: '错题本',
  description: '四级真题错题自动收录，按题型复习、重练并标记已掌握。',
};

export default function MistakesPage() {
  return <MistakesView />;
}
