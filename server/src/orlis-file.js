/* .orlis files: an Orlis Play game in one file.

   A .orlis file is a zip archive (so any zip tool can look inside) holding:
     manifest.json   the game's name, id, version, picture and what it needs
     game.js         its code, one module, built against the Orlis Game Kit
   Each part is compressed on its own (deflate), as ordinary zips are.

   This is the reading and writing, in Node - used by the server (to list and
   hand out games) and by the build that makes .orlis files. The app reads
   them with its own small reader (app/src/ui/orlis-file.js). */
import { deflateRawSync, inflateRawSync, crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';

export const FORMAT = 1;
const MAX_PART = 64 * 1024 * 1024;

/* files: { 'manifest.json': Buffer|string, 'game.js': Buffer|string, ... } */
export function writeOrlis(files){
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, raw] of Object.entries(files)){
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const fname = Buffer.from(name, 'utf8');
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);            /* a fixed date: 1980-01-01, so builds come out the same */
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fname.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, fname, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fname.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, fname);
    offset += local.length + fname.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const n = Object.keys(files).length;
  end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/* -> { 'manifest.json': Buffer, 'game.js': Buffer } - or throws if it isn't
   a readable .orlis file. */
export function readOrlis(buf){
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('not an .orlis file');
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not an .orlis file');
  const count = buf.readUInt16LE(e + 10), dirAt = buf.readUInt32LE(e + 16);
  const out = {};
  let p = dirAt;
  for (let i = 0; i < count; i++){
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged .orlis file');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    p += 46 + nl + xl + cl;
    if (size > MAX_PART) throw new Error('part too big');
    const lnl = buf.readUInt16LE(at + 26), lxl = buf.readUInt16LE(at + 28);
    const body = buf.subarray(at + 30 + lnl + lxl, at + 30 + lnl + lxl + csize);
    const data = method === 8 ? inflateRawSync(body) : method === 0 ? Buffer.from(body) : null;
    if (!data) throw new Error('unknown compression');
    if ((crc32(data) >>> 0) !== crc) throw new Error('damaged .orlis file');
    out[name] = data;
  }
  return out;
}

/* The manifest, checked: what the server lists and the app relies on. */
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/, VER = /^\d+\.\d+(\.\d+)?$/;
export function manifestOf(files){
  if (!files['manifest.json'] || !files['game.js']) throw new Error('missing manifest.json or game.js');
  let m;
  try { m = JSON.parse(files['manifest.json'].toString('utf8')); } catch { throw new Error('manifest.json is not valid'); }
  if (m.format !== FORMAT) throw new Error(`unsupported .orlis format ${m.format}`);
  if (!ID.test(m.id || '')) throw new Error('bad game id');
  if (!VER.test(m.version || '')) throw new Error('bad version');
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) throw new Error('bad name');
  return {
    format: m.format, id: m.id, name: m.name.trim(), version: m.version, kit: m.kit || 1,
    blurb: String(m.blurb || '').slice(0, 140), players: m.players || [1, 4],
    icon: m.icon && typeof m.icon === 'object' ? { cols: (m.icon.cols || []).slice(0, 2), glyph: String(m.icon.glyph || '').slice(0, 4000) } : null,
    by: String(m.by || '').slice(0, 60),
    /* for the Store's game page and rows (all optional) */
    about: String(m.about || '').slice(0, 600),
    uses: USES.includes(m.uses) ? m.uses : '',
    ages: Number.isInteger(m.ages) && m.ages >= 2 && m.ages <= 18 ? m.ages : null,
    tags: Array.isArray(m.tags) ? m.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 20)).slice(0, 6) : [],
    howto: Array.isArray(m.howto) ? m.howto.filter(x => x && MOVES.includes(x.move)).slice(0, 5)
      .map(x => ({ move: x.move, title: String(x.title || '').slice(0, 24), line: String(x.line || '').slice(0, 60) })) : []
  };
}
/* what a game is played with, and the moves its page can picture */
export const USES = ['hands', 'body'];
export const MOVES = ['reach', 'jump', 'duck', 'squat', 'wave', 'run', 'dance', 'together'];

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
