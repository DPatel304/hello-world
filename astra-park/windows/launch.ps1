# Starts MoveCube. The desktop shortcut runs this rather than the browser
# directly, so that every launch first picks up the newest build from GitHub
# and then opens the game full screen.
#
# The update is best effort: no network, a slow one, or a download that is not
# plainly the game all fall through to the copy already installed, so the
# game always opens. last-update.txt says what happened on the latest launch.
#
# Kept to plain ASCII for Windows PowerShell 5.1, like setup.ps1.

param([switch]$FindBrowser)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$game = Join-Path $here 'astra-park.html'

# Filled in by windows/package.mjs from the branch the zip was built from.
$Repo   = '__REPO__'
$Branch = '__BRANCH__'
$File   = 'astra-park/astra-park.html'

# Chrome first; Edge is built on the same engine and ships with Windows.
# Plain strings rather than Join-Path: on a machine with no "Program Files
# (x86)" the variable is empty, which Join-Path would throw on.
function Find-Browser {
    @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if ($FindBrowser) {
    $b = Find-Browser
    if (-not $b) { exit 1 }
    Write-Output $b
    exit 0
}

function Update-Game {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Add-Type -AssemblyName System.Net.Http
    # HttpClient rather than Invoke-WebRequest: it honours a short timeout
    # and has no progress bar, which makes 5.1 downloads crawl.
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(5)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd('MoveCube-launcher')
    $client.DefaultRequestHeaders.Accept.ParseAdd('application/vnd.github.raw')

    # The API serves a push within a minute; the raw address can lag five,
    # but has no hourly limit, so it is the fallback.
    $sources = @(
        "https://api.github.com/repos/$Repo/contents/$($File)?ref=$($Branch)",
        "https://raw.githubusercontent.com/$Repo/$Branch/$File"
    )
    $tmp = Join-Path $here 'download.tmp'
    try {
        foreach ($url in $sources) {
            try { $bytes = $client.GetByteArrayAsync($url).GetAwaiter().GetResult() }
            catch { continue }
            # Only ever replace the game with something that is plainly the
            # game: an error page or a cut-off download stays out.
            $text = [Text.Encoding]::UTF8.GetString($bytes)
            # (Its page title is still 'Astra Park' from before the name changed;
            # 'MoveCube' is accepted too, for when it does.)
            if ($bytes.Length -lt 50000 -or -not ($text.Contains('<title>Astra Park</title>') -or $text.Contains('<title>MoveCube</title>'))) { continue }
            [IO.File]::WriteAllBytes($tmp, $bytes)
            if ((Test-Path -LiteralPath $game) -and
                (Get-FileHash -LiteralPath $tmp).Hash -eq (Get-FileHash -LiteralPath $game).Hash) {
                return 'already up to date'
            }
            Move-Item -LiteralPath $tmp -Destination $game -Force
            return "updated from $url"
        }
        return 'could not reach GitHub; opened the copy already installed'
    } finally {
        $client.Dispose()
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
}

try { $result = Update-Game } catch { $result = "update skipped: $($_.Exception.Message)" }

# The launcher keeps itself up to date too, the same way: the newest
# launch.ps1 from the same branch, with this install's repo and branch put
# in, used from the next start on. Only ever something that is plainly the
# launcher, and plain ASCII, replaces it.
function Update-Launcher {
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(5)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd('MoveCube-launcher')
    $client.DefaultRequestHeaders.Accept.ParseAdd('application/vnd.github.raw')
    $me = $PSCommandPath
    if (-not $me) { $me = Join-Path $here 'launch.ps1' }
    # (in two pieces, so only the real placeholders above are ever filled in)
    $phRepo = "'__" + "REPO__'"; $phBranch = "'__" + "BRANCH__'"
    try {
        foreach ($url in @(
            "https://api.github.com/repos/$Repo/contents/astra-park/windows/launch.ps1?ref=$($Branch)",
            "https://raw.githubusercontent.com/$Repo/$Branch/astra-park/windows/launch.ps1")) {
            try { $bytes = $client.GetByteArrayAsync($url).GetAwaiter().GetResult() } catch { continue }
            if (($bytes | Where-Object { $_ -gt 127 } | Select-Object -First 1) -ne $null) { continue }
            $text = [Text.Encoding]::ASCII.GetString($bytes)
            if (-not ($text.Contains('function Update-Game') -and $text.Contains('Start-Process') -and $text.Contains($phRepo))) { continue }
            $text = $text.Replace($phRepo, "'$Repo'").Replace($phBranch, "'$Branch'")
            if ((Test-Path -LiteralPath $me) -and ([IO.File]::ReadAllText($me) -eq $text)) { return 'launcher up to date' }
            [IO.File]::WriteAllText($me, $text, [Text.Encoding]::ASCII)
            return 'launcher updated'
        }
        return 'launcher not checked'
    } finally { $client.Dispose() }
}
try { $result = "$result; $(Update-Launcher)" } catch { $result = "$result; launcher update skipped" }

# The soundtrack: every song in the family's "MoveCube" music folder,
# listed into playlist.js beside the game, which reads it as it starts.
# Re-listed on every launch, so adding or removing a song is all it takes.
$musicDir = Join-Path ([Environment]::GetFolderPath('MyMusic')) 'MoveCube'
if (-not (Test-Path -LiteralPath $musicDir)) { $musicDir = Join-Path ([Environment]::GetFolderPath('MyMusic')) 'Astra Park' }
$songs = @()
if (Test-Path -LiteralPath $musicDir) {
    $songs = Get-ChildItem -LiteralPath $musicDir -File |
        Where-Object { $_.Extension -match '^\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$' } |
        Sort-Object Name |
        ForEach-Object { '"' + ([System.Uri]$_.FullName).AbsoluteUri + '"' }
}
# AbsoluteUri escapes spaces and accented letters, so this stays ASCII.
"window.ASTRA_MUSIC = [$($songs -join ',')];" |
    Set-Content -LiteralPath (Join-Path $here 'playlist.js') -Encoding ASCII
"$(Get-Date -Format s)  $result" | Set-Content -LiteralPath (Join-Path $here 'last-update.txt') -Encoding ASCII

# The window is hidden, so there is nowhere to show an error; setup already
# checked a browser exists.
$browser = Find-Browser
if (-not $browser) { exit 1 }

# A proper file:// URL, so a space in the Windows user name is escaped.
$page = ([System.Uri]$game).AbsoluteUri

# The camera allowed without a prompt (a file opened from disk never has its
# camera permission remembered), sound allowed before anyone clicks, and a
# browser profile of its own: that keeps those flags away from normal
# browsing, and is what makes them apply when the browser is already open.
# Full screen for playing; a window, while the game's being worked on and
# tried out (set $Windowed = $false for full screen again).
$Windowed = $true
# The window: small - about 55% of the screen's width (inside the taskbar),
# the game's own 16:9, in the middle. Measured in the browser's own scaled
# units: a screen with Windows' display scaling turned up (125%, 150%...)
# can report its size in real pixels, which would make the window far too
# big - so the size is divided by that scaling. (If the screen can't be
# measured, a modest 960 x 540.)
$winW = 960; $winH = 540; $winX = 40; $winY = 30
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $scale = 1.0
    try { $g = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero); $scale = [Math]::Max(1.0, $g.DpiX / 96.0); $g.Dispose() } catch { }
    $aw = $area.Width / $scale; $ah = $area.Height / $scale; $ax = $area.X / $scale; $ay = $area.Y / $scale
    $winW = [int]($aw * 0.55)
    $winH = [int]($winW * 9 / 16)
    if ($winH -gt $ah * 0.6) { $winH = [int]($ah * 0.6); $winW = [int]($winH * 16 / 9) }
    $winX = [int]($ax + ($aw - $winW) / 2)
    $winY = [int]($ay + ($ah - $winH) / 2)
} catch { }
$screenMode = if ($Windowed) { "--window-size=$winW,$winH --window-position=$winX,$winY" } else { '--start-fullscreen' }
$arguments = @(
    "--user-data-dir=`"$(Join-Path $here 'browser-profile')`"",
    "--app=`"$page`"",
    $screenMode,
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--no-first-run',
    '--no-default-browser-check',
    # (hides the yellow "unsupported command-line flag" bar the camera flag
    # would otherwise bring up on every start)
    '--test-type'
) -join ' '

Start-Process -FilePath $browser -ArgumentList $arguments
