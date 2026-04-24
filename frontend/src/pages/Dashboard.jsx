import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import { agentAPI } from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import './Dashboard.css';

// ─── localStorage helpers ──────────────────────────────────────────────────────
function getAgentLeads() {
  try { return JSON.parse(localStorage.getItem('je_agent_leads') || '[]'); } catch { return []; }
}
function getStageHistory() {
  try { return JSON.parse(localStorage.getItem('je_stage_history') || '[]'); } catch { return []; }
}

// ─── Lookup tables ─────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'new_lead',       label: 'New Lead',       color: '#C9A84C' },
  { id: 'contacted',      label: 'Contacted',      color: '#2D6A9F' },
  { id: 'appt_set',       label: 'Appt Set',       color: '#6B46C1' },
  { id: 'under_contract', label: 'Under Contract', color: '#0F766E' },
  { id: 'closed',         label: 'Closed',         color: '#15803D' },
];

const LEAD_TYPE_META = {
  expired:         { label: 'Expired',         color: '#D97706', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.3)'   },
  fsbo:            { label: 'FSBO',            color: '#6BA3FF', bg: 'rgba(58,125,255,0.1)',  border: 'rgba(58,125,255,0.25)' },
  pre_foreclosure: { label: 'Pre-Foreclosure', color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
};

function timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * ⚠️ CRITICAL: AI SCHEDULING POLICY ⚠️
 *
 * AI recommendations run ONCE PER DAY at 8:00 AM via AWS Bedrock (Amazon Nova Micro).
 * Results are cached in localStorage and reused throughout the day.
 * NO manual refresh button — AI updates happen automatically at 8 AM only.
 */

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [leadActivities, setLeadActivities] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [lastAIRun, setLastAIRun] = useState(() => {
    const cached = localStorage.getItem('aiRecommendationsTime');
    return cached ? new Date(cached) : null;
  });
  const [lastActivityHash, setLastActivityHash] = useState('');

  useEffect(() => {
    fetchDashboardData();
    loadActivities();
    loadCachedRecommendations();
    getCurrentUser().then(setAuthUser).catch(() => {});
  }, []);

  // Monitor activity changes and filter recommendations (NO AI CALL)
  useEffect(() => {
    const currentHash = JSON.stringify(leadActivities);
    if (lastActivityHash && currentHash !== lastActivityHash && recommendations.length > 0) {
      filterRecommendationsBasedOnActivity();
    }
    setLastActivityHash(currentHash);
  }, [leadActivities]);

  const filterRecommendationsBasedOnActivity = () => {
    const now = new Date();
    const filtered = recommendations.filter(({ transaction, lead }) => {
      const activities = leadActivities[transaction.leadId] || [];
      if (activities.length === 0) return true;
      const lastActivity = new Date(activities[activities.length - 1].timestamp);
      const daysSinceLastContact = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
      if (daysSinceLastContact >= 3 && lead.funnelStage !== 'closed') return true;
      if (lead.score >= 7 && daysSinceLastContact >= 2) return true;
      return false;
    });
    setRecommendations(filtered);
    localStorage.setItem('aiRecommendations', JSON.stringify(filtered));
  };

  const loadActivities = () => {
    const saved = localStorage.getItem('leadActivities');
    if (saved) {
      try { setLeadActivities(JSON.parse(saved)); } catch {}
    }
  };

  const loadCachedRecommendations = () => {
    const cachedRecs = localStorage.getItem('aiRecommendations');
    const cachedTime = localStorage.getItem('aiRecommendationsTime');
    if (cachedRecs && cachedTime) {
      try {
        setLastAIRun(new Date(cachedTime));
        setRecommendations(JSON.parse(cachedRecs));
      } catch {}
    }
  };

  const shouldRunAI = () => {
    if (!lastAIRun) return true;
    const now = new Date();
    const lastRunDate = new Date(lastAIRun);
    const isSameDay =
      lastRunDate.getFullYear() === now.getFullYear() &&
      lastRunDate.getMonth()    === now.getMonth()    &&
      lastRunDate.getDate()     === now.getDate();
    if (isSameDay) return false;
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    return now >= today8AM;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response    = await agentAPI.getProfile();
      const profileData = response.data.data.profile;
      setProfile(profileData);

      if (profileData?.verificationStatus === 'pending') {
        setError('Your account is pending verification. You will receive an email once approved by an administrator.');
        return;
      }
      if (profileData?.verificationStatus === 'denied') {
        setError('Your verification request was denied. Please contact support for more information.');
        return;
      }

      const purchasedLeads  = response.data.data.purchasedLeads || [];
      const individualLeads = purchasedLeads.filter(
        p => p.lead?.leadType !== 'bulk-package' && !p.transaction?.leadId?.startsWith('package#')
      );
      setPurchases(individualLeads);

      loadCachedRecommendations();
      if (shouldRunAI()) {
        await generateAIRecommendations(individualLeads);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateAIRecommendations = async (leads) => {
    // ⚠️ CRITICAL: Only called by shouldRunAI() — once per day at 8 AM
    try {
      const leadsData = leads.map(({ transaction, lead }) => ({
        leadId:       transaction.leadId,
        contact:      lead.contact,
        leadType:     lead.leadType,
        score:        lead.score,
        location:     lead.location,
        funnelStage:  lead.funnelStage || 'new_match',
        purchaseDate: transaction.createdAt,
        activities:   leadActivities[transaction.leadId] || [],
      }));

      const response = await agentAPI.getAIRecommendations(leadsData);
      const aiRecs   = response.data.recommendations || [];

      const formattedRecs = aiRecs.map(aiRec => {
        const purchase = leads.find(p => p.transaction.leadId === aiRec.leadId);
        if (!purchase) return null;
        const { transaction, lead } = purchase;
        const activities       = leadActivities[transaction.leadId] || [];
        const now              = new Date();
        const lastActivity     = activities.length > 0
          ? new Date(activities[activities.length - 1].timestamp)
          : new Date(transaction.createdAt);
        const daysSinceContact = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
        return {
          lead, transaction,
          priority:        aiRec.priority,
          reason:          aiRec.reason,
          action:          aiRec.action,
          daysSinceContact,
          activitiesCount: activities.length,
          confidence:      aiRec.confidence,
        };
      }).filter(Boolean);

      setRecommendations(formattedRecs);
      const now = new Date();
      localStorage.setItem('aiRecommendations',      JSON.stringify(formattedRecs));
      localStorage.setItem('aiRecommendationsTime',  now.toISOString());
      localStorage.setItem('aiRecommendationsModel', response.data.model || 'Unknown');
      setLastAIRun(now);
    } catch {
      setRecommendations([]);
    }
  };

  // ─── Loading / Error guards ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container">
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        {error.includes('pending verification') && (
          <div className="card" style={{ maxWidth: '520px', margin: '60px auto', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <svg width="20" height="20" fill="none" stroke="#C9A84C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 style={{ color: '#E8ECF4', fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', marginBottom: '0.75rem' }}>Account Pending Verification</h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your account is currently under review. An administrator will verify your license information and approve your account shortly.</p>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9rem' }}>You'll receive an email notification once approved. This usually takes 1–2 business days.</p>
          </div>
        )}
        {error.includes('denied') && (
          <div className="card" style={{ maxWidth: '520px', margin: '60px auto', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <svg width="20" height="20" fill="none" stroke="#F87171" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h2 style={{ color: '#E8ECF4', fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', marginBottom: '0.75rem' }}>Verification Request Denied</h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9rem' }}>We were unable to verify your account information. If you believe this is an error, please contact support.</p>
          </div>
        )}
        {!error.includes('pending') && !error.includes('denied') && error.includes('not found') && (
          <div className="card" style={{ maxWidth: '520px', margin: '60px auto', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(58,125,255,0.08)', border: '1px solid rgba(58,125,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <svg width="20" height="20" fill="none" stroke="#6BA3FF" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h2 style={{ color: '#E8ECF4', fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', marginBottom: '0.75rem' }}>Complete Your Profile</h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '1rem', fontSize: '0.9rem' }}>To get started, complete your agent profile with your license, brokerage, service area, and preferences.</p>
            <button onClick={() => navigate('/profile')} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Complete Profile Setup</button>
          </div>
        )}
        {!error.includes('pending') && !error.includes('denied') && !error.includes('not found') && (
          <div className="alert alert-error">{error}</div>
        )}
      </div>
    );
  }

  // ─── Derived data ──────────────────────────────────────────────────────────
  const displayName = (() => {
    const profileFirst = profile?.name?.split(' ')[0];
    if (profileFirst && profileFirst.toLowerCase() !== 'test' && profileFirst.toLowerCase() !== 'agent') {
      return profileFirst;
    }
    const email = authUser?.signInDetails?.loginId || authUser?.username || profile?.email || '';
    if (email) return email.split('@')[0];
    return 'there';
  })();

  const agentLeads   = getAgentLeads();
  const stageHistory = getStageHistory();
  const now          = new Date();
  const weekAgo      = new Date(now - 7 * 24 * 3600 * 1000);

  const activeLeads       = agentLeads.length;
  const contactedThisWeek = agentLeads.filter(l =>
    l.stage === 'contacted' && l.lastContactDate && new Date(l.lastContactDate) >= weekAgo
  ).length;
  const apptsSet    = agentLeads.filter(l => l.stage === 'appt_set').length;
  const dealsClosed = agentLeads.filter(l => l.stage === 'closed').length;

  const pipelineCounts = {};
  PIPELINE_STAGES.forEach(s => {
    pipelineCounts[s.id] = agentLeads.filter(l => l.stage === s.id).length;
  });

  const LEAD_TYPES_LIST = ['expired', 'fsbo', 'pre_foreclosure'];
  const leadTypeBreakdown = LEAD_TYPES_LIST.map(typeId => {
    const meta    = LEAD_TYPE_META[typeId];
    const subset  = agentLeads.filter(l => l.leadType === typeId);
    const stages  = {};
    PIPELINE_STAGES.forEach(s => { stages[s.id] = subset.filter(l => l.stage === s.id).length; });
    return { id: typeId, label: meta.label, color: meta.color, bg: meta.bg, border: meta.border, total: subset.length, stages };
  });

  const todaysFocus = agentLeads.filter(l => {
    if (l.stage === 'appt_set') return true;
    const daysSinceContact = l.lastContactDate
      ? Math.floor((now - new Date(l.lastContactDate)) / 86400000)
      : 999;
    return (l.stage === 'new_lead' || l.stage === 'contacted') && daysSinceContact >= 3;
  }).slice(0, 3);

  return (
    <div className="container dashboard">

      {/* 1 — Header */}
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {displayName}</h1>
          <p className="dashboard-subtitle">Here's your pipeline at a glance.</p>
        </div>
      </div>

      {/* 2 — Today's Focus */}
      {todaysFocus.length > 0 && (
        <div className="card" style={{ marginBottom: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ color: '#E8ECF4', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Today's Focus</h3>
              <p className="card-subtitle" style={{ margin: '0.15rem 0 0' }}>Leads that need your attention right now</p>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#C9A84C', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '0.2rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {todaysFocus.length} Lead{todaysFocus.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {todaysFocus.map(lead => {
              const lt    = LEAD_TYPE_META[lead.leadType] || LEAD_TYPE_META.expired;
              const stage = PIPELINE_STAGES.find(s => s.id === lead.stage);
              return (
                <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#E8ECF4', marginBottom: '0.1rem' }}>{lead.ownerName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.propertyAddress}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ padding: '0.18rem 0.5rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: lt.color, background: lt.bg, border: `1px solid ${lt.border}` }}>{lt.label}</span>
                    {stage && <span style={{ padding: '0.18rem 0.5rem', borderRadius: '8px', fontSize: '0.67rem', fontWeight: 600, color: stage.color, background: `${stage.color}15`, border: `1px solid ${stage.color}40` }}>{stage.label}</span>}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} style={{ padding: '0.3rem 0.65rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', color: '#34D399', fontSize: '0.72rem', textDecoration: 'none', fontWeight: 500 }}>
                        Call
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <a href="/history" style={{ display: 'block', marginTop: '0.875rem', textAlign: 'right', fontSize: '0.78rem', color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>View full funnel →</a>
        </div>
      )}

      {/* 3 — Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">
            <svg width="16" height="16" fill="none" stroke="#C9A84C" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{activeLeads}</div>
            <div className="stat-label">Active Leads</div>
            <div className="stat-trend">In your pipeline</div>
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-icon">
            <svg width="16" height="16" fill="none" stroke="#3A7DFF" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{contactedThisWeek}</div>
            <div className="stat-label">Contacted This Week</div>
            <div className="stat-trend">Last 7 days</div>
          </div>
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-icon">
            <svg width="16" height="16" fill="none" stroke="#F59E0B" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{apptsSet}</div>
            <div className="stat-label">Appointments Set</div>
            <div className="stat-trend">Active right now</div>
          </div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-icon">
            <svg width="16" height="16" fill="none" stroke="#10B981" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{dealsClosed}</div>
            <div className="stat-label">Deals Closed</div>
            <div className="stat-trend">All time</div>
          </div>
        </div>
      </div>

      {/* 3.5 — Lead Type Breakdown */}
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ color: '#E8ECF4', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.2rem' }}>Lead Type Breakdown</h3>
          <p style={{ color: '#4A5568', fontSize: '0.8rem', margin: 0 }}>Your pipeline organized by prospecting type</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {leadTypeBreakdown.map(lt => (
            <div
              key={lt.id}
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${lt.border}`, borderRadius: '14px', padding: '1.25rem 1.375rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, color: lt.color, background: lt.bg, border: `1px solid ${lt.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {lt.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: lt.color, fontFamily: '"Playfair Display", serif', lineHeight: 1 }}>{lt.total}</div>
                  <div style={{ fontSize: '0.65rem', color: '#4A5568', marginTop: '0.15rem' }}>total</div>
                </div>
              </div>

              {/* Stage rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {PIPELINE_STAGES.map(stage => {
                  const count = lt.stages[stage.id] || 0;
                  const pct   = lt.total > 0 ? Math.round((count / lt.total) * 100) : 0;
                  return (
                    <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: '80px', fontSize: '0.7rem', color: count > 0 ? '#9CA3AF' : '#374151', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {stage.label}
                      </div>
                      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: count > 0 ? stage.color : 'transparent', borderRadius: '2px', transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: '18px', fontSize: '0.72rem', fontWeight: 600, color: count > 0 ? stage.color : '#374151', textAlign: 'right', flexShrink: 0 }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 — AI Recommendations */}
      <div className="card ai-recommendations-card">
        <div className="card-header-with-icon">
          <h3>AI Recommended Actions</h3>
          <div className="ai-info">
            <span className="ai-badge">HomeMatch AI</span>
            {lastAIRun && (
              <span className="ai-timestamp">
                Last updated: {formatDateTime(lastAIRun.toISOString())}
                {now.getHours() >= 8 ? ' · Next: Tomorrow at 8:00 AM' : ' · Next: Today at 8:00 AM'}
              </span>
            )}
          </div>
        </div>

        {recommendations.length > 0 ? (
          <>
            <p className="card-subtitle">Based on your lead activity and engagement patterns</p>
            <div className="recommendations-list">
              {recommendations.map(({ lead, transaction, priority, reason, action, daysSinceContact, activitiesCount }, index) => (
                <div key={`rec-${transaction.transactionId}-${transaction.leadId}-${index}`} className={`recommendation-item priority-${priority}`}>
                  <div className="recommendation-priority">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: priority === 'high' ? '#EF4444' : '#F59E0B', marginTop: '6px' }} />
                  </div>
                  <div className="recommendation-content">
                    <div className="recommendation-header">
                      <h4>{lead.contact?.name}</h4>
                      <span className={`priority-badge priority-${priority}`}>{priority.toUpperCase()}</span>
                    </div>
                    <div className="recommendation-details">
                      <span className="lead-type-badge">{lead.leadType === 'buyer' ? 'Buyer' : 'Seller'}</span>
                      <span className="lead-score">Score: {lead.score}/10</span>
                      <span className="lead-location">{lead.location?.city}</span>
                    </div>
                    <div className="recommendation-reason"><strong>Why:</strong> {reason}</div>
                    <div className="recommendation-action"><strong>Action:</strong> {action}</div>
                    <div className="recommendation-meta">
                      <span>{activitiesCount} interaction{activitiesCount !== 1 ? 's' : ''}</span>
                      <span>{daysSinceContact} day{daysSinceContact !== 1 ? 's' : ''} ago</span>
                    </div>
                  </div>
                  <div className="recommendation-actions">
                    <a href="/history" className="btn btn-sm btn-primary">Take Action</a>
                    <a href={`tel:${lead.contact?.phone}`} className="btn btn-sm btn-outline">Call</a>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="all-caught-up">
            <div className="caught-up-icon">
              <svg width="36" height="36" fill="none" stroke="#C9A84C" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4>No recommendations yet.</h4>
            <p>Add leads to your pipeline to get AI-powered action suggestions.</p>
            <p className="caught-up-hint">
              {lastAIRun
                ? `Next AI analysis: ${now.getHours() >= 8 ? 'Tomorrow' : 'Today'} at 8:00 AM`
                : 'AI analysis runs daily at 8:00 AM once you have leads.'}
            </p>
          </div>
        )}
      </div>

      {/* 5 — Pipeline Overview + Recent Activity */}
      <div className="grid grid-2">

        {/* Pipeline Overview */}
        <div className="card">
          <h3>Pipeline Overview</h3>
          <p className="card-subtitle">Where your leads stand</p>
          <div className="pipeline-stats">
            {PIPELINE_STAGES.map(stage => {
              const count = pipelineCounts[stage.id] || 0;
              const pct   = agentLeads.length > 0 ? Math.round((count / agentLeads.length) * 100) : 0;
              return (
                <div key={stage.id} className="pipeline-stat-item">
                  <div className="pipeline-stat-header">
                    <span className="pipeline-label" style={{ color: stage.color }}>{stage.label}</span>
                  </div>
                  <div className="pipeline-stat-value">
                    <span className="count">{count}</span>
                    <div className="pipeline-bar">
                      <div className="pipeline-bar-fill" style={{ width: `${pct}%`, background: stage.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <a href="/history" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>View Full Funnel</a>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3>Recent Activity</h3>
          <p className="card-subtitle">Stage changes across your pipeline</p>
          <div className="recent-activity-list">
            {stageHistory.length === 0 ? (
              <div className="empty-state">
                <p>No activity yet</p>
                <p className="empty-hint">Stage changes you make in your funnel will appear here.</p>
              </div>
            ) : (
              stageHistory.slice(0, 5).map((entry, i) => {
                const fromStage = PIPELINE_STAGES.find(s => s.id === entry.fromStage);
                const toStage   = PIPELINE_STAGES.find(s => s.id === entry.toStage);
                return (
                  <div key={i} className="activity-item">
                    <div className="activity-icon">
                      <svg width="14" height="14" fill="none" stroke="#C9A84C" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">{entry.ownerName}</div>
                      <div className="activity-note">
                        <span style={{ color: '#6B7280' }}>{fromStage?.label || entry.fromStage}</span>
                        {' → '}
                        <span style={{ color: toStage?.color || '#E8ECF4', fontWeight: 600 }}>{toStage?.label || entry.toStage}</span>
                      </div>
                      <div className="activity-time">{timeAgo(entry.timestamp)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <a href="/history" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>Go to Funnel</a>
        </div>
      </div>

      {/* 6 — Quick Actions */}
      <div className="card">
        <h3 style={{ color: '#E8ECF4', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Quick Actions</h3>
        <div className="action-buttons">
          <a href="/history" className="btn btn-primary">View My Funnel</a>
          <button onClick={() => navigate('/history')} className="btn btn-outline">Add New Lead</button>
          <a href="/profile" className="btn btn-outline">View Profile</a>
          <a href="mailto:joseph@josephesfandiari.com" className="btn btn-outline">Contact Support</a>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
