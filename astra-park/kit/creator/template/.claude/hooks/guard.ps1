# Orlis Play's guard, before Claude reads or changes anything: this game's
# folder only, and of it only game.js and orlis.json can be changed.
# (Claude Code runs it; it says no by answering "deny" with the reason.)
$ErrorActionPreference = 'Stop'
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = [IO.Path]::GetFullPath($env:CLAUDE_PROJECT_DIR).TrimEnd('\', '/')
$sep = [IO.Path]::DirectorySeparatorChar

function Deny([string]$why) {
  @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = $why } } | ConvertTo-Json -Compress -Depth 5
  exit 0
}

$p = $in.tool_input.file_path
if (-not $p) { $p = $in.tool_input.notebook_path }
if (-not $p) { $p = $in.tool_input.path }
if (-not $p) { exit 0 }   # (no path given: this folder)

if (-not [IO.Path]::IsPathRooted($p)) { $p = Join-Path $root $p }
$full = [IO.Path]::GetFullPath($p).TrimEnd('\', '/')
$inside = ($full -eq $root) -or $full.StartsWith($root + $sep, [StringComparison]::OrdinalIgnoreCase)
if (-not $inside) { Deny "This game can only use its own folder ($root) - nothing else on this computer." }

if (@('Edit', 'Write', 'MultiEdit', 'NotebookEdit') -contains $in.tool_name) {
  $rel = $full.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
  if (@('game.js', 'orlis.json') -notcontains $rel) {
    Deny "Only game.js and orlis.json can be changed. The rest of this folder is Orlis Play's (its rules and checks)."
  }
}
exit 0
