import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout';
import Chat from './pages/Chat';
import Agents from './pages/Agents';
import AgentEditor from './pages/AgentEditor';
import Tasks from './pages/Tasks';
import Costs from './pages/Costs';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: '#6366f1', borderRadius: 8 } }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/new" element={<AgentEditor />} />
            <Route path="agents/:id/edit" element={<AgentEditor />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="costs" element={<Costs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
