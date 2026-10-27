/* Little cartoon stand-ins, shared by the games: a child for when there's
   no camera to show a real face, and a dalmatian for an empty seat. */

/* Who rides along in an empty seat: a dalmatian, of course. */
export function drawPup(c, x, y, r, t){
  const bob = Math.sin(t * 2.4) * r * 0.03;
  y += bob;
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.75, r * 0.5, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.08, r * 0.55, r * 0.5, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2733';
  for (const side of [-1, 1]){
    c.save(); c.translate(x + side * r * 0.5, y - r * 0.1); c.rotate(side * (0.25 + Math.sin(t * 3) * 0.06));
    c.beginPath(); c.ellipse(0, r * 0.22, r * 0.16, r * 0.34, 0, 0, 6.2832); c.fill(); c.restore();
  }
  for (const [sx, sy, sr] of [[-0.25, -0.15, 0.08], [0.3, 0.2, 0.06], [0.05, -0.32, 0.05], [-0.4, 0.9, 0.1], [0.35, 1.05, 0.08]]){
    c.beginPath(); c.arc(x + sx * r, y + sy * r, sr * r, 0, 6.2832); c.fill();
  }
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * r * 0.2, y, r * 0.07, 0, 6.2832); c.fill(); }
  c.beginPath(); c.ellipse(x, y + r * 0.2, r * 0.1, r * 0.07, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#ff8a9a';
  c.beginPath(); c.ellipse(x + r * 0.04, y + r * 0.42, r * 0.07, r * 0.1 + Math.max(0, Math.sin(t * 4)) * r * 0.03, 0, 0, 6.2832); c.fill();
}

/* A cartoon child, for when there's no camera to show a real one. */
export function drawKid(c, x, y, r, t, skin = '#e9b892'){
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.7, r * 0.45, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.5, r * 0.56, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2440';
  const blink = (t % 3.3) < 0.12 ? 0.15 : 1;
  for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * r * 0.18, y + r * 0.02, r * 0.06, r * 0.08 * blink, 0, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#2b2440'; c.lineWidth = r * 0.05;
  c.beginPath(); c.arc(x, y + r * 0.22, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(255,120,120,.35)';
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * r * 0.33, y + r * 0.24, r * 0.09, 0, 6.2832); c.fill(); }
}
