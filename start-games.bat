@echo off
setlocal
title Learning Games - dev server

rem Work from this file's own folder, so it can be double-clicked from
rem anywhere or pinned to the taskbar.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js isn't installed, or isn't on your PATH.
  echo   Get it from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting the games server...
echo   Your browser will open by itself in a moment.
echo.
echo   Leave this window open while you work.
echo   Edit a file, then just refresh the browser - no restart needed.
echo   Press Ctrl+C or close this window to stop.
echo.

node tools\serve.mjs --open

rem Only reached once the server exits - keep the window up so any
rem error message is readable instead of flashing past.
echo.
echo   Server stopped.
pause
