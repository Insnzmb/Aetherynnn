@echo off
setlocal
cd /d "%~dp0"

set "LOG=%cd%\launcher.log"

echo === AETHERYN WEB DEBUG LAUNCH ===> "%LOG%"
echo Time: %date% %time%>> "%LOG%"
echo Folder: %cd%>> "%LOG%"
echo.>> "%LOG%"

echo Running launcher... (also writing to launcher.log)
echo.

(where node) >> "%LOG%" 2>&1
(where npm) >> "%LOG%" 2>&1

node tools\launcher.cjs >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
echo Launcher exited with code %RC%
echo.
echo If the normal launcher still flashes closed, open launcher.log and paste it to me.
echo Log: %LOG%
echo.
pause
endlocal
