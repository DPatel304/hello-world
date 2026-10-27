import { clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { PATHS, PADS, PAD_R, CASTLE, CASTLE_BASE, CHEST, onCastle, along, drawMeadow, drawCastle, drawPad, drawTower, drawChoice, drawChest, heart,
         drawMonster, drawShot, coin, star, drawKnight, drawClapRing, drawMarker, drawHorn } from './castle-art.js';

/* Castle Defense. Silly monsters - bouncing slimes, quick little goblins,
   bats, and now and then a big ogre - come in at the top left and march the
   long way round the meadow, back and forth along one winding trail, to
   the wide castle in the bottom left. The children build towers beside the
   path to stop them, and each has a little knight of their own out on the
   meadow, in their colour with their face in the helmet.

   To send your knight somewhere, put your hands together and point them
   at the spot - hold them there a moment and a flag goes up, and off the
   knight walks. To fight, clap: your knight's shockwave knocks back and
   hurts the monsters round it, wherever your hands happen to be.

   Building is holding with both hands. Put a hand over an empty stone pad
   and three bubbles pop up - an archer tower, a cannon, a frost tower -
   with the coins each costs as dots underneath; hold both hands on one, a
   good couple of seconds, to build it. Both hands on a tower make it
   bigger and stronger, up to three times, and both hands on the castle
   mend it, a heart at a time. Any two hands will do - two children can
   build together, and more hands go faster. Let go and the work drains
   away. Monsters drop coins into the treasure chest by the castle.

   The waves keep coming, each a little harder, until the castle's hearts
   run out - so the round is as long as the castle holds. Nothing is
   counted in numbers: the castle flies a pennant for every wave held off.

   Ghostly hands show how to build first thing, then how to point and clap
   when the first monsters come. */

export const ROUND = 900;
export const HEARTS = 10;
export const START_COINS = 7;
export const COST = { archer: 3, cannon: 5, frost: 4 };
export const KINDS = ['archer', 'cannon', 'frost'];
export const OPEN = 0.5;                              /* one hand, to bring up the bubbles */
export const BUILD = 2, UPGRADE = 2.5, REPAIR = 2.5;  /* seconds of holding with both hands */
/* Knights. Hands together (closer than POINT_GAP, in screen heights) and
   held still for POINT_HOLD point the way; a clap is the hands snapping
   together from apart. */
export const POINT_GAP = 0.13, POINT_HOLD = 0.35;
export const CLAP_APART = 0.17, CLAP_SHUT = 0.08, CLAP_SPEED = 0.9, CLAP_COOL = 0.35;
export const CLAP_R = 0.13, CLAP_DMG = 1;               /* reach, in screen heights, and damage */
export const KNIGHT_SPEED = 0.16, KNIGHT_SIZE = 0.085;
/* The game goes in turns. A build phase between waves - no monsters; hands
   build, upgrade and mend - and then the wave, the attack phase, when hands
   only steer and clap for the knights. The build phase lasts BUILD_TIME
   (the first one FIRST_BUILD), or until both hands are held on the war
   horn for HORN_HOLD to call the wave in early. */
export const BUILD_TIME = 15, FIRST_BUILD = 20, HORN_HOLD = 1.5;
export const HORN = { x: 0.06, y: 0.34 };
const BREAK = BUILD_TIME;
export const STATS = {
  archer: { range: [0.24, 0.27, 0.3], rate: [1.1, 1.5, 2.0], dmg: [1, 1.4, 2] },
  cannon: { range: [0.21, 0.23, 0.26], rate: [0.45, 0.55, 0.65], dmg: [2.5, 3.5, 5], splash: [0.08, 0.095, 0.11], most: [3, 4, 5] },
  frost:  { range: [0.2, 0.22, 0.24], rate: [0.8, 1.0, 1.2], dmg: [0.4, 0.6, 0.8], slow: [0.55, 0.45, 0.35] }
};
export const MONSTERS = {
  slime:  { hp: 3, speed: 0.06, size: 0.08, coins: 1, harm: 1 },
  goblin: { hp: 2, speed: 0.095, size: 0.085, coins: 1, harm: 1 },
  bat:    { hp: 2, speed: 0.077, size: 0.08, coins: 1, harm: 1, flies: true },
  ogre:   { hp: 18, speed: 0.04, size: 0.13, coins: 5, harm: 3 }
};
const SLOW_FOR = 1.6, CHOICE_R = 0.045, CHOICE_D = 0.12, MENU_IDLE = 2.5;
const ASPECT = 16 / 9;

/* What comes in wave w: more each time - that's the whole challenge; the
   monsters themselves never get faster or tougher. It creeps up slowly at
   first (7, 9, 11, 13, 17...) and then snowballs, so a strong team holds
   about a quarter of an hour before the horde is too much. Goblins from the
   second wave, bats from the third, an ogre (or more) every fifth. All
   along the one trail. */
export const POUR = 8;   /* seconds a wave takes to come out, once it's big */
export const countOf = (w) => Math.min(1500, Math.round(5 + w + Math.pow(1.65, w - 1)));
/* Seconds between monsters coming out in wave w. */
export const gapOf = (w) => Math.min(1.3, POUR / countOf(w));
export function waveOf(w){
  const n = countOf(w), out = [];
  const path = () => 0;
  for (let k = 0; k < n; k++){
    const r = ((k * 7 + w * 3) % 12) / 12;
    out.push({ kind: w >= 3 && r < 0.25 ? 'bat' : w >= 2 && r < 0.55 ? 'goblin' : 'slime', path: path(k) });
  }
  if (w % 5 === 0) for (let k = 0; k < w / 5; k++) out.push({ kind: 'ogre', path: 0 });
  return out;
}
export const upgradeCost = (kind, lvl) => lvl === 1 ? Math.ceil(COST[kind] * 1.2) : COST[kind] * 2;

export default {
  /* Endless: it lasts as long as the castle holds. secs is only how long
     the music takes to build. */
  id: 'castle-defense', name: 'Castle Defense', stars: 2, accent: '#e5534b', secs: ROUND, endless: true,
  /* Hands reach up to the top of the map; a pause is a longer hold. */
  pauseHold: 3,
  create(n){ return new CastleDefense(n); }
};

class CastleDefense {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false; this.lost = false;
    this.coins = START_COINS;
    this.hearts = HEARTS;
    this.wave = 0;              /* waves started */
    this.held = 0;              /* waves held off */
    this.state = 'build';       /* 'build' between waves, 'wave' while one is on */
    this.breakT = FIRST_BUILD;  /* time left to build before the wave */
    this.queue = []; this.spawnT = 0;
    this.towers = new Map();    /* pad index -> tower */
    this.menus = new Map();     /* pad index -> open build bubbles */
    this.dwell = new Map();     /* hand -> what it's resting on, and for how long */
    this.work = new Map();      /* target -> building, upgrading or mending done so far */
    this.lonely = [];           /* single hands on something that needs two */
    this.mend = 0;
    this.repaired = false;
    this.monsters = [];
    this.shots = [];
    this.bits = [];
    this.castleHit = 0;
    this.clapped = false;       /* has anyone clapped yet: the clap hint stops */
    this.faces = new FaceCam();
    /* The knights wait by the castle, side by side, till sent somewhere. */
    this.knights = pose.players.map((_, i) => {
      const x = CASTLE.x + CASTLE.w / 2 + 0.04 + i * 0.035, y = CASTLE_BASE - 0.3 - i * 0.02;
      return { x, y, tx: x, ty: y, dir: 1, walk: 0, clap: 0, cool: 0, together: 0, apart: 0, gap: 1, rings: [] };
    });
    this.built = false;
    this.avatars = new Avatars();
    this.out = null;
    this.nextId = 1;
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.castleHit = Math.max(0, this.castleHit - dt * 2);
    this._waves(dt);
    this.faces.step(dt);
    this._hands(dt, W, H);
    this._knights(dt);
    this._march(dt);
    this._towers(dt, W, H);
    this._shots(dt, W, H);
    this._stepBits(dt);
    this.avatars.step(dt, this.players);
    for (const [i, m] of this.menus){ m.idle += dt; if (m.idle > MENU_IDLE || this.towers.has(i)) this.menus.delete(i); }
  }

  _waves(dt){
    if (this.state === 'build'){
      this.breakT -= dt;
      if (this.breakT <= 0) this._startWave();
      return;
    }
    /* Each wave comes out over about the same time, so a bigger wave pours
       out faster - several at once, late on. */
    this.spawnT -= dt;
    while (this.queue.length && this.spawnT <= 0){
      const next = this.queue.shift();
      this._spawn(next.kind, next.path);
      this.spawnT += gapOf(this.wave);
    }
    /* The wave is held off once every monster in it is gone - beaten, or
       got in: a pennant, a few coins, and time to build. */
    if (!this.queue.length && !this.monsters.length){
      this.held++;
      this.coins += 2 + Math.floor(this.wave / 3);
      this.state = 'build'; this.breakT = BREAK;
      sfx.fanfare();
    }
  }

  _startWave(){
    this.wave++; this.state = 'wave';
    this.queue = waveOf(this.wave); this.spawnT = 0;
    /* Building stops: any bubbles fold away and half-done work is dropped. */
    this.menus.clear(); this.work.clear(); this.dwell.clear(); this.lonely = [];
    sfx.trumpet(1);
  }

  _spawn(kind, path = 0){
    const M = MONSTERS[kind], hp = M.hp;
    /* Each walks a little to one side or the other of the middle of the
       trail, so a crowd looks like a crowd, not a queue. */
    this.monsters.push({ id: this.nextId++, wave: this.wave, kind, path, s: 0, side: (Math.random() - 0.5) * 0.05, hp, max: hp, speed: M.speed,
                         slowT: 0, slowK: 1, hurt: 0, wob: Math.random() * 6 });
  }

  _march(dt){
    for (const m of this.monsters){
      m.hurt = Math.max(0, m.hurt - dt * 4);
      if (m.slowT > 0){ m.slowT -= dt; if (m.slowT <= 0) m.slowK = 1; }
      m.s += m.speed * m.slowK * dt;
      if (m.s >= PATHS[m.path].total){
        m.gone = true;
        this.hearts = Math.max(0, this.hearts - MONSTERS[m.kind].harm);
        this.castleHit = 1;
        sfx.thud();
        if (this.hearts <= 0 && !this.lost){ this.lost = true; this.over = true; }
      }
    }
    this.monsters = this.monsters.filter(m => !m.gone);
  }

  pos(m){
    const p = along(m.s, m.path), k = m.side || 0;
    return { x: p.x + k / ASPECT * 0.7, y: p.y + k * 0.7, dir: p.dir };
  }

  /* ---------- the knights: pointing and clapping ---------- */

  _knights(dt){
    for (let i = 0; i < this.knights.length; i++){
      const k = this.knights[i], p = pose.players[i];
      k.cool = Math.max(0, k.cool - dt);
      k.clap = Math.max(0, k.clap - dt * 3);
      for (const r of k.rings) r.k += dt / 0.45;
      k.rings = k.rings.filter(r => r.k < 1);
      if (i < this.players && p && p.present && this.state === 'wave') this._hands2(i, k, p, dt);
      else k.aim = null;
      /* Walk toward the flag. */
      const dx = (k.tx - k.x) * ASPECT, dy = k.ty - k.y, d = Math.hypot(dx, dy), step = KNIGHT_SPEED * dt;
      if (d > 0.004){
        const u = Math.min(1, step / d);
        k.x += dx * u / ASPECT; k.y += dy * u;
        if (Math.abs(dx) > 0.002) k.dir = dx > 0 ? 1 : -1;
        k.walk = Math.min(1, k.walk + dt * 6);
      } else k.walk = Math.max(0, k.walk - dt * 6);
    }
  }

  /* One child's two hands: held together on a spot, they point the way;
     snapped together from apart, they clap. */
  _hands2(i, k, p, dt){
    if (pose.mouse.active){
      /* The mouse: resting still points; the knight claps by itself when
         monsters are near, so the game can be tried without a camera. */
      const h = p.hands.right;
      k.together = (h.speed || 0) < 0.15 ? k.together + dt : 0;
      if (k.together >= POINT_HOLD && this._onMap(h.x, h.y)){ k.tx = h.x; k.ty = h.y; }
      if (!k.cool && this.monsters.some(m => this._near(k, m))) this.clap(i);
      return;
    }
    const l = p.hands.left, r = p.hands.right;
    const gap = Math.hypot((l.x - r.x) * ASPECT, l.y - r.y), mx = (l.x + r.x) / 2, my = (l.y + r.y) / 2;
    const closing = (k.gap - gap) / Math.max(dt, 1e-3);
    k.apart = gap > CLAP_APART ? 0.4 : Math.max(0, k.apart - dt);
    if (gap < CLAP_SHUT && k.apart > 0 && closing > CLAP_SPEED && !k.cool){ this.clap(i); k.apart = 0; }
    k.gap = gap;
    k.together = gap < POINT_GAP ? k.together + dt : 0;
    if (k.together >= POINT_HOLD && this._onMap(mx, my)){ k.tx = mx; k.ty = my; }
    k.aim = gap < POINT_GAP ? { x: mx, y: my, k: Math.min(1, k.together / POINT_HOLD) } : null;
  }

  _onMap(x, y){ return x > 0.01 && x < 0.99 && y > 0.04 && y < 0.98; }
  _near(k, m){ const p = this.pos(m); return Math.hypot((p.x - k.x) * ASPECT, p.y - k.y) < CLAP_R + MONSTERS[m.kind].size * 0.3; }

  /* A clap: the knight's shockwave knocks back and hurts the monsters
     round it. */
  clap(i){
    const k = this.knights[i];
    k.cool = CLAP_COOL; k.clap = 1;
    k.rings.push({ k: 0 });
    this.clapped = true;
    let hit = 0;
    for (const m of [...this.monsters]){
      if (!this._near(k, m)) continue;
      m.s = Math.max(0, m.s - (m.kind === 'ogre' ? 0.015 : 0.04));
      m.hurt = 1; hit++;
      this._damage(m, CLAP_DMG);
    }
    sfx.pop(hit ? 0.9 : 0.3);
    if (hit) sfx.boing(1);
  }

  /* ---------- the children's hands: building ---------- */

  _handsOf(){
    const out = [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      const hs = pose.mouse.active ? [['r', p.hands.right]] : [['l', p.hands.left], ['r', p.hands.right]];
      for (const [side, h] of hs) out.push({ who: i, key: i + side, h });
    }
    return out;
  }

  /* The build bubbles round a pad: above it, or below if it's near the top. */
  choices(i){
    const pad = PADS[i], up = pad.y > 0.22 ? -1 : 1;
    return KINDS.map((kind, k) => {
      const a = (up < 0 ? -Math.PI / 2 : Math.PI / 2) + (k - 1) * 0.85 * -up;
      return { kind, x: pad.x + Math.cos(a) * CHOICE_D / ASPECT, y: pad.y + Math.sin(a) * CHOICE_D };
    });
  }

  /* What a hand is over: a build bubble, a pad, the castle, or nothing. */
  _target(h){
    const d = (x, y) => Math.hypot((h.x - x) * ASPECT, h.y - y);
    for (const [i] of this.menus){
      for (const ch of this.choices(i)) if (d(ch.x, ch.y) < CHOICE_R * 1.6) return { id: `c${i}${ch.kind}`, pad: i, kind: ch.kind, x: ch.x, y: ch.y };
    }
    for (const pad of PADS) if (d(pad.x, pad.y - 0.02) < PAD_R * 1.5) return { id: `p${pad.i}`, pad: pad.i, x: pad.x, y: pad.y - 0.06 };
    if (onCastle(h.x, h.y)) return { id: 'castle', castle: true, x: CASTLE.x, y: CASTLE_BASE - 0.2 };
    if (d(HORN.x, HORN.y) < 0.08) return { id: 'horn', horn: true, x: HORN.x, y: HORN.y };
    return null;
  }

  /* What holding on a target does, how long it takes, and whether it can
     happen now. */
  _job(tg){
    if (tg.kind) return { need: BUILD, can: this.coins >= COST[tg.kind], act: (who) => this._build(tg.pad, tg.kind, who) };
    if (tg.horn) return { need: HORN_HOLD, can: this.state === 'build', act: () => { this.breakT = 0; this.called = true; } };
    if (tg.castle) return { need: REPAIR, can: this.hearts < HEARTS, act: () => this._repair(), again: true };
    const tw = this.towers.get(tg.pad);
    if (tw) return { need: UPGRADE, can: tw.lvl < 3 && this.coins >= upgradeCost(tw.kind, tw.lvl), act: (who) => this._upgrade(tg.pad, who) };
    return null;
  }

  _hands(dt, W, H){
    /* Hands build only in the build phase; in a wave they're the knights'. */
    if (this.state !== 'build'){ this.lonely = []; return; }
    /* Who has a hand on what. */
    const on = new Map();
    for (const { who, key, h } of this._handsOf()){
      const tg = this._target(h);
      if (!tg){ this.dwell.delete(key); continue; }
      const e = on.get(tg.id) || { tg, hands: [] };
      e.hands.push({ who, key, h });
      on.set(tg.id, e);
      /* One hand resting on an empty pad brings up its bubbles. */
      let dw = this.dwell.get(key);
      if (!dw || dw.id !== tg.id){ dw = { id: tg.id, t: 0 }; this.dwell.set(key, dw); }
      dw.t += dt;
      if (tg.pad != null && !tg.kind && !this.towers.has(tg.pad) && dw.t >= OPEN && !this.menus.has(tg.pad)){ this.menus.set(tg.pad, { who, idle: 0 }); sfx.tick(); }
      const menu = tg.pad != null && this.menus.get(tg.pad);
      if (menu) menu.idle = 0;
    }
    for (const k of [...this.dwell.keys()]) if (![...on.values()].some(e => e.hands.some(x => x.key === k))) this.dwell.delete(k);

    /* The work: two hands (or more) on a target fill it up; fewer let it
       drain away. */
    this.lonely = [];
    for (const [id, e] of on){
      const job = this._job(e.tg);
      if (!job) continue;
      const w = this.work.get(id) || { t: 0 };
      w.need = job.need; w.can = job.can; w.tg = e.tg; w.seen = true;
      const n = pose.mouse.active ? 2 : e.hands.length;
      if (n >= 2 && job.can){
        w.t += dt * (1 + 0.25 * (n - 2));
        if (w.t >= job.need){ job.act(e.hands[0].who); w.t = job.again ? 0 : -0.8; }
      } else {
        w.t = Math.max(0, w.t - dt);
        if (n < 2 && job.can) this.lonely.push(e.hands[0].h);
      }
      this.work.set(id, w);
    }
    for (const [id, w] of this.work){
      if (!w.seen){ w.t = Math.max(0, w.t - dt); if (w.t <= 0) this.work.delete(id); }
      w.seen = false;
    }
    this.mend = Math.max(0, (this.mend || 0) - dt * 2);
    const rep = this.work.get('castle');
    if (rep && rep.t > 0) this.mend = 1;
  }

  _repair(){
    this.hearts = Math.min(HEARTS, this.hearts + 1);
    this.repaired = true;
    sfx.jar(this.hearts);
    for (let k = 0; k < 16; k++) this._spark(CASTLE.x + (Math.random() - 0.5) * CASTLE.w * 0.8, CASTLE_BASE - 0.1 - Math.random() * 0.15, '#ffe27a');
  }

  _build(i, kind, who){
    this.coins -= COST[kind];
    this.towers.set(i, { kind, lvl: 1, cool: 0.3, aim: -Math.PI / 2, who, kick: 0 });
    this.menus.delete(i);
    for (const [k, d] of this.dwell) if (d.id.startsWith(`c${i}`) || d.id === `p${i}`) this.dwell.delete(k);
    for (const id of [...this.work.keys()]) if (id.startsWith(`c${i}`)) this.work.delete(id);
    this.built = true;
    sfx.land();
    const pad = PADS[i];
    for (let k = 0; k < 14; k++) this._spark(pad.x, pad.y - 0.04, '#ffd24a');
  }

  _upgrade(i, who){
    const tw = this.towers.get(i);
    this.coins -= upgradeCost(tw.kind, tw.lvl);
    tw.lvl++;
    sfx.gold();
    const pad = PADS[i];
    for (let k = 0; k < 20; k++) this._spark(pad.x, pad.y - 0.08, PLAYER_COLORS[who]);
  }

  /* ---------- towers ---------- */

  _towers(dt, W, H){
    for (const [i, tw] of this.towers){
      tw.cool -= dt; tw.kick = Math.max(0, tw.kick - dt * 4);
      const pad = PADS[i], S = STATS[tw.kind], L = tw.lvl - 1, range = S.range[L];
      const top = { x: pad.x, y: pad.y - 0.12 };
      let best = null;
      for (const m of this.monsters){
        if (tw.kind === 'cannon' && MONSTERS[m.kind].flies) continue;
        const p = this.pos(m);
        if (Math.hypot((p.x - pad.x) * ASPECT, p.y - pad.y) > range) continue;
        /* The one nearest the castle, whichever path it's on. */
        if (!best || PATHS[m.path].total - m.s < PATHS[best.path].total - best.s) best = m;
      }
      if (!best) continue;
      const bp = this.pos(best);
      tw.aim = Math.atan2(bp.y - top.y, (bp.x - top.x) * ASPECT);
      if (tw.cool > 0) continue;
      tw.cool = 1 / S.rate[L]; tw.kick = 1;
      if (tw.kind === 'archer'){ this.shots.push({ kind: 'arrow', x: top.x, y: top.y, vx: 0, vy: 0, target: best.id, dmg: S.dmg[L] }); sfx.whoosh(); }
      else if (tw.kind === 'cannon'){
        /* Lobbed where the monster will be when it lands. */
        const lead = this.pos({ s: best.s + best.speed * best.slowK * 0.55, path: best.path });
        this.shots.push({ kind: 'ball', x: top.x, y: top.y, from: { ...top }, to: lead, k: 0, dmg: S.dmg[L], splash: S.splash[L], most: S.most[L] });
        sfx.thud();
      } else { this.shots.push({ kind: 'frost', x: top.x, y: top.y - 0.03, vx: 0, vy: 0, target: best.id, dmg: S.dmg[L], slow: S.slow[L] }); sfx.twinkle(); }
    }
  }

  _shots(dt, W, H){
    for (const s of this.shots){
      if (s.kind === 'ball'){
        s.k += dt / 0.55;
        s.x = s.from.x + (s.to.x - s.from.x) * Math.min(1, s.k); s.y = s.from.y + (s.to.y - s.from.y) * Math.min(1, s.k);
        if (s.k >= 1){
          s.done = true;
          sfx.pop(0.8);
          for (let k = 0; k < 10; k++) this._spark(s.x, s.y, '#ffb02e');
          /* The blast catches the nearest few, not a whole crowd. */
          const caught = this.monsters.filter(m => !MONSTERS[m.kind].flies)
            .map(m => { const p = this.pos(m); return { m, d: Math.hypot((p.x - s.x) * ASPECT, p.y - s.y) }; })
            .filter(q => q.d < s.splash).sort((a, b) => a.d - b.d).slice(0, s.most);
          for (const q of caught) this._damage(q.m, s.dmg);
        }
        continue;
      }
      const m = this.monsters.find(q => q.id === s.target);
      if (!m){ s.done = true; continue; }
      const p = this.pos(m), M = MONSTERS[m.kind], ty = p.y - M.size * (M.flies ? 0.75 : 0.4);
      const dx = (p.x - s.x) * ASPECT, dy = ty - s.y, d = Math.hypot(dx, dy), v = s.kind === 'arrow' ? 1.4 : 1.0;
      s.vx = dx / d * v / ASPECT; s.vy = dy / d * v;
      if (d < v * dt + 0.01){
        s.done = true;
        this._damage(m, s.dmg);
        if (s.kind === 'frost'){ m.slowK = Math.min(m.slowK, s.slow); m.slowT = SLOW_FOR; for (let k = 0; k < 5; k++) this._spark(p.x, ty, '#bfefff'); }
      } else { s.x += s.vx * dt; s.y += s.vy * dt; }
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  _damage(m, dmg){
    if (m.dead) return;
    m.hp -= dmg; m.hurt = 1;
    if (m.hp > 0) return;
    m.dead = true; m.gone = true;
    const M = MONSTERS[m.kind];
    this.coins += M.coins;
    const p = this.pos(m);
    sfx.pop(M.coins > 1 ? 1 : 0.4);
    /* Its coins fly to the chest; a puff where it was. */
    for (let k = 0; k < M.coins; k++) this.bits.push({ kind: 'coin', x: p.x, y: p.y - 0.04, from: { x: p.x, y: p.y - 0.04 }, age: -k * 0.08, life: 0.7 });
    for (let k = 0; k < 8; k++) this._spark(p.x, p.y - 0.03, '#ffffff');
    this.monsters = this.monsters.filter(q => q !== m);
  }

  /* ---------- little things ---------- */

  _spark(x, y, col){
    const a = Math.random() * 6.28, sp = 0.08 + Math.random() * 0.12;
    this.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp / ASPECT, vy: Math.sin(a) * sp - 0.05, age: 0, life: 0.6, col });
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }
  _stepBits(dt){
    const chest = { x: CHEST.x, y: CHEST.y - 0.02 };
    for (const b of this.bits){
      b.age += dt;
      if (b.kind === 'spark'){ b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.15 * dt; }
      else if (b.kind === 'coin' && b.age > 0){
        const k = Math.min(1, b.age / b.life), e = k * k;
        b.x = b.from.x + (chest.x - b.from.x) * e; b.y = b.from.y + (chest.y - b.from.y) * e - Math.sin(k * Math.PI) * 0.12;
      }
    }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- showing how ---------- */

  /* Building: until the first tower, a ghostly hand holds over a pad, the
     bubbles pop up, and it holds on the archer. */
  get buildHint(){ return !this.built && this.t > 1 ? (this.t - 1) % 6.5 : -1; }
  /* Pointing and clapping: once monsters are about, until someone claps. */
  get clapHint(){
    if (this.clapped || this.out || !this.monsters.length || this.buildHint >= 0) return null;
    return this.monsters.slice().sort((a, b) => b.s - a.s)[0];
  }

  /* ---------- the ending ---------- */

  outro(dt, W, H){
    if (!this.out){
      this.out = { t: 0 };
      if (this.lost) sfx.lose(); else sfx.fanfare();
      this.shots = []; this.menus.clear();
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    /* The monsters dance about at the gate; or, if the castle held, they
       scurry home. */
    for (const m of this.monsters){ m.hurt = 0; if (!this.lost) m.s = Math.max(0, m.s - dt * 0.3); }
    if (!this.lost && Math.random() < dt * 25) this._spark(Math.random(), Math.random() * 0.6, `hsl(${(Math.random() * 360) | 0},90%,65%)`);
    this._stepBits(dt);
    return o.t > 4.5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    drawMeadow(c, W, H);
    /* How far along each bit of work is; pads glow while a hand is on them
       or their bubbles are up. */
    const holding = new Map();
    for (const [id, w] of this.work) holding.set(id, clamp(w.t / w.need, 0, 1));
    for (const d of this.dwell.values()) if (!holding.has(d.id)) holding.set(d.id, 0);
    const things = [];
    for (const pad of PADS){
      const tw = this.towers.get(pad.i);
      /* Pads glow only in the build phase: that's when they can be used. */
      const building = this.state === 'build' && !this.out;
      drawPad(c, W, H, pad, tw || !building ? 0 : this.menus.has(pad.i) ? 1 : holding.has(`p${pad.i}`) ? 0.7 : this.coins >= COST.archer ? 0.25 + 0.15 * Math.sin(this.t * 3 + pad.i) : 0);
      if (tw) things.push({ y: pad.y, draw: () => drawTower(c, W, H, pad, tw.kind, tw.lvl, tw.aim, PLAYER_COLORS[tw.who] || '#ffffff', this.t, tw.kick) });
    }
    for (const m of this.monsters){
      const p = this.pos(m), M = MONSTERS[m.kind], dance = this.out && this.lost ? Math.abs(Math.sin(this.t * 6 + m.wob)) * 0.03 : 0;
      things.push({ y: p.y, draw: () => drawMonster(c, p.x * W, (p.y - dance) * H, M.size * H, m.kind, this.t + m.wob, p.dir, m.hurt, m.slowT > 0, m.hp / m.max) });
    }
    /* The knights, among everything else; their flags on the ground. */
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!pose.players[i].present) continue;
      if (!this.out && Math.hypot((k.tx - k.x) * ASPECT, k.ty - k.y) > 0.02) drawMarker(c, k.tx * W, k.ty * H, KNIGHT_SIZE * H, PLAYER_COLORS[i], this.t);
      things.push({ y: k.y, draw: () => {
        for (const r of k.rings) drawClapRing(c, k.x * W, k.y * H, CLAP_R * H, r.k, PLAYER_COLORS[i]);
        drawKnight(c, k.x * W, k.y * H, KNIGHT_SIZE * H, this.t + i, PLAYER_COLORS[i], k.dir, k.walk, k.clap, (x, y, r) => {
          if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
          else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
        });
      } });
    }
    things.push({ y: CASTLE.y + 0.12, draw: () => drawCastle(c, W, H, this.t, this.hearts, HEARTS, this.held, this.castleHit, this.mend) });
    things.sort((a, b) => a.y - b.y);
    for (const th of things) th.draw();
    drawChest(c, W, H, this.coins, this.t);
    /* The war horn, through the build phase: its ring is the time left. */
    if (this.state === 'build' && !this.out) drawHorn(c, HORN.x * W, HORN.y * H, H * 0.095, this.t, clamp(this.breakT / (this.wave ? BUILD_TIME : FIRST_BUILD), 0, 1), holding.get('horn') || 0);
    for (const s of this.shots) drawShot(c, W, H, s);
    if (!this.out){
      this._drawRings(c, W, H, holding);
      this._drawMenus(c, W, H, holding);
      this._drawHints(c, W, H);
      /* Hands together: a ring fills where they're pointing, and the flag
         goes up when it's full. */
      for (let i = 0; i < this.players; i++){
        const a = this.knights[i].aim;
        if (!a || a.k >= 1) continue;
        c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = H * 0.007;
        c.beginPath(); c.arc(a.x * W, a.y * H, H * 0.035, -Math.PI / 2, -Math.PI / 2 + a.k * 6.2832); c.stroke();
      }
    }
    this._drawBits(c, W, H);
    this.avatars.drawBodies(c, W, H, this.players, [], 0.16);
    if (!this.out) this.avatars.drawMitts(c, W, H, this.players);
  }

  /* Rings filling round a tower being upgraded and over the castle being
     mended; and beside a lone hand on either, a ghostly second hand
     beckoning, because it takes two. */
  _drawRings(c, W, H, holding){
    const mend = holding.get('castle');
    if (mend != null && this.hearts < HEARTS){
      const x = CASTLE.x * W, y = (CASTLE_BASE - 0.2) * H, r = H * 0.07;
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = H * 0.01; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.strokeStyle = '#ff4f6a'; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + mend * 6.2832); c.stroke();
      heart(c, x, y, r * 0.45, '#ff4f6a');
    }
    for (const h of this.lonely){
      const a = 0.45 + 0.35 * Math.sin(this.t * 6), x = (h.x + 0.05 / ASPECT * 1.6) * W, y = h.y * H, r = H * 0.028;
      c.save(); c.globalAlpha = a;
      c.strokeStyle = '#fff6e2'; c.lineWidth = H * 0.006; c.setLineDash([H * 0.01, H * 0.008]);
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.restore();
    }
    for (const [i, tw] of this.towers){
      const k = holding.get(`p${i}`);
      if (k == null) continue;
      const pad = PADS[i], x = pad.x * W, y = (pad.y - 0.06) * H, r = H * 0.075;
      const can = tw.lvl < 3 && this.coins >= upgradeCost(tw.kind, tw.lvl);
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = H * 0.008; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      if (can){ c.strokeStyle = '#ffd24a'; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * 6.2832); c.stroke(); }
      /* The upgrade's price, as coins, under the ring. */
      if (tw.lvl < 3){
        const n = upgradeCost(tw.kind, tw.lvl);
        c.globalAlpha = can ? 1 : 0.45;
        for (let q = 0; q < n; q++) coin(c, x + (q - (n - 1) / 2) * H * 0.022, y + r + H * 0.02, H * 0.009);
        c.globalAlpha = 1;
      } else star(c, x, y + r + H * 0.02, H * 0.015, '#ffd24a');
    }
  }

  _drawMenus(c, W, H, holding){
    for (const [i, m] of this.menus){
      const pad = PADS[i];
      for (const ch of this.choices(i)){
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = H * 0.003;
        c.beginPath(); c.moveTo(pad.x * W, (pad.y - 0.02) * H); c.lineTo(ch.x * W, ch.y * H); c.stroke();
      }
      for (const ch of this.choices(i)){
        const fill = holding.get(`c${i}${ch.kind}`) || 0;
        drawChoice(c, ch.x * W, ch.y * H, CHOICE_R * H, ch.kind, COST[ch.kind], this.coins >= COST[ch.kind], fill, PLAYER_COLORS[m.who] || '#ffffff');
      }
    }
  }

  _drawHints(c, W, H){
    const ghost = (x, y, a, fill) => {
      const r = H * 0.03;
      c.save(); c.globalAlpha = a;
      const g = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      g.addColorStop(0, 'rgba(255,246,226,.6)'); g.addColorStop(1, 'rgba(255,246,226,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      if (fill > 0){ c.strokeStyle = 'rgba(255,210,74,.95)'; c.lineWidth = H * 0.007; c.beginPath(); c.arc(x, y, r * 1.5, -Math.PI / 2, -Math.PI / 2 + fill * 6.2832); c.stroke(); }
      c.restore();
    };
    /* Building: one hand goes to a pad and the bubbles pop up; then both
       hands come together on the archer and hold while it fills. */
    const u = this.buildHint;
    if (u >= 0){
      const pad = PADS[6], ch = this.choices(6)[0];
      const ease = (a, b) => { const k = clamp((u - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
      const show = Math.min(ease(0, 0.3), 1 - ease(5.4, 6));
      const toPad = ease(0.2, 0.9), toCh = ease(1.5, 2.1), second = ease(1.8, 2.5);
      const x = 0.6 + (pad.x - 0.6) * toPad + (ch.x - pad.x) * toCh, y = 0.7 + (pad.y - 0.02 - 0.7) * toPad + (ch.y - pad.y + 0.02) * toCh;
      const fill = clamp((u - 2.6) / 2.4, 0, 1);
      if (u > 1.2 && u < 5.4){
        /* The bubbles, ghostly. */
        c.save(); c.globalAlpha = 0.6 * show;
        this.choices(6).forEach(q => drawChoice(c, q.x * W, q.y * H, CHOICE_R * H, q.kind, COST[q.kind], true, q === ch ? fill : 0, '#fff6e2'));
        c.restore();
      }
      const off = 0.035 / ASPECT;
      ghost((x - off * second) * W, y * H, show * 0.85, 0);
      if (second > 0) ghost((x + off * second + (1 - second) * 0.15) * W, (y + (1 - second) * 0.1) * H, show * 0.85 * second, 0);
    }
    /* The horn: once there's a tower up, two hands on it call the wave. */
    if (this.built && this.wave === 0 && this.state === 'build' && !this.called && this.breakT < FIRST_BUILD - 4){
      const k = (this.t % 2.5) / 2.5, show = Math.min(1, k * 5, (1 - k) * 5);
      ghost((HORN.x - 0.02) * W, HORN.y * H, show * 0.8, 0); ghost((HORN.x + 0.02) * W, HORN.y * H, show * 0.8, 0);
    }
    /* Mending: once the castle has lost a few hearts, two hands on it. */
    if (this.hearts <= HEARTS - 3 && !this.repaired && !this.out){
      const k = (this.t % 3) / 3, show = Math.min(1, k * 5, (1 - k) * 5), x = CASTLE.x, y = CASTLE_BASE - 0.2;
      ghost((x - 0.03) * W, y * H, show * 0.8, 0); ghost((x + 0.03) * W, y * H, show * 0.8, 0);
    }
    /* Point and clap: two ghostly hands come together on the monster and
       hold (a flag goes up there), then clap, clap, clap. */
    const m = this.clapHint;
    if (m){
      const p = this.pos(m), u = this.t % 4, x = p.x, y = p.y - 0.05;
      if (u < 1.6){
        const c2 = Math.min(1, u / 0.6), off = 0.06 * (1 - c2) + 0.012;
        ghost((x - off / ASPECT * 1.6) * W, y * H, 0.85, 0); ghost((x + off / ASPECT * 1.6) * W, y * H, 0.85, u > 0.6 ? Math.min(1, (u - 0.6) / 0.6) : 0);
        if (u > 1.2){ c.save(); c.globalAlpha = 0.6; drawMarker(c, p.x * W, p.y * H, KNIGHT_SIZE * H, '#fff6e2', this.t); c.restore(); }
      } else {
        const cl = Math.abs(Math.sin((u - 1.6) * Math.PI * 1.5)), off = 0.012 + cl * 0.05;
        ghost((x - off / ASPECT * 1.6) * W, y * H, 0.85, 0); ghost((x + off / ASPECT * 1.6) * W, y * H, 0.85, 0);
        if (cl < 0.15){ c.save(); c.globalAlpha = 0.5; drawClapRing(c, p.x * W, p.y * H, CLAP_R * H, 0.3, '#fff6e2'); c.restore(); }
      }
    }
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      if (b.age < 0) continue;
      const k = b.age / b.life;
      if (b.kind === 'spark'){ c.globalAlpha = 1 - k; c.fillStyle = b.col; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
      else coin(c, b.x * W, b.y * H, H * 0.013);
    }
  }

  /* No numbers: the castle's hearts and pennants say how it's going. */
  hud(){ return { score: pose.players.map(() => this.held), showLives: false, hideScore: true, hideClock: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) if (pose.players[i].present) rows.push({ label: `Player ${i + 1}`, value: this.held, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return pose.players.slice(0, this.players).filter(p => p.present).length < 2 ? null : -1; }
  value(){ return this.held; }
}
