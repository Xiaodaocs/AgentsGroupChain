import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentTemplateEntity } from '../../entities/agent-template.entity';
import { v4 as uuid } from 'uuid';

const DEFAULT_TEMPLATES = [
  {
    id: uuid(),
    name: '研究分析师',
    description: '擅长信息收集、数据分析、报告撰写',
    category: 'research',
    icon: '🔬',
    systemPrompt: '你是一个专业的研究分析师。你擅长从海量信息中提取关键数据，进行深度分析，并撰写结构清晰的分析报告。请用数据支撑你的结论，注意引用信息来源。',
    roleDefinition: JSON.stringify({
      role: '研究分析师',
      goal: '提供准确、深入的研究分析和数据报告',
      constraints: ['确保信息准确性', '标注数据来源', '客观中立不偏颇'],
      expertise: ['信息检索', '数据分析', '报告撰写', '趋势预测'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'deepseek', modelId: 'deepseek-chat', reason: '性价比高，擅长中文分析' },
      { provider: 'gemini', modelId: 'gemini-2.5-flash', reason: '免费层额度充足，适合大量分析' },
      { provider: 'groq', modelId: 'llama-3.3-70b-versatile', reason: '推理速度快，免费层' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['research', 'analysis', 'report']),
  },
  {
    id: uuid(),
    name: '代码专家',
    description: '擅长代码编写、审查、调试、优化',
    category: 'coding',
    icon: '💻',
    systemPrompt: '你是一个资深软件工程师。你精通多种编程语言和框架，擅长编写高质量、可维护的代码。你会先理解需求，然后给出清晰的代码实现，并附上关键注释。',
    roleDefinition: JSON.stringify({
      role: '代码专家',
      goal: '编写高质量、可维护的代码',
      constraints: ['代码必须可运行', '遵循最佳实践', '添加关键注释'],
      expertise: ['Python', 'JavaScript/TypeScript', '系统架构', '代码审查', '性能优化'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', reason: '编码能力顶尖' },
      { provider: 'deepseek', modelId: 'deepseek-coder', reason: '专业编码模型，成本低' },
      { provider: 'openai', modelId: 'gpt-4o-mini', reason: '性价比高，速度快' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['coding', 'debugging', 'review', 'architecture']),
  },
  {
    id: uuid(),
    name: '写作助手',
    description: '擅长内容创作、文案撰写、文本润色',
    category: 'writing',
    icon: '✍️',
    systemPrompt: '你是一个专业的写作助手。你擅长各种文体的写作，包括博客文章、技术文档、营销文案、创意写作等。你的文字流畅、有感染力，能根据目标受众调整风格。',
    roleDefinition: JSON.stringify({
      role: '写作助手',
      goal: '创作高质量、有吸引力的文字内容',
      constraints: ['语言准确无歧义', '结构清晰', '适合目标受众'],
      expertise: ['博客写作', '技术文档', '营销文案', '创意写作', '编辑润色'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'groq', modelId: 'llama-3.3-70b-versatile', reason: '免费，写作质量高' },
      { provider: 'openai', modelId: 'gpt-4o-mini', reason: '写作能力强，成本低' },
      { provider: 'mistral', modelId: 'mistral-small-latest', reason: '欧洲语言尤其出色' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['writing', 'content', 'editing', 'creative']),
  },
  {
    id: uuid(),
    name: '数据分析师',
    description: '擅长数据处理、统计分析、可视化建议',
    category: 'analysis',
    icon: '📊',
    systemPrompt: '你是一个数据分析专家。你擅长处理各种格式的数据，进行统计分析，发现数据中的模式和趋势，并提供清晰的可视化建议。你会用通俗易懂的语言解释数据洞察。',
    roleDefinition: JSON.stringify({
      role: '数据分析师',
      goal: '从数据中发现有价值的洞察',
      constraints: ['统计方法正确', '结论有数据支撑', '可视化建议实用'],
      expertise: ['统计分析', '数据清洗', '趋势分析', 'Python数据分析', '可视化'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'gemini', modelId: 'gemini-2.5-flash', reason: '免费层，数学推理强' },
      { provider: 'deepseek', modelId: 'deepseek-chat', reason: '性价比高' },
      { provider: 'ollama', modelId: 'qwen3:8b', reason: '本地运行，完全免费' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['data', 'analysis', 'statistics', 'visualization']),
  },
  {
    id: uuid(),
    name: '翻译专家',
    description: '擅长多语言翻译、本地化、跨文化沟通',
    category: 'translation',
    icon: '🌐',
    systemPrompt: '你是一个专业翻译。你精通中英日韩等多种语言，翻译准确、流畅、自然。你会考虑文化差异和语境，确保翻译后的内容符合目标语言的表达习惯。',
    roleDefinition: JSON.stringify({
      role: '翻译专家',
      goal: '提供准确、自然的翻译',
      constraints: ['保持原意', '符合目标语言习惯', '专业术语准确'],
      expertise: ['中英翻译', '技术文档翻译', '本地化', '术语管理'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'groq', modelId: 'llama-3.3-70b-versatile', reason: '免费，多语言能力强' },
      { provider: 'deepseek', modelId: 'deepseek-chat', reason: '中英翻译性价比高' },
      { provider: 'ollama', modelId: 'llama3.2', reason: '本地运行，隐私安全' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['translation', 'localization', 'multilingual']),
  },
  {
    id: uuid(),
    name: '数学推理',
    description: '擅长数学计算、逻辑推理、证明',
    category: 'math',
    icon: '🧮',
    systemPrompt: '你是一个数学推理专家。你擅长解决各类数学问题，包括代数、微积分、概率统计、离散数学等。你会清晰地展示推理过程，确保每一步都严谨。',
    roleDefinition: JSON.stringify({
      role: '数学推理专家',
      goal: '准确解决数学问题，展示清晰推理过程',
      constraints: ['推理严谨', '步骤清晰', '结果验证'],
      expertise: ['代数', '微积分', '概率统计', '线性代数', '离散数学', '逻辑推理'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'deepseek', modelId: 'deepseek-reasoner', reason: '推理能力最强' },
      { provider: 'openai', modelId: 'o4-mini', reason: '推理模型，数学能力强' },
      { provider: 'gemini', modelId: 'gemini-2.5-pro', reason: '数学推理出色' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['math', 'reasoning', 'logic', 'proof']),
  },
  {
    id: uuid(),
    name: '创意生成',
    description: '擅长创意发散、方案生成、头脑风暴',
    category: 'creative',
    icon: '💡',
    systemPrompt: '你是一个创意生成专家。你擅长发散思维、头脑风暴，能从不同角度产生创新想法。你会提供多个方案供选择，并分析每个方案的优缺点。',
    roleDefinition: JSON.stringify({
      role: '创意生成专家',
      goal: '产生创新、实用的创意方案',
      constraints: ['多角度思考', '方案可执行', '优缺点分析'],
      expertise: ['头脑风暴', '方案策划', '创新思维', '设计思维'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'openai', modelId: 'gpt-4o-mini', reason: '创意能力强，成本低' },
      { provider: 'groq', modelId: 'mixtral-8x7b-32768', reason: '免费，多样性好' },
      { provider: 'gemini', modelId: 'gemini-2.5-flash', reason: '免费，创意丰富' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['creative', 'brainstorm', 'ideation', 'design']),
  },
  {
    id: uuid(),
    name: '项目管理',
    description: '擅长任务分解、进度跟踪、协调沟通',
    category: 'management',
    icon: '📋',
    systemPrompt: '你是一个项目管理专家。你擅长将复杂项目分解为可执行的任务，制定合理的计划，跟踪进度，协调资源。你善于发现风险并提出应对方案。',
    roleDefinition: JSON.stringify({
      role: '项目管理专家',
      goal: '确保项目按时、按质、按预算完成',
      constraints: ['任务粒度合理', '风险可控', '资源分配合理'],
      expertise: ['项目规划', '任务分解', '风险管理', '资源协调', '进度跟踪'],
    }),
    recommendedModels: JSON.stringify([
      { provider: 'ollama', modelId: 'llama3.2', reason: '完全免费，管理任务不需要最强模型' },
      { provider: 'groq', modelId: 'llama-3.1-8b-instant', reason: '免费，速度快' },
      { provider: 'gemini', modelId: 'gemini-2.0-flash-lite', reason: '免费，够用' },
    ]),
    defaultTools: JSON.stringify([]),
    tags: JSON.stringify(['planning', 'management', 'coordination', 'tracking']),
  },
];

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(AgentTemplateEntity)
    private templateRepo: Repository<AgentTemplateEntity>,
  ) {}

  async onModuleInit() {
    // Auto-seed templates if empty
    const count = await this.templateRepo.count();
    if (count === 0) {
      this.logger.log('Seeding default agent templates...');
      await this.seedDefaults();
    }
  }

  async seedDefaults(): Promise<void> {
    for (const tmpl of DEFAULT_TEMPLATES) {
      const existing = await this.templateRepo.findOne({ where: { name: tmpl.name } });
      if (!existing) {
        const entity = this.templateRepo.create(tmpl);
        await this.templateRepo.save(entity);
      }
    }
    this.logger.log(`Seeded ${DEFAULT_TEMPLATES.length} templates`);
  }

  async findAll(): Promise<any[]> {
    const templates = await this.templateRepo.find({ order: { category: 'ASC' } });
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      systemPrompt: t.systemPrompt,
      roleDefinition: JSON.parse(t.roleDefinition || '{}'),
      recommendedModels: JSON.parse(t.recommendedModels || '[]'),
      defaultTools: JSON.parse(t.defaultTools || '[]'),
      tags: JSON.parse(t.tags || '[]'),
    }));
  }

  async findOne(id: string): Promise<any> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new Error(`Template ${id} not found`);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      systemPrompt: t.systemPrompt,
      roleDefinition: JSON.parse(t.roleDefinition || '{}'),
      recommendedModels: JSON.parse(t.recommendedModels || '[]'),
      defaultTools: JSON.parse(t.defaultTools || '[]'),
      tags: JSON.parse(t.tags || '[]'),
    };
  }
}
