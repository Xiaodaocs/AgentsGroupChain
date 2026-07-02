import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });
const longApi = axios.create({ baseURL: '/api', timeout: 0 }); // 0 = no timeout

export const sessionsApi = {
  create: (title: string, projectRoot?: string) => api.post('/sessions', { title, projectRoot }).then(r => r.data),
  list: () => api.get('/sessions').then(r => r.data),
  get: (id: string) => api.get(`/sessions/${id}`).then(r => r.data),
  remove: (id: string) => api.delete(`/sessions/${id}`),
  messages: (id: string) => api.get(`/sessions/${id}/messages`).then(r => r.data),
  setProject: (id: string, projectRoot: string) => api.put(`/sessions/${id}/project`, { projectRoot }).then(r => r.data),
  setReview: (id: string, reviewEnabled: boolean) => api.put(`/sessions/${id}/review`, { reviewEnabled }).then(r => r.data),
  rename: (id: string, title: string) => api.put(`/sessions/${id}/title`, { title }).then(r => r.data),
};

export const agentsApi = {
  create: (data: any) => api.post('/agents', data).then(r => r.data),
  list: () => api.get('/agents').then(r => r.data),
  get: (id: string) => api.get(`/agents/${id}`).then(r => r.data),
  update: (id: string, data: any) => api.put(`/agents/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/agents/${id}`),
  test: (id: string, message: string) => longApi.post(`/agents/${id}/test`, { message }).then(r => r.data),
};

export const orchestratorApi = {
  chat: (sessionId: string, message: string, taskType?: string) =>
    longApi.post('/orchestrator/chat', { sessionId, message, taskType }).then(r => r.data),
  sessionTasks: (sessionId: string) =>
    api.get(`/orchestrator/sessions/${sessionId}/tasks`).then(r => r.data),
  getTask: (id: string) => api.get(`/orchestrator/tasks/${id}`).then(r => r.data),
  retryTask: (id: string) => api.post(`/orchestrator/tasks/${id}/retry`).then(r => r.data),
  cancelTask: (id: string) => api.post(`/orchestrator/tasks/${id}/cancel`).then(r => r.data),
  cancelSession: (id: string) => api.post(`/orchestrator/sessions/${id}/cancel`).then(r => r.data),
};

export const templatesApi = {
  list: () => api.get('/templates').then(r => r.data),
  get: (id: string) => api.get(`/templates/${id}`).then(r => r.data),
};

export const providersApi = {
  list: () => api.get('/providers').then(r => r.data),
  create: (data: any) => api.post('/providers', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/providers/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/providers/${id}`),
  test: (provider: string, apiKey?: string, baseUrl?: string) =>
    longApi.post('/providers/test', { provider, apiKey, baseUrl }).then(r => r.data),
};

export const costsApi = {
  summary: () => api.get('/costs/summary').then(r => r.data),
  sessionCost: (id: string) => api.get(`/costs/session/${id}`).then(r => r.data),
};

export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
};

export const settingsApi = {
  getFsUnrestricted: () => api.get('/settings/fs-unrestricted').then(r => r.data),
  setFsUnrestricted: (val: boolean) => api.put('/settings/fs-unrestricted', { unrestricted: val }).then(r => r.data),
};

export default api;
