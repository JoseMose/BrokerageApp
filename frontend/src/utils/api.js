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
  getAssignedLeads: () => apiClient.get('/agents/assigned-leads'),
  passLead: (leadId) => apiClient.post(`/agents/pass-lead/${leadId}`),
  getAIRecommendations: (leads) => apiClient.post('/agents/ai-recommendations', { leads }),
  updateLeadStage: (leadId, funnelStage) => apiClient.put(`/agents/leads/${leadId}`, { funnelStage }),
  logLeadActivity: (leadId, activity) => apiClient.post(`/agents/leads/${leadId}/activity`, activity),
};

// Marketplace APIs
export const marketplaceAPI = {
  getLeads: (params) => apiClient.get('/marketplace', { params }),
  getLead: (leadId) => apiClient.get(`/leads/${leadId}`),
};

// Payment APIs
export const paymentAPI = {
  purchaseLead: (data) => apiClient.post('/payments/purchase', data),
};

// Lead Submission API (for testing)
export const leadAPI = {
  submitLead: (data) => apiClient.post('/leads', data),
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
  getLeads: (params) => apiClient.get('/admin', { params: { action: 'leads', ...params } }),
  getAgents: (params) => apiClient.get('/admin', { params: { action: 'agents', ...params } }),
  getTransactions: (params) => apiClient.get('/admin', { params: { action: 'transactions', ...params } }),
  performAction: (data) => apiClient.post('/admin', data),
  // Bulk packages
  createBulkPackage: (data) => apiClient.post('/admin/bulk-packages', data),
  getAllPackages: () => apiClient.get('/admin/bulk-packages'),
};

// Bulk Packages APIs
export const bulkPackagesAPI = {
  getAvailablePackages: () => apiClient.get('/bulk-packages'),
  purchasePackage: (packageId) => apiClient.post(`/bulk-packages/${packageId}/purchase`),
  purchaseCustomBulk: (leadCount, pricePerLead) => apiClient.post('/bulk-packages/custom', { leadCount, pricePerLead }),
};

// Feedback APIs
export const feedbackAPI = {
  submitLeadFeedback: (data) => apiClient.post('/feedback/lead', data),
  submitClientSurvey: (data) => apiClient.post('/feedback/survey', data),
  getLeadFeedback: (leadId) => apiClient.get(`/feedback/lead/${leadId}`),
  getFeedbackStats: () => apiClient.get('/feedback/stats'),
  getPendingFeedback: () => apiClient.get('/feedback/pending'),
  getAIAnalytics: () => apiClient.get('/feedback/analytics'), // Admin only
};

export default apiClient;
