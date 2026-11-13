# {{name}}: an Orlis Play game

You're helping a grown-up make a movement game for **Orlis Play**: families
play it in front of a TV with a webcam, by moving - reaching, jumping,
dancing. Most players are young children. The grown-up may not be a
programmer: talk plainly, keep explanations short, and make the changes
they ask for.

The idea: {{idea}}

## The two files you work on

- **`game.js`** - the game. Plain JavaScript in one file, no imports: everything
  comes from the `Orlis` object. It ends with `Orlis.run({ ... })`.
- **`orlis.json`** - what the Store shows: name, a one-line `blurb`, a longer
  `about`, `players`, `uses` (`"hands"` or `"body"`), `ages`, `tags`, `howto`
  (the moves), and `icon` (two colours and a simple white SVG picture).

Edit only these two. Everything else in this folder is Orlis Play's (these
instructions, `.claude/`) and is protected - don't try to change it.
There's nothing to install and nothing to run: Orlis Play packs and previews
the game itself.

## How a game works

Read the **orlis-game** skill for the full details (the players' body points,
the round, the score, sounds). In short:

```js
Orlis.run({
  secs: 90,                       // seconds in a round
  create(n){                      // a new round, for up to n players
    return {
      step(dt, W, H){ },          // move things on by dt seconds
      draw(c, W, H){ },           // draw everything on canvas context c (W x H pixels)
      hud(){ return { score }; }, // score: an array, one number per player
      value(){ return best; },    // the best score, for the results
      over: false                 // true ends the round early
    };
  }
});
```

Players are `Orlis.pose.players` (up to 4). Each has `present`, `hands.left`
and `hands.right` (`x`, `y` from 0 to 1 across and down the screen, plus
`speed`), `centre`, and `lm` (33 body points). Sounds: `Orlis.sfx.pop()`,
`Orlis.sfx.gold()` and others in the skill - only those.

## The rules (Orlis Play checks every one)

- **For young children.** Friendly and gentle: no violence, nothing scary,
  no weapons, no blood, no mean words, nothing to buy, no ads, no chat, no
  collecting anyone's details. Losing is soft - try again, never "you died".
- **Moving is the controller.** Big, simple movements anyone can do. No
  reading needed to play; show, don't tell.
- **Fair for everyone at once.** Up to 4 players together; each has their
  own colour (`Orlis.PLAYER_COLORS`) and score. A child joining or leaving
  partway mustn't break anything.
- **Sealed off.** The game runs in a sandbox with no internet. Never use
  `fetch`, `XMLHttpRequest`, `WebSocket`, `import()`, `eval`, `new Function`,
  `localStorage`, `indexedDB`, `document.cookie`, `window.parent`,
  `window.top`, `window.open`, `navigator`, or workers. Draw everything
  yourself on the canvas - no images or files from anywhere.
- **The Orlis look.** Bright, soft colours, rounded shapes, big readable
  shapes from the sofa. Simple shapes drawn on the canvas.
- **Smooth.** It runs on a family laptop: keep it light (no huge loops every
  frame).

## After each change

A check runs by itself after every edit and tells you about any rule the
game breaks - fix those first. The grown-up tries each version straight away
in Orlis Play's preview (it reloads when you save). If they report a
problem, `.orlis/preview.txt` has what the preview saw (errors, if any).

When they're happy, they press **Check and send** in Orlis Play - you don't
need to do anything for that.
