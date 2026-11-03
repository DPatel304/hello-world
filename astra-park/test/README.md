# Tests

```
npm test
```

44 tests, no `npm install` required. The suites run under Node's built-in test
runner against a clean checkout with an empty `node_modules`, which is the
whole point: the previous suites lived in a scratch directory, the machine
holding them was reclaimed, and all of them were lost at once.

## What is covered

| File | What it protects |
| --- | --- |
| `pose.test.mjs` | the calibration gate, hand speed, player assignment, stale-camera decay |
| `cursor.test.mjs` | dwell, cool-down, dead zone, hit padding |
| `calibration.test.mjs` | the rolling-ratio gate and every way out of that screen |
| `common.test.mjs` | high scores and the particle/shake layer |

Each suite is written around a bug that actually happened. The comments say
which one, because a test whose reason for existing is forgotten is a test
somebody deletes when it becomes inconvenient.

## The harness

`src/` expects a browser. Rather than refactor it to suit the tests, two
browser-only dependencies are redirected and the handful of globals that are
touched are supplied:

- **`harness/hooks.mjs`** — module resolution. `@mediapipe/tasks-vision` is a
  browser build that will not load under Node; `src/audio/sound.js` needs a
  live `AudioContext`. Both resolve to stubs.
- **`harness/browser.mjs`** — `localStorage`, a small DOM, `CustomEvent`,
  `innerWidth`/`innerHeight`. jsdom would do this too, at the cost of the
  no-install property above.
- **`harness/register.mjs`** — loaded via `--import` so the globals exist
  before `src/` is imported. `sound.js` reads `localStorage` at module scope,
  so the ordering is not optional.

The DOM is deliberately small. If a test needs something it does not have, add
the smallest thing that works rather than reaching for a real one.

## Keeping them honest

A test that passes for the wrong reason is worse than no test, because it
reads like coverage. Two of the cool-down tests here originally ran for 0.7
seconds against a 1.0 second dwell — they could never have failed, and they
passed with the cool-down deleted entirely.

Break the thing on purpose and check the suite notices:

```sh
sed -i 's/^const COOLDOWN = 0.75;/const COOLDOWN = 0;/' src/ui/cursor.js
npm test            # expect failures
git checkout src/ui/cursor.js
```

Every constant worth having a test is worth this check once. The current
suites catch all nine mutations tried against them: dwell length, cool-down,
hit padding, player sort order, landmark mirroring, stale-camera decay, the
calibration threshold, its escape hatch, and the high-score comparison.

## `mkclip.py`

Generates synthetic `.y4m` camera footage for browser-level testing: Chromium
accepts one in place of a real webcam. Not used by `npm test`, kept for when
the pipeline needs exercising end to end.

```sh
python3 test/mkclip.py /tmp/clip.y4m 15
```
