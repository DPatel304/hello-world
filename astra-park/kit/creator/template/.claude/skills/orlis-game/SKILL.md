---
name: orlis-game
description: How an Orlis Play movement game works - the players' body points from the camera, the round (step, draw, score), the game's settings, Orlis Play's sounds and music, orlis.json, and patterns that work well for young children. Use it whenever writing or changing game.js or orlis.json.
---

# Making an Orlis Play game

The game is `game.js`: one plain script (no `import`, no `export`), ending with
`Orlis.run(game)`. It runs in a sandbox and draws on a canvas Orlis Play gives
it; Orlis Play puts the picture on the TV, plays the sounds, and keeps time.

## The game object

```js
Orlis.run({
  secs: 90,            // seconds in a round (or endless: true - it runs until over)
  endless: false,
  music: undefined,    // Orlis Play's band, which builds through the round; or 'action' (tense)
  loud: false,         // true: the music's up from the start (a dance game)
  pauseHold: 1.5,      // seconds both hands up to pause (more if reaching up is part of play)
  keepSitters: false,  // true: someone squatting or sitting stays a player (squat games)
  minPlayers: 1, maxPlayers: 4,
  create(n){ return round; }
});
```

## The round

`create(n)` gives back a round. Orlis Play calls, every frame:

- `step(dt, W, H)` - move the game on by `dt` seconds (about 1/30 to 1/60).
  `W` and `H` are the picture's size in pixels; they can change, so work in
  0..1 units and multiply by `W`/`H` when drawing.
- `draw(c, W, H)` - draw the whole picture on canvas context `c`, every frame,
  from scratch (clear or paint a background first).
- `hud()` - the scores shown at the top: `{ score: [p1, p2, p3, p4] }`. Also
  `hideScore: true` (a team game), `hideClock: true`, `showLives: true` with
  `lives: [3, 3, 3, 3]`.
- `value()` - the round's result: the best score.
- `over` - set it to `true` to end the round early.
- `mood` (optional, 0..1) - how big the music is right now.
- `outro(dt, W, H)` (optional) - a short ending after the round; return `true`
  when it's done.

## The players: `Orlis.pose.players`

Up to 4 (`Orlis.MAX_PLAYERS`), always the same 4 slots. Each player:

- `present` - in front of the camera and playing. **Check it first**: absent
  players keep their last position.
- `color` - their colour (also `Orlis.PLAYER_COLORS[i]`). Use it for anything
  that's theirs.
- `hands.left`, `hands.right` - `{ x, y, vx, vy, speed }`: `x`, `y` from 0 to 1
  (0,0 top left of the screen; already mirrored, so moving your right hand
  moves it right on screen), velocity, and speed (screen-widths a second).
- `centre` - `{ x, y }`, the middle of their body.
- `scale` - their size on screen (bigger = closer).
- `lm` - 33 body points (or `null`), each `{ x, y, z, v }` (`v` is how sure the
  camera is, 0..1). Name them with `Orlis.L`: `NOSE`, `L_SHOULDER`,
  `R_SHOULDER`, `L_ELBOW`, `R_ELBOW`, `L_WRIST`, `R_WRIST`, `L_HIP`, `R_HIP`,
  `L_KNEE`, `R_KNEE`, `L_ANKLE`, `R_ANKLE`. `Orlis.BONES` lists pairs to draw
  a stick figure.

Patterns that work:

- **Touching something:** hand within a radius, in pixels:
  `Math.hypot((h.x - t.x) * W, (h.y - t.y) * H) < r * H`.
- **A jump:** the player's `centre.y` rising quickly (smaller `y`), compared
  with where it's been the last half-second.
- **Arms up:** both wrists above the nose (`lm[L.L_WRIST].y < lm[L.NOSE].y`).
- **A squat:** hips dropping towards the knees (set `keepSitters: true`).
- Show each player where their hands are (a soft circle in their colour) so
  children see what they control.

## Sounds and music

Only Orlis Play's own sounds play; anything else is ignored. Kind ones:

`Orlis.sfx.` pop, gold, chime, twinkle, boing, plop, splash, whoosh, tada,
hooray, fanfare, bloom, rainbow, firefly, squeak, quack, meow, bark, honk,
chirp, warble, bird, drum, trumpet, spring, flip, pick, combo, slice, land,
nibble, zap, uhoh, hmm, hey, yawn, startle, step, tick, select, nav

Music: `Orlis.music.intensity(0..1)` (or use `mood` in the round).

Don't play a sound every frame - only when something happens.

## orlis.json

```json
{
  "id": "bird-hoops",                       // lowercase letters, numbers and dashes; stays the same forever
  "name": "Bird Hoops",                     // up to 40 letters
  "version": "0.1",                         // raise it for each new version sent: 0.2, 0.3...
  "blurb": "Flap your arms to fly through the hoops",
  "about": "A few friendly sentences for the game's page in the Store.",
  "players": [1, 4],
  "uses": "body",                           // "hands" or "body"
  "ages": 3,                                // the youngest it's easy for
  "tags": ["Flying", "Together"],           // up to 6; "Together" puts it in Play together
  "howto": [ { "move": "wave", "title": "Flap", "line": "Flap your arms to fly up" } ],
  "icon": { "cols": ["#0ea5e9", "#6366f1"], "glyph": "<path d=\"...\" fill=\"#fff\"/>" }
}
```

(no comments in the real file - it's JSON). `howto` moves: reach, jump, duck,
squat, wave, run, dance, together (up to 5). The icon's `glyph` is SVG on a
100 x 100 square: white shapes only (`path`, `circle`, `rect`, `ellipse`,
`polygon`) - no scripts, links or images.

## Good games for little ones

- One idea, obvious in the first five seconds.
- Big targets, generous hit areas, slow things at the start, a gentle build.
- Something nice happens for every player, often: sparkles, a chime.
- Nobody is ever stuck or out for long. No "game over" screens - the round
  just ends and everyone gets their score.
