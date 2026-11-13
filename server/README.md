# Orlis Server

The Orlis Play server for one home: accounts, kids' profiles, invites, and
the Store. It runs on a laptop and answers **only devices on the same
home Wi-Fi** - it is not on the internet.

## On the laptop (Windows 11)

1. Download **Orlis-Server.exe**:
   https://github.com/dpatel304/orlis-play/releases/download/server/Orlis-Server.exe
2. Make a folder for it, such as `Documents\Orlis Server`, and put it there.
   Its data goes in an `Orlis Server data` folder beside it.
3. Double-click it. A window opens saying it's running - leave it open.
4. If Windows Firewall asks, tick **Private networks** only (not Public).
   Your home Wi-Fi should be set to Private: Settings > Network & internet >
   Wi-Fi > your network > Private network.
5. The first account made becomes the **owner** (you). After that, joining
   needs an invite code from the owner.

## The Store

The games in the Store are the `.orlis` files in `Orlis Server data\games`.
The server comes with **Pop Party** and puts it there the first time it runs.
To add a game, put its `.orlis` file in that folder; to take one out of the
Store, delete its file (it won't be put back). A newer version of a game
replaces the older one. Orlis Play's Store lists them; downloading one puts it
on that PC's home screen, playable with the server off.

**Back up** by copying the `Orlis Server data` folder (with the server closed).

## Updates

It keeps itself up to date. As it starts, and every few hours, it checks
GitHub for a newer Orlis Server. It only takes one signed with Orlis Play's
own update key, the same as the app's updates. When it finds one, it waits
for a quiet moment (nobody using it for a couple of minutes), copies the
family's data to `Orlis Server data\backups` (the last three are kept), swaps
the new exe in, and restarts in a new window. The data stays as it is.

Checking for updates is the one thing it does on the internet; nothing on
the internet can reach it. To turn updates off, set the environment
variable `ORLIS_NO_UPDATE=1`.

## How it stays private

- It listens on the home network only; the router keeps the internet out, and
  nothing is forwarded to it.
- Orlis Play finds it with a Wi-Fi broadcast, which never leaves the home.
- Passwords are kept as scrypt hashes, sign-in tokens as hashes too.
- Accounts are for parents and guardians (18+). Kids are profiles: a first
  name and an avatar, nothing else.

## For development

    npm install
    npm test                 # the tests, against a real server
    npm start                # run it from the code (data in ./data)
    node build-exe.mjs       # build the single program file into dist/

Ports: 47871 (the app talks to it here), 47870 UDP (Wi-Fi discovery).
