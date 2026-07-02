import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Typography, Badge } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  UnorderedListOutlined,
  DollarOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/chat', icon: <MessageOutlined />, label: '对话' },
    { key: '/agents', icon: <RobotOutlined />, label: 'Agent管理' },
    { key: '/tasks', icon: <UnorderedListOutlined />, label: '任务监控' },
    { key: '/costs', icon: <DollarOutlined />, label: '费用统计' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        width={200}
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0, color: '#6366f1' }}>
            🤖 MoreAgents
          </Title>
          <div style={{ fontSize: 12, color: '#999' }}>多Agent协作系统</div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none', marginTop: 8 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(m => m.key === location.pathname)?.label || 'MoreAgentsTogether'}
          </div>
        </Header>
        <Content style={{ margin: 0, padding: 0, background: '#f5f5f5' }}>
          <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto' }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default AppLayout;
