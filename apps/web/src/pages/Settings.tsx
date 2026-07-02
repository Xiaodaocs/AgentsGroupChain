import React, { useState, useEffect } from 'react';
import {
  Card, List, Tag, Button, Space, Typography, Switch, Modal, Input,
  message as antMessage, Spin, Alert, Collapse, Divider,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ApiOutlined,
  KeyOutlined, LinkOutlined, FolderOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { providersApi, settingsApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const PROVIDER_GUIDES = [
  {
    provider: 'groq',
    name: 'Groq (推荐首选)',
    guide: '1. 访问 console.groq.com\n2. 用Google/GitHub账号注册\n3. 进入 API Keys → Create API Key\n4. 免费额度：14,400请求/天，30请求/分钟',
    url: 'https://console.groq.com',
  },
  {
    provider: 'gemini',
    name: 'Google Gemini',
    guide: '1. 访问 aistudio.google.com/apikey\n2. 用Google账号登录\n3. 点击 "Create API Key"\n4. 免费额度：Flash 1,500请求/天',
    url: 'https://aistudio.google.com/apikey',
  },
  {
    provider: 'openrouter',
    name: 'OpenRouter (一个Key用200+模型)',
    guide: '1. 访问 openrouter.ai\n2. 注册账号\n3. 创建API Key\n4. 28+免费模型可用，充值$10可解锁付费模型',
    url: 'https://openrouter.ai',
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek (极低成本)',
    guide: '1. 访问 platform.deepseek.com\n2. 注册送5M tokens\n3. V3模型仅$0.14/百万token',
    url: 'https://platform.deepseek.com',
  },
  {
    provider: 'ollama',
    name: 'Ollama (本地运行，完全免费)',
    guide: '1. 访问 ollama.com\n2. 下载安装\n3. 命令行运行: ollama run llama3.2\n4. 自动在 localhost:11434 提供API\n5. 无需API Key',
    url: 'https://ollama.com',
  },
  {
    provider: 'mistral',
    name: 'Mistral AI',
    guide: '1. 访问 console.mistral.ai\n2. 注册并激活免费层\n3. 免费额度：约10亿tokens/月',
    url: 'https://console.mistral.ai',
  },
];

const Settings: React.FC = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<{ visible: boolean; provider: any }>({
    visible: false, provider: null,
  });
  const [editApiKey, setEditApiKey] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [fsUnrestricted, setFsUnrestricted] = useState(false);

  useEffect(() => { loadProviders(); loadSettings(); }, []);

  const loadSettings = async () => {
    try { const d = await settingsApi.getFsUnrestricted(); setFsUnrestricted(d.unrestricted); } catch {}
  };

  const loadProviders = async () => {
    try {
      const data = await providersApi.list();
      setProviders(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleProvider = async (id: string, enabled: boolean) => {
    try {
      await providersApi.update(id, { isEnabled: enabled ? 1 : 0 });
      antMessage.success(enabled ? '已启用' : '已禁用');
      loadProviders();
    } catch (e) { antMessage.error('更新失败'); }
  };

  const saveProviderConfig = async () => {
    try {
      await providersApi.update(editModal.provider.id, {
        apiKey: editApiKey || undefined,
        baseUrl: editBaseUrl || undefined,
      });
      antMessage.success('保存成功');
      setEditModal({ visible: false, provider: null });
      loadProviders();
    } catch (e) { antMessage.error('保存失败'); }
  };

  const testProvider = async (provider: string) => {
    setTesting(provider);
    setTestResult(null);
    try {
      const result = await providersApi.test(provider);
      setTestResult(result);
      if (result.success) {
        antMessage.success(`${provider} 连接成功！发现 ${result.models?.length || 0} 个模型`);
      } else {
        antMessage.error(`${provider} 连接失败: ${result.error}`);
      }
    } catch (e: any) {
      antMessage.error(`测试失败: ${e.message}`);
    } finally {
      setTesting(null);
    }
  };

  const getStatusTag = (provider: any) => {
    if (provider.isEnabled) {
      if (provider.provider === 'ollama') {
        return <Tag color="green" icon={<CheckCircleOutlined />}>运行中</Tag>;
      }
      if (provider.apiKey) {
        return <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag>;
      }
      return <Tag color="orange">未配置API Key</Tag>;
    }
    return <Tag icon={<CloseCircleOutlined />}>已禁用</Tag>;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>模型提供商设置</Title>

      <Alert
        message="💡 提示：系统支持多个模型提供商同时使用。推荐优先配置免费提供商（Groq、Gemini、Ollama），可以覆盖大部分日常使用场景。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* File System Access */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {fsUnrestricted ? <UnlockOutlined style={{ color: '#faad14' }} /> : <LockOutlined style={{ color: '#52c41a' }} />}
            <div>
              <Text strong>Agent 文件系统访问权限</Text>
              <div style={{ fontSize: 12, color: '#999' }}>
                {fsUnrestricted
                  ? '⚠️ 无限制 — Agent可以读写电脑上任何文件（包括系统文件）'
                  : '🔒 受限 — Agent只能访问项目目录内的文件（更安全）'}
              </div>
            </div>
          </Space>
          <Switch
            checked={fsUnrestricted}
            onChange={async (checked) => {
              try {
                await settingsApi.setFsUnrestricted(checked);
                setFsUnrestricted(checked);
                antMessage.success(checked ? '已开启无限制访问' : '已恢复目录限制');
              } catch { antMessage.error('设置失败'); }
            }}
            checkedChildren="无限制"
            unCheckedChildren="受限"
          />
        </div>
      </Card>

      {/* Provider List */}
      <List
        dataSource={providers}
        renderItem={(provider: any) => (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Space>
                  <ApiOutlined />
                  <Text strong style={{ fontSize: 16 }}>{provider.displayName}</Text>
                  {getStatusTag(provider)}
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {provider.apiKey ? `API Key: ${provider.apiKey}` : '未设置API Key'}
                    {provider.baseUrl ? ` | 地址: ${provider.baseUrl}` : ''}
                  </Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  {provider.models?.slice(0, 5).map((m: any) => (
                    <Tag key={m.id} style={{ fontSize: 11, marginBottom: 2 }}>
                      {m.name} {m.isFree && <span style={{ color: '#52c41a' }}>免费</span>}
                    </Tag>
                  ))}
                  {provider.models?.length > 5 && (
                    <Tag style={{ fontSize: 11 }}>+{provider.models.length - 5} more</Tag>
                  )}
                </div>
              </div>
              <Space>
                <Switch
                  checked={!!provider.isEnabled}
                  onChange={(checked) => toggleProvider(provider.id, checked)}
                />
                <Button
                  onClick={() => {
                    setEditModal({ visible: true, provider });
                    setEditApiKey('');
                    setEditBaseUrl(provider.baseUrl || '');
                  }}
                  icon={<KeyOutlined />}
                >
                  配置
                </Button>
                <Button
                  loading={testing === provider.provider}
                  onClick={() => testProvider(provider.provider)}
                  icon={<LinkOutlined />}
                >
                  测试连接
                </Button>
              </Space>
            </div>
            {testResult && testing === null && (
              <div style={{ marginTop: 8 }}>
                {testResult.success ? (
                  <Alert
                    message={`连接成功！发现 ${testResult.models?.length || 0} 个可用模型`}
                    type="success"
                    showIcon
                  />
                ) : (
                  <Alert message={`连接失败: ${testResult.error}`} type="error" showIcon />
                )}
              </div>
            )}
          </Card>
        )}
      />

      <Divider />

      {/* API Key Guide */}
      <Title level={4}>📖 获取免费API Key指南</Title>
      <Collapse>
        {PROVIDER_GUIDES.map(guide => (
          <Panel header={`${guide.name} - ${guide.url}`} key={guide.provider}>
            <Paragraph>
              <a href={guide.url} target="_blank" rel="noopener noreferrer">
                {guide.url}
              </a>
            </Paragraph>
            <pre style={{
              background: '#f5f5f5', padding: 12, borderRadius: 4,
              fontSize: 13, whiteSpace: 'pre-wrap',
            }}>
              {guide.guide}
            </pre>
          </Panel>
        ))}
      </Collapse>

      {/* Edit Modal */}
      <Modal
        title={`配置 ${editModal.provider?.displayName}`}
        open={editModal.visible}
        onOk={saveProviderConfig}
        onCancel={() => setEditModal({ visible: false, provider: null })}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>API Key:</Text>
          <Input.Password
            value={editApiKey}
            onChange={e => setEditApiKey(e.target.value)}
            placeholder="输入API Key"
            style={{ marginTop: 4 }}
          />
        </div>
        <div>
          <Text strong>Base URL (可选):</Text>
          <Input
            value={editBaseUrl}
            onChange={e => setEditBaseUrl(e.target.value)}
            placeholder="自定义API地址 (留空使用默认)"
            style={{ marginTop: 4 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
