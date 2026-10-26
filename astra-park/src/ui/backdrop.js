/* The park, painted. Shared by the title and the menu so the two screens are
   obviously the same place rather than two designs that happen to agree.
   Nothing here is an asset: no files to load, and it is sharp on any size of
   television. */

const NIGHT = { hills:['#2f6b4f', '#3c8a5e', '#4da56c'],
                trunk:'#2a4a38', leaf:'#3f8f5e', leafLit:'#4fa76e' };

export function drawPark(c, W, H, t, dim = 0){
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#0a0a2e');
  sky.addColorStop(0.45, '#1b1b52');
  sky.addColorStop(0.72, '#35306e');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);

  /* Seeded off the index so stars hold still between frames. */
  for (let i = 0; i < 90; i++){
    const x = ((i * 2654435761) % 10000) / 10000 * W;
    const y = ((i * 40503) % 7000) / 7000 * H * 0.72;
    const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + i);
    const r = (i % 7 === 0 ? 2.4 : 1.3) * (H / 900);
    c.globalAlpha = tw * 0.9;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(x, y, Math.max(1, r), 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;

  const pr = H * 0.055, px = W * 0.80, py = H * 0.30;
  c.fillStyle = '#ffb45c';
  c.beginPath(); c.arc(px, py, pr, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(255,220,150,.75)';
  c.lineWidth = Math.max(2, H * 0.006);
  c.save(); c.translate(px, py); c.rotate(-0.42); c.scale(1, 0.32);
  c.beginPath(); c.arc(0, 0, pr * 1.9, 0, 6.2832); c.stroke();
  c.restore();

  const ct = (t * 0.07) % 1;
  const cx = W * (0.05 + ct * 1.05), cy = H * (0.30 - ct * 0.16);
  const grad = c.createLinearGradient(cx, cy, cx - W * 0.16, cy + H * 0.07);
  grad.addColorStop(0, 'rgba(255,255,255,.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.strokeStyle = grad; c.lineWidth = Math.max(3, H * 0.009); c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - W * 0.16, cy + H * 0.07); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(cx, cy, Math.max(3, H * 0.008), 0, 6.2832); c.fill();

  drawHills(c, W, H, NIGHT);

  /* Screens with a lot of interface on top ask for the park to step back. */
  if (dim > 0){
    c.fillStyle = `rgba(9,7,20,${dim})`;
    c.fillRect(0, 0, W, H);
  }
}

/* The ground and trees on their own, so a game can stand in the same park
   under a different sky. */
export function drawHills(c, W, H, pal){
  const [far, mid, near] = pal.hills;
  for (const band of [{ y:0.70, h:0.10, col:far,  n:3 },
                      { y:0.79, h:0.13, col:mid,  n:4 },
                      { y:0.89, h:0.16, col:near, n:3 }]){
    c.fillStyle = band.col;
    c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * band.y);
    for (let i = 0; i <= band.n; i++){
      const x1 = W * ((i + 0.5) / band.n);
      c.quadraticCurveTo(x1, H * (band.y - band.h * 0.5), W * ((i + 1) / band.n), H * band.y);
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }

  for (const [fx, fy, fs] of [[0.07,0.76,1],[0.17,0.82,1.3],[0.30,0.78,0.85],
                              [0.70,0.80,1.1],[0.86,0.76,0.95],[0.95,0.83,1.25]]){
    const x = W * fx, y = H * fy, sc = (H / 900) * fs;
    c.fillStyle = pal.trunk; c.fillRect(x - 5 * sc, y, 10 * sc, 42 * sc);
    c.fillStyle = pal.leaf;
    c.beginPath(); c.arc(x, y - 10 * sc, 34 * sc, 0, 6.2832); c.fill();
    c.fillStyle = pal.leafLit;
    c.beginPath(); c.arc(x - 10 * sc, y - 22 * sc, 22 * sc, 0, 6.2832); c.fill();
  }
}
