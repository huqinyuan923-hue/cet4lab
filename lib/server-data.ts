import fs from 'node:fs';
import path from 'node:path';
import type { PaperMeta } from './types';

/** 构建期读取套卷索引（纯静态，无请求期 IO） */
export function loadPaperIndex(): PaperMeta[] {
  const file = path.join(process.cwd(), 'public', 'data', 'papers', 'index.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PaperMeta[];
}

export function findPaper(id: string): PaperMeta | undefined {
  return loadPaperIndex().find((m) => m.id === id);
}
