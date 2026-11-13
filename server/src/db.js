/* The server's data: one file (orlis.db) beside it, in SQLite - built into
   Node, so there's nothing to install. Kept to plain SQL so it can move to a
   cloud PostgreSQL later.

   Changes to the layout are numbered steps below; a new file runs them all,
   an older one runs only the ones it hasn't had yet. Never edit a step once
   it's been released - add a new one. */
import { DatabaseSync } from 'node:sqlite';

export const STEPS = [
  /* 1: accounts (a parent's), the kids' profiles under them, signed-in
     devices, and invite codes. */
  `
  CREATE TABLE accounts (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'creator', 'player')),
    created_at    TEXT NOT NULL
  );
  CREATE TABLE profiles (
    id         TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    avatar     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX profiles_account ON profiles(account_id);
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen  TEXT NOT NULL
  );
  CREATE TABLE invites (
    code       TEXT PRIMARY KEY,
    role       TEXT NOT NULL CHECK (role IN ('creator', 'player')),
    created_by TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    used_by    TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    used_at    TEXT
  );
  `,
  /* 2: households - a family: its grown-ups' accounts, and the kids'
     profiles under them, which the whole family shares. An invite is to
     join a family (household_id), or to start a new one (none). Each
     account there already becomes a family of its own. */
  `
  CREATE TABLE households (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  ALTER TABLE accounts ADD COLUMN household_id TEXT REFERENCES households(id);
  ALTER TABLE invites ADD COLUMN household_id TEXT REFERENCES households(id) ON DELETE CASCADE;
  INSERT INTO households (id, name, created_at)
    SELECT 'h-' || a.id,
           COALESCE((SELECT p.name FROM profiles p WHERE p.account_id = a.id ORDER BY p.created_at, p.rowid LIMIT 1), 'A') || '''s family',
           a.created_at
    FROM accounts a;
  UPDATE accounts SET household_id = 'h-' || id;
  CREATE INDEX accounts_household ON accounts(household_id);
  `,
  /* 3: games a creator has sent in, waiting for the owner's OK (the file
     itself is in "submissions" in the data folder) */
  `
  CREATE TABLE submissions (
    id         TEXT PRIMARY KEY,
    game_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    version    TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    bytes      INTEGER NOT NULL,
    sha256     TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('waiting', 'approved', 'declined', 'withdrawn')),
    note       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    decided_at TEXT
  );
  CREATE INDEX submissions_account ON submissions(account_id);
  `
];

export function openDb(file){
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get();
  let v = row ? row.version : 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (v < STEPS.length){
    db.exec('BEGIN');
    try {
      db.exec(STEPS[v]);
      v++;
      db.prepare('UPDATE schema_version SET version = ?').run(v);
      db.exec('COMMIT');
    } catch (e){ db.exec('ROLLBACK'); throw e; }
  }
  return db;
}

export const SCHEMA = STEPS.length;
export const now = () => new Date().toISOString();
