import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { costsApi } from '../services/api';

const { Title, Text } = Typography;

const Costs: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSummary(); }, []);

  const loadSummary = async () => {
    try {
      const data = await costsApi.summary();
      setSummary(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const costByProvider = summary?.costByProvider || {};
  const costByModel = summary?.costByModel || {};

  const pieOption = {
    title: { text: '费用分布 (按提供商)', left: 'center' },
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: Object.entries(costByProvider).map(([name, value]) => ({
        name,
        value: Number(value).toFixed(4),
      })),
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' },
      },
      label: { formatter: '{b}\n¥{c}' },
    }],
  };

  const barOption = {
    title: { text: '费用分布 (按模型)', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: Object.keys(costByModel).map(m => m.length > 20 ? m.substring(0, 20) + '...' : m),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '费用 (¥)' },
    series: [{
      type: 'bar',
      data: Object.values(costByModel).map(v => Number(v).toFixed(4)),
      itemStyle: { color: '#6366f1' },
    }],
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>费用统计</Title>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日费用"
              value={((summary?.totalCostToday || 0) * 7.2).toFixed(4)}
              prefix="¥"
              valueStyle={{ color: '#6366f1' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="本月费用"
              value={((summary?.totalCostThisMonth || 0) * 7.2).toFixed(4)}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日Token使用"
              value={summary?.totalTokensToday || 0}
              suffix="tokens"
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16}>
        <Col span={12}>
          <Card>
            {Object.keys(costByProvider).length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: 300 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无费用数据
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            {Object.keys(costByModel).length > 0 ? (
              <ReactECharts option={barOption} style={{ height: 300 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无费用数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Provider Cost Breakdown */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>各提供商费用明细</Title>
        {Object.keys(costByProvider).length === 0 ? (
          <Text type="secondary">暂无数据</Text>
        ) : (
          <Row gutter={[16, 16]}>
            {Object.entries(costByProvider).map(([provider, cost]) => (
              <Col span={6} key={provider}>
                <Card size="small">
                  <Statistic
                    title={provider}
                    value={(Number(cost) * 7.2).toFixed(4)}
                    prefix="¥"
                    valueStyle={{ fontSize: 18 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
};

export default Costs;
