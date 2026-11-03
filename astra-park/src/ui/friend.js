/* The park's little friend, who waves on the title screen: Astra, the
   evening star come down to play. A plump golden star with the park's face
   - big dark eyes, rosy cheeks, a small smile - bobbing over the meadow in
   its own glow, twinkles drifting round it, one point waving hello. When
   it's happy it throws both arms (points) up and spins with joy. Drawn,
   like everything, rather than loaded. */

/* Where the friend stands on the front door, across the screen. */
export const FRIEND_X = 0.44;

const INK = '#2b2440';

export function friend(c, x, ground, H, t, happy){
  const u = H / 900, bob = Math.sin(t * 2.2) * 6 * u, cx = x, cy = ground - 72 * u + bob, R = 62 * u;

  /* Its shadow on the grass, smaller as it bobs up. */
  c.fillStyle = 'rgba(20,30,30,.22)';
  c.beginPath(); c.ellipse(x, ground, (46 - bob / u * 0.6) * u, 9 * u, 0, 0, 6.2832); c.fill();

  /* Its glow. */
  const g0 = c.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2);
  g0.addColorStop(0, `rgba(255,226,140,${0.38 + 0.1 * Math.sin(t * 4)})`); g0.addColorStop(1, 'rgba(255,226,140,0)');
  c.fillStyle = g0; c.beginPath(); c.arc(cx, cy, R * 2.2, 0, 6.2832); c.fill();

  c.save();
  c.translate(cx, cy);
  /* A little lean into the wave; a spin for joy. */
  c.rotate(happy ? Math.sin(t * 7) * 0.25 : Math.sin(t * 6) * 0.05);
  /* The five points; the top right one waves, and when happy the two
     side ones go up too. */
  const wave = Math.sin(t * 6) * 0.5, cheer = Math.sin(t * 9) * 0.3;
  c.beginPath();
  for (let i = 0; i < 10; i++){
    let bend = 0, reach = 1;
    if (i === 2){ bend = happy ? cheer : wave; reach = 1.08; }
    if (happy && i === 8){ bend = -cheer; reach = 1.08; }
    const a = -Math.PI / 2 + i * Math.PI / 5 + bend * 0.9, r = (i % 2 ? 0.55 : reach) * R;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.95);
  }
  c.closePath();
  const g = c.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#ffd35a'); g.addColorStop(1, '#f2ad2e');
  c.lineJoin = 'round'; c.strokeStyle = '#f2ad2e'; c.lineWidth = 11 * u; c.stroke();
  c.fillStyle = g; c.fill();
  /* A soft shine on the upper left. */
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.beginPath(); c.ellipse(-R * 0.32, -R * 0.3, R * 0.14, R * 0.08, -0.6, 0, 6.2832); c.fill();
  face(c, 0, 2 * u, u * 0.85, t, happy);
  c.restore();

  /* Twinkles drifting round it - more, and brighter, when it's happy. */
  for (let k = 0; k < (happy ? 6 : 3); k++){
    const a = t * 0.8 + k * (6.2832 / (happy ? 6 : 3)), tw = 0.5 + 0.5 * Math.sin(t * 5 + k * 2);
    sparkle(c, cx + Math.cos(a) * R * 1.45, cy + Math.sin(a) * R * 1.1, (happy ? 10 : 7) * u * tw, '#fff6c8');
  }
}

/* The park's face: big dark eyes with a catchlight, rosy cheeks, a small
   smile - an open one when happy. It blinks now and then. */
function face(c, x, y, u, t, happy){
  const blink = (t % 3.7) < 0.12 && !happy ? 0.15 : 1;
  for (const side of [-1, 1]){
    const ex = x + side * 15 * u;
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(ex, y, 7 * u, 9.1 * u * blink, 0, 0, 6.2832); c.fill();
    if (blink === 1){
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex + 2.5 * u, y - 3.2 * u, 2.7 * u, 0, 6.2832); c.fill();
    }
    c.fillStyle = 'rgba(255,120,120,.45)';
    c.beginPath(); c.ellipse(x + side * 24 * u, y + 8.4 * u, 7 * u, 4.5 * u, 0, 0, 6.2832); c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = 3 * u; c.lineCap = 'round';
  c.beginPath();
  if (happy){ c.fillStyle = '#7a3a3a'; c.ellipse(x, y + 12 * u, 8 * u, 7.2 * u, 0, 0, Math.PI); c.fill(); }
  else { c.arc(x, y + 4.8 * u, 6.4 * u, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
}

function sparkle(c, x, y, r, col){
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}
