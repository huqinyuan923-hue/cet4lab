/**
 * 听力音频 Edge 代理（BUILD-PLAN.md §6 P1-3）。
 * 源 CDN（腾讯 COS）未配置跨域：GET 无 ACAO 头且 OPTIONS 预检 403，
 * 因此非 Safari 浏览器必须经本代理同源转发。仅转发，不落盘、不缓存到磁盘。
 */
export const runtime = 'edge';

const ALLOWED_HOST = 'listening.lazynote.cn';
/** 仅允许 /cet4/<数字>/<文件名> 形态 */
const PATH_RE = /^\/cet4\/\d{1,6}\/[A-Za-z0-9._/-]+$/;

const cors = { 'Access-Control-Allow-Origin': '*' };

function bad(status: number, msg: string) {
  return new Response(msg, { status, headers: cors });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Range, Content-Type' },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const joined = '/' + (path ?? []).join('/');

  if (!PATH_RE.test(joined) || joined.includes('..') || joined.includes('//')) {
    return bad(400, 'invalid path');
  }

  let target: URL;
  try {
    target = new URL(joined, `https://${ALLOWED_HOST}`);
  } catch {
    return bad(400, 'invalid url');
  }
  if (target.host !== ALLOWED_HOST) return bad(403, 'host not allowed');

  const range = req.headers.get('range');
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: range ? { Range: range } : undefined,
      redirect: 'manual', // 不跟随重定向，避免被引到非白名单主机
    });
  } catch {
    return bad(502, 'upstream unreachable');
  }

  if (upstream.status >= 300 && upstream.status < 400) return bad(502, 'upstream redirect blocked');
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(upstream.body, { status: upstream.status, headers: cors });
  }

  const ctype = upstream.headers.get('content-type') || '';
  const isPlaylist = joined.endsWith('.m3u8') || ctype.includes('mpegurl');

  if (isPlaylist) {
    const text = await upstream.text();
    const base = joined.slice(0, joined.lastIndexOf('/') + 1);
    const rewritten = text
      .split('\n')
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;
        if (/^https?:\/\//i.test(t)) {
          try {
            const u = new URL(t);
            if (u.host !== ALLOWED_HOST) return line;
            const p = u.pathname;
            return PATH_RE.test(p) ? `/api/listen${p}` : line;
          } catch {
            return line;
          }
        }
        const name = t.replace(/^\.\//, '');
        if (!/^[A-Za-z0-9._-]+$/.test(name)) return line;
        return `/api/listen${base}${name}`;
      })
      .join('\n');

    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-mpegURL',
        ...cors,
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  }

  // 媒体分片：流式转发，透传 Range 相关头
  const headers = new Headers();
  headers.set('Content-Type', ctype || 'video/mp2t');
  headers.set('Accept-Ranges', 'bytes');
  const len = upstream.headers.get('content-length');
  const cr = upstream.headers.get('content-range');
  if (len) headers.set('Content-Length', len);
  if (cr) headers.set('Content-Range', cr);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set('Cache-Control', 'public, max-age=86400, immutable');

  return new Response(upstream.body, { status: upstream.status, headers });
}
