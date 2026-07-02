@echo off
chcp 65001 >nul
title MoreAgentsTogether - 多Agent协作系统

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   MoreAgentsTogether - 多Agent协作系统       ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js！
    echo  请先安装 Node.js (v18+): https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [1/3] Node.js 版本:
node --version

:: Install dependencies
echo.
echo  [2/3] 安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo  [错误] 依赖安装失败！
    pause
    exit /b 1
)

:: Build frontend
echo.
echo  [3/3] 构建前端...
cd apps\web
call npx vite build
cd ..\..
if %errorlevel% neq 0 (
    echo  [警告] 前端构建失败，尝试使用开发模式...
    call npm run dev
    exit /b 0
)

:: Start server (serves both API and frontend on port 3001)
echo.
echo  启动服务...
echo.
cd apps\server
call npx ts-node -r reflect-metadata src/main.ts

pause
