'use strict';
const { app, BrowserWindow, Menu, powerSaveBlocker, screen, shell } = require('electron');
const path = require('path');

/* ViveCube runs unattended in a living room with small children in front of it, so
   the shell has a different job from a normal desktop app: stay up, stay
   fullscreen, keep the camera, and survive a keyboard being used as a drum. */

const GAME = path.join(__dirname, 'game', 'index.html');

let win = null;
let blocker = null;

/* Only one copy. Two windows would fight over the camera and the second would
   simply fail to open it. */
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

function createWindow(){
  const display = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: Math.min(1440, display.workAreaSize.width),
    height: Math.min(900, display.workAreaSize.height),
    backgroundColor: '#101419',
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false   /* the game must keep running unfocused */
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(GAME);
  win.once('ready-to-show', () => win.show());

  /* Nothing in this app should ever navigate or open a window. If some future
     link does, it goes to the real browser rather than replacing the game. */
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  guardKeyboard(win);
  win.on('closed', () => { win = null; });
}

/* Toddlers play the keyboard like a xylophone. Reload, devtools and close are
   all one keystroke away in Chromium, and each of them ends the game. Block
   them, and keep two deliberate ways out for the adult: hold Escape, or the
   usual quit chord. */
function guardKeyboard(w){
  const BLOCKED = new Set(['F5', 'F7', 'F12']);
  let escDownAt = 0;

  w.webContents.on('before-input-event', (event, input) => {
    const ctrlish = input.control || input.meta;

    if (input.type === 'keyDown' && input.key === 'Escape'){
      if (!escDownAt) escDownAt = Date.now();
      event.preventDefault();
      return;
    }
    if (input.type === 'keyUp' && input.key === 'Escape'){
      /* A held Escape quits; a tapped one does nothing, so a child leaning on
         it cannot end the session by accident. */
      if (escDownAt && Date.now() - escDownAt >= 1200) app.quit();
      escDownAt = 0;
      return;
    }
    if (input.type !== 'keyDown') return;

    if (ctrlish && input.shift && input.key.toUpperCase() === 'Q'){ app.quit(); return; }
    if (input.key === 'F11'){ w.setFullScreen(!w.isFullScreen()); event.preventDefault(); return; }

    if (BLOCKED.has(input.key)) { event.preventDefault(); return; }
    if (ctrlish && ['r','w','n','t','p','f','+','-','0'].includes(input.key.toLowerCase())) event.preventDefault();
    if (ctrlish && input.shift && ['I','J','C','R'].includes(input.key.toUpperCase())) event.preventDefault();
  });
}

/* The camera is the controller, so the game can run for ten minutes without a
   single key or mouse event. Windows would read that as idle and blank the
   screen mid-painting. */
function keepAwake(){
  if (blocker !== null && powerSaveBlocker.isStarted(blocker)) return;
  blocker = powerSaveBlocker.start('prevent-display-sleep');
}

/* Grant the camera and nothing else. The app has no network and no other
   device needs, so anything beyond media is a bug or a surprise. */
function lockPermissions(session){
  const ALLOW = new Set(['media']);
  session.setPermissionRequestHandler((wc, permission, done) => done(ALLOW.has(permission)));
  session.setPermissionCheckHandler((wc, permission) => ALLOW.has(permission));
  if (session.setDevicePermissionHandler){
    session.setDevicePermissionHandler(() => false);   /* no serial/HID/USB */
  }
}

app.whenReady().then(() => {
  lockPermissions(require('electron').session.defaultSession);
  keepAwake();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  if (blocker !== null && powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
});
