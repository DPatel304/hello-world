# Orlis Play's checks, after every change Claude makes: the same rules the
# family's Orlis server checks before a game can be sent. Anything wrong
# goes back to Claude to fix ("decision": "block" with the reason).
$ErrorActionPreference = 'Stop'
$null = [Console]::In.ReadToEnd()
$root = $env:CLAUDE_PROJECT_DIR
$problems = New-Object System.Collections.Generic.List[string]

# the words no game for children has (the same list as Orlis Play's and the
# server's): found however they're written - any capitals, joined in a name
# (killZone), numbers or signs for letters (k1ll)
$words = New-Object 'System.Collections.Generic.HashSet[string]' (,[string[]]@({{WORDS}}))
function Find-Words([string]$t) {
  $found = New-Object System.Collections.Generic.List[string]
  # (colours and hex numbers aren't words: #ff9a55 is no a55)
  $t = [regex]::Replace($t, '#[0-9a-fA-F]{3,8}\b|\b0[xX][0-9a-fA-F]+\b', ' ')
  foreach ($v in @($t, [regex]::Replace($t, '([a-z])([A-Z])', '$1 $2'))) {
    $s = $v.ToLowerInvariant().Replace('0', 'o').Replace('1', 'i').Replace('3', 'e').Replace('4', 'a').Replace('5', 's').Replace('7', 't').Replace('8', 'b').Replace('@', 'a').Replace('$', 's').Replace('!', 'i').Replace('|', 'i')
    foreach ($w in ($s -split '[^a-z]+')) { if ($w -and $words.Contains($w) -and -not $found.Contains($w)) { $found.Add($w) } }
  }
  return ,$found
}

# what a game's code never needs, inside the sandbox (as Orlis Play and the server check)
$forbidden = @(
{{FORBIDDEN}}
)

$gamePath = Join-Path $root 'game.js'
if (-not (Test-Path $gamePath)) { $problems.Add('game.js is missing.') }
else {
  $js = [IO.File]::ReadAllText($gamePath)
  if ($js.Length -gt 1000000) { $problems.Add('game.js is very big - keep it under a megabyte.') }
  $seen = @{}
  foreach ($f in $forbidden) {
    if ($js.Contains($f[0]) -and -not $seen.ContainsKey($f[1])) {
      # (joined with + : Windows PowerShell 5 misreads quotes inside "$(...)")
      $seen[$f[1]] = 1; $w = $f[0].TrimEnd('(')
      $problems.Add('game.js uses ' + $w + ', which reaches for ' + $f[1] + '. Games can''t - take it out.')
    }
  }
  if ($js -notmatch 'Orlis\.run\(') { $problems.Add('game.js must end with Orlis.run({ ... }).') }
  if ($js -match '(?m)^\s*(import|export)\s') { $problems.Add('game.js is one plain script: no import or export - everything comes from Orlis.') }
}

$jsonPath = Join-Path $root 'orlis.json'
if (-not (Test-Path $jsonPath)) { $problems.Add('orlis.json is missing.') }
else {
  try { $m = [IO.File]::ReadAllText($jsonPath) | ConvertFrom-Json } catch { $m = $null; $problems.Add('orlis.json is not valid JSON (no comments or trailing commas).') }
  if ($m) {
    if ($m.id -notmatch '^[a-z0-9][a-z0-9-]{1,40}$') { $problems.Add('orlis.json: "id" must be lowercase letters, numbers and dashes.') }
    if (-not $m.name -or $m.name.Length -gt 40) { $problems.Add('orlis.json: "name" is needed, up to 40 letters.') }
    if ($m.version -notmatch '^\d+\.\d+(\.\d+)?$') { $problems.Add('orlis.json: "version" must look like 0.1 or 1.2.') }
    if (-not $m.blurb) { $problems.Add('orlis.json: "blurb" is needed - one line saying what the game is.') }
    if ($m.uses -and @('hands', 'body') -notcontains $m.uses) { $problems.Add('orlis.json: "uses" is "hands" or "body".') }
    if ($m.icon -and $m.icon.glyph -match '(?i)<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image') { $problems.Add('orlis.json: the icon picture must be simple shapes only.') }
  }
}

# words no game for children has: in the code, on screen, or in the Store's text
$all = ''
if (Test-Path $gamePath) { $all += [IO.File]::ReadAllText($gamePath) }
if ($m) { $all += "`n" + ((@($m.name, $m.blurb, $m.about) + @($m.tags) + @($m.howto | ForEach-Object { $_.title; $_.line })) -join "`n") }
$said = Find-Words $all
if ($said.Count) { $problems.Add('It has words that aren''t for children: ' + ($said -join ', ') + '. Use gentle words everywhere, even in the code''s names and comments.') }

if ($problems.Count) {
  @{ decision = 'block'; reason = "Orlis Play's checks found: " + ($problems -join ' ') } | ConvertTo-Json -Compress
}
exit 0
