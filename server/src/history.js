/* What happened to the family's games, kept for good: who sent each game
   (and which version, and its fingerprint), when the owner played it, who
   approved or declined it and when, games taken out of the Store, and
   grown-ups made creators or not. The management page shows it (History).

   history(db).add(who, what, { gameId, name, version, note })
     who: the account that did it (or null: the server itself)
   history(db).list(n)  the newest n, newest first */
export const WHAT = ['sent', 'played', 'approved', 'declined', 'withdrawn', 'removed', 'creator', 'not-creator'];

export function history(db){
  const add = (who, what, { gameId = null, name = null, version = null, note = null } = {}) => {
    db.prepare('INSERT INTO history (at, who, what, game_id, name, version, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(new Date().toISOString(), who ? who.email : 'Orlis Server', what, gameId, name, version, note == null ? null : String(note).slice(0, 400));
  };
  const list = (n = 300) => db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT ?').all(Math.min(1000, Math.max(1, n)))
    .map(r => ({ at: r.at, who: r.who, what: r.what, gameId: r.game_id, name: r.name, version: r.version, note: r.note }));
  return { add, list };
}
