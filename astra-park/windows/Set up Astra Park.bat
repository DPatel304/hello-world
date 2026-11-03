@echo off
rem Double-click this once. It installs Astra Park and puts its icon on the
rem desktop and in the Start menu. Run it again to install a newer version.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not finish - the message above says why.
  pause
  exit /b 1
)
echo.
echo All set. Double-click "Astra Park" on your desktop to play.
pause
