# Orlis Play backlog

Ideas kept for later. Not promises, and not in order within a section.

## Creator mode

From the VibeBox concept (worked out together with a friend, who is doing
their own variant). Orlis keeps its own approach: the family PC, sealed
single-file `.orlis` games, and family accounts.

- **Try it on the TV.** A Creator-mode switch: a creator's laptop on the
  home Wi-Fi sends the game in progress to Orlis Play, which reloads it in
  the sandbox each time they save, so they can jump in front of the camera
  to test their own change.
- **Starter ideas.** A pack of kid-friendly game ideas in Create, each a
  short prompt plus a matching starter template ("two-player balloon pop",
  "jump-and-duck runner"...). A way in for kids: pick an idea, a parent runs
  it with Claude, the kids play-test it.
- **The body data, on one page.** A short, plain reference for what a game
  receives (players, hands, body points, 0-1 coordinates, what "present"
  means). It goes in the Creator Kit so Claude writes better games, and it
  is the promise that keeps older games working (the kit version).
- **Test without anyone moving.** Record the family moving once (body
  points only, never video) and replay the recordings: for creators, and in
  the Store's checks, which play each submitted game with, say, "two kids
  jumping" to catch games that crash or can't be won.
- **Say up front what a game needs.** In the manifest and on the tile:
  "hands only", "full body, needs space", "1-4 players", "good for little
  kids". The checker confirms it.

The plan for creating (decided):

- **Creators use their own Claude subscription, through Claude Code.**
  Orlis Play's Create makes a game folder with the Orlis kit (CLAUDE.md, an
  Orlis skill, permission rules, hooks that keep edits in the folder and run
  the checker), opens it in Claude Code, and live-previews the game in its
  sandbox as Claude saves. Check, then Submit.
- **Publishing happens on your Wi-Fi.** Submitted games wait on the
  creator's PC ("Waiting to send") and go to the server's approval queue
  the next time they're on your Wi-Fi; the owner approves them on the
  Family page. The server re-checks everything.
- Only grown-up accounts the owner made Creators see Create.
- Order: households and Creator roles (done); the approval queue (upload
  from the app, review on the Family page); Create in Orlis Play; the kit.
- Publishing gates, later: a minimum number of play hours before
  publishing, one published game first, more once it reaches a threshold.

## The app

- **Make the privacy promise visible.** In words a parent sees, on the
  Store page and in Settings: games get body points only, never camera
  pictures, and can't reach the internet. The sandbox already enforces it.

## Store

- Upload games from the app; a Sync button; double-click a `.orlis` file
  to install it; an owner's invites page (taken out of Settings).

## Later

- **A living-room box**, if ever wanted: a dedicated device instead of the
  PC. VibeBox's board research (Orange Pi 5, about $108; Khadas VIM4, about
  $431) is the starting point.
- Not planned: native Godot/Unity games, and games loaded from web
  addresses. Both would break the sealed single-file `.orlis` sandbox.
- **Selling it: one Orlis service for many families.** Families only
  install Orlis Play; it connects to one server on the internet (AWS):
  a fixed address over HTTPS, self sign-up with email confirmation and
  password reset, payments, the owner as admin of the service, the
  database and game files (S3) backed up by AWS, COPPA work (parental
  consent, a privacy policy, deleting a family's data). Households are
  already in place for this. Until then the server stays on the laptop,
  home Wi-Fi only.
- At ship time: the fresh `orlis-play` repo (rename this one away first;
  same signing key), code signing, payments.
- Last Known Position and Pop Party release-ready; Nova re-record; finish
  the Orlis look once there's a third game (see `mockups/ORLIS-LOOK.md`).
