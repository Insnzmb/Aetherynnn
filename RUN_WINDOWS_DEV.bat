@echo off
setlocal
cd /d "%~dp0"

echo === AETHERYN WEB: DEV Launcher (Windows) ===
echo DEV_BUILD=on (dev console + AI trace enabled)
echo.

set DEV_BUILD=on
node tools\launcher.cjs
set "RC=%ERRORLEVEL%"

echo.
echo Launcher exited with code %RC%
echo.
pause
endlocal
