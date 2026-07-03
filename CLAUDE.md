# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Start both server (3001) and web (3000) concurrently
npm run dev:server     # Server only (NestJS, port 3001)
npm run dev:web        # Frontend only (Vite, port 3000)
npm run build          # Build all workspaces
npm install            # Install all workspace deps from root
```

DB: `apps/server/data/multiagent.db` (sql.js/WASM). Reset: delete .db + restart.

## Architecture

npm workspaces monorepo: `apps/server` (NestJS 10) + `apps/web` (React 18 + Ant Design 5) + `packages/shared`.

### Dispatcher-Only Architecture (核心)

**分配者 (Dispatcher) 是用户与AI的唯一通道。** 没有其他硬编码的Agent角色 -- 分配者动态决定一切。

```
POST /api/orchestrator/chat { sessionId, message, taskType? }
  │
  ├─ 1. 找到分配者Agent (tags包含"planning"/"management"，否则第一个Agent)
  ├─ 2. 验证所有Agent model配置 (缺失provider时回退到dashscope-coding/qwen3.7-plus)
  ├─ 3. 分类任务类型 (auto/question/simple/build)
  │
  ├─ [question/simple] → 分配者直接回答，无子Agent
  │
  └─ [build] → 分配者全流程编排:
       ├─ dispatcherPlan()    → 分析需求，选择Agent，决定并行/串行
       ├─ DAGBuilder.build()  → 构建有向无环图
       ├─ 逐层执行:
       │   ├─ 分配者分配任务 → 事件: task:assigned
       │   ├─ Worker Agent调用LLM → 事件: agent:thinking
       │   ├─ Worker完成 → 事件: task:completed
       │   └─ [reviewEnabled] 分配者审查:
       │       ├─ 通过 → 继续
       │       └─ 不通过 → 要求Agent修改重提交
       └─ dispatcherSummarize() → 分配者撰写详细报告
```

关键: `OrchestratorService` 是唯一的编排服务，不再依赖 TaskPlannerService/TaskExecutorService/ResultAggregatorService。所有逻辑（规划、执行、审查、总结）都内联在 orchestrator.service.ts 中。

### 10个预设Agent (首次启动自动种子, 全部 qwen3.7-plus)

| Agent | 标签 | 角色 |
|-------|------|------|
| **项目规划师** | planning, management, dispatcher | 分配者本体 |
| **前端开发** | frontend, react, ui, css | React/TS前端 |
| **后端开发** | backend, api, server, nodejs | API开发 |
| **数据库专家** | database, sql, schema, orm | 数据建模 |
| **测试工程师** | testing, qa, debugging | 测试/Bug查找 |
| **文档编写** | documentation, writing, readme | 技术文档 |
| **安全审查** | security, audit, vulnerability | 安全漏洞检测 |
| **数据分析师** | analysis, data, statistics, report | 数据分析 |
| **UI/UX设计** | design, ui, ux, interaction | 界面设计 |
| **DevOps工程师** | devops, docker, ci-cd | 部署/运维 |

种子逻辑在 `modules/agents/agent-preset.service.ts` (`AgentPresetService.onModuleInit`)。只有数据库为空时才种子。

### Session 实体字段

```typescript
SessionEntity {
  taskType: string;       // auto | question | simple | build
  projectRoot: string;    // 本地项目目录 (Agent可读写文件)
  reviewEnabled: number;  // 1=分配者逐步审查, 0=跳过审查
}
```

### LLM Gateway (8 providers, 2 SDK protocols)

- **OpenAI SDK**: `openai`, `groq`, `deepseek`, `openrouter`, `mistral`, `custom` (不同 `baseURL`)
- **Anthropic SDK**: `anthropic`, `dashscope-coding` (Anthropic协议)
- **Google GenAI SDK**: `gemini`
- **直接HTTP**: `ollama`

### Server Modules

- **OrchestratorModule** -- 唯一编排服务 (orchestrator.service.ts + dag-builder.service.ts)
- **LLMGatewayModule** -- LLM网关 + 费用追踪 + 限流 + 缓存
- **SessionsModule** -- 会话/消息 CRUD + projectRoot/review 设置
- **AgentsModule** -- Agent CRUD + 预设种子 (agent-preset.service.ts)
- **TemplatesModule** -- Agent模板 (旧版，保留)
- **ModelProviderModule** -- 提供商配置 CRUD
- **ToolsModule** -- FileSystemService (Agent读写本地文件)
- **CostsModule**, **WebSocketModule**, **HealthModule**

### Key Patterns

- **JSON text columns**: `roleDefinition`, `modelConfig`, `tools`, `behavior`, `dependsOn`, `input` 等存为JSON字符串
- **Provider fallback**: orchestrator 启动时检查所有Agent的model配置，缺失provider自动回退 `dashscope-coding/qwen3.7-plus`
- **Review gate**: `reviewEnabled=1` 时，每个Agent完成后分配者LLM审查输出，不通过则要求修改重交
- **DAG parallel**: `topologicalLevels()` 分组，同层 `Promise.all` 并行
- **Dual Axios**: `api` (30s) + `longApi` (10min) for LLM calls
- **Single WS channel**: `orchestrator:event` 广播所有事件
- **FileSystemService**: 路径安全检查 (`resolveSafePath`)，防目录穿越，1MB文件限制

### Frontend

Routes: `/chat` (default), `/agents`, `/agents/new`, `/agents/:id/edit`, `/tasks`, `/costs`, `/settings`.

Chat页面特性:
- 任务类型选择器 (自动/提问/简单/大型构建)
- 逐步审查开关 (Switch组件)
- 项目目录设置 (Modal弹窗)
- React Flow 协作思维导图 (实时更新节点状态)
- Timeline 通信日志 (6种事件类型)
- 页面刷新后从DB恢复任务图和消息

### WebSocket Events

通过 `orchestrator:event` 频道广播:
- `session:classified` -- 任务类型分类结果
- `task:assigned` -- 分配者分配任务给Agent
- `agent:thinking` -- Agent正在调用LLM
- `agent:receive` -- Agent接收上游输出
- `task:completed` -- Agent完成 (含output/outputPreview)
- `task:failed` -- Agent失败
- `parallel:start` -- 多个Agent并行启动
- `session:result` -- 最终结果

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /orchestrator/chat | 发消息 (body: sessionId, message, taskType?) |
| PUT | /sessions/:id/project | 设置项目目录 |
| PUT | /sessions/:id/review | 设置审查开关 |
| POST | /agents/:id/test | 测试Agent |
| GET | /providers | 提供商列表 |
| POST | /providers/test | 测试连接 |

## Current Context

### 已配置模型

- **Provider**: `dashscope-coding` (阿里云百炼 Coding Plan)
- **Endpoint**: `https://coding.dashscope.aliyuncs.com/apps/anthropic` (Anthropic协议)
- **Models**: `qwen3.7-plus`, `qwen3.5-plus`, `qwen3-coder-plus` -- 全免费
- **API Key**: 已在系统配置 (sk-sp-****)

### 关键设计决策

1. **sql.js** -- 避免Windows上better-sqlite3 native编译失败
2. **dashscope-coding 走 Anthropic SDK** -- 端点是Anthropic协议
3. **三层10分钟超时** -- Axios longApi + Vite proxy + Express server
4. **分配者唯一中枢** -- 理解需求、分配Agent、审查每步、总结汇报
5. **Agent model防御** -- 缺失provider自动回退，不会crash
6. **10个预设Agent** -- 首次启动自动种子，全部qwen3.7-plus
