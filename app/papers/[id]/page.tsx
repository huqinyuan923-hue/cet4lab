import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPaper, loadPaperIndex } from '@/lib/server-data';
import PaperRunner from '@/components/paper/PaperRunner';

export function generateStaticParams() {
  return loadPaperIndex().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const meta = findPaper(id);
  if (!meta) return { title: '套卷不存在' };
  return {
    title: `${meta.label} ${meta.set} 四级真题`,
    description: `${meta.label} ${meta.set} 大学英语四级真题在线作答：听力、选词填空、长篇阅读、仔细阅读与写作翻译，含逐题解析。`,
  };
}

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = findPaper(id);
  if (!meta) notFound();
  return <PaperRunner meta={meta} initialMode="exam" />;
}
