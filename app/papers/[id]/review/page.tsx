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
  return { title: `${meta.label} ${meta.set} 回顾`, robots: { index: false } };
}

/** 整卷回顾：默认以背题（全解析可见）姿态打开 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = findPaper(id);
  if (!meta) notFound();
  return <PaperRunner meta={meta} initialMode="study" />;
}
