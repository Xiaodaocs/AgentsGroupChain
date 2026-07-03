@echo off
title Agent Group Chain (AGC)

echo.
echo  ========================================
echo    Agent Group Chain (AGC)
echo    Multi-Agent Collaboration System
echo  ========================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: Kill any existing process on port 3001
echo  Checking port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo  Killing process %%a on port 3001...
    taskkill /F /PID %%a >nul 2>&1
)
echo  Port 3001 ready.
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found!
    echo  Install Node.js v18+ from https://nodejs.org
    pause
    exit /b 1
)

echo  Node.js version
node --version
echo.

echo  [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] Install failed!
    pause
    exit /b 1
)
echo  Done.
echo.

echo  [2/3] Building frontend...
cd /d "%ROOT_DIR%apps\web"
call "%ROOT_DIR%node_modules\.bin\vite" build
if %errorlevel% neq 0 (
    echo  [WARN] Build failed, trying dev mode...
    cd /d "%ROOT_DIR%"
    call npm run dev
    pause
    exit /b 0
)
echo  Done.
echo.

echo  [3/3] Starting server...
echo  Open http://localhost:3001 in your browser
echo.
cd /d "%ROOT_DIR%apps\server"
set "NODE_PATH=%ROOT_DIR%node_modules;%ROOT_DIR%apps\server\node_modules"
node -r ts-node/register -r reflect-metadata src/main.ts

echo.
echo  Server stopped.
pause
