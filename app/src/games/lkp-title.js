/* Last Known Position's title card, at the start of every level - the
   game as a film you're in. Black; the title fading in, slowly; a streak
   of light sweeping through it, a bright point travelling along it; the
   level underneath ("LEVEL 1 | VERDANT CRASH SITE"); a hold; and a slow
   fade to black, into the level.

   titleCard(c, W, H, t, sub): drawn at t seconds in (0..CARD). */
import { sfx } from '../audio/sound.js';

export const TITLE = 'LAST KNOWN POSITION';
/* The card's timing (seconds): black, the title fading in, the streak
   sweeping, the level line, the hold, the fade out. */
export const CARD = 8;
const IN = [0.8, 3.8], SWEEP = [2.2, 4.6], SUB = [4.0, 5.2], OUT = [6.8, 8];
const ramp = (t, [a, b]) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (u) => u * u * (3 - 2 * u);
const FONT = '"Inter Title", Inter, "Segoe UI", sans-serif';

/* The fonts asked for straight away, so they're ready when it's drawn. */
export function loadTitleFonts(){
  try { if (typeof document !== 'undefined' && document.fonts) for (const w of [400, 600]) document.fonts.load(`${w} 40px "Inter Title"`); } catch (e){}
}

/* Letters spaced out, centred at (x, y). */
function spaced(c, text, x, y, size, weight, spacing, col){
  c.font = `${weight} ${Math.round(size)}px ${FONT}`; c.fillStyle = col; c.textBaseline = 'middle'; c.textAlign = 'left';
  const ws = [...text].map(ch => c.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + spacing * (ws.length - 1);
  let px = x - total / 2;
  [...text].forEach((ch, i) => { c.fillText(ch, px, y); px += ws[i] + spacing; });
}

export function titleCard(c, W, H, t, sub){
  c.save();
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const out = 1 - ease(ramp(t, OUT)), y = H * 0.47;
  const a = ease(ramp(t, IN)) * out, sw = ramp(t, SWEEP), s = ease(ramp(t, SUB)) * out;
  /* the streak: a thin blue line across, brightest where the point of
     light is, which travels left to right as the title comes up */
  if (sw > 0){
    const px = W * (0.12 + 0.76 * ease(sw)), line = Math.min(1, sw * 2) * out * 0.9;
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(60,140,255,0)'); g.addColorStop(Math.max(0.01, px / W - 0.35), 'rgba(60,140,255,0)');
    g.addColorStop(px / W, `rgba(110,180,255,${0.75 * line})`); g.addColorStop(Math.min(0.99, px / W + 0.25), `rgba(60,140,255,${0.25 * line})`); g.addColorStop(1, 'rgba(60,140,255,0)');
    c.fillStyle = g; c.fillRect(0, y - H * 0.004, W, H * 0.008);
    c.fillStyle = `rgba(160,210,255,${0.35 * line})`; c.fillRect(W * 0.15, y - 1, W * 0.7, 2);
    const glow = 1 - Math.abs(sw - 0.6) * 1.2;
    for (const [r, al] of [[H * 0.22, 0.4], [H * 0.035, 0.95]]){
      const rg = c.createRadialGradient(px, y, 0, px, y, r);
      rg.addColorStop(0, `rgba(${r < H * 0.1 ? '255,255,255' : '120,190,255'},${al * Math.max(0.2, glow) * out})`); rg.addColorStop(1, 'rgba(120,190,255,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(px, y, r, 0, 6.2832); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  /* the title, fading in */
  if (a > 0) spaced(c, TITLE, W / 2, y - H * 0.006, H * 0.072, 600, H * 0.016, `rgba(255,255,255,${a})`);
  /* the level, underneath */
  if (s > 0) spaced(c, sub, W / 2, H * 0.61, H * 0.022, 400, H * 0.012, `rgba(180,210,255,${0.65 * s})`);
  c.restore();
}

/* What you hear: just a deep soft swell as the title comes up, fading away. */
export function titleSound(t, dt, state){
  if (!state.swell && t > IN[0]){ state.swell = true; sfx.titleSwell?.(); }
}
