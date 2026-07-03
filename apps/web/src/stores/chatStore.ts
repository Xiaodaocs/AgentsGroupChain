import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TaskInfo {
  id: string;
  name: string;
  description?: string;
  status: string;
  progress: number;
  output?: string;
  outputPreview?: string;
  error?: string;
  durationMs?: number;
  assignedAgentId?: string;
  agentName?: string;
  modelId?: string;
  provider?: string;
  dependsOn?: string[];
  tokensUsed?: { totalTokens: number };
  estimatedCost?: number;
}

interface CommEvent {
  type: string;
  taskId?: string;
  agentId?: string;
  agentName?: string;
  modelId?: string;
  provider?: string;
  taskName?: string;
  taskDescription?: string;
  message?: string;
  output?: string;
  outputPreview?: string;
  fromAgents?: { agentName: string; taskName: string; outputPreview: string }[];
  durationMs?: number;
  tokensUsed?: any;
  estimatedCost?: number;
  error?: string;
  timestamp: number;
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
  label?: string;
  labelStyle?: any;
}

interface SessionState {
  messages: any[];
  tasks: TaskInfo[];
  flowNodes: any[];
  flowEdges: any[];
  commEvents: CommEvent[];
  projectRoot: string;
  reviewEnabled: boolean;
  isLoading: boolean;
}

interface ChatStore {
  currentSession: string | null;
  sessionStates: Record<string, SessionState>;
  sessions: any[];
  agents: any[];
  showFlow: boolean;
  flowFullscreen: boolean;
  taskType: string;

  // Actions
  setCurrentSession: (sessionId: string | null) => void;
  setSessions: (sessions: any[]) => void;
  setAgents: (agents: any[]) => void;
  setShowFlow: (show: boolean) => void;
  setFlowFullscreen: (fullscreen: boolean) => void;
  setTaskType: (type: string) => void;

  // Session state actions
  getSessionState: (sessionId: string) => SessionState;
  setSessionState: (sessionId: string, updates: Partial<SessionState>) => void;
  clearSessionState: (sessionId: string) => void;
}

export const defaultSessionState: SessionState = {
  messages: [],
  tasks: [],
  flowNodes: [],
  flowEdges: [],
  commEvents: [],
  projectRoot: '',
  reviewEnabled: true,
  isLoading: false,
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessionStates: {},
      sessions: [],
      agents: [],
      showFlow: true,
      flowFullscreen: false,
      taskType: 'auto',

      setCurrentSession: (sessionId) => set({ currentSession: sessionId }),
      setSessions: (sessions) => set({ sessions }),
      setAgents: (agents) => set({ agents }),
      setShowFlow: (show) => set({ showFlow: show }),
      setFlowFullscreen: (fullscreen) => set({ flowFullscreen: fullscreen }),
      setTaskType: (type) => set({ taskType: type }),

      getSessionState: (sessionId) => {
        const state = get().sessionStates[sessionId];
        return state || defaultSessionState;
      },

      setSessionState: (sessionId, updates) => {
        set((state) => {
          const currentState = state.sessionStates[sessionId] || defaultSessionState;
          return {
            sessionStates: {
              ...state.sessionStates,
              [sessionId]: { ...currentState, ...updates },
            },
          };
        });
      },

      clearSessionState: (sessionId) => {
        set((state) => {
          const newStates = { ...state.sessionStates };
          delete newStates[sessionId];
          return { sessionStates: newStates };
        });
      },
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        currentSession: state.currentSession,
        sessionStates: state.sessionStates,
        sessions: state.sessions,
        showFlow: state.showFlow,
        taskType: state.taskType,
      }),
    }
  )
);
