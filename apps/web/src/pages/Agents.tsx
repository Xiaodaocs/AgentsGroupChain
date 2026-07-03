import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Row, Col, Tag, Space, Typography, Modal, Input,
  message as antMessage, Popconfirm, Empty, Spin,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { agentsApi } from '../services/api';

const { Text, Paragraph, Title } = Typography;
const { Search } = Input;

const Agents: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [testModal, setTestModal] = useState<{ visible: boolean; agentId: string; agentName: string }>({
    visible: false, agentId: '', agentName: '',
  });
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await agentsApi.list();
      setAgents(data);
    } catch (e) { antMessage.error('加载Agent列表失败'); }
    finally { setLoading(false); }
  };

  const deleteAgent = async (id: string) => {
    try {
      await agentsApi.remove(id);
      antMessage.success('删除成功');
      loadAgents();
    } catch (e) { antMessage.error('删除失败'); }
  };

  const runTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    try {
      const result = await agentsApi.test(testModal.agentId, testMessage);
      setTestResult(result);
    } catch (e: any) { antMessage.error(`测试失败: ${e.message}`); }
    finally { setTesting(false); }
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase()) ||
    a.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      openai: 'green', anthropic: 'purple', groq: 'blue', gemini: 'cyan',
      ollama: 'orange', deepseek: 'geekblue', openrouter: 'magenta', mistral: 'volcano',
    };
    return colors[provider] || 'default';
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Search
            placeholder="搜索Agent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agents/new')}>
          创建Agent
        </Button>
      </div>

      {/* Agent Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : filteredAgents.length === 0 ? (
        <Empty description="暂无Agent，点击上方按钮创建">
          <Button type="primary" onClick={() => navigate('/agents/new')}>创建第一个Agent</Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredAgents.map(agent => (
            <Col key={agent.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                actions={[
                  <EditOutlined key="edit" onClick={() => navigate(`/agents/${agent.id}/edit`)} />,
                  <PlayCircleOutlined key="test" onClick={() => {
                    setTestModal({ visible: true, agentId: agent.id, agentName: agent.name });
                    setTestResult(null);
                    setTestMessage('');
                  }} />,
                  <Popconfirm title="确定删除？" onConfirm={() => deleteAgent(agent.id)}>
                    <DeleteOutlined key="delete" />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', background: '#f0f0f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    }}>
                      🤖
                    </div>
                  }
                  title={agent.name}
                  description={
                    <div>
                      <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 13, marginBottom: 8 }}>
                        {agent.description || '暂无描述'}
                      </Paragraph>
                      <Tag color={getProviderColor(agent.model?.provider)}>
                        {agent.model?.provider}/{agent.model?.modelId}
                      </Tag>
                      <div style={{ marginTop: 4 }}>
                        {agent.tags?.slice(0, 4).map((tag: string) => (
                          <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
                        ))}
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Test Modal */}
      <Modal
        title={`测试Agent: ${testModal.agentName}`}
        open={testModal.visible}
        onCancel={() => setTestModal({ ...testModal, visible: false })}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.TextArea
            value={testMessage}
            onChange={e => setTestMessage(e.target.value)}
            placeholder="输入测试消息..."
            rows={3}
          />
          <Button
            type="primary"
            onClick={runTest}
            loading={testing}
            style={{ marginTop: 8 }}
            disabled={!testMessage.trim()}
          >
            发送测试
          </Button>
        </div>
        {testResult && (
          <Card size="small" title="测试结果">
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>
              {testResult.response}
            </Paragraph>
            <Space wrap>
              <Tag>模型: {testResult.model}</Tag>
              <Tag>延迟: {testResult.latencyMs}ms</Tag>
              <Tag>Tokens: {testResult.usage?.totalTokens}</Tag>
              <Tag color="green">费用: ¥{(testResult.estimatedCost * 7.2).toFixed(4)}</Tag>
            </Space>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default Agents;
