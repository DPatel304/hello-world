import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, ROWS, newer } from '../src/ui/store.js';

const g = (id, more = {}) => ({ id, name: id, version: '1.0', players: [1, 4], added: '2026-01-01T00:00:00Z', ...more });

test('with only a few games, the Store is the banner and one row of them all', () => {
  const l = layout([g('b'), g('a')]);
  assert.equal(l.rows.length, 1);
  assert.equal(l.rows[0].name, 'All games');
  assert.deepEqual(l.rows[0].list.map(x => x.id), ['a', 'b']);
  assert.equal(l.featured.length, 2);
});

test('with more, the rows fill from what each game says about itself, and empty rows are left out', () => {
  const games = [
    g('pop', { ages: 3, uses: 'hands', tags: ['Party', 'Together'], by: 'Orlis Play', added: '2026-03-01T00:00:00Z' }),
    g('run', { uses: 'body', by: 'Orlis Play', added: '2026-02-01T00:00:00Z' }),
    g('mine', { uses: 'body', by: 'Ellie', added: '2026-04-01T00:00:00Z' }),
    g('old', { by: 'Orlis Play', added: '2025-01-01T00:00:00Z' })
  ];
  const l = layout(games);
  const row = (n) => l.rows.find(r => r.name === n);
  assert.deepEqual(row('New for your family').list.map(x => x.id), ['mine', 'pop', 'run', 'old']);
  assert.deepEqual(row('Great for little kids').list.map(x => x.id), ['pop']);
  assert.deepEqual(row('Get moving').list.map(x => x.id), ['run', 'mine']);
  assert.deepEqual(row('Play together').list.map(x => x.id), ['pop']);
  assert.deepEqual(row('Made by family & friends').list.map(x => x.id), ['mine']);
  assert.equal(l.featured[0].id, 'mine', 'the newest is featured first');
  assert.equal(ROWS.length, 5);
  assert.ok(!layout(games.map(x => ({ ...x, by: 'Orlis Play' }))).rows.some(r => r.name === 'Made by family & friends'));
});

test('versions compare as numbers', () => {
  assert.ok(newer('1.10', '1.9')); assert.ok(newer('1.1', '1.0')); assert.ok(!newer('1.0', '1.0'));
});
