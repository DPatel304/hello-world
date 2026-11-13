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
