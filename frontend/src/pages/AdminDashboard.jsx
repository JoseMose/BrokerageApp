import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { adminAPI } from '../utils/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [agentPerformance, setAgentPerformance] = useState(null);
  const [verificationRequests, setVerificationRequests] = useState(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchData();
    }
  }, [activeTab, loading]);

  const checkAdminAccess = async () => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] || [];

      // Accept both 'Admin' and 'Admins' for backwards compatibility
      if (!groups.includes('Admin') && !groups.includes('Admins')) {
        alert('Access denied. Admin privileges required.');
        navigate('/dashboard');
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error('Admin auth check failed:', error);
      navigate('/login');
    }
  };

  const fetchData = async () => {
    try {
      if (activeTab === 'overview') {
        const [dashboardRes, analyticsRes] = await Promise.all([
          adminAPI.getDashboard(),
          adminAPI.getAnalytics(),
        ]);
        console.log('Dashboard response:', dashboardRes.data);
        console.log('Analytics response:', analyticsRes.data);
        setDashboardData(dashboardRes.data.data);
        setAnalyticsData(analyticsRes.data.data);
      } else if (activeTab === 'agents') {
        const performanceRes = await adminAPI.getAgentPerformance();
        console.log('Agent performance response:', performanceRes.data);
        setAgentPerformance(performanceRes.data.data);
      } else if (activeTab === 'verification') {
        const verificationRes = await adminAPI.getVerificationRequests();
        console.log('Verification requests response:', verificationRes.data);
        setVerificationRequests(verificationRes.data.data);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      alert('Failed to load admin data. Check console for details.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Platform Administration & Analytics</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
              >
                Agent View
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {['overview', 'verification', 'analytics', 'agents', 'leads', 'transactions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'verification' && verificationRequests && verificationRequests.count > 0 ? (
                  <span>
                    {tab} <span className="ml-1 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">{verificationRequests.count}</span>
                  </span>
                ) : (
                  tab
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab data={dashboardData} analytics={analyticsData} />}
        {activeTab === 'verification' && <VerificationTab requests={verificationRequests} onUpdate={fetchData} />}
        {activeTab === 'analytics' && <AnalyticsTab data={analyticsData} />}
        {activeTab === 'agents' && <AgentsTab performance={agentPerformance} />}
        {activeTab === 'leads' && <LeadsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
      </main>
    </div>
  );
}

function OverviewTab({ data, analytics }) {
  if (!data || !analytics) {
    return <div className="text-center py-12">Loading...</div>;
  }

  // Debug logging
  console.log('OverviewTab data:', data);
  console.log('OverviewTab analytics:', analytics);

  if (!data.stats) {
    return <div className="text-center py-12 text-red-600">Error: Dashboard data is missing stats. Check console.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Leads" value={data.stats?.totalLeads || 0} />
        <StatCard label="Total Revenue" value={`$${(data.stats?.totalRevenue || 0).toLocaleString()}`} />
        <StatCard label="Active Agents" value={data.stats?.totalAgents || 0} />
        <StatCard label="Transactions" value={data.stats?.totalTransactions || 0} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Over Time */}
        <ChartCard title="Leads Generated (Last 6 Months)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.leadsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3B82F6" name="Total" strokeWidth={2} />
              <Line type="monotone" dataKey="buyers" stroke="#10B981" name="Buyers" />
              <Line type="monotone" dataKey="sellers" stroke="#F59E0B" name="Sellers" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Over Time */}
        <ChartCard title="Revenue by Month">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Score Distribution */}
        <ChartCard title="Lead Score Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { range: '1-3 (Low)', count: analytics.scoreDistribution['1-3'] },
                { range: '4-5 (Medium)', count: analytics.scoreDistribution['4-5'] },
                { range: '6-7 (High)', count: analytics.scoreDistribution['6-7'] },
                { range: '8-10 (Premium)', count: analytics.scoreDistribution['8-10'] },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Lead Type Breakdown */}
        <ChartCard title="Lead Type Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Buyers', value: analytics.leadTypeBreakdown.buyer },
                  { name: 'Sellers', value: analytics.leadTypeBreakdown.seller },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {[0, 1].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function AnalyticsTab({ data }) {
  if (!data) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Detailed Analytics</h2>

      {/* Status Breakdown */}
      <ChartCard title="Lead Status Distribution">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          <StatusBadge label="Available" count={data.statusBreakdown.available} color="blue" />
          <StatusBadge label="Sold" count={data.statusBreakdown.sold} color="green" />
          <StatusBadge label="Assigned" count={data.statusBreakdown.assigned} color="yellow" />
          <StatusBadge label="Expired" count={data.statusBreakdown.expired} color="red" />
        </div>
      </ChartCard>

      {/* Revenue Chart */}
      <ChartCard title="Revenue Trends">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data.revenueByMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} name="Revenue" />
            <Line type="monotone" dataKey="transactions" stroke="#3B82F6" name="Transactions" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AgentsTab({ performance }) {
  if (!performance) {
    return <div className="text-center py-12">Loading agent performance...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Agent Leaderboard ({performance.totalAgents} total)
        </h2>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchases</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {performance.leaderboard.map((agent, index) => (
              <tr key={agent.agentId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                  <div className="text-sm text-gray-500">{agent.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      agent.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {agent.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {agent.metrics.totalPurchases}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${agent.metrics.totalSpent.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {agent.metrics.averageLeadScore.toFixed(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(agent.metrics.lastActivity).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, with-feedback, without-feedback

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getLeads();
      console.log('Admin leads response:', response.data);
      setLeads(response.data.data?.leads || []);
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (filter === 'with-feedback') return lead.hasFeedback;
    if (filter === 'without-feedback') return !lead.hasFeedback && lead.status === 'sold';
    return true;
  });

  const leadsWithFeedback = leads.filter(l => l.hasFeedback).length;
  const averageFeedbackScore = leads.filter(l => l.feedbackScore)
    .reduce((sum, l) => sum + l.feedbackScore, 0) / (leadsWithFeedback || 1);

  if (loading) {
    return <div className="text-center py-12">Loading leads...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="With Feedback" value={leadsWithFeedback} />
        <StatCard 
          label="Avg Feedback Score" 
          value={averageFeedbackScore.toFixed(2) + '/5'} 
        />
        <StatCard 
          label="Feedback Rate" 
          value={((leadsWithFeedback / leads.filter(l => l.status === 'sold').length || 1) * 100).toFixed(0) + '%'} 
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Leads ({leads.length})
        </button>
        <button
          onClick={() => setFilter('with-feedback')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'with-feedback'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          With Feedback ({leadsWithFeedback})
        </button>
        <button
          onClick={() => setFilter('without-feedback')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'without-feedback'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Awaiting Feedback ({leads.filter(l => !l.hasFeedback && l.status === 'sold').length})
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feedback</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacted</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommend</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLeads.map((lead) => (
              <tr key={lead.leadId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                  {lead.leadId.substring(0, 12)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    lead.leadType === 'buyer' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {lead.leadType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {lead.location?.city}, {lead.location?.state}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`font-bold ${
                    lead.score >= 8 ? 'text-green-600' :
                    lead.score >= 5 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {lead.score}/10
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${lead.price}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    lead.status === 'sold'
                      ? 'bg-green-100 text-green-800'
                      : lead.status === 'available'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {lead.hasFeedback ? (
                    <span className="text-green-600 font-medium">✓ Yes</span>
                  ) : lead.status === 'sold' ? (
                    <span className="text-orange-600">Pending</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {lead.feedbackScore ? (
                    <span className={`font-bold ${
                      lead.feedbackScore >= 4 ? 'text-green-600' :
                      lead.feedbackScore >= 3 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {lead.feedbackScore.toFixed(1)}/5 ⭐
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {lead.contacted === true ? (
                    <span className="text-green-600">✓</span>
                  ) : lead.contacted === false ? (
                    <span className="text-red-600">✗</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {lead.wouldRecommend === true ? (
                    <span className="text-green-600">✓</span>
                  ) : lead.wouldRecommend === false ? (
                    <span className="text-red-600">✗</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionsTab() {
  return (
    <div className="text-center py-12 text-gray-500">
      Transaction management coming soon...
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ label, count, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4 text-center`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
    </div>
  );
}

function VerificationTab({ requests, onUpdate }) {
  const [processingId, setProcessingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [showDenyModal, setShowDenyModal] = useState(null);

  if (!requests) {
    return <div className="text-center py-12">Loading verification requests...</div>;
  }

  const handleApprove = async (agentId) => {
    if (!confirm('Are you sure you want to approve this agent?')) return;
    
    setProcessingId(agentId);
    try {
      await adminAPI.performAction({
        action: 'approve_agent',
        agentId,
      });
      alert('Agent approved successfully!');
      onUpdate(); // Refresh the list
    } catch (error) {
      console.error('Approve error:', error);
      alert('Failed to approve agent: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (agentId) => {
    if (!denyReason.trim()) {
      alert('Please provide a reason for denial');
      return;
    }

    setProcessingId(agentId);
    try {
      await adminAPI.performAction({
        action: 'deny_agent',
        agentId,
        reason: denyReason,
      });
      alert('Agent denied.');
      setShowDenyModal(null);
      setDenyReason('');
      onUpdate(); // Refresh the list
    } catch (error) {
      console.error('Deny error:', error);
      alert('Failed to deny agent: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.count === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <div className="text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending requests</h3>
          <p className="mt-1 text-sm text-gray-500">All agent verification requests have been processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Agent Verification Requests</h2>
        <p className="mt-1 text-sm text-gray-600">{requests.count} pending approval</p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {requests.requests.map((agent) => (
            <li key={agent.agentId} className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{agent.name}</h3>
                      <p className="text-sm text-gray-500">{agent.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested {new Date(agent.verificationRequestedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">License</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {agent.licenseId} ({agent.licenseState})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Brokerage</dt>
                      <dd className="mt-1 text-sm text-gray-900">{agent.brokerage}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{agent.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Location</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {agent.location.city}, {agent.location.state}
                      </dd>
                    </div>
                  </div>
                </div>

                <div className="ml-6 flex flex-col space-y-2">
                  <button
                    onClick={() => handleApprove(agent.agentId)}
                    disabled={processingId === agent.agentId}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {processingId === agent.agentId ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowDenyModal(agent.agentId)}
                    disabled={processingId === agent.agentId}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Deny Modal */}
      {showDenyModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Deny Verification Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for denying this agent's verification request:
            </p>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows="4"
              placeholder="e.g., License number could not be verified, Invalid brokerage information, etc."
            />
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => handleDeny(showDenyModal)}
                disabled={processingId === showDenyModal || !denyReason.trim()}
                className="flex-1 inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {processingId === showDenyModal ? 'Processing...' : 'Confirm Deny'}
              </button>
              <button
                onClick={() => {
                  setShowDenyModal(null);
                  setDenyReason('');
                }}
                className="flex-1 inline-flex justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
