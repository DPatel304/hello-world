/* Reading a .orlis file in the app: a zip archive with manifest.json and
   game.js (the format, and the writer, are in server/src/orlis-file.js).
   Returns { name: Uint8Array } for each part. */
export async function readOrlis(bytes){
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('That isn\'t an Orlis game file.');
  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const out = {};
  for (let i = 0; i < count; i++){
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The game file is damaged.');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), at = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    const lnl = v.getUint16(at + 26, true), lxl = v.getUint16(at + 28, true);
    const body = b.subarray(at + 30 + lnl + lxl, at + 30 + lnl + lxl + csize);
    if (method === 0) out[name] = body.slice();
    else if (method === 8){
      const s = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out[name] = new Uint8Array(await new Response(s).arrayBuffer());
    } else throw new Error('The game file uses a kind of packing this app can\'t open.');
  }
  return out;
}

export async function sha256(bytes){
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* Writing one, for Create: { name: string | Uint8Array } in, the .orlis
   file's bytes out (deflate, as the server writes them). */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export async function writeOrlis(files){
  const enc = new TextEncoder(), locals = [], centrals = [];
  let offset = 0;
  for (const [name, raw] of Object.entries(files)){
    const data = typeof raw === 'string' ? enc.encode(raw) : raw;
    const s = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const packed = new Uint8Array(await new Response(s).arrayBuffer());
    const fname = enc.encode(name), crc = crc32(data);
    const local = new Uint8Array(30 + fname.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(8, 8, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, packed.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, fname.length, true);
    local.set(fname, 30);
    const central = new Uint8Array(46 + fname.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, packed.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, fname.length, true); cv.setUint32(42, offset, true);
    central.set(fname, 46);
    locals.push(local, packed); centrals.push(central);
    offset += local.length + packed.length;
  }
  const size = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centrals.length, true); ev.setUint16(10, centrals.length, true); ev.setUint32(12, size, true); ev.setUint32(16, offset, true);
  const all = [...locals, ...centrals, end], out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let at = 0; for (const a of all){ out.set(a, at); at += a.length; }
  return out;
}
