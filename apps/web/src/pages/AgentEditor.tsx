import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Form, Input, Select, Slider, InputNumber, Button, Steps, Space,
  Typography, Tag, message as antMessage, Spin, Divider,
} from 'antd';
import { agentsApi, templatesApi, providersApi } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AgentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  const isEdit = !!id;

  // Build model options from enabled providers
  const modelOptions = useMemo(() => {
    const enabled = providers.filter((p: any) => p.isEnabled);
    return enabled.map((p: any) => ({
      provider: p.provider,
      displayName: p.displayName,
      models: (p.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        isFree: m.isFree || m.inputCostPer1M === 0,
        capabilities: m.capabilities || [],
      })),
    }));
  }, [providers]);

  // Default provider/model
  const defaultProvider = useMemo(() => {
    // Prefer dashscope-coding with qwen3.7-plus
    const dq = modelOptions.find(p => p.provider === 'dashscope-coding');
    if (dq?.models.find((m: any) => m.id === 'qwen3.7-plus')) {
      return { provider: 'dashscope-coding', modelId: 'qwen3.7-plus' };
    }
    // Fallback: first enabled provider's first model
    if (modelOptions.length > 0) {
      return { provider: modelOptions[0].provider, modelId: modelOptions[0].models[0]?.id };
    }
    return { provider: 'dashscope-coding', modelId: 'qwen3.7-plus' };
  }, [modelOptions]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tmpls, provs] = await Promise.all([
        templatesApi.list(),
        providersApi.list(),
      ]);
      setTemplates(tmpls);
      setProviders(provs);

      if (id) {
        const agent = await agentsApi.get(id);
        form.setFieldsValue({
          name: agent.name,
          description: agent.description,
          tags: agent.tags,
          systemPrompt: agent.systemPrompt,
          role: agent.roleDefinition?.role,
          goal: agent.roleDefinition?.goal,
          constraints: agent.roleDefinition?.constraints?.join('\n'),
          expertise: agent.roleDefinition?.expertise,
          provider: agent.model?.provider,
          modelId: agent.model?.modelId,
          temperature: agent.model?.temperature ?? 0.7,
          maxTokens: agent.model?.maxTokens ?? 4096,
          topP: agent.model?.topP ?? 1,
          tokenBudget: agent.cost?.tokenBudget ?? 100000,
          costBudget: agent.cost?.costBudget ?? 10,
          priority: agent.cost?.priority ?? 'medium',
        });
      } else {
        // Set defaults for new agent
        form.setFieldsValue({
          provider: defaultProvider.provider,
          modelId: defaultProvider.modelId,
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;

    // Find the recommended model that's available
    let provider = defaultProvider.provider;
    let modelId = defaultProvider.modelId;
    if (tmpl.recommendedModels?.length) {
      for (const rec of tmpl.recommendedModels) {
        const prov = modelOptions.find(p => p.provider === rec.provider);
        if (prov?.models.find((m: any) => m.id === rec.modelId)) {
          provider = rec.provider;
          modelId = rec.modelId;
          break;
        }
      }
    }

    form.setFieldsValue({
      name: tmpl.name,
      description: tmpl.description,
      tags: tmpl.tags,
      systemPrompt: tmpl.systemPrompt,
      role: tmpl.roleDefinition?.role,
      goal: tmpl.roleDefinition?.goal,
      constraints: tmpl.roleDefinition?.constraints?.join('\n'),
      expertise: tmpl.roleDefinition?.expertise,
      provider,
      modelId,
    });
    antMessage.success(`已应用模板: ${tmpl.name}`);
  };

  const handleProviderChange = (provider: string) => {
    // When provider changes, auto-select first model from that provider
    const prov = modelOptions.find(p => p.provider === provider);
    if (prov && prov.models.length > 0) {
      form.setFieldsValue({ modelId: prov.models[0].id });
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const data = {
        name: values.name,
        description: values.description,
        tags: values.tags || [],
        systemPrompt: values.systemPrompt,
        roleDefinition: {
          role: values.role,
          goal: values.goal,
          constraints: values.constraints?.split('\n').filter(Boolean) || [],
          expertise: values.expertise || [],
        },
        model: {
          provider: values.provider,
          modelId: values.modelId,
          temperature: values.temperature ?? 0.7,
          maxTokens: values.maxTokens ?? 4096,
          topP: values.topP ?? 1,
        },
        cost: {
          tokenBudget: values.tokenBudget ?? 100000,
          costBudget: values.costBudget ?? 10,
          priority: values.priority ?? 'medium',
        },
        behavior: {
          maxRetries: 3, timeout: 30000, enableMemory: false,
          maxMemoryItems: 10, enableSelfReflection: false,
        },
        collaboration: {
          canDelegateTo: [], canReceiveFrom: [], maxConcurrency: 3,
        },
      };

      if (isEdit) {
        await agentsApi.update(id, data);
        antMessage.success('更新成功');
      } else {
        await agentsApi.create(data);
        antMessage.success('创建成功');
      }
      navigate('/agents');
    } catch (e: any) {
      antMessage.error(`保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const steps = [
    {
      title: '基础信息',
      content: (
        <div>
          {!isEdit && templates.length > 0 && (
            <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
              <Text strong>从模板快速创建: </Text>
              <Select placeholder="选择模板" style={{ width: 300, marginLeft: 8 }}
                onChange={applyTemplate}>
                {templates.map(t => (
                  <Option key={t.id} value={t.id}>{t.icon} {t.name} - {t.description}</Option>
                ))}
              </Select>
            </Card>
          )}
          <Form.Item name="name" label="Agent名称" rules={[{ required: true }]}>
            <Input placeholder="例如：代码审查专家" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="描述这个Agent的用途和能力" />
          </Form.Item>
          <Form.Item name="tags" label="能力标签">
            <Select mode="tags" placeholder="输入标签后按回车" />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '角色定义',
      content: (
        <div>
          <Form.Item name="systemPrompt" label="系统提示词" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="定义Agent的行为和回复风格..." />
          </Form.Item>
          <Form.Item name="role" label="角色名称">
            <Input placeholder="例如：资深软件工程师" />
          </Form.Item>
          <Form.Item name="goal" label="目标">
            <Input placeholder="例如：编写高质量、可维护的代码" />
          </Form.Item>
          <Form.Item name="constraints" label="约束条件">
            <TextArea rows={3} placeholder="每行一条约束" />
          </Form.Item>
          <Form.Item name="expertise" label="专业领域">
            <Select mode="tags" placeholder="输入专业领域" />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '模型配置',
      content: (
        <div>
          {modelOptions.length === 0 && (
            <Card size="small" style={{ marginBottom: 16, background: '#fff7e6' }}>
              <Text type="warning">没有已启用的模型提供商。请先在 <a onClick={() => navigate('/settings')}>设置</a> 中配置并启用提供商。</Text>
            </Card>
          )}

          <Form.Item name="provider" label="模型提供商" rules={[{ required: true }]}>
            <Select onChange={handleProviderChange} placeholder="选择提供商">
              {modelOptions.map(p => (
                <Option key={p.provider} value={p.provider}>
                  <Space>
                    {p.displayName}
                    <Tag color={p.models.some((m: any) => m.isFree) ? 'green' : 'default'}
                      style={{ fontSize: 10 }}>
                      {p.models.filter((m: any) => m.isFree).length} 个免费模型
                    </Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.provider !== cur.provider}>
            {({ getFieldValue }) => {
              const selectedProvider = getFieldValue('provider');
              const prov = modelOptions.find(p => p.provider === selectedProvider);
              return (
                <Form.Item name="modelId" label="模型" rules={[{ required: true }]}>
                  <Select placeholder="选择模型" showSearch
                    optionFilterProp="children">
                    {prov?.models.map((m: any) => (
                      <Option key={m.id} value={m.id}>
                        <Space>
                          {m.name}
                          {m.isFree && <Tag color="green" style={{ fontSize: 9, padding: '0 3px' }}>免费</Tag>}
                          {m.capabilities?.includes('coding') && <Tag color="blue" style={{ fontSize: 9, padding: '0 3px' }}>编码</Tag>}
                          {m.capabilities?.includes('reasoning') && <Tag color="purple" style={{ fontSize: 9, padding: '0 3px' }}>推理</Tag>}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item name="temperature" label="温度">
            <Slider min={0} max={2} step={0.1}
              marks={{ 0: '精确', 0.7: '默认', 1.5: '创意', 2: '随机' }} />
          </Form.Item>
          <Form.Item name="maxTokens" label="最大Token数">
            <InputNumber min={100} max={128000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="topP" label="Top-P">
            <Slider min={0} max={1} step={0.05} />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '成本预算',
      content: (
        <div>
          <Form.Item name="tokenBudget" label="Token预算 (每次任务)">
            <InputNumber min={1000} max={1000000} step={1000} style={{ width: '100%' }}
              addonAfter="tokens" />
          </Form.Item>
          <Form.Item name="costBudget" label="费用预算 (每天)">
            <InputNumber min={0} max={1000} step={1} style={{ width: '100%' }}
              addonAfter="¥" />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select>
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
            </Select>
          </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>{isEdit ? '编辑Agent' : '创建Agent'}</Title>

      <Steps current={step} items={steps.map(s => ({ title: s.title }))}
        style={{ marginBottom: 24 }} size="small" />

      <Card>
        <Form form={form} layout="vertical"
          initialValues={{
            temperature: 0.7, maxTokens: 4096, topP: 1,
            tokenBudget: 100000, costBudget: 10, priority: 'medium',
          }}>
          {steps[step].content}
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Space>
            {step > 0 && <Button onClick={() => setStep(step - 1)}>上一步</Button>}
          </Space>
          <Space>
            {step < steps.length - 1 && (
              <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>
            )}
            {step === steps.length - 1 && (
              <Button type="primary" onClick={save} loading={saving}>
                {isEdit ? '保存修改' : '创建Agent'}
              </Button>
            )}
            <Button onClick={() => navigate('/agents')}>取消</Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default AgentEditor;
