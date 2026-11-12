/* Node marks its built-in SQLite "experimental" and says so on every start.
   It works, and it's on track to be stable; the note would only worry
   whoever reads the server's window. Loaded first, before the database. */
const emit = process.emitWarning;
process.emitWarning = function (warning, ...rest){
  const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
  if (type === 'ExperimentalWarning' && /SQLite/i.test(String(warning?.message ?? warning))) return;
  return emit.call(process, warning, ...rest);
};
