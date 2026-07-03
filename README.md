# 🤖 Agent Group Chain (AGC) — 多Agent协作系统

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 用户输入提示词 → Master Agent 智能分解 → 多Agent并行协作 → 实时可视化监控 → 结果汇总

一个开源的多Agent协作平台。用户只需描述需求，系统自动将任务分解并分配给多个专业Agent（前端、后端、测试、文档等）并行执行，全程实时可视化监控Agent之间的协作过程。

## ✨ 核心特性

- **🧠 智能任务分解** — Master Agent 自动分析需求，决定哪些Agent上场、工作顺序、并行还是串行
- **👁️ 实时协作可视化** — React Flow 思维导图，实时展示 Agent 之间的数据传递和协作状态
- **🔀 并行执行** — 无依赖的任务自动并行启动，最大化效率
- **🔍 逐步审查** — Master Agent 审查每个Agent的输出质量，不通过则要求重做（可关闭）
- **🌐 多模型支持** — 8个LLM提供商，支持免费模型（Groq、Gemini、Ollama等）
- **💰 费用追踪** — 精确统计每个Agent、每次任务的费用消耗
- **📂 本地文件操作** — Agent可直接读写本地项目文件（可开关权限限制）
- **🔗 全链路上下文** — Master Agent 掌握所有Agent的工作记录，用户随时可问

## 🚀 快速启动

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- 无需数据库（内置 SQLite WASM）
- 无需 Docker

### 一键启动

**Windows:**
```bash
双击 start.bat
```

**Mac/Linux:**
```bash
chmod +x start.sh && ./start.sh
```

### 手动启动

```bash
git clone https://github.com/Xiaodaocs/AgentsGroupChain.git
cd AgentsGroupChain
npm install
npm run dev
```

启动后打开浏览器访问 **http://localhost:3001**

## ⚙️ 首次配置

### 1. 配置模型提供商

打开 **设置** 页面，启用至少一个LLM提供商并填入API Key：

| 提供商 | 免费额度 | 获取方式 |
|--------|---------|---------|
| **Groq** | 14,400请求/天 | [console.groq.com](https://console.groq.com) |
| **Google Gemini** | 1,500请求/天 | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenRouter** | 28+免费模型 | [openrouter.ai](https://openrouter.ai) |
| **Ollama** | 完全免费（本地） | [ollama.com](https://ollama.com) |
| **DeepSeek** | 极低费用 | [platform.deepseek.com](https://platform.deepseek.com) |
| **Mistral** | ~10亿tokens/月 | [console.mistral.ai](https://console.mistral.ai) |

### 2. 创建Agent

进入 **Agent管理** → 创建Agent → 选择模型 → 保存

系统预置10个专业Agent模板：项目规划师、前端开发、后端开发、数据库专家、测试工程师、文档编写、安全审查、数据分析师、UI/UX设计师、DevOps工程师。

### 3. 开始对话

进入 **对话** 页面，选择任务类型，输入需求即可！

## 📐 架构

```
┌──────────────────────────────────────────────────────┐
│  React 18 + Ant Design 5 + React Flow                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ 对话面板│ │Agent管理│ │任务监控│ │  设置   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
└──────────────────────┬───────────────────────────────┘
                       │ REST + WebSocket (Socket.IO)
┌──────────────────────┴───────────────────────────────┐
│  NestJS 10 + TypeORM + SQLite (sql.js)               │
│  ┌─────────────────────────────────────────────┐     │
│  │         Orchestrator (编排引擎)                │     │
│  │  Dispatcher → DAG → Executor → Reviewer      │     │
│  └─────────────────────────────────────────────┘     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ LLM网关   │ │ Agent管理 │ │ 费用追踪  │             │
│  │ (8提供商) │ │ (CRUD)   │ │          │             │
│  └──────────┘ └──────────┘ └──────────┘             │
└──────────────────────────────────────────────────────┘
```

## 🏗️ 项目结构

```
MoreAgentsTogether/
├── apps/
│   ├── server/           # NestJS 后端 (端口 3001)
│   └── web/              # React 前端
├── packages/
│   └── shared/           # 共享 TypeScript 类型
├── start.bat             # Windows 一键启动
├── start.sh              # Mac/Linux 一键启动
└── package.json          # npm workspaces 根配置
```

## 💡 使用示例

**简单提问：**
> "Python 的装饰器是什么？"
> → 自动识别为「提问」，Master Agent 直接回答

**简单任务：**
> "帮我写一个快速排序函数"
> → 自动识别为「简单任务」，分配给代码专家完成

**大型构建：**
> "帮我开发一个像素风双人对战游戏，包含注册登录、在线对战、自定义键位"
> → 自动识别为「大型构建」
> → Master Agent 分解为：架构设计 → 前端+后端+数据库并行 → 测试 → 文档
> → 全程可视化监控，审查每步质量

## 🔧 开发

```bash
npm run dev              # 开发模式（前后端热重载）
npm run dev:server       # 仅后端
npm run dev:web          # 仅前端
npm run build            # 生产构建
```

## 📄 License

MIT
