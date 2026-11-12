/* A very small web server: JSON in, JSON out, one route table. No framework,
   so there's nothing to install or keep updated. */
import { createServer } from 'node:http';

export class Fail extends Error {
  constructor(status, code, message){ super(message); this.status = status; this.code = code; }
}

const MAX_BODY = 64 * 1024;

/* routes: [method, '/api/thing/:id', handler(req) -> body | [status, body]] */
export function makeServer(routes){
  const table = routes.map(([method, path, fn]) => {
    const names = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    return { method, re, names, fn };
  });
  return createServer(async (req, res) => {
    /* The app is a page from its own address (tauri.localhost), so it needs
       permission to call this one. Sign-in uses a token in a header, not a
       cookie, so allowing any page to ask doesn't let one act as somebody. */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let status = 200, body;
    try {
      const hit = table.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!hit) throw new Fail(404, 'not_found', 'Nothing here.');
      const m = url.pathname.match(hit.re);
      const params = Object.fromEntries(hit.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const json = req.method === 'GET' ? {} : await readJson(req);
      const out = await hit.fn({ params, body: json, query: url.searchParams, headers: req.headers, ip: req.socket.remoteAddress });
      if (Array.isArray(out)) [status, body] = out; else body = out;
    } catch (e){
      if (e instanceof Fail){ status = e.status; body = { error: e.code, message: e.message }; }
      else { console.error(e); status = 500; body = { error: 'server', message: 'Something went wrong on the server.' }; }
    }
    const text = JSON.stringify(body ?? {});
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
    res.end(text);
  });
}

function readJson(req){
  return new Promise((ok, no) => {
    let size = 0; const parts = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY){ no(new Fail(413, 'too_big', 'That was too big to send.')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => {
      if (!parts.length) return ok({});
      try { const v = JSON.parse(Buffer.concat(parts).toString('utf8')); ok(v && typeof v === 'object' ? v : {}); }
      catch { no(new Fail(400, 'bad_json', 'That request could not be read.')); }
    });
    req.on('error', no);
  });
}
