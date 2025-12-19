import React, { useState, useEffect } from 'react';
import { agentAPI, feedbackAPI } from '../utils/api';
import { formatCurrency, formatDateTime, getLeadTypeLabel } from '../utils/helpers';
import LeadRatingModal from '../components/LeadRatingModal';
import EditLeadModal from '../components/EditLeadModal';
import './PurchaseHistory.css';

// Funnel stages
const FUNNEL_STAGES = [
  { id: 'new_match', label: 'New Match', icon: '🎯', description: 'Lead just assigned to you' },
  { id: 'first_outreach', label: 'First Outreach', icon: '📞', description: 'Attempted contact (text/call)' },
  { id: 'connected', label: 'Connected', icon: '💬', description: 'Lead responded / convo started' },
  { id: 'qualified', label: 'Qualified', icon: '✅', description: 'Confirmed real + viable' },
  { id: 'appointment_set', label: 'Appointment Set', icon: '📅', description: 'Showing/listing scheduled' },
  { id: 'active_client', label: 'Active Client', icon: '🤝', description: 'Officially working together' },
  { id: 'under_contract', label: 'Under Contract', icon: '📝', description: 'Binding agreement signed' },
  { id: 'closed', label: 'Closed', icon: '🏆', description: 'Deal completed!' },
  { id: 'nurture', label: 'Nurture', icon: '🌱', description: 'Long-term follow-up' },
];

// Format questionnaire field names to readable labels
const formatQuestionLabel = (key) => {
  const labels = {
    timeline: '⏱️ Timeline',
    propertyType: '🏠 Property Type',
    budget: '💰 Budget',
    bedrooms: '🛏️ Bedrooms',
    location: '📍 Location',
    prequalified: '✅ Pre-qualified',
    workingWithAgent: '🤝 Working with Agent',
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Format questionnaire answer values to readable text
const formatAnswerValue = (value) => {
  const valueMap = {
    'asap': 'ASAP (Less than 30 days)',
    '1-3-months': '1-3 Months',
    '3-6-months': '3-6 Months',
    '6-months': '6 Months',
    'next-year': 'Next Year',
    'just-browsing': 'Just Browsing',
    'single-family': 'Single Family Home',
    'condo': 'Condo',
    'townhouse': 'Townhouse',
    'multi-family': 'Multi-family',
    'land': 'Land',
    'under-300k': 'Under $300k',
    '300k-500k': '$300k - $500k',
    '500k-750k': '$500k - $750k',
    '750k-1m': '$750k - $1M',
    'over-1m': 'Over $1M',
    'yes': 'Yes',
    'no': 'No',
  };
  return valueMap[value] || String(value);
};

function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [bulkPackages, setBulkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStage, setSelectedStage] = useState('new_match');
  const [expandedLead, setExpandedLead] = useState(null);
  const [showActivityForm, setShowActivityForm] = useState({}); // Track which lead's form is open
  const [activityData, setActivityData] = useState({}); // Store form data per lead
  const [leadActivities, setLeadActivities] = useState({}); // Store activities per lead
  const [ratingModalLead, setRatingModalLead] = useState(null); // Lead being rated
  const [leadFeedback, setLeadFeedback] = useState({}); // Track which leads have feedback
  const [editModalLead, setEditModalLead] = useState(null); // Lead being edited
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    phone: '',
    leadType: 'buyer',
    city: '',
    state: '',
    zip: '',
    budget: '',
    notes: ''
  });

  // Load activities from localStorage on mount
  useEffect(() => {
    const savedActivities = localStorage.getItem('leadActivities');
    if (savedActivities) {
      try {
        setLeadActivities(JSON.parse(savedActivities));
      } catch (err) {
        console.error('Error loading activities:', err);
      }
    }
  }, []);

  // Save activities to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(leadActivities).length > 0) {
      localStorage.setItem('leadActivities', JSON.stringify(leadActivities));
    }
  }, [leadActivities]);

  useEffect(() => {
    fetchPurchaseHistory();
  }, []);

  const fetchPurchaseHistory = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getProfile();
      const purchasedLeads = response.data.data.purchasedLeads || [];
      
      // Separate bulk packages from individual leads
      const packages = purchasedLeads.filter(p => p.lead?.leadType === 'bulk-package' || p.transaction?.leadId?.startsWith('package#'));
      const individualLeads = purchasedLeads.filter(p => p.lead?.leadType !== 'bulk-package' && !p.transaction?.leadId?.startsWith('package#'));
      
      setBulkPackages(packages);
      setPurchases(individualLeads);

      // Check feedback status for each lead
      const feedbackStatus = {};
      for (const { transaction } of individualLeads) {
        try {
          const feedbackResponse = await feedbackAPI.getLeadFeedback(transaction.leadId);
          if (feedbackResponse?.data?.hasFeedback) {
            feedbackStatus[transaction.leadId] = true;
          }
        } catch (err) {
          // Ignore errors, lead just won't show as having feedback
        }
      }
      setLeadFeedback(feedbackStatus);

      // Load activities from database into state
      const activitiesFromDB = {};
      individualLeads.forEach(({ transaction, lead }) => {
        if (lead?.activities && Array.isArray(lead.activities)) {
          activitiesFromDB[transaction.leadId] = lead.activities;
        }
      });
      
      // Merge with localStorage activities (localStorage takes precedence for newer activities)
      setLeadActivities(prev => {
        const merged = { ...activitiesFromDB };
        Object.keys(prev).forEach(leadId => {
          if (merged[leadId]) {
            // Merge and deduplicate by timestamp
            const combined = [...merged[leadId], ...prev[leadId]];
            const unique = Array.from(
              new Map(combined.map(act => [act.timestamp, act])).values()
            );
            merged[leadId] = unique.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          } else {
            merged[leadId] = prev[leadId];
          }
        });
        return merged;
      });
    } catch (err) {
      console.error('Error fetching my leads:', err);
      setError(err.response?.data?.error || 'Failed to load my leads');
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStage = async (leadId, newStage) => {
    try {
      // Update in backend
      await agentAPI.updateLeadStage(leadId, newStage);
      
      // Update locally
      setPurchases(prev => prev.map(p => 
        p.transaction.leadId === leadId 
          ? { ...p, lead: { ...p.lead, funnelStage: newStage } }
          : p
      ));
    } catch (err) {
      console.error('Error updating lead stage:', err);
      setError('Failed to update lead stage');
    }
  };

  const handleEditLead = (lead) => {
    setEditModalLead(lead);
  };

  const handleSaveEdit = async (updatedData) => {
    try {
      await agentAPI.updateLead(editModalLead.leadId, updatedData);
      
      // Update locally
      setPurchases(prev => prev.map(p => 
        p.lead?.leadId === editModalLead.leadId 
          ? { ...p, lead: { ...p.lead, ...updatedData } }
          : p
      ));
      
      setEditModalLead(null);
      alert('Lead updated successfully!');
    } catch (err) {
      console.error('Error updating lead:', err);
      alert('Failed to update lead. Please try again.');
    }
  };

  const handleDeleteLead = async (leadId, leadName) => {
    if (!confirm(`Are you sure you want to delete ${leadName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await agentAPI.deleteLead(leadId);
      
      // Remove from local state
      setPurchases(prev => prev.filter(p => p.lead?.leadId !== leadId));
      
      alert('Lead deleted successfully!');
    } catch (err) {
      console.error('Error deleting lead:', err);
      alert('Failed to delete lead. Please try again.');
    }
  };

  const toggleActivityForm = (leadId) => {
    setShowActivityForm(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
    
    // Initialize form data if not exists
    if (!activityData[leadId]) {
      setActivityData(prev => ({
        ...prev,
        [leadId]: { type: 'call', notes: '' }
      }));
    }
  };

  const updateActivityData = (leadId, field, value) => {
    setActivityData(prev => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        [field]: value
      }
    }));
  };

  const logActivity = async (leadId) => {
    const data = activityData[leadId];
    if (!data || !data.notes.trim()) return;

    const newActivity = {
      id: Date.now(),
      type: data.type,
      notes: data.notes,
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to database
      await agentAPI.logLeadActivity(leadId, newActivity);
      
      // Update local state
      setLeadActivities(prev => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), newActivity]
      }));

      // Reset form
      setActivityData(prev => ({
        ...prev,
        [leadId]: { type: 'call', notes: '' }
      }));
      setShowActivityForm(prev => ({
        ...prev,
        [leadId]: false
      }));

      // Remove AI recommendation for this lead (client-side filtering, no AI call)
      const cachedRecs = localStorage.getItem('aiRecommendations');
      if (cachedRecs) {
        try {
          const recommendations = JSON.parse(cachedRecs);
          const filtered = recommendations.filter(rec => rec.transaction?.leadId !== leadId);
          localStorage.setItem('aiRecommendations', JSON.stringify(filtered));
        } catch (err) {
          console.error('Error filtering recommendations:', err);
        }
      }
    } catch (err) {
      console.error('Error logging activity:', err);
      setError('Failed to log activity');
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      call: '📞',
      text: '💬',
      email: '📧',
      appointment: '📅',
    };
    return icons[type] || '📝';
  };

  const getActivityLabel = (type) => {
    const labels = {
      call: 'Phone Call',
      text: 'Text Message',
      email: 'Email',
      appointment: 'Appointment',
    };
    return labels[type] || 'Activity';
  };

  // Handle rating modal
  const handleRateLeadClick = async (lead, transaction) => {
    // Check if feedback already exists
    try {
      const response = await feedbackAPI.getLeadFeedback(transaction.leadId);
      if (response?.data?.hasFeedback) {
        alert('You have already submitted feedback for this lead');
        return;
      }
    } catch (err) {
      console.error('Error checking feedback:', err);
      // Continue to open modal even if check fails
    }

    setRatingModalLead({ ...lead, leadId: transaction.leadId, transactionId: transaction.transactionId });
  };

  const handleRatingSubmit = async (formData) => {
    try {
      const response = await feedbackAPI.submitLeadFeedback({
        ...formData,
        leadId: ratingModalLead.leadId,
      });

      if (response?.data) {
        // Mark as rated
        setLeadFeedback(prev => ({
          ...prev,
          [ratingModalLead.leadId]: true,
        }));

        alert('Thank you for your feedback! This helps us improve lead quality.');
        setRatingModalLead(null);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert(err?.response?.data?.error || 'Failed to submit feedback. Please try again.');
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    
    try {
      // Create the lead via agent API
      const response = await agentAPI.createOwnLead({
        contact: {
          name: createFormData.name,
          email: createFormData.email,
          phone: createFormData.phone,
        },
        leadType: createFormData.leadType,
        location: {
          city: createFormData.city,
          state: createFormData.state,
          zip: createFormData.zip,
        },
        questionnaire: {
          budget: createFormData.budget || 'not-specified',
        },
        notes: createFormData.notes,
        source: 'agent_manual',
      });

      alert('Lead created successfully! It will appear in your funnel.');
      
      // Reset form and close modal
      setCreateFormData({
        name: '',
        email: '',
        phone: '',
        leadType: 'buyer',
        city: '',
        state: '',
        zip: '',
        budget: '',
        notes: ''
      });
      setShowCreateModal(false);
      
      // Refresh the list
      fetchPurchaseHistory();
    } catch (err) {
      console.error('Error creating lead:', err);
      alert(err.response?.data?.message || 'Failed to create lead. Please try again.');
    }
  };

  const getLeadsByStage = (stageId) => {
    return purchases.filter(p => (p.lead?.funnelStage || 'new_match') === stageId);
  };

  const getFunnelStats = () => {
    const stats = {};
    FUNNEL_STAGES.forEach(stage => {
      stats[stage.id] = purchases.filter(p => (p.lead?.funnelStage || 'new_match') === stage.id).length;
    });
    return stats;
  };

  const downloadCSV = (packageData) => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip', 'Lead Type', 'Score'],
      ['Sample Lead 1', 'lead1@example.com', '555-0001', '123 Main St', 'Atlanta', 'GA', '30301', 'buyer', '3'],
      ['Sample Lead 2', 'lead2@example.com', '555-0002', '456 Oak Ave', 'Atlanta', 'GA', '30302', 'seller', '2'],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `bulk-package-${packageData.transaction.transactionId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      </div>
    );
  }

  return (
    <div className="container purchase-history">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>🎯 My Lead Funnel</h1>
          <p className="subtitle">Track your leads through each stage from first contact to closed deal</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ 
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 8px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          + Create Your Own Lead
        </button>
      </div>

      {/* Bulk Packages Section */}
      {bulkPackages.length > 0 && (
        <div className="bulk-packages-section">
          <h2>📦 Bulk Packages</h2>
          <div className="purchases-count">
            <strong>{bulkPackages.length}</strong> bulk package{bulkPackages.length !== 1 ? 's' : ''} purchased
          </div>
          
          <div className="purchases-list">
            {bulkPackages.map(({ transaction, lead }, index) => (
              <div key={`${transaction.transactionId}-${index}`} className="purchase-card card bulk-package-card">
                <div className="purchase-header">
                  <div>
                    <h3>
                      📦 Bulk Package - {lead?.leadCount || 5} Leads
                    </h3>
                    <p className="purchase-date">
                      Purchased on {formatDateTime(transaction.createdAt)}
                    </p>
                  </div>
                  <div className="purchase-amount">
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>

                <div className="bulk-package-info">
                  <div className="package-stats">
                    <div className="stat">
                      <span className="stat-label">Leads Included:</span>
                      <span className="stat-value">{lead?.leadCount || 5}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Price per Lead:</span>
                      <span className="stat-value">{formatCurrency((transaction.amount || 50) / (lead?.leadCount || 5))}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Package ID:</span>
                      <span className="stat-value package-id">{lead?.packageId || transaction.leadId}</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary download-btn"
                    onClick={() => downloadCSV({ transaction, lead })}
                  >
                    📥 Download CSV
                  </button>
                </div>

                <div className="purchase-footer">
                  <span className={`badge ${transaction.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                    {transaction.status}
                  </span>
                  <span className="transaction-id">ID: {transaction.transactionId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Funnel View - Always Show */}
      <div className="funnel-section">
        <div className="funnel-container">
          {/* Left Side: Funnel Pipeline */}
          <div className="funnel-sidebar">
            <div className="funnel-sidebar-header">
              <h2>🏆 Sales Pipeline</h2>
              <div className="total-leads-badge">
                {purchases.length} {purchases.length === 1 ? 'Lead' : 'Leads'}
              </div>
            </div>

            {/* Funnel Visual Pipeline */}
            <div className="funnel-pipeline">
              {FUNNEL_STAGES.map((stage, index) => {
                const count = getFunnelStats()[stage.id];
                const percentage = purchases.length > 0 ? (count / purchases.length) * 100 : 0;
                const isSelected = selectedStage === stage.id;
                
                return (
                  <div key={stage.id}>
                    <button
                      className={`funnel-stage ${isSelected ? 'selected' : ''} ${count === 0 ? 'empty' : ''}`}
                      onClick={() => setSelectedStage(stage.id)}
                    >
                      <div className="funnel-stage-header">
                        <div className="funnel-stage-info">
                          <span className="funnel-icon">{stage.icon}</span>
                          <div>
                            <div className="funnel-stage-name">{stage.label}</div>
                            <div className="funnel-stage-desc">{stage.description}</div>
                          </div>
                        </div>
                        <div className="funnel-stage-stats">
                          <div className="funnel-count">{count}</div>
                        </div>
                      </div>
                      <div className="funnel-bar-container">
                        <div 
                          className="funnel-bar" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </button>
                    {index < FUNNEL_STAGES.length - 1 && <div className="funnel-connector">▼</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Lead Details */}
          <div className="leads-content">
            {purchases.length > 0 ? (
              <>
                <div className="leads-content-header">
                  <h3>
                    <span className="stage-icon-large">{FUNNEL_STAGES.find(s => s.id === selectedStage)?.icon}</span>
                    {FUNNEL_STAGES.find(s => s.id === selectedStage)?.label}
                  </h3>
                  <div className="stage-count-badge">
                    {getLeadsByStage(selectedStage).length} {getLeadsByStage(selectedStage).length === 1 ? 'Lead' : 'Leads'}
                  </div>
                </div>

                <div className="leads-list">
                  {getLeadsByStage(selectedStage).map(({ transaction, lead }) => (
                    <div key={lead?.leadId || transaction.transactionId} className="lead-detail-card">
                      {/* Lead Header */}
                      <div className="lead-detail-header">
                        <div className="lead-main-info">
                          <h4>{lead?.contact?.name || 'Unknown Lead'}</h4>
                          <div className="lead-meta">
                            <span className={`badge ${lead?.leadType === 'seller' ? 'badge-success' : 'badge-primary'}`}>
                              {getLeadTypeLabel(lead?.leadType)}
                            </span>
                            <span className="lead-score-badge">Score: {lead?.score}/10</span>
                            <span className="lead-location">📍 {lead?.location?.city}, {lead?.location?.state}</span>
                          </div>
                        </div>
                        
                        <div className="lead-actions-group">
                          {/* Stage Selector */}
                          <select
                            className="stage-selector-compact"
                            value={lead?.funnelStage || 'new_match'}
                            onChange={(e) => updateLeadStage(lead?.leadId, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {FUNNEL_STAGES.map(stage => (
                              <option key={stage.id} value={stage.id}>
                                {stage.icon} {stage.label}
                              </option>
                            ))}
                          </select>
                          
                          {/* Edit and Delete Buttons */}
                          <button
                            className="btn-icon-action btn-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditLead(lead);
                            }}
                            title="Edit Lead"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon-action btn-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLead(lead?.leadId, lead?.contact?.name || 'this lead');
                            }}
                            title="Delete Lead"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="lead-contact-section">
                        <h5>📞 Contact Information</h5>
                        <div className="contact-grid">
                          <div className="contact-item">
                            <span className="contact-label">Email</span>
                            <a href={`mailto:${lead?.contact?.email}`} className="contact-value">
                              {lead?.contact?.email}
                            </a>
                          </div>
                          <div className="contact-item">
                            <span className="contact-label">Phone</span>
                            <a href={`tel:${lead?.contact?.phone}`} className="contact-value">
                              {lead?.contact?.phone}
                            </a>
                          </div>
                          <div className="contact-item">
                            <span className="contact-label">Address</span>
                            <span className="contact-value">
                              {lead?.location?.city}, {lead?.location?.state} {lead?.location?.zip}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Outreach Timeline */}
                      <div className="outreach-section">
                        <h5>📋 Activity Timeline</h5>
                        <div className="timeline">
                          <div className="timeline-item">
                            <div className="timeline-icon">{transaction.source === 'agent_manual' ? '✏️' : '💰'}</div>
                            <div className="timeline-content">
                              <div className="timeline-title">
                                {transaction.source === 'agent_manual' ? 'Lead Created' : 'Lead Purchased'}
                              </div>
                              <div className="timeline-date">{formatDateTime(transaction.createdAt)}</div>
                              <div className="timeline-detail">
                                {transaction.source === 'agent_manual' ? 'Manually Added' : `Price: ${formatCurrency(transaction.amount)}`}
                              </div>
                            </div>
                          </div>
                          
                          {/* Display logged activities */}
                          {leadActivities[transaction.leadId]?.map((activity) => (
                            <div key={activity.id} className="timeline-item">
                              <div className="timeline-icon">{getActivityIcon(activity.type)}</div>
                              <div className="timeline-content">
                                <div className="timeline-title">{getActivityLabel(activity.type)}</div>
                                <div className="timeline-date">{formatDateTime(activity.timestamp)}</div>
                                <div className="timeline-detail">{activity.notes}</div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Placeholder if no activities logged yet */}
                          {(!leadActivities[transaction.leadId] || leadActivities[transaction.leadId].length === 0) && (
                            <div className="timeline-item placeholder">
                              <div className="timeline-icon">📞</div>
                              <div className="timeline-content">
                                <div className="timeline-title">First Contact</div>
                                <div className="timeline-note">Track your outreach attempts here</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Inline Activity Form */}
                        {!showActivityForm[transaction.leadId] ? (
                          <button 
                            className="add-activity-btn"
                            onClick={() => toggleActivityForm(transaction.leadId)}
                          >
                            + Log Activity
                          </button>
                        ) : (
                          <div className="activity-form">
                            <div className="activity-form-row">
                              <select
                                className="activity-type-select"
                                value={activityData[transaction.leadId]?.type || 'call'}
                                onChange={(e) => updateActivityData(transaction.leadId, 'type', e.target.value)}
                              >
                                <option value="call">📞 Phone Call</option>
                                <option value="text">💬 Text Message</option>
                                <option value="email">📧 Email</option>
                                <option value="appointment">📅 Appointment</option>
                              </select>
                            </div>
                            <div className="activity-form-row">
                              <textarea
                                className="activity-notes-input"
                                rows="3"
                                placeholder="What happened? Any important details..."
                                value={activityData[transaction.leadId]?.notes || ''}
                                onChange={(e) => updateActivityData(transaction.leadId, 'notes', e.target.value)}
                              ></textarea>
                            </div>
                            <div className="activity-form-actions">
                              <button 
                                className="btn-cancel-activity"
                                onClick={() => toggleActivityForm(transaction.leadId)}
                              >
                                Cancel
                              </button>
                              <button 
                                className="btn-save-activity"
                                onClick={() => logActivity(transaction.leadId)}
                                disabled={!activityData[transaction.leadId]?.notes?.trim()}
                              >
                                Save Activity
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Analysis */}
                      {lead?.aiReason && (
                        <div className="ai-analysis-section">
                          <h5>🤖 AI Analysis</h5>
                          <p className="ai-reason">{lead.aiReason}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="lead-action-buttons">
                        <button
                          className="expand-details-btn"
                          onClick={() => setExpandedLead(expandedLead === transaction.transactionId ? null : transaction.transactionId)}
                        >
                          {expandedLead === transaction.transactionId ? '▲ Hide Details' : '▼ Show All Details'}
                        </button>
                        
                        {!leadFeedback[transaction.leadId] && (
                          <button
                            className="rate-lead-btn"
                            onClick={() => handleRateLeadClick(lead, transaction)}
                          >
                            ⭐ Rate Lead Quality
                          </button>
                        )}
                        
                        {leadFeedback[transaction.leadId] && (
                          <div className="feedback-submitted-badge">
                            ✅ Feedback Submitted
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {expandedLead === transaction.transactionId && lead?.responses && (
                        <div className="expanded-details">
                          <h5>📝 Questionnaire Responses</h5>
                          <div className="responses-grid">
                            {Object.entries(lead.responses).map(([question, answer]) => (
                              <div key={question} className="response-item">
                                <div className="response-question">{formatQuestionLabel(question)}</div>
                                <div className="response-answer">{formatAnswerValue(answer)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {getLeadsByStage(selectedStage).length === 0 && (
                    <div className="empty-stage-content">
                      <div className="empty-icon">
                        {FUNNEL_STAGES.find(s => s.id === selectedStage)?.icon}
                      </div>
                      <h3>No leads in this stage</h3>
                      <p>Move leads here by updating their stage, or purchase new leads from the marketplace.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-funnel-cta">
                <div className="empty-icon">🎯</div>
                <h3>Ready to fill your pipeline?</h3>
                <p>Purchase leads from the marketplace to start tracking them through your sales funnel.</p>
                <a href="/marketplace" className="btn btn-primary btn-large">
                  Browse Available Leads
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      <LeadRatingModal
        lead={ratingModalLead}
        isOpen={!!ratingModalLead}
        onClose={() => setRatingModalLead(null)}
        onSubmit={handleRatingSubmit}
      />

      {/* Edit Lead Modal */}
      {editModalLead && (
        <EditLeadModal
          lead={editModalLead}
          onClose={() => setEditModalLead(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>➕ Create Your Own Lead</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateLead} className="create-lead-form">
              <div className="form-section">
                <h3>Contact Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      required
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                      placeholder="John Smith"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={createFormData.email}
                      onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      required
                      value={createFormData.phone}
                      onChange={(e) => setCreateFormData({...createFormData, phone: e.target.value})}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Lead Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Lead Type *</label>
                    <select
                      value={createFormData.leadType}
                      onChange={(e) => setCreateFormData({...createFormData, leadType: e.target.value})}
                    >
                      <option value="buyer">🏠 Buyer</option>
                      <option value="seller">💰 Seller</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={createFormData.city}
                      onChange={(e) => setCreateFormData({...createFormData, city: e.target.value})}
                      placeholder="Atlanta"
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={createFormData.state}
                      onChange={(e) => setCreateFormData({...createFormData, state: e.target.value})}
                      placeholder="GA"
                      maxLength="2"
                    />
                  </div>
                  <div className="form-group">
                    <label>ZIP</label>
                    <input
                      type="text"
                      value={createFormData.zip}
                      onChange={(e) => setCreateFormData({...createFormData, zip: e.target.value})}
                      placeholder="30301"
                      maxLength="5"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Budget</label>
                    <select
                      value={createFormData.budget}
                      onChange={(e) => setCreateFormData({...createFormData, budget: e.target.value})}
                    >
                      <option value="">Select budget range...</option>
                      <option value="under-300k">Under $300k</option>
                      <option value="300k-500k">$300k - $500k</option>
                      <option value="500k-750k">$500k - $750k</option>
                      <option value="750k-1m">$750k - $1M</option>
                      <option value="over-1m">Over $1M</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={createFormData.notes}
                      onChange={(e) => setCreateFormData({...createFormData, notes: e.target.value})}
                      placeholder="Add any additional details about this lead..."
                      rows="4"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseHistory;
