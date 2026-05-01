import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../utils/ibmAuth';
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
import { adminAPI, masterLeadsAPI } from '../utils/api';

const COLORS = ['#C9A84C', '#10B981', '#3A7DFF', '#EF4444'];

// Shared dark card style
const darkCard = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '14px',
  overflow: 'hidden',
};

const darkCardInner = { padding: '1.25rem 1.5rem' };

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

  const checkAdminAccess = () => {
    const user   = getCurrentUser();
    const groups = user?.['cognito:groups'] || [];

    if (!groups.includes('Admin') && !groups.includes('Admins')) {
      alert('Access denied. Admin privileges required.');
      navigate('/dashboard');
      return;
    }

    setLoading(false);
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
      <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    logout();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'rgba(8,12,22,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: 11, color: '#0A0F1E' }}>JE</div>
              <div>
                <div style={{ color: '#E8ECF4', fontWeight: 600, fontSize: '0.9rem' }}>Admin Console</div>
                <div style={{ color: '#4A5568', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Joseph Esfandiari RE</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem', color: '#9CA3AF', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#E8ECF4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                Agent View
              </button>
              <button
                onClick={handleSignOut}
                style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem', color: '#F87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ background: 'rgba(8,12,22,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
          <nav style={{ display: 'flex', gap: '0', overflowX: 'auto' }}>
            {['overview', 'verification', 'analytics', 'agents', 'leads', 'transactions', 'master-leads'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.875rem 1.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                  letterSpacing: '0.04em',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? '#C9A84C' : 'transparent'}`,
                  color: activeTab === tab ? '#C9A84C' : '#6B7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#9CA3AF'; }}
                onMouseLeave={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#6B7280'; }}
              >
                {tab === 'verification' && verificationRequests && verificationRequests.count > 0 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    verification
                    <span style={{ background: '#EF4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{verificationRequests.count}</span>
                  </span>
                ) : tab === 'master-leads' ? 'Master Leads' : tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: activeTab === 'leads' ? '100%' : '1280px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {activeTab === 'overview' && <OverviewTab data={dashboardData} analytics={analyticsData} />}
        {activeTab === 'verification' && <VerificationTab requests={verificationRequests} onUpdate={fetchData} />}
        {activeTab === 'analytics' && <AnalyticsTab data={analyticsData} />}
        {activeTab === 'agents' && <AgentsTab performance={agentPerformance} />}
        {activeTab === 'leads' && <LeadsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'master-leads' && <MasterLeadsTab />}
      </main>
    </div>
  );
}

function OverviewTab({ data, analytics }) {
  if (!data || !analytics) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading...</div>;
  }

  // Debug logging
  console.log('OverviewTab data:', data);
  console.log('OverviewTab analytics:', analytics);

  if (!data.stats) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#F87171', fontSize: '0.875rem' }}>Error: Dashboard data is missing stats. Check console.</div>;
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4' }} labelStyle={{ color: '#9CA3AF' }} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: '0.82rem', paddingTop: '0.75rem' }} />
              <Line type="monotone" dataKey="count" stroke="#C9A84C" name="Total" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="buyers" stroke="#3A7DFF" name="Buyers" dot={false} />
              <Line type="monotone" dataKey="sellers" stroke="#10B981" name="Sellers" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Over Time */}
        <ChartCard title="Revenue by Month">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4' }} labelStyle={{ color: '#9CA3AF' }} formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: '0.82rem', paddingTop: '0.75rem' }} />
              <Bar dataKey="revenue" fill="#C9A84C" name="Revenue" radius={[4, 4, 0, 0]} />
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
                { range: '1–3 Low', count: analytics.scoreDistribution['1-3'] },
                { range: '4–5 Med', count: analytics.scoreDistribution['4-5'] },
                { range: '6–7 High', count: analytics.scoreDistribution['6-7'] },
                { range: '8–10 Top', count: analytics.scoreDistribution['8-10'] },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4' }} labelStyle={{ color: '#9CA3AF' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                <Cell fill="#F87171" />
                <Cell fill="#FCD34D" />
                <Cell fill="#C9A84C" />
                <Cell fill="#34D399" />
              </Bar>
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
                labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                label={({ cx, cy, midAngle, outerRadius, name, percent }) => {
                  const RADIAN = Math.PI / 180;
                  const x = cx + (outerRadius + 28) * Math.cos(-midAngle * RADIAN);
                  const y = cy + (outerRadius + 28) * Math.sin(-midAngle * RADIAN);
                  return <text x={x} y={y} fill="#9CA3AF" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '0.75rem' }}>{`${name} ${(percent * 100).toFixed(0)}%`}</text>;
                }}
                outerRadius={100}
                dataKey="value"
              >
                {[0, 1].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4' }} labelStyle={{ color: '#9CA3AF' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function AnalyticsTab({ data }) {
  if (!data) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#E8ECF4', fontFamily: '"Playfair Display", serif' }}>Detailed Analytics</h2>

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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#E8ECF4' }} labelStyle={{ color: '#9CA3AF' }} formatter={(value) => `$${value.toLocaleString()}`} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: '0.82rem', paddingTop: '0.75rem' }} />
            <Line type="monotone" dataKey="revenue" stroke="#C9A84C" strokeWidth={2.5} name="Revenue" dot={false} />
            <Line type="monotone" dataKey="transactions" stroke="#3A7DFF" strokeWidth={1.5} name="Transactions" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AgentsTab({ performance }) {
  if (!performance) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading agent performance...</div>;
  }

  const thStyle = { padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' };
  const tdStyle = { padding: '0.875rem 1.25rem', fontSize: '0.85rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#E8ECF4', fontFamily: '"Playfair Display", serif' }}>
        Agent Leaderboard <span style={{ color: '#6B7280', fontWeight: 400, fontSize: '0.85rem' }}>({performance.totalAgents} total)</span>
      </h2>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rank', 'Agent', 'Status', 'Purchases', 'Total Spent', 'Avg Score', 'Last Activity'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {performance.leaderboard.map((agent, index) => (
                <tr key={agent.agentId}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>#{index + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ color: '#E8ECF4', fontWeight: 500, marginBottom: '0.15rem', fontSize: '0.875rem' }}>{agent.name}</div>
                    <div style={{ color: '#4A5568', fontSize: '0.78rem' }}>{agent.email}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                      background: agent.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                      color: agent.status === 'active' ? '#34D399' : '#6B7280',
                      border: `1px solid ${agent.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                      {agent.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#E8ECF4' }}>{agent.metrics.totalPurchases}</td>
                  <td style={{ ...tdStyle, color: '#E8ECF4' }}>${agent.metrics.totalSpent.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: '#E8ECF4' }}>{agent.metrics.averageLeadScore.toFixed(1)}</td>
                  <td style={tdStyle}>{new Date(agent.metrics.lastActivity).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Lead storage helpers (localStorage) ─────────────────────────────────────
const LS_LEADS_KEY = 'je_admin_leads';
const LS_TRANSACTIONS_KEY = 'je_admin_transactions';

const SEED_ADMIN_LEADS = [
  { id: 'lead_001', ownerName: 'Robert Chambers', propertyAddress: '842 Roswell Rd NE, Marietta, GA 30062', leadType: 'expired', phone: '(770) 555-0182', email: 'rchambers@email.com', status: 'contacted', assignedAgent: '', lastContactDate: '2026-04-08', notes: 'Listed for 94 days, expired March 31. Motivated — mentioned divorce.', createdAt: '2026-04-01' },
  { id: 'lead_002', ownerName: 'Patricia Osei', propertyAddress: '2214 Memorial Dr SE, Atlanta, GA 30317', leadType: 'fsbo', phone: '(404) 555-0247', email: 'posei44@gmail.com', status: 'new', assignedAgent: '', lastContactDate: '', notes: 'Sign in yard since 3/15. Zillow listing has been up 29 days.', createdAt: '2026-04-05' },
  { id: 'lead_003', ownerName: 'Marcus Webb', propertyAddress: '510 Flat Shoals Ave SE, Atlanta, GA 30316', leadType: 'pre-foreclosure', phone: '(678) 555-0391', email: '', status: 'appointment', assignedAgent: '', lastContactDate: '2026-04-10', notes: '90 days behind. NOD filed 3/22. Appointment set for 4/17.', createdAt: '2026-04-03' },
  { id: 'lead_004', ownerName: 'Sandra Kim', propertyAddress: '1751 Briarcliff Rd NE, Atlanta, GA 30306', leadType: 'expired', phone: '(404) 555-0614', email: 'skim.atl@gmail.com', status: 'new', assignedAgent: '', lastContactDate: '', notes: 'Expired after 62 days. Price was likely too high for the market.', createdAt: '2026-04-07' },
];

const SEED_ADMIN_TRANSACTIONS = [
  { id: 'txn_001', propertyAddress: '5821 Windmill Dr, Acworth, GA 30101', agentId: 'Joseph Esfandiari', type: 'buy', closeDate: '2026-02-14', salePrice: 312000, commissionRate: 3, commissionAmount: 9360, transactionFee: 250, transactionFeePaid: true, status: 'closed', notes: 'Represented buyer. Negotiated $8K under ask.' },
  { id: 'txn_002', propertyAddress: '3309 Tully Rd, Decatur, GA 30032', agentId: 'Joseph Esfandiari', type: 'sell', closeDate: '2026-03-05', salePrice: 285000, commissionRate: 3, commissionAmount: 8550, transactionFee: 250, transactionFeePaid: true, status: 'closed', notes: 'Listed and sold in 18 days. Dual agency, split commission.' },
  { id: 'txn_003', propertyAddress: '1104 Edgewood Ave SE, Atlanta, GA 30307', agentId: 'Joseph Esfandiari', type: 'invest', closeDate: '2026-04-02', salePrice: 297000, commissionRate: 3, commissionAmount: 8910, transactionFee: 250, transactionFeePaid: false, status: 'closed', notes: 'Investment acquisition. Added to portfolio.' },
];

function getAdminLeads() {
  try { return JSON.parse(localStorage.getItem(LS_LEADS_KEY)) || null; } catch { return null; }
}
function saveAdminLeads(leads) { localStorage.setItem(LS_LEADS_KEY, JSON.stringify(leads)); }
function initAdminLeads() {
  const existing = getAdminLeads();
  if (!existing) { saveAdminLeads(SEED_ADMIN_LEADS); return SEED_ADMIN_LEADS; }
  return existing;
}

function getAdminTransactions() {
  try { return JSON.parse(localStorage.getItem(LS_TRANSACTIONS_KEY)) || null; } catch { return null; }
}
function saveAdminTransactions(txns) { localStorage.setItem(LS_TRANSACTIONS_KEY, JSON.stringify(txns)); }
function initAdminTransactions() {
  const existing = getAdminTransactions();
  if (!existing) { saveAdminTransactions(SEED_ADMIN_TRANSACTIONS); return SEED_ADMIN_TRANSACTIONS; }
  return existing;
}

const LEAD_TYPE_META = {
  expired:         { label: 'Expired',        color: '#FCD34D', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  fsbo:            { label: 'FSBO',           color: '#6BA3FF', bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.25)' },
  'pre-foreclosure':{ label: 'Pre-Foreclosure', color: '#F87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)' },
};

const STATUS_META = {
  new:             { label: 'New',            color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)' },
  contacted:       { label: 'Contacted',      color: '#6BA3FF', bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.2)'  },
  appointment:     { label: 'Appt Set',       color: '#C9A84C', bg: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.2)'  },
  'under-contract':{ label: 'Under Contract', color: '#A78BFA', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)'  },
  closed:          { label: 'Closed',         color: '#34D399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)'  },
  dead:            { label: 'Dead',           color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)'  },
};

const EMPTY_LEAD_FORM = { ownerName: '', propertyAddress: '', leadType: 'expired', phone: '', email: '', status: 'new', lastContactDate: '', notes: '' };

function LeadTypeBadge({ type }) {
  const m = LEAD_TYPE_META[type] || LEAD_TYPE_META.expired;
  return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>{m.label}</span>;
}
function StatusBadgeLead({ status }) {
  const m = STATUS_META[status] || STATUS_META.new;
  return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_LEAD_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none', fontFamily: '"Inter", sans-serif' };
  const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.35rem' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: '#E8ECF4', marginBottom: '1.5rem' }}>Add Prospecting Lead</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Owner Name *</label>
            <input style={fieldStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="John Smith" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Property Address *</label>
            <input style={fieldStyle} value={form.propertyAddress} onChange={e => set('propertyAddress', e.target.value)} placeholder="123 Main St, Atlanta, GA 30301" />
          </div>
          <div>
            <label style={labelStyle}>Lead Type</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.leadType} onChange={e => set('leadType', e.target.value)}>
              <option value="expired" style={{ background: '#0D1220' }}>Expired Listing</option>
              <option value="fsbo" style={{ background: '#0D1220' }}>FSBO</option>
              <option value="pre-foreclosure" style={{ background: '#0D1220' }}>Pre-Foreclosure</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#0D1220' }}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={fieldStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(404) 555-0100" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={fieldStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@email.com" type="email" />
          </div>
          <div>
            <label style={labelStyle}>Last Contact Date</label>
            <input style={fieldStyle} value={form.lastContactDate} onChange={e => set('lastContactDate', e.target.value)} type="date" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: '80px' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Motivation, timing, key details..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', fontSize: '0.85rem', color: '#9CA3AF', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { if (!form.ownerName || !form.propertyAddress) return; onSave({ ...form, id: `lead_${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] }); onClose(); }} style={{ padding: '0.625rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#0A0F1E', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Add Lead</button>
        </div>
      </div>
    </div>
  );
}

function FunnelChart({ leads, activeStage, onStageClick }) {
  const stages = [
    { key: 'all',             label: 'New Leads',      color: '#C9A84C', dropColor: 'rgba(201,168,76,0.12)' },
    { key: 'contacted',       label: 'Contacted',      color: '#6BA3FF', dropColor: 'rgba(58,125,255,0.1)'  },
    { key: 'appointment',     label: 'Appt Set',       color: '#A78BFA', dropColor: 'rgba(139,92,246,0.1)'  },
    { key: 'under-contract',  label: 'Under Contract', color: '#34D399', dropColor: 'rgba(16,185,129,0.1)'  },
    { key: 'closed',          label: 'Closed Won',     color: '#10B981', dropColor: 'rgba(16,185,129,0.15)' },
  ];

  const counts = {
    all:              leads.length,
    contacted:        leads.filter(l => ['contacted','appointment','under-contract','closed'].includes(l.status)).length,
    appointment:      leads.filter(l => ['appointment','under-contract','closed'].includes(l.status)).length,
    'under-contract': leads.filter(l => ['under-contract','closed'].includes(l.status)).length,
    closed:           leads.filter(l => l.status === 'closed').length,
  };

  const top = counts.all || 1;
  // Funnel widths: each stage is narrower. 100% → 80% → 60% → 42% → 26%
  const widths = [100, 80, 60, 42, 26];

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.75rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#6B7280' }}>Prospecting Pipeline</div>
          <div style={{ fontSize: '0.82rem', color: '#4A5568', marginTop: '0.2rem' }}>{leads.length} total leads · click a stage to filter</div>
        </div>
        {activeStage !== 'all' && (
          <button onClick={() => onStageClick('all')} style={{ fontSize: '0.72rem', color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer' }}>
            Clear filter ×
          </button>
        )}
      </div>

      {/* Funnel */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
        {stages.map((s, i) => {
          const count  = counts[s.key];
          const pct    = top > 0 ? Math.round((count / top) * 100) : 0;
          const dropPct = i > 0 ? Math.round(((counts[stages[i-1].key] - count) / (counts[stages[i-1].key] || 1)) * 100) : null;
          const isActive = activeStage === s.key;
          const w = widths[i];

          return (
            <div key={s.key} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Drop indicator between stages */}
              {i > 0 && dropPct > 0 && (
                <div style={{ fontSize: '0.65rem', color: '#EF4444', opacity: 0.7, marginBottom: '2px', letterSpacing: '0.04em' }}>
                  ▼ {dropPct}% dropped
                </div>
              )}

              {/* Funnel bar — trapezoid via clip-path */}
              <button
                onClick={() => onStageClick(isActive ? 'all' : s.key)}
                style={{
                  width: `${w}%`,
                  height: '52px',
                  background: isActive
                    ? `linear-gradient(135deg, ${s.color}33, ${s.color}22)`
                    : s.dropColor,
                  border: `1px solid ${isActive ? s.color : s.color + '44'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.22s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 1rem',
                  outline: 'none',
                  boxShadow: isActive ? `0 0 0 1px ${s.color}66, 0 4px 20px ${s.color}22` : 'none',
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = s.color + '88'; e.currentTarget.style.background = s.dropColor.replace('0.1', '0.15').replace('0.12', '0.18'); } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = s.color + '44'; e.currentTarget.style.background = s.dropColor; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}88`, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#E8ECF4' : '#9CA3AF', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color, fontFamily: '"Playfair Display", serif', lineHeight: 1 }}>{count}</span>
                  <span style={{ fontSize: '0.7rem', color: '#6B7280', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {stages.map((s) => (
          <div key={s.key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#E8ECF4', fontFamily: '"Playfair Display", serif' }}>{counts[s.key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadsTab() {
  const [leads, setLeads] = useState(() => initAdminLeads());
  const [filter, setFilter] = useState('all');
  const [funnelStage, setFunnelStage] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null); // leadId

  const reload = () => setLeads(getAdminLeads() || []);

  const handleAddLead = (lead) => { saveAdminLeads([...leads, lead]); reload(); };

  const updateLeadStatus = (id, status) => {
    const updated = leads.map(l => l.id === id ? { ...l, status } : l);
    saveAdminLeads(updated);
    setLeads(updated);
    setEditingStatus(null);
  };

  const deleteLead = (id) => {
    if (!confirm('Delete this lead?')) return;
    const updated = leads.filter(l => l.id !== id);
    saveAdminLeads(updated);
    setLeads(updated);
  };

  // Metric counts
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const contactedThisWeek = leads.filter(l => l.lastContactDate && new Date(l.lastContactDate) >= weekAgo).length;
  const appointmentsSet   = leads.filter(l => l.status === 'appointment').length;
  const closedCount       = leads.filter(l => l.status === 'closed').length;
  const conversionRate    = leads.length > 0 ? ((closedCount / leads.length) * 100).toFixed(0) + '%' : '0%';

  // Filtering
  const typeFilters = ['all', 'expired', 'fsbo', 'pre-foreclosure', 'contacted', 'appointment', 'under-contract'];
  let filteredLeads = leads;
  if (funnelStage !== 'all') {
    if (funnelStage === 'contacted')       filteredLeads = filteredLeads.filter(l => ['contacted','appointment','under-contract','closed'].includes(l.status));
    else if (funnelStage === 'appointment') filteredLeads = filteredLeads.filter(l => ['appointment','under-contract','closed'].includes(l.status));
    else filteredLeads = filteredLeads.filter(l => l.status === funnelStage);
  }
  if (filter !== 'all' && !['contacted','appointment','under-contract'].includes(filter)) {
    filteredLeads = filteredLeads.filter(l => l.leadType === filter);
  } else if (['contacted','appointment','under-contract'].includes(filter)) {
    filteredLeads = filteredLeads.filter(l => l.status === filter);
  }

  const filterBtnStyle = (active, danger = false) => ({
    padding: '0.4rem 0.875rem', fontSize: '0.78rem', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
    background: active ? (danger ? 'rgba(239,68,68,0.15)' : 'rgba(201,168,76,0.12)') : 'rgba(255,255,255,0.04)',
    color: active ? (danger ? '#F87171' : '#C9A84C') : '#6B7280',
    border: `1px solid ${active ? (danger ? 'rgba(239,68,68,0.25)' : 'rgba(201,168,76,0.25)') : 'rgba(255,255,255,0.07)'}`,
  });

  const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Leads"          value={leads.length} />
        <StatCard label="Contacted This Week"  value={contactedThisWeek} />
        <StatCard label="Appointments Set"     value={appointmentsSet} />
        <StatCard label="Conversion Rate"      value={conversionRate} />
      </div>

      {/* Funnel */}
      <FunnelChart leads={leads} activeStage={funnelStage} onStageClick={setFunnelStage} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',              label: `All (${leads.length})` },
            { key: 'expired',          label: `Expired (${leads.filter(l => l.leadType === 'expired').length})` },
            { key: 'fsbo',             label: `FSBO (${leads.filter(l => l.leadType === 'fsbo').length})` },
            { key: 'pre-foreclosure',  label: `Pre-FC (${leads.filter(l => l.leadType === 'pre-foreclosure').length})` },
            { key: 'contacted',        label: `Contacted (${leads.filter(l => l.status === 'contacted').length})` },
            { key: 'appointment',      label: `Appt (${leads.filter(l => l.status === 'appointment').length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} style={filterBtnStyle(filter === key)}>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '9px', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
        >
          + Add Lead
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Owner', 'Property Address', 'Type', 'Status', 'Phone', 'Last Contact', 'Notes', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const tm = LEAD_TYPE_META[lead.leadType] || LEAD_TYPE_META.expired;
                const sm = STATUS_META[lead.status]     || STATUS_META.new;
                return (
                  <tr key={lead.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <div style={{ color: '#E8ECF4', fontWeight: 500 }}>{lead.ownerName}</div>
                      {lead.email && <div style={{ color: '#6B7280', fontSize: '0.72rem' }}>{lead.email}</div>}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '220px' }}>
                      <div style={{ color: '#9CA3AF', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.propertyAddress}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: tm.bg, color: tm.color, border: `1px solid ${tm.border}`, whiteSpace: 'nowrap' }}>{tm.label}</span>
                    </td>
                    <td style={tdStyle}>
                      {editingStatus === lead.id ? (
                        <select
                          autoFocus
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          onBlur={() => setEditingStatus(null)}
                          style={{ background: '#0D1220', border: '1px solid rgba(201,168,76,0.4)', borderRadius: '6px', color: '#E8ECF4', fontSize: '0.78rem', padding: '0.2rem 0.4rem', outline: 'none', cursor: 'pointer' }}
                        >
                          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#0D1220' }}>{v.label}</option>)}
                        </select>
                      ) : (
                        <span
                          onClick={() => setEditingStatus(lead.id)}
                          style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`, whiteSpace: 'nowrap', cursor: 'pointer' }}
                          title="Click to change status"
                        >{sm.label}</span>
                      )}
                    </td>
                    <td style={tdStyle}>{lead.phone || <span style={{ color: '#4A5568' }}>—</span>}</td>
                    <td style={tdStyle}>{lead.lastContactDate || <span style={{ color: '#4A5568' }}>—</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: '200px' }}>
                      <div style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.notes || '—'}</div>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        style={{ fontSize: '0.72rem', color: '#F87171', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                      >Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280', fontSize: '0.875rem' }}>
            No leads found
          </div>
        )}
      </div>

      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} onSave={handleAddLead} />}
    </div>
  );
}

function TransactionsTab() {
  const [transactions, setTransactions] = useState(() => initAdminTransactions());

  const toggleFeePaid = (id) => {
    const updated = transactions.map(t => t.id === id ? { ...t, transactionFeePaid: !t.transactionFeePaid } : t);
    saveAdminTransactions(updated);
    setTransactions(updated);
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const feesThisMonth = transactions.filter(t => t.transactionFeePaid && t.closeDate?.startsWith(thisMonth)).reduce((s, t) => s + t.transactionFee, 0);
  const feesPending   = transactions.filter(t => !t.transactionFeePaid).reduce((s, t) => s + t.transactionFee, 0);
  const ytdVolume     = transactions.filter(t => t.closeDate?.startsWith(String(now.getFullYear()))).reduce((s, t) => s + t.salePrice, 0);

  const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Transactions"    value={transactions.length} />
        <StatCard label="Fees Collected (Mo.)"  value={`$${feesThisMonth.toLocaleString()}`} />
        <StatCard label="Pending Fees"          value={`$${feesPending.toLocaleString()}`} />
        <StatCard label="YTD Volume"            value={`$${(ytdVolume / 1000).toFixed(0)}K`} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Property', 'Agent', 'Type', 'Close Date', 'Sale Price', 'Commission', 'Txn Fee', 'Fee Status', 'Action'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => {
                const typeColors = { buy: '#6BA3FF', sell: '#C9A84C', invest: '#34D399' };
                return (
                  <tr key={txn.id}
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...tdStyle, maxWidth: '220px' }}>
                      <div style={{ color: '#E8ECF4', fontWeight: 500, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.propertyAddress}</div>
                      {txn.notes && <div style={{ color: '#6B7280', fontSize: '0.72rem', marginTop: '0.1rem' }}>{txn.notes}</div>}
                    </td>
                    <td style={tdStyle}>{txn.agentId}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: typeColors[txn.type] || '#9CA3AF', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', textTransform: 'capitalize' }}>{txn.type}</span>
                    </td>
                    <td style={tdStyle}>{txn.closeDate}</td>
                    <td style={{ ...tdStyle, color: '#E8ECF4', fontWeight: 500 }}>${txn.salePrice.toLocaleString()}</td>
                    <td style={{ ...tdStyle, color: '#C9A84C' }}>${txn.commissionAmount.toLocaleString()}</td>
                    <td style={tdStyle}>${txn.transactionFee}</td>
                    <td style={tdStyle}>
                      {txn.transactionFeePaid
                        ? <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: '#34D399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>Paid ✓</span>
                        : <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: '#FCD34D', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>Pending</span>}
                    </td>
                    <td style={tdStyle}>
                      {!txn.transactionFeePaid && (
                        <button
                          onClick={() => toggleFeePaid(txn.id)}
                          style={{ fontSize: '0.72rem', color: '#34D399', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                        >Mark Paid</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280', fontSize: '0.875rem' }}>No transactions yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Master Leads Tab ──────────────────────────────────────────────────────────
const ML_TYPE_META = {
  expired:         { label: 'Expired',         color: '#C9A84C' },
  fsbo:            { label: 'FSBO',            color: '#6BA3FF' },
  pre_foreclosure: { label: 'Pre-Foreclosure', color: '#F87171' },
};

const EMPTY_ML_FORM = {
  ownerName: '', propertyAddress: '', leadType: 'expired',
  phone: '', email: '', notes: '',
};

function AddMasterLeadModal({ onClose, onSave }) {
  const [form, setForm]   = useState(EMPTY_ML_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.ownerName || !form.propertyAddress) return;
    setSaving(true);
    try {
      const res = await masterLeadsAPI.create(form);
      onSave(res.data.data?.lead);
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none',
    fontFamily: '"Inter", sans-serif',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.68rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '0.35rem',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '18px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', color: '#E8ECF4', margin: 0 }}>Add Master Lead</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Owner Name *</label>
            <input style={fieldStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Robert Chambers" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Property Address *</label>
            <input style={fieldStyle} value={form.propertyAddress} onChange={e => set('propertyAddress', e.target.value)} placeholder="842 Roswell Rd NE, Marietta, GA 30062" />
          </div>
          <div>
            <label style={labelStyle}>Lead Type</label>
            <select style={{ ...fieldStyle, cursor: 'pointer' }} value={form.leadType} onChange={e => set('leadType', e.target.value)}>
              <option value="expired" style={{ background: '#0D1220' }}>Expired Listing</option>
              <option value="fsbo" style={{ background: '#0D1220' }}>FSBO</option>
              <option value="pre_foreclosure" style={{ background: '#0D1220' }}>Pre-Foreclosure</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={fieldStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(770) 555-0182" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Email</label>
            <input style={fieldStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@email.com" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...fieldStyle, resize: 'vertical', minHeight: '80px' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Motivation, property condition, timeline..."
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.ownerName || !form.propertyAddress}
            style={{ padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '10px', color: '#0A0F1E', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: (!form.ownerName || !form.propertyAddress || saving) ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MasterLeadsTab() {
  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [seeding, setSeeding]       = useState(false);
  const [archiving, setArchiving]   = useState(null);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await masterLeadsAPI.getAll();
      setLeads(res.data.data?.leads || []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleSeed = async () => {
    if (!confirm('Seed the master leads table with the 6 default Georgia leads? This will skip if the table already has data.')) return;
    setSeeding(true);
    try {
      const res = await masterLeadsAPI.seed();
      alert(res.data.data?.message || 'Done');
      await loadLeads();
    } catch (err) {
      alert(err.response?.data?.error || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Archive this lead? It will be removed from the agent pool.')) return;
    setArchiving(id);
    try {
      await masterLeadsAPI.archive(id);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to archive');
    } finally {
      setArchiving(null);
    }
  };

  const displayed = filterType === 'all' ? leads : leads.filter(l => l.leadType === filterType);

  const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  const filterBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setFilterType(key)}
      style={{
        padding: '0.4rem 0.875rem', fontSize: '0.78rem', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
        background: filterType === key ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
        color: filterType === key ? '#C9A84C' : '#6B7280',
        border: `1px solid ${filterType === key ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Pool"      value={leads.length} />
        <StatCard label="Expired"         value={leads.filter(l => l.leadType === 'expired').length} />
        <StatCard label="FSBO"            value={leads.filter(l => l.leadType === 'fsbo').length} />
        <StatCard label="Pre-Foreclosure" value={leads.filter(l => l.leadType === 'pre_foreclosure').length} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {filterBtn('all', `All (${leads.length})`)}
          {filterBtn('expired', `Expired (${leads.filter(l => l.leadType === 'expired').length})`)}
          {filterBtn('fsbo', `FSBO (${leads.filter(l => l.leadType === 'fsbo').length})`)}
          {filterBtn('pre_foreclosure', `Pre-FC (${leads.filter(l => l.leadType === 'pre_foreclosure').length})`)}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSeed}
            disabled={seeding}
            style={{ padding: '0.5rem 1rem', background: 'rgba(107,163,255,0.08)', border: '1px solid rgba(107,163,255,0.2)', borderRadius: '8px', color: '#6BA3FF', fontSize: '0.8rem', fontWeight: 600, cursor: seeding ? 'wait' : 'pointer' }}
          >
            {seeding ? 'Seeding...' : 'Seed Defaults'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)', border: 'none', borderRadius: '8px', color: '#0A0F1E', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Owner', 'Address', 'Type', 'Phone', 'Email', 'Notes', 'Added', 'Action'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(lead => {
                  const meta = ML_TYPE_META[lead.leadType] || ML_TYPE_META.expired;
                  return (
                    <tr key={lead.id}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ ...tdStyle, color: '#E8ECF4', fontWeight: 500 }}>{lead.ownerName}</td>
                      <td style={{ ...tdStyle, maxWidth: '220px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.propertyAddress}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, color: meta.color, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={tdStyle}>{lead.phone || '—'}</td>
                      <td style={tdStyle}>{lead.email || '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6B7280', fontSize: '0.78rem' }}>{lead.notes || '—'}</div>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{lead.createdAt?.slice(0, 10) || '—'}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => handleArchive(lead.id)}
                          disabled={archiving === lead.id}
                          style={{ fontSize: '0.72rem', color: '#F87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: archiving === lead.id ? 'wait' : 'pointer' }}
                        >
                          {archiving === lead.id ? '...' : 'Archive'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280', fontSize: '0.875rem' }}>
                No leads in pool. Use "Seed Defaults" to add the 6 starter leads, or click "+ Add Lead".
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddMasterLeadModal
          onClose={() => setShowAddModal(false)}
          onSave={lead => { if (lead) setLeads(prev => [lead, ...prev]); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1.25rem 1.5rem', transition: 'border-color 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#E8ECF4', fontFamily: '"Playfair Display", serif', lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1.25rem' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ label, count, color }) {
  const colorMap = {
    blue:   { bg: 'rgba(58,125,255,0.08)',   border: 'rgba(58,125,255,0.2)',   text: '#6BA3FF' },
    green:  { bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.2)',   text: '#34D399' },
    yellow: { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)',   text: '#FCD34D' },
    red:    { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)',    text: '#F87171' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.text, fontFamily: '"Playfair Display", serif', lineHeight: 1.1 }}>{count}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6B7280', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
}

function VerificationTab({ requests, onUpdate }) {
  const [processingId, setProcessingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [showDenyModal, setShowDenyModal] = useState(null);

  if (!requests) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading verification requests...</div>;
  }

  const handleApprove = async (agentId) => {
    if (!confirm('Are you sure you want to approve this agent?')) return;

    setProcessingId(agentId);
    try {
      await adminAPI.performAction({ action: 'approve_agent', agentId });
      alert('Agent approved successfully!');
      onUpdate();
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
      await adminAPI.performAction({ action: 'deny_agent', agentId, reason: denyReason });
      alert('Agent denied.');
      setShowDenyModal(null);
      setDenyReason('');
      onUpdate();
    } catch (error) {
      console.error('Deny error:', error);
      alert('Failed to deny agent: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  if (requests.count === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '50%', margin: '0 auto 1rem' }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#34D399" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#E8ECF4', marginBottom: '0.35rem' }}>No pending requests</h3>
        <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>All agent verification requests have been processed.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#E8ECF4', fontFamily: '"Playfair Display", serif', marginBottom: '0.25rem' }}>
          Agent Verification Requests
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#6B7280' }}>{requests.count} pending approval</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        {requests.requests.map((agent, idx) => (
          <div
            key={agent.agentId}
            style={{
              padding: '1.5rem',
              borderBottom: idx < requests.requests.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1.25rem',
            }}
          >
            {/* Avatar */}
            <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.08))', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.1rem', color: '#C9A84C' }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#E8ECF4' }}>{agent.name}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '0.2rem' }}>{agent.email}</div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: '1rem' }}>
                Requested {new Date(agent.verificationRequestedAt).toLocaleString()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'License', value: `${agent.licenseId} (${agent.licenseState})` },
                  { label: 'Brokerage', value: agent.brokerage },
                  { label: 'Phone', value: agent.phone },
                  { label: 'Location', value: `${agent.location?.city}, ${agent.location?.state}` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B7280', marginBottom: '0.2rem' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', color: '#C9C9C9' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => handleApprove(agent.agentId)}
                disabled={processingId === agent.agentId}
                style={{
                  padding: '0.5rem 1.125rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                  background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.25)',
                  opacity: processingId === agent.agentId ? 0.5 : 1, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}
              >
                {processingId === agent.agentId ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowDenyModal(agent.agentId)}
                disabled={processingId === agent.agentId}
                style={{
                  padding: '0.5rem 1.125rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.08)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)',
                  opacity: processingId === agent.agentId ? 0.5 : 1, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Deny Modal */}
      {showDenyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#E8ECF4', fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Deny Verification Request</h3>
            <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Please provide a reason for denying this agent's verification request:
            </p>
            <textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              rows={4}
              placeholder="e.g., License number could not be verified, Invalid brokerage information, etc."
              style={{
                width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', color: '#E8ECF4', fontSize: '0.875rem', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: '"Inter", sans-serif',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => handleDeny(showDenyModal)}
                disabled={processingId === showDenyModal || !denyReason.trim()}
                style={{
                  flex: 1, padding: '0.625rem 1rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)',
                  opacity: (processingId === showDenyModal || !denyReason.trim()) ? 0.5 : 1, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              >
                {processingId === showDenyModal ? 'Processing...' : 'Confirm Deny'}
              </button>
              <button
                onClick={() => { setShowDenyModal(null); setDenyReason(''); }}
                style={{
                  flex: 1, padding: '0.625rem 1rem', fontSize: '0.85rem', fontWeight: 500, borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#E8ECF4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
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
