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

for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 (
  echo [X] Node is too old. Node 18 or newer is required.
  node -v
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

:: Rebuilding only when dist was missing meant a pulled update kept serving
:: the old interface. Node is verified above, so use it to compare times.
set NEEDS_BUILD=0
if not exist "dist\index.html" set NEEDS_BUILD=1
if "%NEEDS_BUILD%"=="0" (
  for /f %%i in ('node -e "const fs=require('fs'),p=require('path');const d=fs.statSync('dist/index.html').mtimeMs;let s=0;const w=x=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=p.join(x,e.name);if(e.isDirectory())w(f);else if(fs.statSync(f).mtimeMs>d)s=1}};w('src');for(const f of ['server.ts','index.html','package.json','vite.config.ts','tailwind.config.js'])if(fs.existsSync(f)&&fs.statSync(f).mtimeMs>d)s=1;console.log(s)"') do set NEEDS_BUILD=%%i
)

if "%NEEDS_BUILD%"=="1" (
  echo [*] Building the interface...
  call npm run build
  if errorlevel 1 (
    echo [X] Build failed.
    pause
    exit /b 1
  )
)

echo.
echo [*] Starting Study Hub - your browser will open when it is ready.
echo     To stop it: press Ctrl+C here, or click the red X at the
echo     top-right of the page in your browser.
echo ==================================================
set STUDYHUB_OPEN=1
call npx tsx server.ts
