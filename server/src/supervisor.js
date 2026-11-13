/* Orlis Server, running quietly: no window to keep open - just the Orlis
   cube by the clock (the system tray). Right-click it for the log, the
   data folder, Restart and Quit.

   When Orlis Server.exe is double-clicked, this part starts first. It
   puts the icon by the clock (double-click it, or right-click > Manage Orlis
   Server, for the management page - manage-page.js), and runs the server itself as a second copy
   of the exe (--worker), its words going to "server.log" in the data
   folder. If the server ever stops by itself, this starts it again (a
   few seconds later; after five stops in ten minutes it gives up and says
   so). When the server has updated itself, this starts the new exe and
   closes; when it's asked to finish a restore, it starts the server again.

   The icon is drawn by Windows' own PowerShell (it comes with Windows), so
   there's nothing extra to install. It doesn't start with Windows: it runs
   when it's double-clicked, until it's told to quit. */
import { spawn as spawnChild } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AFTER_UPDATE, UPDATED } from './update.js';

export const WORKER = '--worker';
export const RESTART = 76;                    /* the server's "start me again" (a restore) */
const LOG_MAX = 1024 * 1024;
const CRASHES = 5, CRASH_WINDOW = 10 * 60 * 1000, CRASH_WAIT = 3000;

/* the Orlis cube, 32 pixels */
export const ICON = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEnklEQVR4nMRXT2gcVRj/vjezyRqTNJtoRE1VgliaHoKeQg9N9eRFDx5bGwpRxEty0ARKgxQMaPXU4k0LSq2IoqLQogdDgzbkIGhpqlDLYk2aptk0aZJmd2P3vc9v5s28fTPbXSdboR8M376ZN+/3533vzVsB9zhcuIu4kac+L3c04TTUGQLqCAbuyuXpUwKYIoKppTyd9O5BHYFb6TxP1JQqwggQjPKLTZx16JxHgvfam+FdRNxMOmZiAqx4H3c+yoq70HqZ23oQMu0s2/pmphW/STLufxK4fot6hYBj3LHfVmxeJGsg2xGESZQwnMngeaiHwMI6dToujLOtg+DVClUqNmTwjk549xXnEykHxlpacDERgT+JGjMFGOaBDnOz1XQkq9NWnNCxxu+Pb8vA8Xh9RAjMFArPPkTpj/hm9x0VY0whJHSi/Dx7cxkGHn8Sz4WYkWX4/lp24Mfi0pxSkLMHiYBQlftVnpt+BLlfZ2ju2x/kKzZmhAApxDP5pT1jK5fTvxduneWXN5MMjrXIKdicvUZnP/m6lP7tgtyDSkVcj+6EhP5VlNTy4erC3s7VxtnXOh6+2iHcPntQonJNVLPbu9Y2YPr0T7cfXV/FvS63vcuJ7X1RAkpfyCTYDcip0va35+e270o1nR944MH70gKfis0p99PZVl6SdOnMtCzMXoM+h5+nPKt9cAR2oBYBZsfAJDWJkMzFQrH30JWr6oW2tqnn2pp3MkimSo2s/HJJ/vHzjGJgFL5ifh99cO6riAGjDkRbZg6FrwxIZ+SsJIjvcuu7D19ehOzG7UnuVyr3h9Lfi3Lyg9MSJi+o3YJQCLbKoVC5B57IAa+DCBwIwH1XdNvLG4oyx/9a6X+koSH7+mPbllkpnJqS7Sur1O/4ClGDBso9hUJpEj6pWjUglCgqUwNWVno6/CKVmuj8Rqn7rYs3uzuuNHNxIQOSr9ADYQeM8jK4R8YnVag6BYrKBagVY1AL6E+Hzhjc1w6JUJkBxQDMst+QoYoDiIhPAQWgFCgmAwoWeNmhMij5v71CM4rJrv5yrkEgWv12tkmEpDwSeq7Jt9d2ICxAESjXTlDFCUhEG3b1o1kFYKZDWKR0G439ZApNUGg7mrk35Go5oCTEQMptMNMijP2gyvabqo8UYLgUA4cCJ5I54Fe7tQRldEmGz8PBMbburaoPlAckahGQJfqClWWjyis3JTvHqz+sekHhug+V+/ZnXaQvqxI42fvEROv9mz287kd5jtfiBVixP5ClPFiSaBWgpZzHotGmtNPz4khqwsaseiQ7cG6hk4cfR4mDIIVA6dmO/qZE/NtrA7d3LDaA/8EJgF2lv3r+5qRIpQhPpJUz9tJIwiNZPF6euN7rgnOMSqJfb9PBdl3SeeeiG4AFJDwCPKwjadIlGj7wRkN9h9J4HPx+eR8pcZRBuyBQ7127cikw33qfBPrH8sFhN9GxPPE/o4+fb/+sUeZ3KIlHuD7y4T5hffXyDsKRAjo9ScG9SOyAHfu/yne5Ct9hB/Y/fcPx5vpUmlKHXh3COdhi1EUgjIOf/9P3DJfW0FBD3X9O74rA/xH/AgAA//81K2DfAAAABklEQVQDAF8fybt0/ZbUAAAAAElFTkSuQmCC';

/* The tray icon, in PowerShell. It reads lines from this side ("status
   ...", "say title|text", "exit") and writes back what was picked ("log",
   "folder", "restart", "quit"). With ORLIS_TRAY_TEST set it builds
   everything and exits at once (a check that it works on a machine). */
export function trayScript(){
  return String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$png = [Convert]::FromBase64String('${ICON}')
$ms = New-Object System.IO.MemoryStream(,$png)
$bmp = [System.Drawing.Bitmap]::FromStream($ms)
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$out = [Console]::Out
function Send([string]$what){ $out.WriteLine($what); $out.Flush() }
$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = $icon
$ni.Text = 'Orlis Server'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$title = $menu.Items.Add('Orlis Server')
$title.Enabled = $false
[void]$menu.Items.Add('-')
$manage = $menu.Items.Add('Manage Orlis Server')
$manage.Font = New-Object System.Drawing.Font($manage.Font, [System.Drawing.FontStyle]::Bold)
$manage.add_Click({ Send 'manage' })
$menu.Items.Add('Show the log').add_Click({ Send 'log' })
$menu.Items.Add('Open the data folder').add_Click({ Send 'folder' })
$menu.Items.Add('Restart').add_Click({ Send 'restart' })
[void]$menu.Items.Add('-')
$menu.Items.Add('Quit Orlis Server').add_Click({ Send 'quit' })
$ni.ContextMenuStrip = $menu
$ni.add_DoubleClick({ Send 'manage' })
if ($env:ORLIS_TRAY_TEST) { $ni.Dispose(); 'tray ok'; exit 0 }
$ni.Visible = $true
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$script:next = $stdin.ReadLineAsync()
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 250
$timer.add_Tick({
  while ($script:next.IsCompleted) {
    $line = $script:next.Result
    if ($line -eq $null -or $line -eq 'exit') { $timer.Stop(); $ni.Visible = $false; [System.Windows.Forms.Application]::Exit(); return }
    if ($line.StartsWith('status ')) { $t = $line.Substring(7); $title.Text = $t; $ni.Text = $t.Substring(0, [Math]::Min(63, $t.Length)) }
    elseif ($line.StartsWith('say ')) { $p = $line.Substring(4).Split('|', 2); $ni.ShowBalloonTip(6000, $p[0], $p[1], 'Info') }
    $script:next = $stdin.ReadLineAsync()
  }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
$ni.Dispose()
`;
}
const encoded = (script) => Buffer.from(script, 'utf16le').toString('base64');

/* supervise({ exe, dataDir, version, afterUpdate }) */
export function supervise({ exe, dataDir, version, afterUpdate = false, spawn = spawnChild, exit = (c) => process.exit(c),
  port = 47871, fetchImpl = fetch, now = () => Date.now(), crashWait = CRASH_WAIT, finishWait = 400 }){
  mkdirSync(dataDir, { recursive: true });
  const logFile = join(dataDir, 'server.log');
  function log(text){
    try {
      if (existsSync(logFile) && statSync(logFile).size > LOG_MAX) renameSync(logFile, join(dataDir, 'server.old.log'));
      appendFileSync(logFile, String(text).replace(/\r?\n$/, '') + '\n');
    } catch {}
  }

  /* the icon */
  let tray = null;
  const tell = (line) => { try { tray && tray.stdin.write(line.replace(/[\r\n]+/g, ' ') + '\n'); } catch {} };
  function startTray(){
    try {
      tray = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded(trayScript())],
        { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      tray.on('error', (e) => { log(`(the icon by the clock couldn't start: ${e.message})`); tray = null; });
      let buf = '';
      tray.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0){ picked(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
      tray.on('exit', () => { tray = null; });
    } catch (e){ log(`(the icon by the clock couldn't start: ${e.message})`); }
  }
  const open = (cmd, args) => { try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref?.(); } catch {} };
  function picked(what){
    if (what === 'manage') manage();
    else if (what === 'log') open('notepad.exe', [logFile]);
    else if (what === 'folder') open('explorer.exe', [dataDir]);
    else if (what === 'restart'){ log('-- restarting (asked from the icon) --'); restarting = true; stopWorker(); }
    else if (what === 'quit'){ log('-- quitting (asked from the icon) --'); quitting = true; stopWorker(); if (!worker) finish(0); }
  }

  /* the management page, in the browser, with its key (it's only ever
     opened from here, on this laptop) */
  function manage(){
    let key = '';
    try { key = readFileSync(join(dataDir, 'manage.key'), 'utf8').trim(); } catch {}
    if (!key){ tell("say Orlis Server is starting|Try Manage again in a moment."); return; }
    open('explorer.exe', [`http://127.0.0.1:${port}/manage#k=${key}`]);
  }

  /* the server */
  let worker = null, quitting = false, restarting = false, first = true;
  const stops = [];
  function startWorker(){
    const args = [WORKER]; if (first && afterUpdate) args.push(AFTER_UPDATE);
    first = false;
    worker = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, ORLIS_SUPERVISED: '1' } });
    worker.stdout?.on('data', (d) => log(d.toString()));
    worker.stderr?.on('data', (d) => log(d.toString()));
    worker.on('error', (e) => log(`(the server couldn't start: ${e.message})`));
    worker.on('exit', (code) => {
      worker = null;
      if (quitting) return finish(0);
      if (code === UPDATED){
        log('-- updated: starting the new Orlis Server --');
        open(exe, [AFTER_UPDATE]);
        return finish(0);
      }
      if (code === RESTART || restarting){ restarting = false; tell('status Orlis Server ' + version + ' - running'); return startWorker(); }
      stops.push(now());
      while (stops.length && now() - stops[0] > CRASH_WINDOW) stops.shift();
      log(`-- the server stopped (${code}) --`);
      if (stops.length >= CRASHES){
        tell('status Orlis Server - stopped (see the log)');
        tell("say Orlis Server stopped|It stopped a few times in a row, so it's resting. Right-click the icon to see the log, or Restart.");
        restarting = false;
        return;
      }
      setTimeout(startWorker, crashWait);
    });
  }
  function stopWorker(){
    if (!worker){ if (restarting){ restarting = false; stops.length = 0; startWorker(); } return; }
    try { worker.stdin.end(); } catch {}
    const w = worker;
    setTimeout(() => { if (worker === w) try { w.kill(); } catch {} }, 5000);
  }
  function finish(code){
    tell('exit');
    setTimeout(() => exit(code), finishWait);
  }

  async function begin(){
    /* already running? then say so, and leave it be */
    try {
      const c = new AbortController(); setTimeout(() => c.abort(), 1500);
      const r = await fetchImpl(`http://127.0.0.1:${port}/api/hello`, { signal: c.signal });
      const h = await r.json();
      if (h && h.app === 'orlis'){
        startTray();
        tell('status Orlis Server - already running');
        tell("say Orlis Server is already running|Look for the Orlis cube by the clock - there's only ever one.");
        log('-- already running: this one closes --');
        setTimeout(() => finish(0), 7000);
        return;
      }
    } catch {}
    log(`-- Orlis Server ${version} starting --`);
    startTray();
    tell('status Orlis Server ' + version + ' - running');
    /* where it is - said the first time it ever runs, not every time */
    const told = join(dataDir, '.shown-where');
    if (afterUpdate) tell(`say Orlis Server updated|Now version ${version}.`);
    else if (!existsSync(told)){
      tell("say Orlis Server is running|It's here by the clock. Double-click the cube to manage it; right-click for more.");
      try { appendFileSync(told, ''); } catch {}
    }
    startWorker();
  }
  begin();
  return { picked, log, get worker(){ return worker; } };
}
