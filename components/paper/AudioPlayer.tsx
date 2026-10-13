'use client';

/**
 * 听力播放器：三层降级（BUILD-PLAN.md §6 P1-3）
 *  1) Safari 系：原生 <audio> 直连 CDN m3u8（不经代理）
 *  2) 其余浏览器：hls.js → 本站 /api/listen 代理（源 CDN 无 CORS，直连必失败）
 *  3) 均失败：展示来源页外链兜底
 * 附加：分段跳转（基于 pieces）、本段循环、倍速、进度记忆。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { AudioEntry } from '@/lib/types';
import { fmtTime, pieceQuestionRange } from '@/lib/paper';
import { Icons, cn } from '@/components/ui';

export interface AudioPlayerHandle {
  playPiece: (i: number) => void;
}

const SPEEDS = [0.8, 1.0, 1.25, 1.5];

type Engine = 'loading' | 'native' | 'hls' | 'fallback';

function supportsNativeHls(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('audio');
  return el.canPlayType('application/vnd.apple.mpegurl') !== '';
}

const AudioPlayer = forwardRef<AudioPlayerHandle, {
  audio: AudioEntry | null;
  initialSpeed?: number;
  storageKey?: string;
  highlightPiece?: number;
  compact?: boolean;
}>(function AudioPlayer({ audio, initialSpeed = 1, storageKey, highlightPiece, compact = false }, handle) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [engine, setEngine] = useState<Engine>('loading');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [pieceIdx, setPieceIdx] = useState<number | null>(null);
  const [loopPiece, setLoopPiece] = useState(false);
  const [showPieces, setShowPieces] = useState(false);
  const posKey = storageKey ? `cet4:audio:${storageKey}` : '';

  /* 桌面端默认展开分段列表，移动端默认收起（首帧与 SSR 一致，避免水合不一致） */
  useEffect(() => {
    if (compact) return;
    if (window.matchMedia('(min-width: 1024px)').matches) setShowPieces(true);
  }, [compact]);

  const piece = pieceIdx != null ? audio?.pieces[pieceIdx] : null;

  /* --- 选源与初始化 --- */
  useEffect(() => {
    const el = ref.current;
    if (!el || !audio) return;
    let cancelled = false;

    const saved = posKey ? Number(window.localStorage.getItem(`${posKey}:pos`) || 0) : 0;
    const savedSpeed = posKey ? Number(window.localStorage.getItem(`${posKey}:speed`) || 0) : 0;
    if (savedSpeed) setSpeed(savedSpeed);
    if (saved > 1) el.currentTime = saved;

    if (supportsNativeHls()) {
      el.src = audio.m3u8;
      setEngine('native');
      return;
    }

    (async () => {
      try {
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setEngine('fallback');
          return;
        }
        const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(`/api/listen${audio.proxyPath}`);
        hls.attachMedia(el);
        hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal) setEngine('fallback');
        });
        setEngine('hls');
      } catch {
        if (!cancelled) setEngine('fallback');
      }
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [audio, posKey]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.playbackRate = speed;
  }, [speed, engine]);

  /* --- 事件 --- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => {
      setTime(el.currentTime);
      if (posKey && Math.floor(el.currentTime) % 5 === 0) {
        window.localStorage.setItem(`${posKey}:pos`, String(Math.floor(el.currentTime)));
      }
      const p = pieceIdx != null ? audio?.pieces[pieceIdx] : null;
      if (p && el.currentTime >= p.end) {
        if (loopPiece) {
          el.currentTime = p.start;
        } else if (!el.paused) {
          el.pause();
        }
      }
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
    };
  }, [audio, pieceIdx, loopPiece, posKey]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const playPiece = useCallback(
    (i: number) => {
      const el = ref.current;
      const p = audio?.pieces[i];
      if (!el || !p) return;
      setPieceIdx(i);
      setLoopPiece(true);
      el.currentTime = p.start;
      void el.play();
    },
    [audio]
  );

  const seek = (t: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = t;
    setTime(t);
  };

  useImperativeHandle(handle, () => ({ playPiece }), [playPiece]);

  const piecesWithRange = useMemo(
    () => (audio?.pieces || []).map((p) => ({ ...p, range: pieceQuestionRange(p) })),
    [audio]
  );

  if (!audio) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-2 px-3.5 py-3 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Icons.Headphones className="h-4 w-4" />
          该套暂无音频
        </div>
      </div>
    );
  }

  if (engine === 'fallback') {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Icons.Headphones className="h-4 w-4 text-warn" />
          <span>当前浏览器无法直接播放该音频源（跨域限制）。</span>
          {audio.page && (
            <a className="link font-medium" href={audio.page} target="_blank" rel="noreferrer noopener">
              去来源页收听 →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-line bg-surface', compact ? 'p-2.5' : 'p-3.5')}>
      <audio ref={ref} preload="metadata" className="hidden" crossOrigin={undefined} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:opacity-90 dark:text-[rgb(9_11_17)]"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? <Icons.Pause className="h-4 w-4" /> : <Icons.Play className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
            <span className="truncate">
              {engine === 'loading' ? '正在准备音频…' : audio.label}
              {piece ? ` · ${piece.label}` : ''}
            </span>
            <span className="shrink-0 font-mono">
              {fmtTime(time)}
              {duration ? ` / ${fmtTime(duration)}` : ''}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[rgb(var(--c-brand))]"
            aria-label="进度"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className="rounded-md border border-line px-1.5 py-1 font-mono text-xs text-muted hover:text-ink"
            title="倍速"
          >
            {speed}×
          </button>
          {audio.pieces.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPieces((v) => !v)}
              className={cn('rounded-md border px-1.5 py-1 text-xs', showPieces ? 'border-brand/50 text-brand' : 'border-line text-muted hover:text-ink')}
              title="分段精听"
            >
              <Icons.List className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showPieces && audio.pieces.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>分段精听（点击播放该段）</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={loopPiece}
                onChange={(e) => setLoopPiece(e.target.checked)}
                className="accent-[rgb(var(--c-brand))]"
              />
              本段循环
            </label>
          </div>
          <div className="grid max-h-52 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {piecesWithRange.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => playPiece(i)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                  pieceIdx === i
                    ? 'border-brand/60 bg-brand-soft text-brand'
                    : highlightPiece === i && highlightPiece != null
                      ? 'border-warn/50 bg-warn/10'
                      : 'border-line hover:border-brand/40 hover:text-brand'
                )}
              >
                <span className="truncate">{p.label}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted">{fmtTime(p.start)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {engine === 'hls' && (
        <p className="mt-2 text-[11px] text-muted">经本站代理转发播放（源站未开放跨域，音频不落地）。</p>
      )}
    </div>
  );
});

export default AudioPlayer;
