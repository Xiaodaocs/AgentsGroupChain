// ============================================================
// Model Provider Types
// ============================================================
export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'gemini'
  | 'ollama'
  | 'deepseek'
  | 'openrouter'
  | 'mistral'
  | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  contextWindow: number;
  inputCostPer1M: number;   // USD per 1M tokens
  outputCostPer1M: number;
  isFree: boolean;
  capabilities: string[];   // e.g. ['chat', 'vision', 'function-calling']
}

export interface ModelProviderConfig {
  id: string;
  provider: ModelProvider;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  rateLimitRPM: number;
  rateLimitRPD: number;
  defaultModel?: string;
  models: ModelInfo[];
}

// ============================================================
// Agent Types
// ============================================================
export type AgentStatus = 'active' | 'inactive' | 'error';

export interface RoleDefinition {
  role: string;
  goal: string;
  constraints: string[];
  expertise: string[];
}

export interface AgentModelConfig {
  provider: ModelProvider;
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentBehavior {
  maxRetries: number;
  timeout: number;
  enableMemory: boolean;
  maxMemoryItems: number;
  enableSelfReflection: boolean;
  reflectionPrompt?: string;
}

export interface AgentCostConfig {
  tokenBudget: number;
  costBudget: number;
  priority: 'low' | 'medium' | 'high';
}

export interface AgentCollaboration {
  canDelegateTo: string[];
  canReceiveFrom: string[];
  maxConcurrency: number;
  outputFormat?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  tags: string[];
  systemPrompt: string;
  roleDefinition: RoleDefinition;
  model: AgentModelConfig;
  tools: ToolConfig[];
  behavior: AgentBehavior;
  cost: AgentCostConfig;
  collaboration: AgentCollaboration;
  status: AgentStatus;
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Task Types
// ============================================================
export type TaskType = 'decompose' | 'execute' | 'aggregate' | 'validate';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export interface TaskInput {
  description: string;
  context?: Record<string, any>;
  dependencies?: Record<string, any>;  // outputs from dependency tasks
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Task {
  id: string;
  sessionId: string;
  parentTaskId?: string;
  name: string;
  description: string;
  type: TaskType;
  input: TaskInput;
  expectedOutput?: string;
  actualOutput?: any;
  assignedAgentId: string;
  fallbackAgentId?: string;
  dependsOn: string[];
  status: TaskStatus;
  progress: number;
  attempt: number;
  maxAttempts: number;
  timeout: number;
  tokensUsed?: TokenUsage;
  estimatedCost: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Session Types
// ============================================================
export type SessionStatus = 'active' | 'completed' | 'archived';

export interface Session {
  id: string;
  title: string;
  userId?: string;
  status: SessionStatus;
  totalCost: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Message Types
// ============================================================
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  sessionId: string;
  taskId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  role: MessageRole;
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
  metadata?: Record<string, any>;
  createdAt: string;
}

// ============================================================
// Cost Types
// ============================================================
export interface CostRecord {
  id: string;
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  provider: ModelProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
}

export interface CostSummary {
  totalCostToday: number;
  totalCostThisMonth: number;
  totalTokensToday: number;
  costByProvider: Record<string, number>;
  costByAgent: Record<string, number>;
  costByModel: Record<string, number>;
}

// ============================================================
// Agent Template Types
// ============================================================
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  systemPrompt: string;
  roleDefinition: RoleDefinition;
  recommendedModels: { provider: ModelProvider; modelId: string; reason: string }[];
  defaultTools: ToolConfig[];
  tags: string[];
}

// ============================================================
// WebSocket Event Types
// ============================================================
export interface WSTaskCreated { task: Task }
export interface WSTaskStarted { taskId: string; agentId: string }
export interface WSTaskProgress { taskId: string; progress: number; status: TaskStatus }
export interface WSTaskCompleted { taskId: string; output: any; durationMs: number }
export interface WSTaskFailed { taskId: string; error: string; willRetry: boolean }
export interface WSAgentMessage { taskId: string; agentId: string; content: string; type: 'thinking' | 'tool_call' | 'response' }
export interface WSSessionResult { sessionId: string; aggregatedResult: string }
export interface WSCostUpdate { sessionId: string; currentCost: number; tokenCount: number }

// ============================================================
// API Response Types
// ============================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
