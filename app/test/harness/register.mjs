/* Loaded via --import before any test file, so the globals are in place
   before src/ is imported. sound.js reads localStorage at module scope, so
   "before" is not negotiable. */
import './browser.mjs';
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
