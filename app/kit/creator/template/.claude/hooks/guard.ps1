# Orlis Play's guard: Claude Code asks it before every single thing Claude
# does, and anything not on the lists below is refused. It starts strict on
# purpose; to allow more later, add to the lists (Orlis Play puts the new
# guard into every game's folder when it opens the game).
# (It says no by answering "deny" with the reason; if it fails, Claude Code
# says no too.)

# ---- What Claude may do -------------------------------------------------
# the tools: reading, searching and editing this folder, its own how-to
# (the skill), its to-do list, and asking the grown-up a question. Refused:
# commands, the web, other agents, connectors (email, drive...), anything new.
$tools     = @('Read', 'Glob', 'Grep', 'Edit', 'Write', 'MultiEdit', 'Skill', 'TodoWrite', 'AskUserQuestion')
# the files it may read (in this folder)
$canRead   = @('game.js', 'orlis.json', 'CLAUDE.md', '.claude/skills/orlis-game/SKILL.md', '.orlis/preview.txt')
# the files it may change: these two, nothing new
$canChange = @('game.js', 'orlis.json')
# the only skill it may use
$skills    = @('orlis-game')
# what new code may never have (the same list as the checks and the server)
$forbidden = @(
{{FORBIDDEN}}
)
# --------------------------------------------------------------------------

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

$ErrorActionPreference = 'Stop'
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = [IO.Path]::GetFullPath($env:CLAUDE_PROJECT_DIR).TrimEnd('\', '/')
$sep = [IO.Path]::DirectorySeparatorChar
$tool = [string]$in.tool_name
$ti = $in.tool_input

function Deny([string]$why) {
  @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = $why } } | ConvertTo-Json -Compress -Depth 5
  exit 0
}

if ($tools -notcontains $tool) {
  Deny ("Making an Orlis Play game only needs reading and editing game.js and orlis.json - '" + $tool + "' isn't allowed here.")
}

if ($tool -eq 'Skill') {
  $sk = [string]$ti.skill; if (-not $sk) { $sk = [string]$ti.command }
  if ($skills -notcontains $sk.TrimStart('/')) { Deny 'Only the orlis-game skill is used here.' }
  exit 0
}
if (@('TodoWrite', 'AskUserQuestion') -contains $tool) { exit 0 }

# the file or folder it's about: inside this game's folder only
$p = $ti.file_path
if (-not $p) { $p = $ti.path }
$given = [bool]$p
if (-not $p) { $p = $root }
if (-not [IO.Path]::IsPathRooted($p)) { $p = Join-Path $root $p }
$full = [IO.Path]::GetFullPath($p).TrimEnd('\', '/')
$inside = ($full -eq $root) -or $full.StartsWith($root + $sep, [StringComparison]::OrdinalIgnoreCase)
if (-not $inside) { Deny ("This game can only use its own folder (" + $root + ") - nothing else on this computer.") }
$rel = ''
if ($full.Length -gt $root.Length) { $rel = $full.Substring($root.Length).TrimStart('\', '/').Replace('\', '/') }

if ($tool -eq 'Read') {
  if (-not $given -or $canRead -notcontains $rel) { Deny ('Only these can be read here: ' + ($canRead -join ', ') + '.') }
  exit 0
}
if (@('Glob', 'Grep') -contains $tool) { exit 0 }   # (searching this folder)

# Edit, Write, MultiEdit: game.js and orlis.json, and nothing on the list
if (-not $given -or $canChange -notcontains $rel) {
  Deny 'Only game.js and orlis.json can be changed. The rest of this folder is Orlis Play''s (its rules and checks).'
}
$new = @()
if ($tool -eq 'Write') { $new += [string]$ti.content }
if ($tool -eq 'Edit') { $new += [string]$ti.new_string }
if ($tool -eq 'MultiEdit') { foreach ($e in $ti.edits) { $new += [string]$e.new_string } }
$text = $new -join "`n"
if ($text.Length -gt 1000000) { Deny 'That is too big - a game stays under a megabyte.' }
$said = Find-Words $text
if ($said.Count) { Deny ('That change has words that aren''t for children (' + ($said -join ', ') + '). Orlis Play games are for young children: use gentle words everywhere, even in the code''s names and comments.') }
foreach ($f in $forbidden) {
  if ($text.Contains($f[0])) {
    $w = $f[0].TrimEnd('(')
    Deny ('That change uses ' + $w + ', which reaches for ' + $f[1] + '. Orlis Play games can''t - leave it out and find another way.')
  }
}
exit 0
