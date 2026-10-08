# ViveCube

A camera-controlled motion game for one adult and two toddlers.

## Running it

It is a desktop app now, not a file you open in a browser.

```
npm install
npm start          # play it
npm test           # 18 assertions against the real app
npm run build:win  # a Windows installer, on Windows
```

The game itself is still one self-contained HTML file at `src/game/index.html`,
with no build step, no bundler and no network. Electron is a shell around it,
and `src/main.js` is the whole shell.

The opening screen is blocks on warm paper. It is the one screen in the whole
thing meant to read as a toy on a shelf rather than as software, because the
people it has to convince are two and four.

It is light and the game is dark, so pressing play is a handover rather than a
cut: the blocks are thrown outward from the middle, the paper darkens to the
game's own ground, and the camera opens on the far side of it. The blocks are
sized in `vmin` rather than pixels — fixed pixel blocks are fine on a laptop
and crowd the name off its own screen on a phone.

Press play, stand back about two metres, and moving paints. That is the whole
game.
**Hold Escape for about a second to quit** — a tap does nothing, so a child
leaning on the keyboard cannot end the session.

### What the shell is for

A browser tab is the wrong container for this. The shell:

- grants the camera itself, so nobody is asked for permission mid-play, and
  grants nothing else — no microphone, no USB, no serial
- opens fullscreen with no menu, no address bar and no tabs
- holds the display awake. The camera is the controller, so the game can run
  ten minutes without a key or mouse event, and Windows would blank the screen
  halfway through a painting
- swallows the keys that would end the game. Reload, devtools and close are one
  keystroke away in Chromium and toddlers play a keyboard like a xylophone
- refuses to navigate anywhere, so the game cannot be replaced by a web page

### Getting a build without a Windows machine

Push a tag and CI builds the installer on a real Windows runner:

```
git tag v0.1.0 && git push origin v0.1.0
```

The installer lands as a build artifact. Building it on Linux gets as far as a
working `dist/win-unpacked/ViveCube.exe` and a `.zip`, but the NSIS installer step
needs wine.

No menu, no score, no timer, nothing to lose. Colour is chosen by where you are
across the room, so moving sideways changes it — the most discoverable mapping a
toddler can find. Trails fade over roughly eight seconds, so the canvas cleans
itself and never needs an adult.

**Verified**, against synthetic camera footage fed to Chromium as a fake capture
device (empty room, one mover, two simultaneous movers, a swinging room light):

- empty room reads as still — 0.00% motion, no frame spikes
- one mover localises cleanly — 1.51 vs 0.00 across the midline
- two movers register simultaneously at 0.96 balance, costing no more time than one
- a changing room light paints nothing — 0.00%
- vision 2.1ms, whole frame 2.6ms, comfortably inside a 60fps slot

Timing splits into two halves that scale with different things. Pulling a frame
out of the video element ends in `getImageData`, a GPU-to-CPU readback that
costs whatever the machine's graphics stack charges: **5.1ms** under software
rendering in CI, far less on a real GPU. Everything after it is a flat loop over
19,200 bytes and costs **0.24ms** anywhere. The panel shows them separately,
because one combined number reads as the pipeline being slow when it is not.

## The knocked camera

A toddler will knock the laptop. When the camera moves, every pixel changes at
once, the room reads as one enormous player, and the canvas floods.

Telling that apart from hard play turned out to be the interesting part. Two
measurements killed the obvious approaches: two people playing hard peak at
**30.2%** motion coverage and a knocked tripod at **30.6%**, so the level cannot
separate them — and players re-entering frame step up just as suddenly, so a
sharp rise cannot either.

What separates them is how long it lasts. A bump is a permanent misalignment, so
coverage stays pinned until the model catches up; limbs change direction, so
people cannot hold it. Measured, a bump held above 24% for **1.4s** and two
players for at most **0.5s**. The line sits at 0.9s, and a single quiet frame
clears the timer.

Rather than only recovering, the game undoes the damage: a copy of the canvas is
kept from a moment ago and restored when a bump is confirmed. That snapshot is
only taken after an unbroken calm stretch, because a bump's own coverage dips to
23% as the model starts catching up — enough, in the first version, to snapshot
the flood itself.

Measured end to end: the canvas floods to 38% and comes back to 13%, which is
where it was before the bump. Unguarded it stays at 38%. No false trips on one
player, two players at full tilt, or a changing light.

## Where it is going

Laptop webcam first, to find out whether the toddlers enjoy any of this before
spending on hardware. If they do, the capture layer swaps to an Orbbec Femto
Bolt depth camera and the rest of the code stays put.
