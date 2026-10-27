/* The park's little friend, who waves on the title screen and turns up in
   the games now and then. Drawn, like everything, rather than loaded. */
import { wind } from './backdrop.js';

/* The park's little friend: round and warm, rosy-cheeked, with a sprout on
   top that leans in the wind. One arm waves; when it's happy, both go up. */
export function friend(c, x, ground, H, t, happy){
  const u = H / 900, bw = 50 * u, bh = 56 * u, y = ground - bh - 14 * u;

  c.fillStyle = 'rgba(20,30,30,.25)';
  c.beginPath(); c.ellipse(x, ground, bw * 0.95, 9 * u, 0, 0, 6.2832); c.fill();

  c.fillStyle = '#e3a546';
  for (const side of [-1, 1]){
    c.beginPath(); c.ellipse(x + side * 20 * u, ground - 8 * u, 14 * u, 11 * u, 0, 0, 6.2832); c.fill();
  }

  /* Arms behind the body, rounded caps for hands. */
  c.strokeStyle = '#f0b850'; c.lineWidth = 15 * u; c.lineCap = 'round';
  const waveA = Math.sin(t * 6) * 0.45;
  for (const side of [-1, 1]){
    const up = happy || side === 1;
    c.save();
    c.translate(x + side * bw * 0.78, y + bh * 0.05);
    c.rotate(up ? side * (0.5 + (side === 1 && !happy ? waveA : Math.sin(t * 9) * 0.2)) + Math.PI : side * -0.35);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 40 * u); c.stroke();
    c.restore();
  }

  const body = c.createRadialGradient(x - bw * 0.35, y - bh * 0.4, bw * 0.1, x, y, bh * 1.1);
  body.addColorStop(0, '#ffefb0'); body.addColorStop(0.6, '#ffd36e'); body.addColorStop(1, '#eeac48');
  c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y, bw, bh, 0, 0, 6.2832); c.fill();

  /* The sprout. */
  const lean = wind(0.44, t) * 0.5;
  c.strokeStyle = '#5f9a55'; c.lineWidth = 4 * u;
  const tipX = x + lean * 18 * u, tipY = y - bh - 20 * u;
  c.beginPath(); c.moveTo(x, y - bh + 2 * u); c.quadraticCurveTo(x, y - bh - 10 * u, tipX, tipY); c.stroke();
  c.fillStyle = '#86c46e';
  for (const side of [-1, 1]){
    c.save(); c.translate(tipX, tipY); c.rotate(side * 0.9 + lean * 0.4);
    c.beginPath(); c.ellipse(side * 9 * u, 0, 10 * u, 5 * u, 0, 0, 6.2832); c.fill();
    c.restore();
  }

  /* Face: big dark eyes with two catchlights, rosy cheeks, a small smile. */
  const blink = (t % 3.7) < 0.12 && !happy ? 0.15 : 1;
  for (const side of [-1, 1]){
    const ex = x + side * 18 * u, ey = y - 6 * u;
    c.fillStyle = '#2b2440';
    c.beginPath(); c.ellipse(ex, ey, 9 * u, 12 * u * blink, 0, 0, 6.2832); c.fill();
    if (blink === 1){
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex + 3 * u, ey - 4 * u, 3.4 * u, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(ex - 3 * u, ey + 4 * u, 1.6 * u, 0, 6.2832); c.fill();
    }
    c.fillStyle = 'rgba(255,130,120,.45)';
    c.beginPath(); c.ellipse(x + side * 32 * u, y + 10 * u, 8 * u, 5 * u, 0, 0, 6.2832); c.fill();
  }
  c.strokeStyle = '#2b2440'; c.lineWidth = 3 * u;
  c.beginPath();
  if (happy) { c.fillStyle = '#7a3a3a'; c.ellipse(x, y + 13 * u, 9 * u, 8 * u, 0, 0, Math.PI); c.fill(); }
  else { c.arc(x, y + 8 * u, 7 * u, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
}
