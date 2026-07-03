#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Agent Group Chain (AGC)                    ║"
echo "║   Multi-Agent Collaboration System           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Get the directory where this script is located
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js！"
    echo "请先安装 Node.js (v18+): https://nodejs.org"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# Install dependencies
echo "📦 [1/3] 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败！"
    read -p "按回车键退出..."
    exit 1
fi
echo "依赖安装完成。"
echo ""

# Build frontend
echo "🔨 [2/3] 构建前端..."
cd "$ROOT_DIR/apps/web"
"$ROOT_DIR/node_modules/.bin/vite" build
if [ $? -ne 0 ]; then
    echo "⚠️  前端构建失败，尝试使用开发模式..."
    cd "$ROOT_DIR"
    npm run dev
    exit 0
fi
echo "前端构建完成。"
echo ""

# Start server
echo "🚀 [3/3] 启动服务..."
echo ""
cd "$ROOT_DIR/apps/server"
NODE_PATH="$ROOT_DIR/node_modules:$ROOT_DIR/apps/server/node_modules" \
  node -r ts-node/register -r reflect-metadata src/main.ts
