/* The trailer's clips: [name, seconds, setup js, each-frame js (optional), caption (optional)] */
const Z = (kind, rel) => `const th = i.things.find(t => t.kind === '${kind}'); i.z = th.d - 0.03 - ${rel};`;
const corr = `LKP.start(3, false); const i = LKP.inst; i.scene = null; i.demo = true; i.jog = false;`;
export const CLIPS = [
  ['wake', 4.2, `LKP.start(3, true); const i = LKP.inst; i.demo = true; LKP.until(() => i.scene.stage === 'wake', 60);`],
  ['walk', 3.2, `LKP.start(3, true); const i = LKP.inst; i.scene = null; i._toSummit(); i.demo = true; LKP.run(4);`, '', 'A WORLD NOBODY HAS EVER SEEN'],
  ['climb', 2.6, `LKP.start(3, true); const i = LKP.inst; i.scene = null; i._toSummit(); i.demo = true; LKP.until(() => i.summit.phase === 'climb', 30, LKP.reach); LKP.run(0.8, LKP.reach);`, 'LKP.reach'],
  ['crest', 6.0, `LKP.start(3, true); const i = LKP.inst; i.scene = null; i._toSummit(); i.demo = true; LKP.until(() => i.summit.phase === 'crest', 60, LKP.reach);`, 'LKP.reach'],
  ['jellies', 3.0, `${corr} ${Z('vista', 0.02)} LKP.run(2.2);`],
  ['herd', 3.2, `${corr} ${Z('herd', 0.02)} LKP.run(16);`, '', 'EXPLORE IT TOGETHER'],
  ['burrow', 2.2, `${corr} ${Z('burrow', 0.6)} LKP.run(0.2);`],
  ['flutter', 2.4, `${corr} const th = i.things.find(t => t.kind === 'flutter'); i.z = th.d0 - 0.03 - 0.45 + 0.6; LKP.run(0.5);`],
  ['longneck', 3.4, `${corr} ${Z('longneck', 0.75)} LKP.run(0.3);`],
  ['pond', 2.8, `${corr} for (const r of i.crew) r.hp = r.max * 0.5; ${Z('pond', 0.4)} LKP.until(() => i.rest && i.rest.t > 3.5, 40);`, '', 'YOUR WHOLE BODY IS THE CONTROLLER'],
  ['stampede', 3.2, `${corr} i.step_ = 0; i._next(); ${Z('herd', 0.02)} LKP.until(() => i.trumblerAt() && i.trumblerAt().rel > 0.05, 40);`],
  ['sneak', 3.4, `LKP.start(3, false); const i = LKP.inst; i.demo = true; LKP.to('sneak'); LKP.run(11);`, '', 'SHHH...'],
  ['wing', 3.4, `LKP.start(3, false); const i = LKP.inst; i.demo = true; LKP.to('wing'); i.marchOf = () => 0.9; LKP.until(() => i.wing.phase === 'climb', 20); LKP.run(5);`],
  ['leap', 2.8, `${corr} i.step_ = 0; i._next(); i.jumps = { step: () => [] }; LKP.until(() => i.leap, 200); LKP.run(0.6); let once = true; i.jumps = { step: () => once ? (once = false, [0, 1, 2]) : [] };`],
  ['depot', 3.4, `LKP.start(3, false); const i = LKP.inst; i.demo = true; LKP.to('depot'); LKP.until(() => i.depot && i.depot.state === 'power', 40); LKP.run(2);`, 'LKP.crank'],
  ['robots', 4.0, `LKP.start(3, false); const i = LKP.inst; i.demo = true; LKP.to('depot'); LKP.until(() => i.depot && i.depot.state === 'stir', 60);`],
  ['ride', 3.6, `LKP.start(3, false); const i = LKP.inst; i.demo = true; LKP.to('ride'); LKP.until(() => i.ride && i.ride.phase === 'relax', 60, LKP.wave); LKP.run(4, LKP.wave);`, 'LKP.wave'],
  ['title', 7.0, `LKP.start(3, true); const i = LKP.inst; i.scene = null; i._toSummit(); i.demo = true; LKP.until(() => i.summit.phase === 'look', 80, LKP.reach); LKP.run(1.6);`, '', '', 'COMING SOON']
];
