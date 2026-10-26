# Installs Astra Park for the current Windows user.
#
# Copies the game into %LOCALAPPDATA%\AstraPark and adds an "Astra Park"
# shortcut to the desktop and the Start menu. The shortcut opens the game in
# its own full-screen browser window with:
#   - the camera allowed without a prompt (a file opened from disk never gets
#     its camera permission remembered, so it would otherwise ask every time)
#   - sound allowed to start before anyone clicks
#   - a browser profile of its own, so none of that touches normal browsing,
#     and so the flags still apply when the browser is already open
#
# Running it again updates the game in place: that is how a new version of
# astra-park.html gets installed.
#
# Kept to plain ASCII: Windows PowerShell 5.1 reads a script without a BOM
# in the local code page, and anything fancier would arrive garbled.

$ErrorActionPreference = 'Stop'

$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$install = Join-Path $env:LOCALAPPDATA 'AstraPark'
$browserProfile = Join-Path $install 'browser-profile'

foreach ($f in 'astra-park.html', 'astra-park.ico') {
    if (-not (Test-Path -LiteralPath (Join-Path $here $f))) {
        throw "$f is missing. Unzip the whole download into one folder and run setup from there."
    }
}

New-Item -ItemType Directory -Force -Path $install | Out-Null
Copy-Item -LiteralPath (Join-Path $here 'astra-park.html') -Destination $install -Force
Copy-Item -LiteralPath (Join-Path $here 'astra-park.ico') -Destination $install -Force

# Chrome first; Edge is built on the same engine and ships with Windows, so
# it is always there as a fallback.
# Plain strings rather than Join-Path: on a machine with no "Program Files
# (x86)" the variable is empty, which Join-Path would throw on.
$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browser) {
    throw 'Could not find Google Chrome or Microsoft Edge. Install Chrome, then run setup again.'
}

# A proper file:// URL, so a space in the Windows user name is escaped.
$page = ([System.Uri](Join-Path $install 'astra-park.html')).AbsoluteUri

$arguments = @(
    "--user-data-dir=`"$browserProfile`"",
    "--app=`"$page`"",
    '--start-fullscreen',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--no-first-run',
    '--no-default-browser-check'
) -join ' '

$shell = New-Object -ComObject WScript.Shell
$places = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs')
)
foreach ($dir in $places) {
    $link = $shell.CreateShortcut((Join-Path $dir 'Astra Park.lnk'))
    $link.TargetPath       = $browser
    $link.Arguments        = $arguments
    $link.WorkingDirectory = $install
    $link.IconLocation     = (Join-Path $install 'astra-park.ico') + ',0'
    $link.Description      = 'Astra Park'
    $link.Save()
}

Write-Host ''
Write-Host "Installed to $install"
Write-Host "Using $browser"
