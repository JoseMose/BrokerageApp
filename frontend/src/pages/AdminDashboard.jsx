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
            {['overview', 'analytics', 'agents', 'leads', 'transactions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab data={dashboardData} analytics={analyticsData} />}
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
  return (
    <div className="text-center py-12 text-gray-500">
      Lead management coming soon...
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
