/* What the Orlis Play app can ask the server.

   Accounts belong to a parent (or another grown-up): an email and password.
   The kids are profiles under it - a name and an avatar, nothing else - so no
   child ever gives the server any personal details.

   Joining needs an invite code from the owner, except for the very first
   account on a new server, which becomes the owner's. Roles:
     owner   - you: makes invites, sets roles, and (later) approves games
     creator - may upload games they've made (to the owner's approval queue)
     player  - plays

   A device stays signed in until someone signs out on it, so a family can
   play at home with no server in reach. */
import { Fail } from './http.js';
import { now } from './db.js';
import { hashPassword, checkPassword, burnTime, newToken, hashToken, newId, newInviteCode, tidyInvite } from './secure.js';

export const LIMITS = {
  profiles: 8,              /* per account */
  invites: 20,              /* unused ones an owner can have out at once */
  password: [8, 200],
  name: [1, 20],
  tries: 10,                /* wrong passwords for one email before a pause */
  pause: 15 * 60 * 1000     /* ms */
};
export const AVATARS = ['cube', 'rocket', 'star', 'moon', 'balloon', 'fish', 'dino', 'cat', 'dog', 'owl', 'bee', 'leaf'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function api(db, info, extra = () => []){
  const q = (sql) => db.prepare(sql);
  const tries = new Map();      /* email -> { n, until } */

  /* ---------- who's asking ---------- */
  function who(headers){
    const m = /^Bearer (.+)$/.exec(headers.authorization || '');
    if (!m) throw new Fail(401, 'signed_out', 'Please sign in.');
    const s = q('SELECT s.token_hash, a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?').get(hashToken(m[1]));
    if (!s) throw new Fail(401, 'signed_out', 'Please sign in again.');
    q('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now(), s.token_hash);
    return s;
  }
  const owner = (headers) => {
    const a = who(headers);
    if (a.role !== 'owner') throw new Fail(403, 'not_owner', 'Only the owner can do that.');
    return a;
  };

  /* ---------- checking what's sent ---------- */
  const text = (v) => (typeof v === 'string' ? v : '').trim();
  function email(v){
    const e = text(v).toLowerCase();
    if (!EMAIL.test(e)) throw new Fail(400, 'bad_email', 'That email address doesn\'t look right.');
    return e;
  }
  function password(v){
    const p = typeof v === 'string' ? v : '';
    if (p.length < LIMITS.password[0]) throw new Fail(400, 'short_password', `Passwords need at least ${LIMITS.password[0]} characters.`);
    if (p.length > LIMITS.password[1]) throw new Fail(400, 'long_password', 'That password is too long.');
    return p;
  }
  /* A profile's name: a first name or nickname. Not an email or a phone
     number - kids' profiles carry no contact details. */
  function name(v){
    const n = text(v).replace(/\s+/g, ' ');
    if (n.length < LIMITS.name[0] || n.length > LIMITS.name[1]) throw new Fail(400, 'bad_name', `Names are ${LIMITS.name[0]} to ${LIMITS.name[1]} letters.`);
    if (/@|\d{5,}|https?:/i.test(n)) throw new Fail(400, 'bad_name', 'Just a first name or nickname, please.');
    return n;
  }
  function avatar(v){
    const a = text(v) || AVATARS[0];
    if (!AVATARS.includes(a)) throw new Fail(400, 'bad_avatar', 'Pick one of the avatars.');
    return a;
  }
  const device = (v) => text(v).slice(0, 60) || 'A device';

  /* ---------- what's sent back ---------- */
  const accountOut = (a) => ({ id: a.id, email: a.email, role: a.role, createdAt: a.created_at });
  const profilesOf = (id) => q('SELECT id, name, avatar FROM profiles WHERE account_id = ? ORDER BY created_at, rowid').all(id).map(p => ({ ...p }));
  function signIn(accountId, dev){
    const token = newToken(), t = now();
    q('INSERT INTO sessions (token_hash, account_id, device, created_at, last_seen) VALUES (?, ?, ?, ?, ?)').run(hashToken(token), accountId, device(dev), t, t);
    const a = q('SELECT * FROM accounts WHERE id = ?').get(accountId);
    return { token, account: accountOut(a), profiles: profilesOf(accountId) };
  }
  const accounts = () => q('SELECT COUNT(*) AS n FROM accounts').get().n;

  return [
    ...extra(who),
    /* The app's "is this an Orlis server, and does it need setting up?" */
    ['GET', '/api/hello', () => ({ app: 'orlis', name: info.name, version: info.version, setup: accounts() === 0 })],

    /* Joining: a grown-up's email and password, an invite (unless this is
       the first account), their own profile's name, and a yes to "I'm a
       parent or guardian, 18 or over". */
    ['POST', '/api/signup', ({ body }) => {
      if (body.adult !== true) throw new Fail(400, 'adult', 'Accounts are for parents and guardians, 18 or over. Kids get profiles on a grown-up\'s account.');
      const e = email(body.email), p = password(body.password), n = name(body.name);
      const first = accounts() === 0;
      let invite = null;
      if (!first){
        invite = q('SELECT * FROM invites WHERE code = ? AND used_by IS NULL').get(tidyInvite(body.invite));
        if (!invite) throw new Fail(400, 'bad_invite', 'That invite code isn\'t right, or it\'s been used. Ask the owner for a new one.');
      }
      if (q('SELECT 1 FROM accounts WHERE email = ?').get(e)) throw new Fail(409, 'taken', 'There\'s already an account with that email. Try signing in.');
      const id = newId(), t = now();
      db.exec('BEGIN');
      try {
        q('INSERT INTO accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(id, e, hashPassword(p), first ? 'owner' : invite.role, t);
        q('INSERT INTO profiles (id, account_id, name, avatar, created_at) VALUES (?, ?, ?, ?, ?)').run(newId(), id, n, avatar(body.avatar), t);
        if (invite) q('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?').run(id, t, invite.code);
        db.exec('COMMIT');
      } catch (err){ db.exec('ROLLBACK'); throw err; }
      return [201, signIn(id, body.device)];
    }],

    ['POST', '/api/signin', ({ body }) => {
      const e = text(body.email).toLowerCase(), p = typeof body.password === 'string' ? body.password : '';
      const t = tries.get(e);
      if (t && t.n >= LIMITS.tries && Date.now() < t.until) throw new Fail(429, 'paused', 'Too many tries. Wait a few minutes, then try again.');
      const a = e ? q('SELECT * FROM accounts WHERE email = ?').get(e) : null;
      if (!a){ burnTime(p); throw new Fail(401, 'wrong', 'That email and password don\'t match.'); }
      if (!checkPassword(p, a.password_hash)){
        const n = (t && Date.now() < t.until ? t.n : 0) + 1;
        tries.set(e, { n, until: Date.now() + LIMITS.pause });
        throw new Fail(401, 'wrong', 'That email and password don\'t match.');
      }
      tries.delete(e);
      return signIn(a.id, body.device);
    }],

    ['POST', '/api/signout', ({ headers }) => {
      const a = who(headers);
      q('DELETE FROM sessions WHERE token_hash = ?').run(a.token_hash);
      return { ok: true };
    }],

    ['GET', '/api/me', ({ headers }) => {
      const a = who(headers);
      return { account: accountOut(a), profiles: profilesOf(a.id) };
    }],

    /* ---------- the family's profiles ---------- */
    ['POST', '/api/profiles', ({ headers, body }) => {
      const a = who(headers);
      if (profilesOf(a.id).length >= LIMITS.profiles) throw new Fail(400, 'full', `An account can have up to ${LIMITS.profiles} profiles.`);
      const p = { id: newId(), name: name(body.name), avatar: avatar(body.avatar) };
      q('INSERT INTO profiles (id, account_id, name, avatar, created_at) VALUES (?, ?, ?, ?, ?)').run(p.id, a.id, p.name, p.avatar, now());
      return [201, p];
    }],
    ['PATCH', '/api/profiles/:id', ({ headers, params, body }) => {
      const a = who(headers);
      const p = q('SELECT * FROM profiles WHERE id = ? AND account_id = ?').get(params.id, a.id);
      if (!p) throw new Fail(404, 'no_profile', 'No such profile.');
      const n = body.name === undefined ? p.name : name(body.name);
      const v = body.avatar === undefined ? p.avatar : avatar(body.avatar);
      q('UPDATE profiles SET name = ?, avatar = ? WHERE id = ?').run(n, v, p.id);
      return { id: p.id, name: n, avatar: v };
    }],
    ['DELETE', '/api/profiles/:id', ({ headers, params }) => {
      const a = who(headers);
      if (!q('SELECT 1 FROM profiles WHERE id = ? AND account_id = ?').get(params.id, a.id)) throw new Fail(404, 'no_profile', 'No such profile.');
      if (profilesOf(a.id).length <= 1) throw new Fail(400, 'last', 'An account needs at least one profile.');
      q('DELETE FROM profiles WHERE id = ? AND account_id = ?').run(params.id, a.id);
      return { ok: true };
    }],

    /* ---------- the owner's ---------- */
    ['POST', '/api/invites', ({ headers, body }) => {
      const a = owner(headers);
      const role = body.role === 'creator' ? 'creator' : 'player';
      if (q('SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL').get().n >= LIMITS.invites) throw new Fail(400, 'too_many', 'There are lots of unused invites already.');
      let code; do { code = newInviteCode(); } while (q('SELECT 1 FROM invites WHERE code = ?').get(code));
      q('INSERT INTO invites (code, role, created_by, created_at) VALUES (?, ?, ?, ?)').run(code, role, a.id, now());
      return [201, { code, role }];
    }],
    ['GET', '/api/invites', ({ headers }) => {
      owner(headers);
      return { invites: q('SELECT i.code, i.role, i.created_at AS createdAt, i.used_at AS usedAt, a.email AS usedBy FROM invites i LEFT JOIN accounts a ON a.id = i.used_by ORDER BY i.created_at DESC').all().map(r => ({ ...r })) };
    }],
    ['DELETE', '/api/invites/:code', ({ headers, params }) => {
      owner(headers);
      const r = q('DELETE FROM invites WHERE code = ? AND used_by IS NULL').run(tidyInvite(params.code));
      if (!r.changes) throw new Fail(404, 'no_invite', 'No unused invite with that code.');
      return { ok: true };
    }],
    ['GET', '/api/accounts', ({ headers }) => {
      owner(headers);
      return { accounts: q('SELECT id, email, role, created_at AS createdAt, (SELECT COUNT(*) FROM profiles p WHERE p.account_id = a.id) AS profiles FROM accounts a ORDER BY created_at').all().map(r => ({ ...r })) };
    }],
    ['POST', '/api/accounts/:id/role', ({ headers, params, body }) => {
      const me = owner(headers);
      if (params.id === me.id) throw new Fail(400, 'self', 'The owner stays the owner.');
      if (!['creator', 'player'].includes(body.role)) throw new Fail(400, 'bad_role', 'Roles are creator or player.');
      const r = q('UPDATE accounts SET role = ? WHERE id = ?').run(body.role, params.id);
      if (!r.changes) throw new Fail(404, 'no_account', 'No such account.');
      return { id: params.id, role: body.role };
    }]
  ];
}
