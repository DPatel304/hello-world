# Stomp Stomp Clap Clap Jump Spin Freeze… Again

A camera-controlled motion game for one adult and two toddlers. Short name: **Stomp**.

The title is also the warm-up. The screen chants it one word per beat with the
lights pulsing along, everyone does the action as it is called, and the pause
before *Again* is a real freeze. Then the loop restarts.

## Where this is

`stomp.html` — a single-file prototype running on a laptop webcam. It carries an
adaptive background subtractor (160x120 luma, per-pixel noise modelling,
illumination normalisation, speckle rejection) feeding a motion-energy game.

**It is UNVERIFIED.** Synthetic-camera tests passed for the empty room, a single
mover, and two simultaneous movers. They then caught two failures, and the fixes
are in the file but were never re-tested:

- illumination correction was multiplicative and could not cancel an additive
  light shift, so a changing room light read as whole-frame motion
- a per-pixel `sqrt` in the noise test cost 23ms a frame

Next step is to re-run the synthetic-camera suite against those fixes.

## Where it is going

Laptop webcam first, to find out whether the toddlers enjoy any of this before
spending on hardware. If they do, the capture layer swaps to an Orbbec Femto
Bolt depth camera and the rest of the code stays put.
