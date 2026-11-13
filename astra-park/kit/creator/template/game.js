/* Star Catch - the starter game. Stars drift down; reach out and catch
   them with your hands. Gold ones are worth double. Up to four play at once,
   each with their own score.

   A game is one object handed to Orlis.run at the end of this file. Its
   create(n) starts a round and gives back the round: step it, draw it,
   say the score. Everything about how this works is in CLAUDE.md and the
   orlis-game skill. Change anything - this is yours. */

const ROUND = 90;              /* seconds in a round */

function makeRound(players){
  const stars = [];
  const score = Array(Orlis.MAX_PLAYERS).fill(0);
  let t = 0, spawn = 0;

  /* a new star, somewhere along the top */
  function addStar(W, H){
    const gold = Math.random() < 0.15;
    stars.push({ x: 0.08 + Math.random() * 0.84, y: -0.05, r: gold ? 0.045 : 0.035, vy: 0.08 + Math.random() * 0.06,
      spin: Math.random() * 6, gold, caught: -1, fade: 1 });
  }

  /* is a hand (0..1 across and down the screen) touching a star? */
  const touching = (hand, s, W, H) => Math.hypot((hand.x - s.x) * W, (hand.y - s.y) * H) < (s.r * 1.6) * H;

  return {
    step(dt, W, H){
      t += dt;
      /* more stars as the round goes on */
      spawn -= dt;
      if (spawn <= 0){ addStar(W, H); spawn = Math.max(0.45, 1.3 - t / 90); }
      for (const s of stars){
        if (s.caught >= 0){ s.fade -= dt * 3; continue; }
        s.y += s.vy * dt; s.spin += dt * 2;
        /* every player who's there, both hands */
        Orlis.pose.players.forEach((p, i) => {
          if (!p.present || s.caught >= 0) return;
          for (const hand of [p.hands.left, p.hands.right]){
            if (touching(hand, s, W, H)){
              s.caught = i; score[i] += s.gold ? 2 : 1;
              s.gold ? Orlis.sfx.gold() : Orlis.sfx.pop();
              break;
            }
          }
        });
      }
      /* (gone: caught and faded, or off the bottom) */
      for (let k = stars.length - 1; k >= 0; k--) if (stars[k].fade <= 0 || stars[k].y > 1.1) stars.splice(k, 1);
    },

    draw(c, W, H){
      /* a night sky */
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1e1b4b'); sky.addColorStop(1, '#4c1d95');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      /* the stars */
      for (const s of stars){
        c.save();
        c.globalAlpha = Math.max(0, s.fade);
        c.translate(s.x * W, s.y * H); c.rotate(s.spin);
        drawStar(c, s.r * H, s.gold ? '#fbbf24' : '#f0f9ff', s.caught >= 0 ? Orlis.PLAYER_COLORS[s.caught] : null);
        c.restore();
      }
      /* each player's hands, as glowing circles in their colour */
      Orlis.pose.players.forEach((p, i) => {
        if (!p.present) return;
        for (const hand of [p.hands.left, p.hands.right]){
          c.beginPath(); c.arc(hand.x * W, hand.y * H, H * 0.03, 0, Math.PI * 2);
          c.fillStyle = Orlis.PLAYER_COLORS[i]; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1;
        }
      });
    },

    /* the scores at the top, one for each player */
    hud(){ return { score }; },
    /* the best score, for the results */
    value(){ return Math.max(...score.slice(0, players)); },
    over: false
  };
}

/* a five-pointed star, centred on 0,0 */
function drawStar(c, r, fill, ring){
  c.beginPath();
  for (let k = 0; k < 10; k++){
    const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = fill; c.shadowColor = fill; c.shadowBlur = r * 0.8; c.fill(); c.shadowBlur = 0;
  if (ring){ c.lineWidth = r * 0.2; c.strokeStyle = ring; c.stroke(); }
}

Orlis.run({
  secs: ROUND,
  create(n){ return makeRound(n); }
});
