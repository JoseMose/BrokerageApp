import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '';

// Create axios instance with interceptor for auth token
const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }
  
  return config;
});

// Agent Profile APIs
export const agentAPI = {
  getProfile: () => apiClient.get('/agents'),
  createProfile: (data) => apiClient.post('/agents', data),
  updateProfile: (data) => apiClient.put('/agents', data),
  getAIRecommendations: (leads) => apiClient.post('/agents/ai-recommendations', { leads }),
  updateLeadStage: (leadId, funnelStage) => apiClient.put(`/agents/leads/${leadId}`, { funnelStage }),
  updateLead: (leadId, data) => apiClient.put(`/agents/leads/${leadId}`, data),
  deleteLead: (leadId) => apiClient.delete(`/agents/leads/${leadId}`),
  logLeadActivity: (leadId, activity) => apiClient.post(`/agents/leads/${leadId}/activity`, activity),
  createOwnLead: (data) => apiClient.post('/agents/create-lead', data),
  createProspectingLead: (data) => apiClient.post('/agents/create-lead', {
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
    // Create public axios instance without auth interceptor
    const publicClient = axios.create({
      baseURL: API_ENDPOINT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Submitting lead with payload:', formData);
    
    const response = await publicClient.post('/create-lead', formData);
    
    console.log('Lead submission response:', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Lead submission error:', error);
    console.error('Error response:', error.response?.data);
    return {
      success: false,
      message: error.response?.data?.message || error.response?.data?.details?.join(', ') || 'Failed to submit lead. Please try again.'
    };
  }
};

// Admin APIs
export const adminAPI = {
  getDashboard: () => apiClient.get('/admin', { params: { action: 'dashboard' } }),
  getAnalytics: () => apiClient.get('/admin', { params: { action: 'analytics' } }),
  getAgentPerformance: () => apiClient.get('/admin', { params: { action: 'agent-performance' } }),
  getVerificationRequests: () => apiClient.get('/admin', { params: { action: 'verification-requests' } }),
  getLeads: (params) => apiClient.get('/admin', { params: { action: 'leads', ...params } }),
  getAgents: (params) => apiClient.get('/admin', { params: { action: 'agents', ...params } }),
  getTransactions: (params) => apiClient.get('/admin', { params: { action: 'transactions', ...params } }),
  performAction: (data) => apiClient.post('/admin', data),
  reassignLead: (leadId, newAgentId) => apiClient.put('/admin', { newAgentId }, { params: { action: 'reassign-lead', leadId } }),
  restoreLead: (leadId) => apiClient.put('/admin', {}, { params: { action: 'restore-lead', leadId } }),
  // Bulk packages
  createBulkPackage: (data) => apiClient.post('/admin/bulk-packages', data),
  getAllPackages: () => apiClient.get('/admin/bulk-packages'),
};


// Master Leads API (shared pool — agents browse, admin manages)
export const masterLeadsAPI = {
  getAll: () => apiClient.get('/master-leads'),
  seed: () => apiClient.get('/master-leads', { params: { action: 'seed' } }),
  create: (data) => apiClient.post('/master-leads', data),
  update: (id, data) => apiClient.put(`/master-leads/${id}`, data),
  archive: (id) => apiClient.delete(`/master-leads/${id}`),
};

// Agent Funnel API (agent's private copy of leads they are working)
export const funnelAPI = {
  getAll: () => apiClient.get('/funnel'),
  addToFunnel: (masterId) => apiClient.post('/funnel', { masterId }),
  updateEntry: (id, data) => apiClient.put(`/funnel/${id}`, data),
  removeEntry: (id) => apiClient.delete(`/funnel/${id}`),
};

export default apiClient;
