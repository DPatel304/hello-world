/* Shared bits every game leans on: score storage, timers, and the little
   flourishes that make a hit feel like a hit. */

const KEY = (id, n) => `famjam_best_${id}_${n}p`;

export const scores = {
  best(id, n){ try { return +(localStorage.getItem(KEY(id, n)) || 0); } catch (e){ return 0; } },
  record(id, n, value){
    const prev = this.best(id, n);
    if (value > prev){ try { localStorage.setItem(KEY(id, n), String(value)); } catch (e){} return true; }
    return false;
  },
  reset(){
    try {
      Object.keys(localStorage).filter(k => k.startsWith('famjam_best_'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e){}
  }
};

/* Particles, score pops and screen shake. Juice is the difference between a
   tech demo and something a four-year-old shrieks at, so it lives in the
   shared layer rather than being reinvented per game. */
export class Juice {
  constructor(){ this.bits = []; this.pops = []; this.shake = 0; }
  burst(x, y, color, n = 14, power = 1){
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, s = (60 + Math.random() * 260) * power;
      this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
                       life: 0.5 + Math.random() * 0.5, age: 0, color,
                       r: 3 + Math.random() * 6 });
    }
  }
  pop(x, y, text, color){ this.pops.push({ x, y, text, color, age: 0, life: 0.9 }); }
  kick(amount = 8){ this.shake = Math.max(this.shake, amount); }
  step(dt){
    this.shake *= Math.pow(0.0015, dt);
    for (const b of this.bits){ b.age += dt; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
    for (const p of this.pops){ p.age += dt; p.y -= 70 * dt; }
    this.pops = this.pops.filter(p => p.age < p.life);
  }
  draw(c, H){
    for (const b of this.bits){
      c.globalAlpha = Math.max(0, 1 - b.age / b.life);
      c.fillStyle = b.color;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pops){
      const k = p.age / p.life;
      c.globalAlpha = Math.max(0, 1 - k);
      c.font = `900 ${Math.round(H * 0.045 * (1 + k * 0.4))}px ui-rounded, system-ui, sans-serif`;
      c.lineWidth = Math.max(3, H * 0.006); c.strokeStyle = 'rgba(0,0,0,.6)';
      c.strokeText(p.text, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
    }
    c.globalAlpha = 1; c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  }
  applyShake(c){
    if (this.shake < 0.2) return false;
    c.save();
    c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    return true;
  }
}

export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
export const lerp  = (a, b, t) => a + (b - a) * t;
