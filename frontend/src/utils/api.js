import axios from 'axios';
import { getIdToken } from './ibmAuth';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '';

const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  headers: { 'Content-Type': 'application/json' },
});

// Attach IBM App ID id_token as Bearer on every request
apiClient.interceptors.request.use((config) => {
  const token = getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Agent Profile APIs
export const agentAPI = {
  getProfile:          ()              => apiClient.get('/agents'),
  createProfile:       (data)          => apiClient.post('/agents', data),
  updateProfile:       (data)          => apiClient.put('/agents', data),
  getAIRecommendations:(leads)         => apiClient.post('/agents/ai-recommendations', { leads }),
  updateLeadStage:     (leadId, stage) => apiClient.put(`/agents/leads/${leadId}`, { funnelStage: stage }),
  updateLead:          (leadId, data)  => apiClient.put(`/agents/leads/${leadId}`, data),
  deleteLead:          (leadId)        => apiClient.delete(`/agents/leads/${leadId}`),
  logLeadActivity:     (leadId, act)   => apiClient.post(`/agents/leads/${leadId}/activity`, act),
  createOwnLead:       (data)          => apiClient.post('/agents/create-lead', data),
  createProspectingLead: (data)        => apiClient.post('/agents/create-lead', {
    ownerName:       data.ownerName,
    propertyAddress: data.propertyAddress,
    leadType:        data.leadType,
    phone:           data.phone,
    email:           data.email,
    stage:           data.stage,
    notes:           data.notes,
  }),
};

// Public Lead Generation API (no auth required)
export const submitLead = async (formData) => {
  try {
    const publicClient = axios.create({
      baseURL: API_ENDPOINT,
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await publicClient.post('/create-lead', formData);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Lead submission error:', error.response?.data);
    return {
      success: false,
      message: error.response?.data?.message
        || error.response?.data?.details?.join(', ')
        || 'Failed to submit lead. Please try again.',
    };
  }
};

// Admin APIs
export const adminAPI = {
  getDashboard:          ()                      => apiClient.get('/admin', { params: { action: 'dashboard' } }),
  getAnalytics:          ()                      => apiClient.get('/admin', { params: { action: 'analytics' } }),
  getAgentPerformance:   ()                      => apiClient.get('/admin', { params: { action: 'agent-performance' } }),
  getVerificationRequests: ()                    => apiClient.get('/admin', { params: { action: 'verification-requests' } }),
  getLeads:              (params)                => apiClient.get('/admin', { params: { action: 'leads', ...params } }),
  getAgents:             (params)                => apiClient.get('/admin', { params: { action: 'agents', ...params } }),
  getTransactions:       (params)                => apiClient.get('/admin', { params: { action: 'transactions', ...params } }),
  performAction:         (data)                  => apiClient.post('/admin', data),
  reassignLead:          (leadId, newAgentId)    => apiClient.put('/admin', { newAgentId }, { params: { action: 'reassign-lead', leadId } }),
  restoreLead:           (leadId)                => apiClient.put('/admin', {}, { params: { action: 'restore-lead', leadId } }),
  createBulkPackage:     (data)                  => apiClient.post('/admin/bulk-packages', data),
  getAllPackages:         ()                      => apiClient.get('/admin/bulk-packages'),
};

// Master Leads API (shared pool — agents browse, admin manages)
export const masterLeadsAPI = {
  getAll:   ()         => apiClient.get('/master-leads'),
  seed:     ()         => apiClient.get('/master-leads', { params: { action: 'seed' } }),
  create:   (data)     => apiClient.post('/master-leads', data),
  update:   (id, data) => apiClient.put(`/master-leads/${id}`, data),
  archive:  (id)       => apiClient.delete(`/master-leads/${id}`),
};

// Agent Funnel API (agent's private copy of leads they are working)
export const funnelAPI = {
  getAll:      ()           => apiClient.get('/funnel'),
  addToFunnel: (masterId)   => apiClient.post('/funnel', { masterId }),
  updateEntry: (id, data)   => apiClient.put(`/funnel/${id}`, data),
  removeEntry: (id)         => apiClient.delete(`/funnel/${id}`),
};

export default apiClient;
