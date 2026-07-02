import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card, Input, Button, List, Tag, Space, Typography, Spin, Avatar,
  Empty, message as antMessage, Badge, Drawer, Timeline, Tooltip,
  Radio, Modal, Switch, Popconfirm,
} from 'antd';
import {
  SendOutlined, PlusOutlined, RobotOutlined, UserOutlined,
  CheckCircleOutlined, SyncOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ApartmentOutlined, SwapOutlined,
  BulbOutlined, FileTextOutlined, EyeOutlined,
  ThunderboltOutlined, QuestionCircleOutlined,
  CodeOutlined, BuildOutlined, FolderOutlined, DeleteOutlined,
  FullscreenOutlined, FullscreenExitOutlined, CompressOutlined, ExpandOutlined,
  StopOutlined, EditOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  Node, Edge, Controls, Background, useNodesState, useEdgesState,
  Position, MarkerType, Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { sessionsApi, orchestratorApi, agentsApi } from '../services/api';
import { useChatStore, defaultSessionState } from '../stores/chatStore';
import { wsService } from '../services/websocket';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ── Types ──
interface TaskInfo {
  id: string; name: string; description?: string; status: string;
  progress: number; output?: string; outputPreview?: string; error?: string;
  durationMs?: number; assignedAgentId?: string; agentName?: string;
  modelId?: string; provider?: string; dependsOn?: string[];
  tokensUsed?: { totalTokens: number }; estimatedCost?: number;
}

interface CommEvent {
  type: string; taskId?: string; agentId?: string; agentName?: string;
  modelId?: string; provider?: string; taskName?: string; taskDescription?: string;
  message?: string; output?: string; outputPreview?: string;
  fromAgents?: { agentName: string; taskName: string; outputPreview: string }[];
  durationMs?: number; tokensUsed?: any; estimatedCost?: number;
  error?: string; timestamp: number;
}

// ── Custom Flow Node ──
const AgentTaskNode: React.FC<{ data: any }> = ({ data }) => {
  const colors: Record<string, string> = { pending: '#d9d9d9', running: '#1890ff', completed: '#52c41a', failed: '#ff4d4f' };
  const c = colors[data.status] || '#d9d9d9';
  return (
    <div style={{ background: '#fff', border: `2px solid ${c}`, borderRadius: 12, padding: '10px 14px', minWidth: 200, maxWidth: 280, boxShadow: data.status === 'running' ? `0 0 16px ${c}50` : '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.3s' }}>
      <Handle type="target" position={Position.Top} style={{ background: c }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Avatar size={22} style={{ backgroundColor: '#6366f1', fontSize: 12 }} icon={<RobotOutlined />} />
        <Text strong style={{ fontSize: 11, flex: 1 }} ellipsis>{data.agentName || 'Agent'}</Text>
        {data.status === 'running' ? <SyncOutlined spin style={{ color: '#1890ff' }} /> : data.status === 'completed' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : data.status === 'failed' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <ClockCircleOutlined style={{ color: '#d9d9d9' }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{data.taskName || data.name}</div>
      {data.modelId && <Tag style={{ fontSize: 9, padding: '0 4px' }} color="purple">{data.modelId}</Tag>}
      {data.outputPreview && <div style={{ fontSize: 10, color: '#666', background: '#f9f9f9', borderRadius: 4, padding: '3px 5px', marginTop: 4, maxHeight: 50, overflow: 'hidden', lineHeight: 1.3 }}>{data.outputPreview}</div>}
      {data.durationMs != null && <div style={{ fontSize: 9, color: '#999', marginTop: 3 }}>{(data.durationMs / 1000).toFixed(1)}s{data.tokensUsed?.totalTokens ? ` · ${data.tokensUsed.totalTokens}tok` : ''}</div>}
      {data.error && <div style={{ fontSize: 10, color: '#ff4d4f', marginTop: 3 }}>{data.error}</div>}
      {data.thinking && <div style={{ fontSize: 10, color: '#1890ff', marginTop: 3, fontStyle: 'italic' }}><BulbOutlined /> {data.thinking}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: c }} />
    </div>
  );
};

const nodeTypeMap = { agentTask: AgentTaskNode };

const taskTypeConfig = [
  { value: 'auto', label: '自动判断', icon: <ThunderboltOutlined />, desc: '系统自动识别任务类型' },
  { value: 'question', label: '提问', icon: <QuestionCircleOutlined />, desc: '知识问答，单Agent直接回答' },
  { value: 'simple', label: '简单任务', icon: <CodeOutlined />, desc: '单个Agent即可完成' },
  { value: 'build', label: '大型构建', icon: <BuildOutlined />, desc: '多Agent协作完成' },
];

// ── Build flow nodes/edges from task graph (pure function) ──
function buildFlowData(nodes: any[], edges: any[]) {
  const nodeW = 240;
  const nodeH = 120;
  const gapX = 60;
  const gapY = 80;

  // Topological layering: assign each node to a layer
  const layerOf: Record<string, number> = {};
  const depsMap: Record<string, string[]> = {};
  nodes.forEach((n: any) => { depsMap[n.id] = n.dependsOn || []; });

  // Layer 0: nodes with no dependencies
  const assigned = new Set<string>();
  let currentLayer = [nodes.filter((n: any) => !depsMap[n.id] || depsMap[n.id].length === 0).map((n: any) => n.id)].flat();
  let layerIdx = 0;

  while (currentLayer.length > 0) {
    currentLayer.forEach(id => { layerOf[id] = layerIdx; assigned.add(id); });
    layerIdx++;
    currentLayer = nodes
      .filter((n: any) => !assigned.has(n.id))
      .filter((n: any) => depsMap[n.id].every((dep: string) => assigned.has(dep)))
      .map((n: any) => n.id);
  }
  // Any unassigned nodes (circular deps) go to last layer
  nodes.forEach((n: any) => { if (!assigned.has(n.id)) { layerOf[n.id] = layerIdx; } });

  // Group nodes by layer
  const layers: string[][] = [];
  for (let i = 0; i <= layerIdx; i++) {
    layers.push(nodes.filter((n: any) => layerOf[n.id] === i).map((n: any) => n.id));
  }

  // Position: user request at top center, tasks layered below
  const allLayerWidths = layers.map(l => l.length * nodeW + (l.length - 1) * gapX);
  const maxWidth = Math.max(...allLayerWidths, nodeW);

  // User request node at top
  const fNodes: Node[] = [{
    id: 'user-request', type: 'agentTask',
    position: { x: maxWidth / 2 - nodeW / 2, y: 0 },
    data: { taskName: '用户请求', agentName: 'You', status: 'completed' },
  }];

  // Task nodes in layers
  layers.forEach((layer, li) => {
    const layerWidth = layer.length * nodeW + (layer.length - 1) * gapX;
    const startX = (maxWidth - layerWidth) / 2;
    layer.forEach((nodeId, ni) => {
      const node = nodes.find((n: any) => n.id === nodeId);
      fNodes.push({
        id: nodeId, type: 'agentTask',
        position: { x: startX + ni * (nodeW + gapX), y: (li + 1) * (nodeH + gapY) },
        data: { taskName: node.name, agentName: node.agentName || '待分配...', status: node.status || 'pending' },
      });
    });
  });

  // Build edges
  const fEdges: Edge[] = [];
  nodes.forEach((n: any) => {
    if (!n.dependsOn || n.dependsOn.length === 0) {
      fEdges.push({ id: `u-${n.id}`, source: 'user-request', target: n.id, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }, label: '分配', labelStyle: { fontSize: 9, fill: '#6366f1' } });
    }
  });
  nodes.forEach((n: any) => (n.dependsOn || []).forEach((depId: string) => {
    fEdges.push({ id: `${depId}-${n.id}`, source: depId, target: n.id, animated: true, style: { stroke: '#87d068', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#87d068' }, label: '传递结果', labelStyle: { fontSize: 9, fill: '#87d068' } });
  }));
  return { nodes: fNodes, edges: fEdges };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const Chat: React.FC = () => {
  // Global store (persists across navigation)
  const store = useChatStore();
  const currentSession = store.currentSession;
  const sessions = store.sessions;
  const agents = store.agents;
  const showFlow = store.showFlow;
  const flowFullscreen = store.flowFullscreen;
  const taskType = store.taskType;

  // Per-session state from store
  const sessionState = currentSession ? store.getSessionState(currentSession) : defaultSessionState;
  const messages = sessionState.messages;
  const tasks = sessionState.tasks;
  const commEvents = sessionState.commEvents;
  const projectRoot = sessionState.projectRoot;
  const reviewEnabled = sessionState.reviewEnabled;
  const isLoading = sessionState.isLoading;

  // Ref to always read latest session state (fixes stale closure in useEffect)
  const getLatestState = () => currentSession ? store.getSessionState(currentSession) : defaultSessionState;

  // Update helpers — always read from store, never from stale closures
  const updateSession = (updates: Partial<typeof defaultSessionState>) => {
    if (currentSession) store.setSessionState(currentSession, updates);
  };
  const setMessages = (val: any) => {
    if (typeof val === 'function') {
      updateSession({ messages: val(getLatestState().messages) });
    } else {
      updateSession({ messages: val });
    }
  };
  const setTasks = (val: any) => {
    if (typeof val === 'function') {
      updateSession({ tasks: val(getLatestState().tasks) });
    } else {
      updateSession({ tasks: val });
    }
  };
  const setCommEvents = (val: any) => {
    if (typeof val === 'function') {
      updateSession({ commEvents: val(getLatestState().commEvents) });
    } else {
      updateSession({ commEvents: val });
    }
  };
  const setProjectRoot = (r: string) => updateSession({ projectRoot: r });
  const setReviewEnabled = (v: boolean) => updateSession({ reviewEnabled: v });
  const setIsLoading = (v: boolean) => updateSession({ isLoading: v });

  // Stable refs so useEffect([]) always calls the latest function
  const currentSessionRef = useRef(currentSession);
  currentSessionRef.current = currentSession;
  const setCommEventsRef = useRef(setCommEvents);
  setCommEventsRef.current = setCommEvents;
  const setTasksRef = useRef(setTasks);
  setTasksRef.current = setTasks;
  const setIsLoadingRef = useRef(setIsLoading);
  setIsLoadingRef.current = setIsLoading;
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  // Flow state from store (persist nodes/edges)
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(sessionState.flowNodes || []);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(sessionState.flowEdges || []);

  // Sync flow state to store on change
  useEffect(() => { if (currentSession) store.setSessionState(currentSession, { flowNodes, flowEdges }); }, [flowNodes, flowEdges]);
  // Load flow state from store on session change OR initial mount with persisted data
  useEffect(() => {
    if (currentSession) {
      const ss = store.getSessionState(currentSession);
      if (ss.flowNodes?.length > 0) setFlowNodes(ss.flowNodes);
      if (ss.flowEdges?.length > 0) setFlowEdges(ss.flowEdges);
    }
  }, [currentSession]);

  // Local UI state (doesn't need to persist)
  const [inputValue, setInputValue] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Helper to set flow from task graph ──
  const setFlowFromGraph = (nodes: any[], edges: any[]) => {
    const { nodes: fn, edges: fe } = buildFlowData(nodes, edges);
    setFlowNodes(fn);
    setFlowEdges(fe);
  };

  // ── WebSocket: register handlers ONCE ──
  useEffect(() => {
    wsService.connect();

    const onEvent = async (data: any) => {
      setCommEventsRef.current((prev: any[]) => [...prev, { ...data, timestamp: Date.now() }]);
      setTimeout(() => { if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight; }, 50);

      switch (data.type) {
        case 'task:created':
          setFlowFromGraph(data.nodes, data.edges);
          break;
        case 'task:assigned':
        case 'agent:thinking':
          setFlowNodes(prev => prev.map(n => n.id !== data.taskId ? n : { ...n, data: { ...n.data, status: 'running', agentName: data.agentName || n.data.agentName, modelId: data.modelId || n.data.modelId, thinking: data.type === 'agent:thinking' ? '分析中...' : undefined } }));
          setTasksRef.current((prev: any[]) => {
            const i = prev.findIndex((t: any) => t.id === data.taskId);
            const u = { id: data.taskId, name: data.taskName || '', status: 'running', progress: 20, agentName: data.agentName, modelId: data.modelId };
            return i >= 0 ? prev.map((t: any) => t.id === data.taskId ? { ...t, ...u } : t) : [...prev, u as TaskInfo];
          });
          break;
        case 'task:completed':
          setFlowNodes(prev => prev.map(n => n.id !== data.taskId ? n : { ...n, data: { ...n.data, status: 'completed', agentName: data.agentName || n.data.agentName, outputPreview: data.outputPreview, durationMs: data.durationMs, tokensUsed: data.tokensUsed, thinking: undefined } }));
          setFlowEdges(prev => prev.map(e => e.target === data.taskId ? { ...e, animated: false, style: { ...e.style, opacity: 0.5 } } : e));
          setTasksRef.current((prev: any[]) => prev.map((t: any) => t.id === data.taskId ? { ...t, status: 'completed', progress: 100, output: data.output, outputPreview: data.outputPreview, durationMs: data.durationMs, tokensUsed: data.tokensUsed, agentName: data.agentName } : t));
          break;
        case 'task:failed':
          setFlowNodes(prev => prev.map(n => n.id !== data.taskId ? n : { ...n, data: { ...n.data, status: 'failed', error: data.error, thinking: undefined } }));
          setTasksRef.current((prev: any[]) => prev.map((t: any) => t.id === data.taskId ? { ...t, status: 'failed', error: data.error } : t));
          break;
        case 'parallel:start':
          setFlowNodes(prev => prev.map(n => data.taskIds?.includes(n.id) ? { ...n, data: { ...n.data, status: 'running', thinking: '并行执行中...' } } : n));
          break;
        case 'session:result':
          setIsLoadingRef.current(false);
          // Reload messages to show the final summary
          try {
            const [msgs, tasks] = await Promise.all([
              sessionsApi.messages(currentSessionRef.current || ''),
              orchestratorApi.sessionTasks(currentSessionRef.current || ''),
            ]);
            setMessagesRef.current(msgs);
            setTasksRef.current(tasks.map((x: any) => ({ ...x, progress: x.progress || 0, output: x.actualOutput })));
          } catch {}
          break;
        case 'session:cancelled':
          setIsLoadingRef.current(false);
          setMessagesRef.current((p: any[]) => [...p, { id: 'cancel-' + Date.now(), role: 'assistant', content: '⛔ 任务已被停止。', metadata: { type: 'cancelled' } }]);
          break;
      }
    };

    wsService.on('orchestrator:event', onEvent);
    wsService.on('session:result', onEvent);

    return () => {
      wsService.off('orchestrator:event', onEvent);
      wsService.off('session:result', onEvent);
    };
  }, []);

  // ── Load data ──
  useEffect(() => { loadSessions(); loadAgents(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSessions = async () => {
    try { const d = await sessionsApi.list(); store.setSessions(d); if (d.length > 0 && !currentSession) selectSession(d[0].id); } catch {}
  };
  const loadAgents = async () => { try { store.setAgents(await agentsApi.list()); } catch {} };

  const selectSession = async (sid: string) => {
    store.setCurrentSession(sid); setCommEvents([]); setSelectedTask(null);
    try {
      const [msgs, t] = await Promise.all([sessionsApi.messages(sid), orchestratorApi.sessionTasks(sid)]);
      setMessages(msgs);
      try { const sess = await sessionsApi.get(sid); setProjectRoot(sess.projectRoot || ''); setReviewEnabled(sess.reviewEnabled !== 0); } catch {}
      const loadedTasks = t.map((x: any) => ({ ...x, progress: x.progress || 0, output: x.actualOutput }));
      setTasks(loadedTasks);
      if (t.length > 0) {
        const ns = t.map((x: any) => ({ id: x.id, name: x.name, dependsOn: x.dependsOn || [], status: x.status, agentName: agents.find((a: any) => a.id === x.assignedAgentId)?.name }));
        setFlowFromGraph(ns, []);
        setFlowNodes(prev => prev.map(n => {
          const task = t.find((x: any) => x.id === n.id);
          if (!task || n.id === 'user-request') return n;
          return { ...n, data: { ...n.data, status: task.status, agentName: agents.find((a: any) => a.id === task.assignedAgentId)?.name || n.data.agentName, outputPreview: task.actualOutput ? (typeof task.actualOutput === 'string' ? task.actualOutput : JSON.stringify(task.actualOutput)).substring(0, 200) : undefined } };
        }));
      } else { setFlowNodes([]); setFlowEdges([]); }
    } catch (e) { console.error('selectSession error:', e); }
  };

  const createNewSession = async () => {
    try {
      const s = await sessionsApi.create('新会话', projectRoot || undefined);
      store.setSessions([s, ...sessions]); store.setCurrentSession(s.id);
      setMessages([]); setTasks([]); setFlowNodes([]); setFlowEdges([]); setCommEvents([]);
    } catch { antMessage.error('创建失败'); }
  };

  const stopSession = async () => {
    if (!currentSession) return;
    try {
      await orchestratorApi.cancelSession(currentSession);
      setIsLoading(false);
      antMessage.info('已发送停止指令');
    } catch { antMessage.error('停止失败'); }
  };

  const startRename = (sid: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingSessionId(sid);
    setRenameTitle(currentTitle);
  };

  const confirmRename = async () => {
    if (!renamingSessionId || !renameTitle.trim()) { setRenamingSessionId(null); return; }
    try {
      await sessionsApi.rename(renamingSessionId, renameTitle.trim());
      store.setSessions(sessions.map(s => s.id === renamingSessionId ? { ...s, title: renameTitle.trim() } : s));
      antMessage.success('已重命名');
    } catch { antMessage.error('重命名失败'); }
    setRenamingSessionId(null);
  };

  const deleteSession = async (sid: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      // Stop running tasks first
      try { await orchestratorApi.cancelSession(sid); } catch {}
      await sessionsApi.remove(sid); antMessage.success('已删除');
      const remaining = sessions.filter(s => s.id !== sid);
      store.setSessions(remaining);
      if (currentSession === sid) {
        store.setCurrentSession(null); setMessages([]); setTasks([]); setFlowNodes([]); setFlowEdges([]); setCommEvents([]);
        if (remaining.length > 0) selectSession(remaining[0].id);
      }
    } catch { antMessage.error('删除失败'); }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !currentSession || isLoading) return;
    const msg = inputValue.trim(); setInputValue(''); setIsLoadingRef.current(true); setCommEventsRef.current([]);
    setMessages((p: any[]) => [...p, { id: 'u' + Date.now(), role: 'user', content: msg }]);
    try {
      await orchestratorApi.chat(currentSession, msg, taskType !== 'auto' ? taskType : undefined);
      const [m2, t2] = await Promise.all([sessionsApi.messages(currentSession), orchestratorApi.sessionTasks(currentSession)]);
      setMessages(m2);
      setTasks(t2.map((x: any) => ({ ...x, progress: x.progress || 0, output: x.actualOutput })));
      loadSessions();
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || e?.message || '未知错误';
      if (!errMsg.includes('Connection') && !errMsg.includes('timeout') && !errMsg.includes('Network')) {
        antMessage.error(`失败: ${errMsg}`);
      }
      setMessages((p: any[]) => [...p, { id: 'e' + Date.now(), role: 'assistant', content: `执行出错: ${errMsg}`, metadata: { type: 'error' } }]);
    } finally { setIsLoadingRef.current(false); }
  };

  const getAgentName = (id: string) => agents.find(a => a.id === id)?.name || '';
  const eventColor = (type: string) => ({ 'task:assigned': '#6366f1', 'agent:thinking': '#1890ff', 'agent:receive': '#faad14', 'task:completed': '#52c41a', 'task:failed': '#ff4d4f', 'parallel:start': '#722ed1' } as any)[type] || '#d9d9d9';
  const eventIcon = (type: string) => { if (type === 'task:assigned') return <ThunderboltOutlined />; if (type === 'agent:thinking') return <BulbOutlined />; if (type === 'agent:receive') return <SwapOutlined />; if (type === 'task:completed') return <CheckCircleOutlined />; if (type === 'task:failed') return <CloseCircleOutlined />; if (type === 'parallel:start') return <ApartmentOutlined />; return <ClockCircleOutlined />; };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <div style={{ width: 180, borderRight: '1px solid #f0f0f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
          <Button type="primary" icon={<PlusOutlined />} block size="small" onClick={createNewSession}>新建会话</Button>
        </div>
        <List style={{ flex: 1, overflow: 'auto' }} dataSource={sessions} renderItem={(s: any) => (
          <List.Item style={{ cursor: 'pointer', padding: '4px 6px', background: currentSession === s.id ? '#f0f5ff' : 'transparent' }}
            onClick={() => selectSession(s.id)}
            actions={[
              renamingSessionId === s.id ? (
                <Space size={2} key="rename">
                  <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); confirmRename(); }} />
                  <CloseOutlined style={{ color: '#999', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setRenamingSessionId(null); }} />
                </Space>
              ) : (
                <Space size={2} key="actions">
                  <EditOutlined style={{ color: '#1890ff', fontSize: 11 }} onClick={(e) => startRename(s.id, s.title, e)} />
                  <Popconfirm title="删除此对话？" onConfirm={(e: any) => deleteSession(s.id, e)} onCancel={(e: any) => e?.stopPropagation()} okText="删除" cancelText="取消">
                    <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 12 }} onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>
                </Space>
              )
            ]}>
            {renamingSessionId === s.id ? (
              <Input size="small" value={renameTitle} onChange={e => setRenameTitle(e.target.value)}
                onPressEnter={() => confirmRename()} onClick={(e) => e.stopPropagation()}
                autoFocus style={{ fontSize: 12 }} />
            ) : (
              <Text ellipsis style={{ fontSize: 12 }} onDoubleClick={(e) => startRename(s.id, s.title, e as any)}>{s.title}</Text>
            )}
          </List.Item>
        )} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} />
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {messages.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <RobotOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
              <Title level={5} style={{ color: '#999', marginTop: 8 }}>开始对话</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>输入需求，系统自动分解任务给多Agent协作</Text>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', marginBottom: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 6 }}>
              <Avatar size={28} icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ backgroundColor: m.role === 'user' ? '#6366f1' : '#87d068', flexShrink: 0 }} />
              <div style={{ maxWidth: '70%' }}>
                {m.metadata?.agentName && <Tag color="blue" style={{ fontSize: 10, marginBottom: 2 }}>{m.metadata.agentName}</Tag>}
                <Card size="small" style={{ background: m.role === 'user' ? '#6366f1' : '#fff', border: m.role === 'user' ? 'none' : '1px solid #e8e8e8' }} bodyStyle={{ padding: '6px 10px' }}>
                  <div style={{ color: m.role === 'user' ? '#fff' : '#333', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                </Card>
              </div>
            </div>
          ))}
          {isLoading && <div style={{ textAlign: 'center', padding: 12 }}><Spin /> <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>Agent协作中...</Text></div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
          <Radio.Group value={taskType} onChange={e => store.setTaskType(e.target.value)} size="small" style={{ marginBottom: 6 }}>
            {taskTypeConfig.map(t => (
              <Radio.Button key={t.value} value={t.value}>
                <Tooltip title={t.desc}>{t.icon} {t.label}</Tooltip>
              </Radio.Button>
            ))}
          </Radio.Group>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Switch size="small" checked={reviewEnabled} onChange={async (checked) => { setReviewEnabled(checked); if (currentSession) { try { await sessionsApi.setReview(currentSession, checked); } catch {} } }} />
            <Text style={{ fontSize: 11 }}><EyeOutlined /> 逐步审查 {reviewEnabled ? '开启' : '关闭'}</Text>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextArea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="输入需求..." autoSize={{ minRows: 1, maxRows: 3 }}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }} disabled={isLoading} style={{ flex: 1 }} />
            <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} disabled={isLoading}>发送</Button>
          </div>
        </div>
      </div>

      {/* Right: Flow + Timeline */}
      {!showFlow && (
        <div style={{ width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, borderLeft: '1px solid #f0f0f0', background: '#fff' }}>
          <Tooltip title="展开监控面板" placement="left">
            <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#6366f1' }} />} onClick={() => store.setShowFlow(true)} style={{ writingMode: 'vertical-rl', height: 80 }} />
          </Tooltip>
        </div>
      )}
      <div style={{ width: showFlow ? (flowFullscreen ? '70%' : 440) : 0, flex: showFlow && flowFullscreen ? 1 : 'none', borderLeft: showFlow ? '1px solid #f0f0f0' : 'none', background: '#fafafa', display: showFlow ? 'flex' : 'none', flexDirection: 'column', transition: 'width 0.3s', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={4}>
            <EyeOutlined style={{ color: '#6366f1' }} />
            <Text strong style={{ fontSize: 12 }}>实时监控</Text>
            {tasks.filter(t => t.status === 'completed').length > 0 && <Badge count={`${tasks.filter(t => t.status === 'completed').length}/${tasks.length}`} style={{ backgroundColor: '#52c41a' }} />}
            {projectRoot && <Tooltip title={projectRoot}><Tag color="cyan" style={{ fontSize: 9, cursor: 'pointer' }} onClick={() => setProjectModalVisible(true)}><FolderOutlined /> {projectRoot.split(/[\\/]/).pop()}</Tag></Tooltip>}
            {!projectRoot && <Tag style={{ fontSize: 9, cursor: 'pointer' }} onClick={() => setProjectModalVisible(true)}><FolderOutlined /> 设置目录</Tag>}
          </Space>
          <Space size={2}>
            {isLoading && (
              <Tooltip title="停止所有任务">
                <Button type="text" size="small" danger icon={<StopOutlined />} onClick={stopSession}>停止</Button>
              </Tooltip>
            )}
            {showFlow && (
              <Tooltip title={flowFullscreen ? '退出全屏' : '全屏'}>
                <Button type="text" size="small" icon={flowFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => store.setFlowFullscreen(!flowFullscreen)} />
              </Tooltip>
            )}
            <Tooltip title={showFlow ? '收起面板' : '展开面板'}>
              <Button type="text" size="small" icon={showFlow ? <CompressOutlined /> : <ExpandOutlined />} onClick={() => { store.setShowFlow(!showFlow); if (showFlow) store.setFlowFullscreen(false); }} />
            </Tooltip>
          </Space>
        </div>

        {showFlow && (
          <>
            <div style={{ height: flowFullscreen ? '60%' : 280, borderBottom: '1px solid #f0f0f0' }}>
              {flowNodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#ccc' }}><ApartmentOutlined style={{ fontSize: 28 }} /><div style={{ fontSize: 11, marginTop: 6 }}>发送消息后显示协作图</div></div>
              ) : (
                <ReactFlow key={`${flowFullscreen}-${flowNodes.length}`} nodes={flowNodes} edges={flowEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypeMap}
                  onNodeClick={(_, node) => { if (node.id !== 'user-request') { const t = tasks.find(x => x.id === node.id); if (t) { setSelectedTask(t); setDrawerVisible(true); } } }}
                  fitView fitViewOptions={{ padding: 0.4, includeHiddenNodes: false }} minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}>
                  <Controls showInteractive={false} /><Background color="#e8e8e8" gap={14} />
                </ReactFlow>
              )}
            </div>
            <div ref={timelineRef} style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
              {commEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#ccc', fontSize: 11 }}>等待Agent活动...</div>
              ) : (
                <Timeline items={commEvents.map((evt) => ({
                  color: eventColor(evt.type), dot: eventIcon(evt.type),
                  children: (
                    <div style={{ paddingBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Tag style={{ fontSize: 9, padding: '0 3px', margin: 0, lineHeight: '16px' }} color={eventColor(evt.type)}>
                          {evt.type === 'task:assigned' ? '分配' : evt.type === 'agent:thinking' ? '思考' : evt.type === 'agent:receive' ? '接收' : evt.type === 'task:completed' ? '完成' : evt.type === 'task:failed' ? '失败' : evt.type === 'parallel:start' ? '并行' : evt.type === 'session:result' ? '结果' : evt.type === 'session:classified' ? '分类' : '事件'}
                        </Tag>
                        {evt.agentName && <Text strong style={{ fontSize: 11 }}>{evt.agentName}</Text>}
                        {evt.modelId && <Tag style={{ fontSize: 8, padding: '0 2px', margin: 0 }} color="purple">{evt.modelId}</Tag>}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>{evt.message}</div>
                      {evt.type === 'agent:receive' && evt.fromAgents && evt.fromAgents.map((fa: any, fi: number) => (
                        <div key={fi} style={{ fontSize: 10, background: '#fff7e6', border: '1px solid #ffe7ba', borderRadius: 4, padding: '3px 6px', marginTop: 2 }}>
                          <FileTextOutlined style={{ color: '#faad14', marginRight: 3 }} /><Text strong style={{ fontSize: 10 }}>来自 {fa.agentName}</Text>
                          <div style={{ color: '#888', fontSize: 9, marginTop: 1, maxHeight: 30, overflow: 'hidden' }}>{fa.outputPreview?.substring(0, 120)}...</div>
                        </div>
                      ))}
                      {evt.type === 'task:completed' && evt.outputPreview && <div style={{ fontSize: 10, background: '#f6ffed', border: '1px solid #d9f7be', borderRadius: 4, padding: '3px 6px', marginTop: 3, maxHeight: 50, overflow: 'hidden' }}>{evt.outputPreview.substring(0, 150)}...</div>}
                      {evt.error && <div style={{ fontSize: 10, color: '#ff4d4f', marginTop: 2 }}>{evt.error}</div>}
                      <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>
                        {evt.durationMs && `${(evt.durationMs / 1000).toFixed(1)}s`}{evt.tokensUsed?.totalTokens && ` · ${evt.tokensUsed.totalTokens} tokens`}{evt.estimatedCost === 0 && ' · 免费'}
                      </div>
                    </div>
                  ),
                }))} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Task Drawer */}
      <Drawer title={selectedTask ? <Space><RobotOutlined /><span>{selectedTask.name}</span><Tag color={selectedTask.status === 'completed' ? 'success' : selectedTask.status === 'running' ? 'processing' : selectedTask.status === 'failed' ? 'error' : 'default'}>{selectedTask.status}</Tag></Space> : '详情'} open={drawerVisible} onClose={() => setDrawerVisible(false)} width={500}>
        {selectedTask && <div>
          <Card size="small" style={{ marginBottom: 10 }}><Space direction="vertical" style={{ width: '100%' }}>
            <div><Text type="secondary">Agent: </Text><Text strong>{selectedTask.agentName || getAgentName(selectedTask.assignedAgentId || '')}</Text></div>
            {selectedTask.modelId && <div><Text type="secondary">模型: </Text><Tag color="purple">{selectedTask.modelId}</Tag></div>}
            {selectedTask.durationMs != null && <div><Text type="secondary">耗时: </Text>{(selectedTask.durationMs / 1000).toFixed(1)}s</div>}
          </Space></Card>
          {commEvents.filter(e => e.taskId === selectedTask.id).length > 0 && (
            <Card size="small" title="Agent通信全过程" style={{ marginBottom: 10 }}>
              <Timeline items={commEvents.filter(e => e.taskId === selectedTask.id).map((evt) => ({ color: eventColor(evt.type), children: <div>
                <Tag style={{ fontSize: 9 }} color={eventColor(evt.type)}>{evt.type?.replace(':', ' ')}</Tag>
                <Text style={{ fontSize: 11 }}>{evt.message}</Text>
                {evt.fromAgents?.map((fa: any, fi: number) => <div key={fi} style={{ fontSize: 10, background: '#fffbe6', padding: '2px 4px', borderRadius: 3, marginTop: 2 }}><FileTextOutlined /> 来自 {fa.agentName}: {fa.outputPreview?.substring(0, 80)}...</div>)}
              </div> }))} />
            </Card>
          )}
          {selectedTask.output && <Card size="small" title="完整输出"><div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5, maxHeight: 400, overflow: 'auto' }}>{typeof selectedTask.output === 'string' ? selectedTask.output : JSON.stringify(selectedTask.output, null, 2)}</div></Card>}
          {selectedTask.error && <Card size="small" title="错误"><Text type="danger">{selectedTask.error}</Text></Card>}
        </div>}
      </Drawer>

      {/* Project Root Modal */}
      <Modal title="设置本地项目目录" open={projectModalVisible} onOk={async () => { if (currentSession && projectRoot) { await sessionsApi.setProject(currentSession, projectRoot); antMessage.success('已设置'); } setProjectModalVisible(false); }} onCancel={() => setProjectModalVisible(false)}>
        <div style={{ marginBottom: 12 }}><Text type="secondary">Agent可以读写此目录下的文件。</Text></div>
        <Input value={projectRoot} onChange={e => setProjectRoot(e.target.value)} placeholder="例如: D:\projects\my-app" addonBefore={<FolderOutlined />} />
      </Modal>
    </div>
  );
};

export default Chat;
