@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================================
echo       Starting Universal Study Hub
echo   100%% Local - Offline - Hardware Accelerated
echo ==================================================

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed.
  echo     Install Node 18 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [X] npm is not installed ^(it normally ships with Node.js^).
  pause
  exit /b 1
)

REM A fresh clone has no node_modules, so the build would fail on a missing tsc.
if not exist "node_modules" (
  echo [*] First run - installing dependencies ^(this takes a minute^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [X] npm install failed.
    pause
    exit /b 1
  )
)

REM data\ is gitignored so nobody's notes end up in the repository; seed it.
if not exist "data" mkdir data
if not exist "data\study-hub-data.json" (
  if exist "data\study-hub-data.example.json" (
    copy /y "data\study-hub-data.example.json" "data\study-hub-data.json" >nul
    echo [*] Created data\study-hub-data.json from the bundled example.
  )
)

if not exist "dist" (
  echo [*] Building the interface...
  call npm run build
  if errorlevel 1 (
    echo [X] Build failed.
    pause
    exit /b 1
  )
)

echo.
echo [*] Starting on http://localhost:47285
echo     Press Ctrl+C to stop.
echo ==================================================
start "" "http://localhost:47285"
call npx tsx server.ts
