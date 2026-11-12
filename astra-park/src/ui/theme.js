/* Light or dark, for the home screen and its menus (the games keep their
   own look). Kept on this PC; Settings > Theme changes it. */
const KEY = 'orlis.theme';
export const DARK_PAPER = '#11121c';

export function theme(){
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
export function setTheme(t){
  try { localStorage.setItem(KEY, t === 'dark' ? 'dark' : 'light'); } catch {}
  applyTheme();
}
export function applyTheme(){
  if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('dark', theme() === 'dark');
}
