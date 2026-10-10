# FamJam

A body-controlled party game box for the living room. It runs in a browser on a
Windows laptop plugged into the TV over HDMI. A webcam on top of the TV watches
the room; everything after launch — menus, settings, games — is driven by moving
your body. No controller, no keyboard.

## Trying it in thirty seconds

Open `famjam.html` — one self-contained file, no install. It pulls the pose
runtime from a CDN on first run, so the machine needs to be online that once.
If the download is blocked the app says so plainly and drops to mouse mode
rather than sitting on a loading message.

Rebuild it after changing anything with `npm run single`.

## Running it from source

```
npm install
npm run dev        # then press F for fullscreen
npm run build      # a static bundle in dist/
npm run offline    # optional: pull the model + WASM so it runs with no network
```

The pose model and MediaPipe runtime load from a CDN by default. `npm run
offline` copies both into `public/` — about 43MB — after which FamJam works with
the network unplugged, which is what you want for a box that lives in a living
room.

Open `http://localhost:5173`, allow the camera, stand back, and the calibration
screen takes you to the menu by itself.

`?debug` in the URL (or denying the camera) switches to **mouse mode**: the
pointer drives Player 1's cursor and everything stays reachable. That is how the
whole app is tested on machines with no camera and nobody standing in front of
them.

## Setting up the room

- **Webcam** on top of the TV, facing where people stand, as level as you can get it.
- **Distance**: 6–10 feet. Calibration waits until it can see a whole body —
  head, hips and at least one ankle — because every game here needs legs.
- **Lighting**: room lights on. Pose tracking reads an ordinary colour image, so
  a dark room is the one thing that will beat it.
- **Fullscreen**: press `F`, or use Settings → Fullscreen.
- **Two players**: stand side by side. The person on the left of the screen is
  Player 1 (blue), on the right is Player 2 (orange).

## Controls

| | |
|---|---|
| Move a hand over a button and hold ~1s | press it |
| Both hands above your head for 1.5s | pause |
| `F` | fullscreen |
| `K` | toggle the skeleton overlay |

There is a short pause after every selection before the cursor will pick again.
Without it, whatever replaces the button you just pressed is sitting under your
hand and gets chosen too.

## How it fits together

```
src/
  main.js            boot, screen router, HUD, the one animation loop
  tracking/pose.js   camera + PoseLandmarker, mirrored and smoothed
  ui/cursor.js       hand cursor, dwell-to-click, cool-down
  ui/menu.js         menu, settings, help
  ui/screens.js      calibration, splash, results, pause, lost-player
  audio/sound.js     every sound, generated — no audio files
  games/common.js    score storage, particles, score pops, screen shake
  games/*.js         one file per game
```

A game is a module exporting metadata plus `create(playerCount)`. The instance
provides `step(dt, W, H)`, `draw(c, W, H)`, `hud()`, `tally()`, `winner()` and
`value()`. The shell owns the camera, the clock, the HUD, pausing and every
screen around the round, so adding a game is one file and one line in
`games/index.js`.

## Built so far

- Tracking, calibration, hand cursor, menu, settings, help, splash, results,
  pause gesture, lost-player handling, score persistence, generated audio.
- **Pop Party** and **Star Snatch**.

Still to come: Mole Mash, Fruit Fury, Bubble Keeper, Dodge Storm, Goal Guard,
Copycat Groove.

## What has and has not been verified

Everything above is driven end to end in a headless browser through mouse mode —
boot, calibration, menu, hover-to-select, settings, splash, countdown, a played
round, scoring and results.

**Pose tracking itself has not been verified against a real person.** There is no
camera and nobody to stand in front of it here, and synthetic footage of drawn
figures is not something a pose model will recognise. The landmark plumbing,
mirroring, smoothing and player assignment are written to the documented API but
the first real run is the first real test. Expect to tune `SMOOTH` in
`tracking/pose.js` and the hit radii in each game once you can see it working.

## Troubleshooting

- **No camera prompt** — the page must be on `localhost` or HTTPS. Check the
  browser's site permissions; reload after allowing.
- **"Step back into frame"** — the camera has lost a player. Back up, or turn
  more lights on.
- **Never leaves calibration** — your feet are probably out of frame. Tilt the
  webcam down or stand further back. Settings → Re-calibrate to retry.
- **Laggy** — close other tabs. Pose runs on the GPU; a browser with hardware
  acceleration disabled will crawl.
