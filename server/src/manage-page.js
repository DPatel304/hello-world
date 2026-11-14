import { TRY_SECS } from './submissions.js';
/* The management page: the server's own, opened from the Orlis cube by the
   clock (Manage Orlis Server), in the browser on this laptop only. It's
   where the owner looks after the server - every family and who's a
   creator, the Store's games, backups - so Orlis Play itself stays the
   family app, the same for everyone.

   One page, nothing loaded from anywhere: its look and its code are below.
   It asks the server's usual routes, with the key the cube opened it with
   (in the address, which never leaves the laptop - and is taken out of
   sight as the page opens). */
export function managePage(){
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orlis Server</title>
<style>
:root{ --ink:#16161d; --dim:#5b5f6e; --faint:#8a8ea0; --paper:#f3f4f7; --card:#fff; --line:#eef0f4; --violet:#6d5efc; --bad:#be123c; }
*{ box-sizing:border-box }
body{ margin:0; background:var(--paper); color:var(--ink); font:16px/1.45 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif; }
header{ display:flex; align-items:center; gap:16px; padding:20px 32px; }
header h1{ font-size:22px; margin:0; font-weight:650; }
header h1 i{ font-style:normal; font-weight:400; background:linear-gradient(90deg,#2bb6c9,#5b8cf5,#a66bf5); -webkit-background-clip:text; background-clip:text; color:transparent; }
nav{ display:flex; gap:4px; margin-left:auto; padding:4px; border-radius:999px; background:#fff; box-shadow:0 2px 10px rgba(20,24,50,.08); }
nav button{ border:0; background:transparent; font:inherit; font-weight:600; color:#3b3e4d; padding:8px 18px; border-radius:999px; cursor:pointer; }
nav button.on{ background:var(--ink); color:#fff; }
main{ max-width:880px; margin:8px auto 60px; padding:0 24px; }
.card{ background:var(--card); border-radius:18px; padding:22px 24px; box-shadow:0 6px 22px rgba(20,24,50,.07); margin-bottom:18px; }
.card h2{ margin:0 0 6px; font-size:19px; }
.row{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-top:1px solid var(--line); }
.row:first-of-type{ border-top:0; }
.row small{ display:block; color:var(--faint); font-size:13.5px; }
.big{ font-size:30px; font-weight:700; letter-spacing:-.01em; }
.ok{ color:#15803d; font-weight:600; }
.warn{ color:#92400e; background:#fef3c7; border-radius:10px; padding:10px 14px; margin:10px 0 0; }
.err{ color:var(--bad); margin:10px 0 0; }
.muted{ color:var(--faint); font-size:14px; margin:10px 0 0; }
button.b{ font:inherit; font-size:14.5px; font-weight:600; border:1px solid #e3e5ec; background:#fff; color:var(--ink); padding:7px 15px; border-radius:999px; cursor:pointer; white-space:nowrap; }
button.b:hover{ background:#f5f6fa; }
button.go{ background:var(--violet); border-color:var(--violet); color:#fff; }
button.go:hover{ background:#5b4ce6; }
button.danger{ color:var(--bad); }
.seg{ display:inline-flex; padding:3px; border-radius:999px; background:#f1f2f6; }
.seg button{ border:0; background:transparent; font:inherit; font-size:14px; font-weight:600; padding:5px 13px; border-radius:999px; cursor:pointer; color:var(--dim); }
.seg button.on{ background:#fff; color:var(--ink); box-shadow:0 1px 4px rgba(20,24,50,.12); }
.fam{ font-weight:700; }
.code{ font-size:26px; font-weight:800; letter-spacing:.14em; color:var(--violet); }
.icon{ width:40px; height:40px; border-radius:23%; display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; margin-right:12px; }
.icon svg{ width:60%; height:60%; }
.who{ display:flex; align-items:center; }
#waiting:not(:empty){ display:inline-block; min-width:20px; margin-left:6px; padding:0 6px; border-radius:999px; background:var(--violet); color:#fff; font-size:12.5px; line-height:20px; }
nav button.on #waiting{ background:#fff; color:var(--ink); }
textarea{ width:100%; font:inherit; font-size:15px; border:1px solid #e3e5ec; border-radius:12px; padding:10px 12px; margin-top:10px; resize:vertical; min-height:70px; }
.tag{ display:inline-block; font-size:12.5px; font-weight:700; padding:2px 9px; border-radius:999px; background:#f1f2f6; color:var(--dim); }
.tag.approved, .tag.ok{ background:#dcfce7; color:#15803d; }
button:disabled{ opacity:.55; cursor:not-allowed; } .tag.declined{ background:#fee2e2; color:var(--bad); }
.empty{ text-align:center; color:var(--dim); padding:60px 20px; font-size:18px; }
</style></head>
<body>
<header><h1>Orlis <i>Server</i></h1>
<nav id="tabs"><button data-t="overview" class="on">Overview</button><button data-t="approvals">Approvals<span id="waiting"></span></button><button data-t="families">Families</button><button data-t="store">Store</button><button data-t="backups">Backups</button></nav></header>
<main id="main"></main>
<script>
var TRY = ${TRY_SECS};
(function(){
  /* the key: from the address the cube opened (then out of sight) */
  var key = '';
  try { var m = /[?#&]k=([0-9a-f]+)/.exec(location.search + location.hash); if (m){ key = m[1]; sessionStorage.setItem('k', key); history.replaceState(null, '', location.pathname); } else key = sessionStorage.getItem('k') || ''; } catch (e) {}
  var main = document.getElementById('main'), tab = 'overview';
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function when(iso){ var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
  function size(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function call(method, path, body){
    return fetch(path, { method: method, headers: { 'Content-Type': 'application/json', 'X-Orlis-Manage': key }, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.message || 'That didn\\u2019t work.'); return d; }); });
  }
  function h(html){ var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function card(title){ var c = h('<section class="card"><h2>' + esc(title) + '</h2></section>'); main.appendChild(c); return c; }
  function row(c, left, right){ var r = h('<div class="row"><div>' + left + '</div><div></div></div>'); (right || []).forEach(function(x){ r.lastChild.appendChild(x); }); c.appendChild(r); return r; }
  function btn(label, cls, fn){ var b = document.createElement('button'); b.className = 'b ' + (cls || ''); b.textContent = label; b.onclick = function(){ fn(b); }; return b; }
  /* a button that asks first: picked once it asks, picked again it does it */
  function sure(label, ask, cls, fn){ var at = 0; return btn(label, cls, function(b){ if (Date.now() - at < 4000){ at = 0; fn(b); return; } at = Date.now(); b.textContent = ask; setTimeout(function(){ if (at && Date.now() - at >= 3950){ at = 0; b.textContent = label; } }, 4000); }); }
  function note(c, t, cls){ var p = document.createElement('p'); p.className = cls || 'muted'; p.textContent = t; c.appendChild(p); return p; }
  function fail(c){ return function(e){ note(c, e.message, 'err'); }; }

  var UPDATE = { 'up to date': ['Up to date', 'ok'], ready: ['A newer version is ready - it switches at a quiet moment', ''], offline: ['Couldn\\u2019t check for updates just now', ''], waiting: ['Checking for updates soon', ''], off: ['Updates only in the Windows exe', ''] };
  var KINDS = { daily: 'Daily', update: 'Before an update', manual: 'Made by you', 'before-restore': 'Before a restore' };

  var views = {
    approvals: function(){
      return call('GET', '/api/submissions').then(function(r){
        var waiting = r.submissions.filter(function(x){ return x.state === 'waiting'; });
        var done = r.submissions.filter(function(x){ return x.state !== 'waiting'; });
        var c = card('Waiting for your OK');
        if (!waiting.length) note(c, 'Nothing waiting. Games your creators send in show up here.');
        waiting.forEach(function(x){
          var r2 = row(c, '<b>' + esc(x.name) + '</b> <span class="tag">version ' + esc(x.version) + '</span>' + (x.tried ? ' <span class="tag ok">played \u2713</span>' : ' <span class="tag">not played yet</span>') + '<small>From ' + esc(x.family) + ' (' + esc(x.by) + ') \u00b7 sent ' + esc(when(x.createdAt)) + ' \u00b7 ' + size(x.bytes) + '</small>', [
            btn('Decline\u2026', '', function(){
              if (r2.nextSibling && r2.nextSibling.dataset && r2.nextSibling.dataset.note) return;
              var box = h('<div data-note="1"><textarea maxlength="300" placeholder="A note for them: what to change, say (they\u2019ll see it in Orlis Play)"></textarea><div style="text-align:right;margin-top:8px"></div></div>');
              box.lastChild.appendChild(btn('Decline it', 'danger', function(){ call('POST', '/api/submissions/' + encodeURIComponent(x.id) + '/decline', { note: box.firstChild.value }).then(show, fail(c)); }));
              r2.after(box); box.firstChild.focus();
            }),
            /* (only once it's been played: in Orlis Play, Try it) */
            x.tried ? btn('Approve', 'go', function(b){ b.textContent = 'Approving\u2026'; call('POST', '/api/submissions/' + encodeURIComponent(x.id) + '/approve').then(show, fail(c)); })
              : (function(){ var b = btn('Play it first', '', function(){}); b.disabled = true; b.title = 'Approve comes on once you\u2019ve played this version in Orlis Play (the Store, Waiting for your OK, Try it).'; return b; })()
          ]);
        });
        if (waiting.length) note(c, 'Every game is played before it\u2019s approved: open Orlis Play, then the Store - games waiting for your OK are at the top (only you see them). Press Try it and play for at least ' + TRY + ' seconds; Approve comes on here.');
        if (done.length){
          var d = card('Lately');
          done.forEach(function(x){ row(d, '<b>' + esc(x.name) + '</b> <span class="tag ' + esc(x.state) + '">' + (x.state === 'approved' ? 'In the Store' : 'Declined') + '</span><small>' + esc(x.family) + ' \u00b7 ' + esc(when(x.decidedAt)) + (x.note ? ' \u00b7 \u201c' + esc(x.note) + '\u201d' : '') + '</small>'); });
        }
      });
    },
    overview: function(){
      return call('GET', '/api/server').then(function(s){
        var c = card('This server');
        var u = UPDATE[s.update && s.update.state] || ['', ''];
        row(c, '<div class="big">' + esc(s.name) + '</div><small>Orlis Server ' + esc(s.version) + '</small>');
        row(c, '<span class="' + u[1] + '">' + esc(u[0]) + '</span>');
        row(c, 'Last backup<small>' + (s.backups[0] ? esc(when(s.backups[0].at)) : 'None yet - one is made each day') + '</small>');
        if (s.addresses && s.addresses.length) row(c, 'Its address on the home Wi-Fi<small>' + esc(s.addresses.join('  or  ')) + ' - Orlis Play finds it by itself; this is in case it ever asks</small>');
        if (s.restoring) note(c, 'A restore is waiting: it happens as the server next starts.', 'warn');
      });
    },
    families: function(){
      return Promise.all([call('GET', '/api/households'), call('GET', '/api/invites')]).then(function(r){
        var c = card('Families');
        r[0].households.forEach(function(f){
          row(c, '<span class="fam">' + esc(f.name) + '</span><small>' + f.profiles + ' profile' + (f.profiles === 1 ? '' : 's') + '</small>');
          f.accounts.forEach(function(a){
            var right = [];
            if (a.role === 'owner') right.push(h('<b style="color:#6d5efc">Owner</b>'));
            else {
              var seg = h('<span class="seg"></span>');
              [['player', 'Player'], ['creator', 'Creator']].forEach(function(p){
                var b = document.createElement('button'); b.textContent = p[1]; if (a.role === p[0]) b.className = 'on';
                b.onclick = function(){ call('POST', '/api/accounts/' + encodeURIComponent(a.id) + '/role', { role: p[0] }).then(function(){ a.role = p[0]; [].forEach.call(seg.children, function(x){ x.className = x === b ? 'on' : ''; }); }, fail(c)); };
                seg.appendChild(b);
              });
              right.push(seg);
            }
            row(c, '&nbsp;&nbsp;' + esc(a.email), right);
          });
        });
        note(c, 'Creators can make games with Create in Orlis Play; you approve them before they\\u2019re in the Store.');
        var inv = card('Invite a new family');
        r[1].invites.filter(function(i){ return !i.usedAt && i.kind === 'new'; }).forEach(function(i){
          row(inv, '<span class="code">' + esc(i.code) + '</span><small>Made ' + esc(when(i.createdAt)) + '</small>', [sure('Remove', 'Remove? Click again', '', function(){ call('DELETE', '/api/invites/' + encodeURIComponent(i.code)).then(show, fail(inv)); })]);
        });
        row(inv, 'A friend\\u2019s family gets its own grown-ups and kids, kept apart from yours.<small>They set up Orlis Play on this Wi-Fi and type the code.</small>', [btn('Make an invite', 'go', function(){ call('POST', '/api/invites', { household: 'new' }).then(show, fail(inv)); })]);
      });
    },
    store: function(){
      return call('GET', '/api/store').then(function(st){
        var c = card('The Store\\u2019s games');
        if (!st.games || !st.games.length) note(c, 'Nothing in the Store. Put a game\\u2019s .orlis file in the server\\u2019s "games" folder to add one.');
        (st.games || []).forEach(function(g){
          var cols = (g.icon && g.icon.cols) || ['#6d5efc', '#6d5efc'];
          var glyph = g.icon && g.icon.glyph && !/<\\s*script|on\\w+\\s*=|javascript:|href/i.test(g.icon.glyph) ? g.icon.glyph : '';
          row(c, '<span class="who"><span class="icon" style="background:linear-gradient(135deg,' + esc(cols[0]) + ',' + esc(cols[1] || cols[0]) + ')"><svg viewBox="0 0 100 100">' + glyph + '</svg></span><span><b>' + esc(g.name) + '</b><small>Version ' + esc(g.version) + (g.by ? ' \\u00b7 ' + esc(g.by) : '') + ' \\u00b7 ' + size(g.bytes) + '</small></span></span>',
            [sure('Take out', 'Take it out? Click again', 'danger', function(){ call('DELETE', '/api/store/' + encodeURIComponent(g.id)).then(show, fail(c)); })]);
        });
        note(c, 'Taking a game out of the Store leaves it on any PC that already downloaded it.');
      });
    },
    backups: function(){
      return call('GET', '/api/server').then(function(s){
        var c = card('Backups');
        row(c, 'One is made every day, and before each update.<small>The accounts, kids\\u2019 profiles and the Store\\u2019s games. (Each PC keeps its own downloads, scores and settings.)</small>', [btn('Back up now', 'go', function(b){ b.textContent = 'Backing up\\u2026'; call('POST', '/api/backups').then(show, fail(c)); })]);
        s.backups.forEach(function(b){
          var what = [b.accounts != null ? b.accounts + ' account' + (b.accounts === 1 ? '' : 's') : '', b.profiles != null ? b.profiles + ' profile' + (b.profiles === 1 ? '' : 's') : '', b.games + ' game' + (b.games === 1 ? '' : 's'), size(b.bytes)].filter(Boolean).join(' \\u00b7 ');
          row(c, '<b>' + esc(when(b.at)) + '</b><small>' + esc(KINDS[b.reason] || b.reason) + ' \\u00b7 ' + esc(what) + '</small>', [sure('Restore', 'Restore it? Click again', '', function(x){
            call('POST', '/api/backups/' + encodeURIComponent(b.id) + '/restore').then(function(r){
              x.textContent = r.restarting ? 'Restoring\\u2026' : 'At next start';
              note(c, r.restarting ? 'Restoring: the server restarts in a moment with the data as it was then. What it had just now is kept as a backup too.' : 'This restore happens the next time the server starts.', 'warn');
              if (r.restarting) setTimeout(show, 6000);
            }, fail(c));
          })]);
        });
      });
    }
  };
  /* how many are waiting, on the tab */
  function count(){ call('GET', '/api/submissions').then(function(r){ var n = r.submissions.filter(function(x){ return x.state === 'waiting'; }).length; document.getElementById('waiting').textContent = n ? n : ''; }, function(){}); }
  function show(){
    main.innerHTML = '';
    if (key) count();
    [].forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.className = b.dataset.t === tab ? 'on' : ''; });
    if (!key){ main.innerHTML = '<p class="empty">Open this page from the Orlis cube by the clock:<br>right-click it, then <b>Manage Orlis Server</b>.</p>'; return; }
    views[tab]().catch(function(e){ main.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; });
  }
  document.getElementById('tabs').onclick = function(e){ var t = e.target.dataset && e.target.dataset.t; if (t){ tab = t; show(); } };
  show();
})();
</script>
</body></html>`;
}
