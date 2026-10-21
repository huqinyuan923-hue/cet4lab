import fs from 'node:fs';
import path from 'node:path';
import type { AudioEntry, PaperMeta } from './types';

/** 构建期读取套卷索引（纯静态，无请求期 IO） */
export function loadPaperIndex(): PaperMeta[] {
  const file = path.join(process.cwd(), 'public', 'data', 'papers', 'index.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PaperMeta[];
}

export function findPaper(id: string): PaperMeta | undefined {
  return loadPaperIndex().find((m) => m.id === id);
}

/** 构建期读取音频索引：只把当前套卷的条目传给客户端，避免每页拉整份 75KB */
export function loadAudioIndex(): Record<string, AudioEntry> {
  const file = path.join(process.cwd(), 'public', 'data', 'audio', 'index.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, AudioEntry>;
}

export function findAudio(id: string): AudioEntry | null {
  return loadAudioIndex()[id] ?? null;
}
