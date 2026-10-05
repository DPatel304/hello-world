# Stomp Stomp Clap Clap Jump Spin Freeze… Again

A camera-controlled motion game for one adult and two toddlers. Short name: **Stomp**.

The title is also the warm-up. The screen chants it one word per beat with the
lights pulsing along, everyone does the action as it is called, and the pause
before *Again* is a real freeze. Then the loop restarts.

## Where this is

`stomp.html` — a single self-contained file. Open it in a browser, press Start,
stand back about two metres. Moving paints. That is the whole game.

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
