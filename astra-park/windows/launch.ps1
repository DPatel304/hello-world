# Starts Astra Park. The desktop shortcut runs this rather than the browser
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
    $client.DefaultRequestHeaders.UserAgent.ParseAdd('AstraPark-launcher')
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
            if ($bytes.Length -lt 50000 -or -not $text.Contains('<title>Astra Park</title>')) { continue }
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
$arguments = @(
    "--user-data-dir=`"$(Join-Path $here 'browser-profile')`"",
    "--app=`"$page`"",
    '--start-fullscreen',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--no-first-run',
    '--no-default-browser-check'
) -join ' '

Start-Process -FilePath $browser -ArgumentList $arguments
