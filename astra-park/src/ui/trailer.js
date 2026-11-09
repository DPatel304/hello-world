/* The home screen banner's trailer: the real game, playing itself. A copy of
   the game runs in the banner with pretend players - hands reaching for the
   balloons, astronauts leaning for crystals and jumping the gorge - so what
   you see is exactly what you'll get. It's silent (quietly), and the real
   players in front of the TV don't reach into it: while it steps and draws,
   the game sees only the pretend ones. Every little while it starts over.

   trailer(game) gives { step(dt, W, H), draw(c, W, H) }, or null for a game
   without one (the banner shows its poster instead). */
import { pose, MAX_PLAYERS, PLAYER_COLORS } from '../tracking/pose.js';
import { quietly } from '../audio/sound.js';
import { RUN } from '../games/lkp-art.js';
import { story } from '../games/lkp-game.js';

const fakePlayers = () => Array.from({ length: MAX_PLAYERS }, (_, i) => ({
  id: i, color: PLAYER_COLORS[i], present: false, lostFor: 99, watching: 0, at: null, lm: null, raw: null,
  hands: { left: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }, right: { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 } },
  centre: { x: 0.5, y: 0.6 }, scale: 0.3
}));

/* Run fn with only the pretend players there, and no sound. */
function sandbox(fake, fn){
  const players = pose.players, mouse = pose.mouse;
  pose.players = fake.players; pose.mouse = fake.mouse;
  try { return quietly(fn); }
  finally { pose.players = players; pose.mouse = mouse; }
}

export function trailer(game){
  if (game.id === 'pop-party') return popTrailer(game);
  if (game.id === 'last-known-position') return lkpTrailer(game);
  return null;
}

/* A few seconds run ahead before it's shown, so it opens mid-action. */
function warm(tr, secs){ for (let k = 0; k < secs * 30; k++) tr.step(1 / 30, 1440, 810); }

/* ---------- Pop Party: two hands popping their way across the sky ---------- */
const POP_FROM = 95, POP_LOOP = 50;      /* starts with a busy sky; this long before starting over */
function popTrailer(game){
  const fake = { players: fakePlayers(), mouse: { active: true, x: 0.5, y: 0.5 } };
  const hands = [0, 1].map(i => ({ x: 0.62 + i * 0.18, y: 0.55, tx: 0.6, ty: 0.5, slap: 0, aim: null }));
  let inst = null;
  const fresh = () => sandbox(fake, () => {
    inst = game.create(2);
    inst.t = POP_FROM;
    inst.events = [{ kind: 'giant', at: POP_FROM + 13, done: false }, { kind: 'parade', at: POP_FROM + 30, done: false }, { kind: 'dog', at: POP_FROM + 42, done: false }];
    fake.players[0].present = fake.players[1].present = true;
  });
  const self = {
    anchor: 0.5,
    step(dt, W, H){
      if (inst.t > POP_FROM + POP_LOOP){ fresh(); warm(self, 8); }
      sandbox(fake, () => {
        const giant = inst.balloons.find(b => b.giant && !b.dead && b.y + b.r < 0.98);
        hands.forEach((hd, i) => {
          if (giant){
            /* slap it: in and out */
            hd.slap += dt;
            const inside = Math.floor(hd.slap / 0.32 + i * 0.5) % 2 === 0;
            hd.tx = giant.x + (i ? 0.08 : -0.08); hd.ty = giant.y + (inside ? 0 : giant.r * 1.1);
          } else {
            /* the nearest balloon on the right of the banner, not the other hand's */
            const other = hands[1 - i].aim;
            let best = null, bd = 1e9;
            for (const b of inst.balloons){
              if (b.dead || b.giant || b === other || b.y < 0.25 || b.y > 0.62 || b.x < 0.42) continue;
              const d = Math.hypot((b.x - hd.x) * (W / H), b.y - hd.y);
              if (d < bd){ bd = d; best = b; }
            }
            hd.aim = best;
            if (best){ hd.tx = best.x; hd.ty = best.y; }
            else if (inst.animal){ hd.tx = 0.7; hd.ty = 0.75; }
          }
          const dx = (hd.tx - hd.x) * (W / H), dy = hd.ty - hd.y, d = Math.hypot(dx, dy), v = Math.min(d, dt * 0.9);
          if (d > 1e-4){ hd.x += dx / d * v / (W / H); hd.y += dy / d * v; }
          const p = fake.players[i].hands.right;
          p.vx = (hd.x - p.x) / Math.max(dt, 1e-3); p.vy = (hd.y - p.y) / Math.max(dt, 1e-3); p.x = hd.x; p.y = hd.y; p.speed = Math.hypot(p.vx, p.vy);
          fake.players[i].hands.left = { ...p };
        });
        inst.step(dt, W, H);
      });
    },
    draw(c, W, H){
      sandbox(fake, () => inst.draw(c, W, H));
      /* the pretend players' hands, as the console shows yours */
      hands.forEach((hd, i) => {
        const x = hd.x * W, y = hd.y * H, r = Math.max(10, H * 0.04);
        c.save(); c.lineWidth = Math.max(3, H * 0.008);
        c.fillStyle = PLAYER_COLORS[i]; c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, r * 0.5, 0, 6.2832); c.fill();
        c.globalAlpha = 1; c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
        c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = Math.max(2, H * 0.005); c.stroke();
        c.restore();
      });
    }
  };
  fresh(); warm(self, 8);
  return self;
}

/* ---------- Last Known Position: three astronauts on the run ---------- */
function lkpTrailer(game){
  const fake = { players: fakePlayers(), mouse: { active: true, x: 0.5, y: 0.5 } };
  const N = 3;
  let inst = null, bots = null;
  const fresh = () => sandbox(fake, () => {
    const was = story.on; story.on = false;
    try { inst = game.create(N); } finally { story.on = was; }
    inst.demo = true; inst.scene = null;
    inst.captain.say = () => false;
    for (let i = 0; i < N; i++) fake.players[i].present = true;
    bots = Array.from({ length: N }, () => ({ tx: 0, duck: false, hop: false, sees: new Map() }));
    inst.leanOf = (i) => Math.max(-1, Math.min(1, (bots[i].tx - inst._home(i)) / inst.reach));
    inst.duckOf = (i) => bots[i].duck;
    inst.jumps = { step: () => bots.map((b, i) => b.hop ? i : -1).filter(i => i >= 0) };
    /* straight to the run with the gorge in it */
    const idx = inst.level.plan.map((k, i) => k === 'corridor' ? i : -1).filter(i => i >= 0)[1];
    inst.step_ = idx - 1; inst.things = []; inst._next();
  });
  const self = {
    anchor: 0.62,
    step(dt, W, H){
      if (inst.over || inst.seg.kind !== 'corridor'){ fresh(); warm(self, 2); }
      sandbox(fake, () => {
        if (inst.levelup) inst.levelup.t = 1e9;
        for (let i = 0; i < N; i++){
          const b = bots[i], rn = inst.crew[i];
          b.duck = false; b.hop = false;
          if (inst.leap && inst.leap.phase === 'ready' && Math.random() < dt * 1.5) b.hop = true;
          let tx = inst._home(i);
          const soon = inst.things.filter(th => th.d - inst.z > RUN - 0.02 && th.d - inst.z < RUN + 0.45).sort((a, c) => a.d - c.d);
          for (const th of soon){
            const dist = th.d - inst.z - RUN;
            if (th.kind === 'blocker'){ const L = th.a - 0.2, R = th.b + 0.2; tx = (Math.abs(rn.x - L) < Math.abs(rn.x - R) && L > -1.05) || R > 1.05 ? L : R; break; }
            if (th.kind === 'roller'){ const L = th.end - 0.42, R = th.end + 0.42; tx = (Math.abs(rn.x - L) < Math.abs(rn.x - R) && L > -1.05) || R > 1.05 ? L : R; break; }
            if (th.kind === 'beam' && dist < 0.15) b.duck = true;
            if (th.kind === 'crystal' && !th.got){ tx = th.lane; break; }
          }
          b.tx = tx;
        }
        inst.step(dt, W, H);
      });
    },
    draw(c, W, H){ sandbox(fake, () => inst.draw(c, W, H)); }
  };
  fresh(); warm(self, 2);
  return self;
}
