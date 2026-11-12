/* Passwords, session tokens and invite codes.

   Passwords are kept only as scrypt hashes (a deliberately slow, salted
   hash), never as themselves. Sessions are long random tokens; the server
   keeps only a hash of each, so the database alone can't sign anyone in. */
import { scryptSync, randomBytes, timingSafeEqual, createHash, randomUUID } from 'node:crypto';

const N = 16384, R = 8, P = 1, LEN = 64;

export function hashPassword(pw){
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export function checkPassword(pw, stored){
  const [kind, n, r, p, salt, key] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64url');
  const got = scryptSync(String(pw), Buffer.from(salt, 'base64url'), want.length, { N: +n, r: +r, p: +p });
  return got.length === want.length && timingSafeEqual(got, want);
}

/* For a sign-in with an email nobody has: the same slow work, so the answer
   takes as long as a wrong password and doesn't give away who has an account. */
const DUMMY = hashPassword(randomBytes(12).toString('hex'));
export const burnTime = (pw) => { checkPassword(pw, DUMMY); };

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('base64url');
export const newId = () => randomUUID();

/* Invite codes: easy to read out and type - no 0/O, 1/I/L. */
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newInviteCode(){
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ABC[b[i] % ABC.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}
export const tidyInvite = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
