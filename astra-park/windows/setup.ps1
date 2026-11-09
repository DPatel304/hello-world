# Installs MoveCube for the current Windows user.
#
# Copies the game and its launcher into %LOCALAPPDATA%\AstraPark and adds an
# "MoveCube" shortcut to the desktop and the Start menu. The shortcut runs
# launch.ps1, which fetches the newest build from GitHub on every start and
# then opens the game full screen - so after this, updates arrive by
# themselves. Running setup again reinstalls in place.
#
# Kept to plain ASCII: Windows PowerShell 5.1 reads a script without a BOM
# in the local code page, and anything fancier would arrive garbled.

$ErrorActionPreference = 'Stop'

$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
# (The folder keeps its old name, so scores, settings and the camera
# permission carry over.)
$install = Join-Path $env:LOCALAPPDATA 'AstraPark'
$files   = 'astra-park.html', 'movecube.ico', 'launch.ps1'

foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $here $f))) {
        throw "$f is missing. Unzip the whole download into one folder and run setup from there."
    }
}

New-Item -ItemType Directory -Force -Path $install | Out-Null
foreach ($f in $files) {
    $to = Join-Path $install $f
    Copy-Item -LiteralPath (Join-Path $here $f) -Destination $to -Force
    # Downloaded files carry a "came from the internet" mark; the launcher
    # runs on every start, so clear it once here.
    Unblock-File -LiteralPath $to
}

$launcher = Join-Path $install 'launch.ps1'
$browser  = & $launcher -FindBrowser
if ($LASTEXITCODE -ne 0 -or -not $browser) {
    throw 'Could not find Google Chrome or Microsoft Edge. Install Chrome, then run setup again.'
}

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments  = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""

$shell = New-Object -ComObject WScript.Shell
$places = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('Programs')
)
foreach ($dir in $places) {
    # (It was called Astra Park once: that shortcut goes.)
    $old = Join-Path $dir 'Astra Park.lnk'
    if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Force }
    $link = $shell.CreateShortcut((Join-Path $dir 'MoveCube.lnk'))
    $link.TargetPath       = $powershell
    $link.Arguments        = $arguments
    $link.WorkingDirectory = $install
    $link.IconLocation     = (Join-Path $install 'movecube.ico') + ',0'
    $link.WindowStyle      = 7
    $link.Description      = 'MoveCube'
    $link.Save()
}

# The soundtrack folder: any songs put here play in the game.
# An old "Astra Park" music folder becomes the MoveCube one, songs and all.
$myMusic  = [Environment]::GetFolderPath('MyMusic')
$music    = Join-Path $myMusic 'MoveCube'
$oldMusic = Join-Path $myMusic 'Astra Park'
if ((Test-Path -LiteralPath $oldMusic) -and -not (Test-Path -LiteralPath $music)) {
    Move-Item -LiteralPath $oldMusic -Destination $music
}
New-Item -ItemType Directory -Force -Path $music | Out-Null
$desktop = [Environment]::GetFolderPath('Desktop')
$oldLink = Join-Path $desktop 'Astra Park Music.lnk'
if (Test-Path -LiteralPath $oldLink) { Remove-Item -LiteralPath $oldLink -Force }
$link = $shell.CreateShortcut((Join-Path $desktop 'MoveCube Music.lnk'))
$link.TargetPath  = $music
$link.Description = 'Songs for MoveCube'
$link.Save()

Write-Host ''
Write-Host "Installed to $install"
Write-Host "Using $browser"
Write-Host "Put songs for the game in $music"
