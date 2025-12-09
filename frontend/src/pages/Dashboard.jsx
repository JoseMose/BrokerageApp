import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import AssignedLeads from '../components/AssignedLeads';
import './Dashboard.css';

/**
 * ⚠️ CRITICAL: AI SCHEDULING POLICY ⚠️
 * 
 * AI-powered recommendations using AWS BEDROCK run ONLY ONCE PER DAY at 8:00 AM.
 * 
 * AI Model: Amazon Nova Micro (primary) with Claude 3 Sonnet (fallback)
 * Endpoint: POST /agents/ai-recommendations
 * 
 * How it works:
 * 1. shouldRunAI() checks if current time has passed today's 8 AM AND AI hasn't run yet today
 * 2. generateAIRecommendations() makes the ACTUAL AWS BEDROCK API CALL - ONLY called by shouldRunAI()
 * 3. Backend handler (ai-recommendations.ts) sends all lead data to Bedrock for analysis
 * 4. AI analyzes leads and returns prioritized recommendations with reasons
 * 5. Results are cached in localStorage and reused throughout the day
 * 6. When user logs activities, filterRecommendationsBasedOnActivity() does CLIENT-SIDE
 *    filtering (NO AI CALL) to remove completed recommendations
 * 7. If all recommendations are resolved, shows "All Caught Up" state
 * 
 * NO OTHER CODE should call generateAIRecommendations() - this prevents AI usage leaks.
 * NO manual refresh button exists - AI updates happen automatically at 8 AM only.
 * 
 * Cost: ~$0.0001-0.0003 per recommendation with Amazon Nova Micro (very cheap)
 */

function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [leadActivities, setLeadActivities] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [lastAIRun, setLastAIRun] = useState(null);
  const [lastActivityHash, setLastActivityHash] = useState('');

  useEffect(() => {
    fetchDashboardData();
    loadActivities();
    loadCachedRecommendations();
  }, []);

  // Monitor activity changes and filter recommendations (NO AI CALL)
  useEffect(() => {
    const currentHash = JSON.stringify(leadActivities);
    if (lastActivityHash && currentHash !== lastActivityHash && recommendations.length > 0) {
      // Filter out recommendations for leads that now have recent activity
      filterRecommendationsBasedOnActivity();
    }
    setLastActivityHash(currentHash);
  }, [leadActivities]);

  const filterRecommendationsBasedOnActivity = () => {
    // This is CLIENT-SIDE filtering only - NO AI API CALL
    const now = new Date();
    const filtered = recommendations.filter(({ transaction, lead }) => {
      const leadId = transaction.leadId;
      const activities = leadActivities[leadId] || [];
      
      if (activities.length === 0) return true; // Still needs contact
      
      const lastActivity = new Date(activities[activities.length - 1].timestamp);
      const daysSinceLastContact = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
      
      // Keep in recommendations if still needs attention
      if (daysSinceLastContact >= 3 && lead.funnelStage !== 'closed') return true;
      if (lead.score >= 7 && daysSinceLastContact >= 2) return true;
      
      return false;
    });
    
    setRecommendations(filtered);
    
    // Update cache with filtered results (NO AI INVOLVED)
    localStorage.setItem('aiRecommendations', JSON.stringify(filtered));
  };

  const loadActivities = () => {
    const savedActivities = localStorage.getItem('leadActivities');
    if (savedActivities) {
      try {
        setLeadActivities(JSON.parse(savedActivities));
      } catch (err) {
        console.error('Error loading activities:', err);
      }
    }
  };

  const loadCachedRecommendations = () => {
    const cachedRecs = localStorage.getItem('aiRecommendations');
    const cachedTime = localStorage.getItem('aiRecommendationsTime');
    
    if (cachedRecs && cachedTime) {
      try {
        const lastRun = new Date(cachedTime);
        setLastAIRun(lastRun);
        setRecommendations(JSON.parse(cachedRecs));
      } catch (err) {
        console.error('Error loading cached recommendations:', err);
      }
    }
  };

  const shouldRunAI = () => {
    if (!lastAIRun) return true; // Never run before
    
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    
    // If current time is before 8 AM today, check if AI ran yesterday at 8 AM or later
    if (now < today8AM) {
      const yesterday8AM = new Date(today8AM);
      yesterday8AM.setDate(yesterday8AM.getDate() - 1);
      return lastAIRun < yesterday8AM;
    }
    
    // If current time is after 8 AM today, check if AI has run today at 8 AM or later
    return lastAIRun < today8AM;
  };

  // REMOVED: No manual refresh button - AI ONLY runs at 8 AM daily

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getProfile();
      setProfile(response.data.data.profile);
      setStats(response.data.data.stats);
      
      const purchasedLeads = response.data.data.purchasedLeads || [];
      const individualLeads = purchasedLeads.filter(
        p => p.lead?.leadType !== 'bulk-package' && !p.transaction?.leadId?.startsWith('package#')
      );
      setPurchases(individualLeads);
      
      // ⚠️ CRITICAL: AI ONLY runs at 8 AM daily - NO OTHER TRIGGERS
      if (shouldRunAI()) {
        console.log('🤖 AI Analysis scheduled for 8:00 AM - Calling AWS Bedrock...');
        await generateAIRecommendations(individualLeads);
      } else {
        console.log('✅ Using cached AI recommendations. Next AI run: Tomorrow at 8:00 AM');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateAIRecommendations = async (leads) => {
    // ⚠️ CRITICAL: This function should ONLY be called by shouldRunAI() at 8 AM
    console.log('🤖 CALLING AWS BEDROCK - This should only happen once per day at 8 AM');
    
    try {
      // Prepare lead data for AI analysis
      const leadsData = leads.map(({ transaction, lead }) => ({
        leadId: transaction.leadId,
        contact: lead.contact,
        leadType: lead.leadType,
        score: lead.score,
        location: lead.location,
        funnelStage: lead.funnelStage || 'new_match',
        purchaseDate: transaction.createdAt,
        activities: leadActivities[transaction.leadId] || [],
      }));

      // Call backend AI recommendations endpoint
      const response = await agentAPI.getAIRecommendations(leadsData);
      const aiRecs = response.data.recommendations || [];
      
      console.log(`✅ AWS Bedrock returned ${aiRecs.length} AI-powered recommendations`);
      console.log(`📊 Model used: ${response.data.model}`);

      // Map AI recommendations to our format
      const formattedRecs = aiRecs.map(aiRec => {
        const purchase = leads.find(p => p.transaction.leadId === aiRec.leadId);
        if (!purchase) return null;

        const { transaction, lead } = purchase;
        const activities = leadActivities[transaction.leadId] || [];
        const now = new Date();
        const lastActivity = activities.length > 0 
          ? new Date(activities[activities.length - 1].timestamp)
          : new Date(transaction.createdAt);
        const daysSinceContact = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        return {
          lead,
          transaction,
          priority: aiRec.priority,
          reason: aiRec.reason,
          action: aiRec.action,
          daysSinceContact,
          activitiesCount: activities.length,
          confidence: aiRec.confidence,
        };
      }).filter(Boolean);

      setRecommendations(formattedRecs);
      
      // Cache recommendations and timestamp
      const now = new Date();
      localStorage.setItem('aiRecommendations', JSON.stringify(formattedRecs));
      localStorage.setItem('aiRecommendationsTime', now.toISOString());
      localStorage.setItem('aiRecommendationsModel', response.data.model || 'Unknown');
      setLastAIRun(now);
      
      console.log(`✅ AI recommendations cached successfully`);
    } catch (error) {
      console.error('❌ Failed to get AI recommendations:', error);
      // Fall back to empty recommendations on error
      setRecommendations([]);
    }
  };

  const getFunnelStageCounts = () => {
    const counts = {
      new_match: 0,
      first_outreach: 0,
      connected: 0,
      qualified: 0,
      appointment_set: 0,
      active_client: 0,
      under_contract: 0,
      closed: 0
    };
    
    purchases.forEach(({ lead }) => {
      const stage = lead?.funnelStage || 'new_match';
      if (counts[stage] !== undefined) {
        counts[stage]++;
      }
    });
    
    return counts;
  };

  const getUrgentTasks = () => {
    const tasks = [];
    const now = new Date();
    
    // Count leads without any contact
    const noContact = purchases.filter(({ transaction, lead }) => {
      const activities = leadActivities[transaction.leadId] || [];
      return activities.length === 0 && lead?.funnelStage !== 'closed';
    }).length;
    
    if (noContact > 0) {
      tasks.push({
        icon: '🚨',
        text: `${noContact} lead${noContact > 1 ? 's' : ''} need${noContact === 1 ? 's' : ''} first contact`,
        urgent: true
      });
    }
    
    // Count leads in appointment stage
    const appointments = purchases.filter(({ lead }) => 
      lead?.funnelStage === 'appointment_set'
    ).length;
    
    if (appointments > 0) {
      tasks.push({
        icon: '📅',
        text: `${appointments} upcoming appointment${appointments > 1 ? 's' : ''}`,
        urgent: false
      });
    }
    
    // Count under contract
    const underContract = purchases.filter(({ lead }) => 
      lead?.funnelStage === 'under_contract'
    ).length;
    
    if (underContract > 0) {
      tasks.push({
        icon: '📝',
        text: `${underContract} deal${underContract > 1 ? 's' : ''} under contract`,
        urgent: false
      });
    }
    
    return tasks;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">{error}</div>
        {error.includes('not found') && (
          <div className="card">
            <h3>Welcome! Complete Your Profile</h3>
            <p>To start viewing and purchasing leads, please complete your agent profile.</p>
            <a href="/profile" className="btn btn-primary">
              Set Up Profile
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {profile?.name?.split(' ')[0] || 'Agent'}! 👋</h1>
          <p className="dashboard-subtitle">Here's what needs your attention today</p>
        </div>
        <a href="/marketplace" className="btn btn-primary">
          Browse New Leads
        </a>
      </div>

      {/* Urgent Tasks Alert */}
      {getUrgentTasks().length > 0 && (
        <div className="urgent-tasks-banner">
          <div className="urgent-tasks-content">
            {getUrgentTasks().map((task, index) => (
              <div key={index} className={`urgent-task ${task.urgent ? 'urgent' : ''}`}>
                <span className="task-icon">{task.icon}</span>
                <span className="task-text">{task.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{purchases.length || 0}</div>
            <div className="stat-label">Active Leads</div>
            <div className="stat-trend">In your pipeline</div>
          </div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats?.totalSpent || 0)}</div>
            <div className="stat-label">Total Invested</div>
            <div className="stat-trend">Lifetime</div>
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-value">
              {getFunnelStageCounts().closed || 0}
            </div>
            <div className="stat-label">Deals Closed</div>
            <div className="stat-trend">All time</div>
          </div>
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-icon">�</div>
          <div className="stat-content">
            <div className="stat-value">{recommendations.filter(r => r.priority === 'high').length}</div>
            <div className="stat-label">High Priority</div>
            <div className="stat-trend">Need attention now</div>
          </div>
        </div>
      </div>

      {/* AI Recommendations - Priority Section */}
      <div className="card ai-recommendations-card">
        <div className="card-header-with-icon">
          <h3>🤖 AI Recommended Actions</h3>
          <div className="ai-info">
            <span className="ai-badge">
              {localStorage.getItem('aiRecommendationsModel') 
                ? `AWS ${localStorage.getItem('aiRecommendationsModel').includes('nova') ? 'Nova' : 'Bedrock'}`
                : 'Powered by AI'
              }
            </span>
            {lastAIRun && (
              <span className="ai-timestamp">
                Last updated: {formatDateTime(lastAIRun.toISOString())}
                {(() => {
                  const now = new Date();
                  const tomorrow8AM = new Date(now);
                  tomorrow8AM.setDate(tomorrow8AM.getDate() + 1);
                  tomorrow8AM.setHours(8, 0, 0, 0);
                  
                  if (now.getHours() >= 8) {
                    return ` • Next: Tomorrow at 8:00 AM`;
                  } else {
                    return ` • Next: Today at 8:00 AM`;
                  }
                })()}
              </span>
            )}
          </div>
        </div>
        
        {recommendations.length > 0 ? (
          <>
            <p className="card-subtitle">Based on your lead activity and engagement patterns</p>
            
            <div className="recommendations-list">
              {recommendations.map(({ lead, transaction, priority, reason, action, daysSinceContact, activitiesCount }) => (
                <div key={transaction.transactionId} className={`recommendation-item priority-${priority}`}>
                  <div className="recommendation-priority">
                    {priority === 'high' ? '🔴' : '🟡'}
                  </div>
                  <div className="recommendation-content">
                    <div className="recommendation-header">
                      <h4>{lead.contact?.name}</h4>
                      <span className={`priority-badge priority-${priority}`}>
                        {priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="recommendation-details">
                      <span className="lead-type-badge">
                        {lead.leadType === 'buyer' ? '🏠 Buyer' : '🏡 Seller'}
                      </span>
                      <span className="lead-score">Score: {lead.score}/10</span>
                      <span className="lead-location">📍 {lead.location?.city}</span>
                    </div>
                    <div className="recommendation-reason">
                      <strong>Why:</strong> {reason}
                    </div>
                    <div className="recommendation-action">
                      <strong>Action:</strong> {action}
                    </div>
                    <div className="recommendation-meta">
                      <span>👥 {activitiesCount} interaction{activitiesCount !== 1 ? 's' : ''}</span>
                      <span>⏱️ {daysSinceContact} day{daysSinceContact !== 1 ? 's' : ''} ago</span>
                    </div>
                  </div>
                  <div className="recommendation-actions">
                    <a 
                      href={`/history`} 
                      className="btn btn-sm btn-primary"
                    >
                      Take Action
                    </a>
                    <a 
                      href={`tel:${lead.contact?.phone}`} 
                      className="btn btn-sm btn-outline"
                    >
                      📞 Call
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="all-caught-up">
            <div className="caught-up-icon">✨</div>
            <h4>You're All Caught Up!</h4>
            <p>Great work! No urgent actions needed right now. Your leads are getting the attention they need.</p>
            <p className="caught-up-hint">Check back tomorrow at 8:00 AM for your next AI-powered recommendations.</p>
          </div>
        )}
      </div>

      <div className="grid grid-2">
        {/* Pipeline Overview */}
        <div className="card">
          <h3>📊 Pipeline Overview</h3>
          <p className="card-subtitle">Where your leads are in the funnel</p>
          <div className="pipeline-stats">
            {[
              { id: 'new_match', label: 'New Match', icon: '🎯' },
              { id: 'first_outreach', label: 'First Outreach', icon: '📞' },
              { id: 'connected', label: 'Connected', icon: '💬' },
              { id: 'qualified', label: 'Qualified', icon: '✅' },
              { id: 'appointment_set', label: 'Appointment Set', icon: '📅' },
              { id: 'active_client', label: 'Active Client', icon: '🤝' },
              { id: 'under_contract', label: 'Under Contract', icon: '📝' },
              { id: 'closed', label: 'Closed', icon: '🏆' },
            ].map(stage => {
              const count = getFunnelStageCounts()[stage.id];
              const percentage = purchases.length > 0 ? (count / purchases.length) * 100 : 0;
              
              return (
                <div key={stage.id} className="pipeline-stat-item">
                  <div className="pipeline-stat-header">
                    <span className="pipeline-icon">{stage.icon}</span>
                    <span className="pipeline-label">{stage.label}</span>
                  </div>
                  <div className="pipeline-stat-value">
                    <span className="count">{count}</span>
                    <div className="pipeline-bar">
                      <div 
                        className="pipeline-bar-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <a href="/history" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
            View Full Funnel
          </a>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3>⚡ Recent Activity</h3>
          <p className="card-subtitle">Your latest interactions</p>
          <div className="recent-activity-list">
            {(() => {
              const allActivities = [];
              Object.entries(leadActivities).forEach(([leadId, activities]) => {
                const purchase = purchases.find(p => p.transaction.leadId === leadId);
                if (purchase) {
                  activities.forEach(activity => {
                    allActivities.push({
                      ...activity,
                      leadName: purchase.lead?.contact?.name,
                      leadId
                    });
                  });
                }
              });
              
              allActivities.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
              );
              
              const recentActivities = allActivities.slice(0, 5);
              
              if (recentActivities.length === 0) {
                return (
                  <div className="empty-state">
                    <p>No activities logged yet</p>
                    <p className="empty-hint">Start logging your lead interactions!</p>
                  </div>
                );
              }
              
              return recentActivities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'call' ? '📞' : 
                     activity.type === 'text' ? '💬' : 
                     activity.type === 'email' ? '📧' : '📅'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">
                      {activity.type === 'call' ? 'Called' : 
                       activity.type === 'text' ? 'Texted' : 
                       activity.type === 'email' ? 'Emailed' : 'Met with'} {activity.leadName}
                    </div>
                    <div className="activity-note">{activity.notes}</div>
                    <div className="activity-time">{formatDateTime(activity.timestamp)}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
          <a href="/history" className="btn btn-outline" style={{ marginTop: '1rem', width: '100%' }}>
            Log New Activity
          </a>
        </div>
      </div>

      {/* Assigned Leads Section */}
      <div className="card">
        <AssignedLeads />
      </div>

      <div className="card">
        <h3>⚡ Quick Actions</h3>
        <div className="action-buttons">
          <a href="/marketplace" className="btn btn-primary">
            🛒 Browse New Leads
          </a>
          <a href="/history" className="btn btn-outline">
            📊 View My Funnel
          </a>
          <a href="/bulk" className="btn btn-outline">
            📦 Buy Bulk Package
          </a>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
