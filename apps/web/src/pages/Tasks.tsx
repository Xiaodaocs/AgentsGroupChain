import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Space, Typography, Statistic, Row, Col,
  Button, message as antMessage, Empty, Spin,
} from 'antd';
import {
  CheckCircleOutlined, SyncOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ReloadOutlined, StopOutlined,
} from '@ant-design/icons';
import { sessionsApi, orchestratorApi } from '../services/api';

const { Title, Text } = Typography;

const Tasks: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) loadTasks();
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      const data = await sessionsApi.list();
      setSessions(data);
      if (data.length > 0) setSelectedSession(data[0].id);
    } catch (e) { console.error(e); }
  };

  const loadTasks = async () => {
    if (!selectedSession) return;
    setLoading(true);
    try {
      const data = await orchestratorApi.sessionTasks(selectedSession);
      setTasks(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const retryTask = async (taskId: string) => {
    try {
      await orchestratorApi.retryTask(taskId);
      antMessage.success('任务已重新排队');
      loadTasks();
    } catch (e) { antMessage.error('重试失败'); }
  };

  const cancelTask = async (taskId: string) => {
    try {
      await orchestratorApi.cancelTask(taskId);
      antMessage.success('任务已取消');
      loadTasks();
    } catch (e) { antMessage.error('取消失败'); }
  };

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      completed: { color: 'success', icon: <CheckCircleOutlined /> },
      running: { color: 'processing', icon: <SyncOutlined spin /> },
      pending: { color: 'default', icon: <ClockCircleOutlined /> },
      queued: { color: 'default', icon: <ClockCircleOutlined /> },
      failed: { color: 'error', icon: <CloseCircleOutlined /> },
      cancelled: { color: 'warning', icon: <StopOutlined /> },
    };
    const { color, icon } = map[status] || map.pending;
    return <Tag color={color} icon={icon}>{status}</Tag>;
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => statusTag(s),
    },
    {
      title: '进度', dataIndex: 'progress', key: 'progress', width: 100,
      render: (p: number) => `${p}%`,
    },
    {
      title: '耗时', key: 'duration', width: 100,
      render: (_: any, r: any) => {
        if (r.startedAt && r.completedAt) {
          const ms = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
          return `${(ms / 1000).toFixed(1)}s`;
        }
        return '-';
      },
    },
    {
      title: 'Tokens', key: 'tokens', width: 100,
      render: (_: any, r: any) => r.tokensUsed?.totalTokens || '-',
    },
    {
      title: '费用', key: 'cost', width: 100,
      render: (_: any, r: any) => `¥${((r.estimatedCost || 0) * 7.2).toFixed(4)}`,
    },
    {
      title: '操作', key: 'actions', width: 150,
      render: (_: any, r: any) => (
        <Space>
          {r.status === 'failed' && (
            <Button size="small" icon={<ReloadOutlined />} onClick={() => retryTask(r.id)}>
              重试
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'queued') && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => cancelTask(r.id)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <div style={{ padding: 24 }}>
      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="总任务" value={tasks.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已完成" value={completedCount} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="运行中" value={runningCount} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="失败" value={failedCount} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      {/* Session selector */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>选择会话:</Text>
          {sessions.map(s => (
            <Tag
              key={s.id}
              color={selectedSession === s.id ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedSession(s.id)}
            >
              {s.title}
            </Tag>
          ))}
        </Space>
      </Card>

      {/* Task Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : tasks.length === 0 ? (
        <Empty description="暂无任务记录。在对话页面发送消息即可创建任务。" />
      ) : (
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </div>
  );
};

export default Tasks;
