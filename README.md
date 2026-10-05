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
- vision 1.7ms, whole frame 2.3ms, comfortably inside a 60fps slot

## Where it is going

Laptop webcam first, to find out whether the toddlers enjoy any of this before
spending on hardware. If they do, the capture layer swaps to an Orbbec Femto
Bolt depth camera and the rest of the code stays put.
