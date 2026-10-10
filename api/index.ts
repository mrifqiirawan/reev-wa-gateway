import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel runs only this short-lived proxy. Never import server.ts or Baileys here.
export default async function handler(req: IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const fail = (status: number, error: string) => { res.statusCode = status; res.end(JSON.stringify({ success: false, error })); };
  const origin = process.env.BACKEND_URL;
  const secret = process.env.BACKEND_SHARED_SECRET;
  if (!origin || !secret) return fail(503, 'Isi BACKEND_URL dan BACKEND_SHARED_SECRET pada Vercel, lalu deploy ulang. Baileys memerlukan backend Node.js aktif.');
  try {
    const base = new URL(origin);
    if (base.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && base.hostname === '127.0.0.1')) throw new Error('BACKEND_URL harus HTTPS');
    const incoming = new URL(req.url || '/', 'https://proxy.invalid');
    const route = req.query?.path ?? incoming.searchParams.get('path');
    const rawPath = Array.isArray(route) ? route.join('/') : route;
    const pathname = rawPath ? `/api/${rawPath}` : incoming.pathname;
    if (!pathname.startsWith('/api/') || pathname.includes('..') || pathname.includes('\\')) return fail(400, 'Endpoint tidak valid.');
    const target = new URL(pathname, base.origin);
    if (!target.pathname.startsWith('/api/')) return fail(400, 'Endpoint tidak valid.');
    incoming.searchParams.delete('path');
    target.search = incoming.searchParams.toString();
    const headers: Record<string, string> = { 'x-reev-proxy-secret': secret };
    for (const key of ['content-type', 'cookie', 'authorization', 'sec-fetch-site']) {
      const value = req.headers[key];
      if (typeof value === 'string') headers[key] = value;
    }
    let body: string | Buffer | undefined;
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      if (req.body !== undefined) body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      else {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk);
          if (size > 4 * 1024 * 1024) return fail(413, 'Ukuran permintaan terlalu besar.');
          chunks.push(Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }
    }
    const upstream = await fetch(target, { method: req.method, headers, body: Buffer.isBuffer(body) ? new Uint8Array(body) : body, redirect: 'manual', signal: AbortSignal.timeout(25000) });
    if (upstream.status >= 300 && upstream.status < 400) return fail(502, 'Backend mengalihkan URL. Gunakan alamat HTTPS backend secara langsung.');
    res.statusCode = upstream.status;
    for (const key of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(key); if (value) res.setHeader(key, value);
    }
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    fail(502, 'Backend tidak dapat dijangkau atau timeout. Periksa BACKEND_URL, HTTPS, dan proses backend.');
  }
}
