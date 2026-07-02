#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   MoreAgentsTogether - 多Agent协作系统       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js！"
    echo "请先安装 Node.js (v18+): https://nodejs.org"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# Install dependencies
echo ""
echo "📦 [1/3] 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败！"
    read -p "按回车键退出..."
    exit 1
fi

# Build frontend
echo ""
echo "🔨 [2/3] 构建前端..."
cd apps/web
npx vite build
cd ../..
if [ $? -ne 0 ]; then
    echo "⚠️  前端构建失败，尝试使用开发模式..."
    npm run dev
    exit 0
fi

# Start server (serves both API and frontend on port 3001)
echo ""
echo "🚀 [3/3] 启动服务..."
echo ""
cd apps/server
npx ts-node -r reflect-metadata src/main.ts
