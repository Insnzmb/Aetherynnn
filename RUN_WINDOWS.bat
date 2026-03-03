@echo off
setlocal
cd /d "%~dp0"

echo === AETHERYN WEB: One-Click Launcher (Windows) ===
echo Time: %date% %time%
echo Folder: %cd%
echo.

echo Node:
where node

echo npm:
where npm

echo.
echo Starting launcher...
echo.

node tools\launcher.cjs
set "RC=%ERRORLEVEL%"

echo.
echo Launcher exited with code %RC%
echo.
echo Keep this window open while playing. Use Ctrl+C to stop.
echo.
pause
endlocal
