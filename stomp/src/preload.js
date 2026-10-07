'use strict';
const { contextBridge } = require('electron');

/* The game is the same document that runs in a browser, so it must not depend
   on any of this. It only asks whether it is running as an app, which is how it
   knows to show the quit hint instead of the file:// chrome. */
contextBridge.exposeInMainWorld('stompShell', {
  isApp: true,
  version: process.versions.electron,
  platform: process.platform
});
