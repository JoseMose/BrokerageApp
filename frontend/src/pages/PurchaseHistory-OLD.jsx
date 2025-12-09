import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { formatCurrency, formatDateTime, getLeadTypeLabel } from '../utils/helpers';
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
];

function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [bulkPackages, setBulkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStage, setSelectedStage] = useState('all');
  const [expandedLead, setExpandedLead] = useState(null);

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
    } catch (err) {
      console.error('Error fetching my leads:', err);
      setError(err.response?.data?.error || 'Failed to load my leads');
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStage = async (leadId, newStage) => {
    // TODO: Add API call to update lead stage in backend
    console.log('Update lead', leadId, 'to stage', newStage);
    
    // For now, update locally
    setPurchases(prev => prev.map(p => 
      p.transaction.leadId === leadId 
        ? { ...p, lead: { ...p.lead, funnelStage: newStage } }
        : p
    ));
  };

  const getLeadsByStage = (stageId) => {
    if (stageId === 'all') return purchases;
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
      <h1>🎯 My Lead Funnel</h1>
      <p className="subtitle">Track your leads through each stage from first contact to closed deal</p>

      {/* Bulk Packages Section */}
      {bulkPackages.length > 0 && (
        <div className="bulk-packages-section">
          <h2>📦 Bulk Packages</h2>
          <div className="purchases-count">
            <strong>{bulkPackages.length}</strong> bulk package{bulkPackages.length !== 1 ? 's' : ''} purchased
          </div>
              
              <div className="purchases-list">
                {bulkPackages.map(({ transaction, lead }) => (
                  <div key={transaction.transactionId} className="purchase-card card bulk-package-card">
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
                        <div key={transaction.transactionId} className="lead-detail-card">
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
                            
                            {/* Stage Selector */}
                            <select
                              className="stage-selector-compact"
                              value={lead?.funnelStage || 'new_match'}
                              onChange={(e) => updateLeadStage(transaction.leadId, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {FUNNEL_STAGES.map(stage => (
                                <option key={stage.id} value={stage.id}>
                                  {stage.icon} {stage.label}
                                </option>
                              ))}
                            </select>
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
                                <div className="timeline-icon">💰</div>
                                <div className="timeline-content">
                                  <div className="timeline-title">Lead Purchased</div>
                                  <div className="timeline-date">{formatDateTime(transaction.createdAt)}</div>
                                  <div className="timeline-detail">Price: {formatCurrency(transaction.amount)}</div>
                                </div>
                              </div>
                              
                              {/* Placeholder for future outreach tracking */}
                              <div className="timeline-item placeholder">
                                <div className="timeline-icon">📞</div>
                                <div className="timeline-content">
                                  <div className="timeline-title">First Contact</div>
                                  <div className="timeline-note">Track your outreach attempts here</div>
                                </div>
                              </div>
                              
                              <div className="add-activity-btn">
                                <button className="btn btn-outline btn-sm">
                                  + Log Activity
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* AI Analysis */}
                          {lead?.aiReason && (
                            <div className="ai-analysis-section">
                              <h5>🤖 AI Analysis</h5>
                              <p className="ai-reason">{lead.aiReason}</p>
                            </div>
                          )}

                          {/* Expand for More Details */}
                          <button
                            className="expand-details-btn"
                            onClick={() => setExpandedLead(expandedLead === transaction.transactionId ? null : transaction.transactionId)}
                          >
                            {expandedLead === transaction.transactionId ? '▲ Hide Details' : '▼ Show All Details'}
                          </button>

                          {/* Expanded Details */}
                          {expandedLead === transaction.transactionId && lead?.responses && (
                            <div className="expanded-details">
                              <h5>📝 Questionnaire Responses</h5>
                              <div className="responses-grid">
                                {Object.entries(lead.responses).map(([question, answer]) => (
                                  <div key={question} className="response-item">
                                    <div className="response-question">{question}</div>
                                    <div className="response-answer">{String(answer)}</div>
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
                <button
                  className={`stage-nav-btn ${selectedStage === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedStage('all')}
                >
                  All Leads ({purchases.length})
                </button>
                {FUNNEL_STAGES.map(stage => {
                  const count = getFunnelStats()[stage.id];
                  return (
                    <button
                      key={stage.id}
                      className={`stage-nav-btn ${selectedStage === stage.id ? 'active' : ''} ${count === 0 ? 'empty' : ''}`}
                      onClick={() => setSelectedStage(stage.id)}
                    >
                      <span className="stage-icon">{stage.icon}</span>
                      <span className="stage-label">{stage.label}</span>
                      <span className="stage-count">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Funnel Visual Pipeline */}
              <div className="funnel-pipeline">
                {FUNNEL_STAGES.map((stage, index) => {
                  const count = getFunnelStats()[stage.id];
                  const percentage = purchases.length > 0 ? (count / purchases.length) * 100 : 0;
                  
                  return (
                    <div key={stage.id} className="funnel-stage">
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
                          <div className="funnel-percentage">{percentage.toFixed(0)}%</div>
                        </div>
                      </div>
                      <div className="funnel-bar-container">
                        <div 
                          className="funnel-bar" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      {index < FUNNEL_STAGES.length - 1 && <div className="funnel-arrow">▼</div>}
                    </div>
                  );
                })}
              </div>

              {/* Leads List for Selected Stage */}
              {purchases.length > 0 ? (
                <div className="funnel-leads-section">
                  <h3>
                    {selectedStage === 'all' 
                      ? `All Leads (${purchases.length})`
                      : `${FUNNEL_STAGES.find(s => s.id === selectedStage)?.icon} ${FUNNEL_STAGES.find(s => s.id === selectedStage)?.label} (${getLeadsByStage(selectedStage).length})`
                    }
                  </h3>

                <div className="funnel-leads-list">
                  {getLeadsByStage(selectedStage).map(({ transaction, lead }) => (
                    <div key={transaction.transactionId} className="funnel-lead-card">
                      <div className="funnel-lead-header">
                        <div className="funnel-lead-main">
                          <span className={`badge ${lead?.leadType === 'seller' ? 'badge-success' : 'badge-primary'}`}>
                            {getLeadTypeLabel(lead?.leadType)}
                          </span>
                          <h4>{lead?.contact?.name || 'Unknown Lead'}</h4>
                          <span className="lead-score-badge">Score: {lead?.score}/10</span>
                        </div>
                        <div className="funnel-lead-actions">
                          <select
                            className="stage-selector"
                            value={lead?.funnelStage || 'new_match'}
                            onChange={(e) => updateLeadStage(transaction.leadId, e.target.value)}
                          >
                            {FUNNEL_STAGES.map(stage => (
                              <option key={stage.id} value={stage.id}>
                                {stage.icon} {stage.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn-expand"
                            onClick={() => setExpandedLead(expandedLead === transaction.transactionId ? null : transaction.transactionId)}
                          >
                            {expandedLead === transaction.transactionId ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>

                      {expandedLead === transaction.transactionId && lead && (
                        <div className="funnel-lead-details">
                          <div className="detail-grid">
                            <div className="detail-section">
                              <h5>📞 Contact</h5>
                              <div className="detail-item">
                                <span>Email:</span>
                                <a href={`mailto:${lead.contact?.email}`}>{lead.contact?.email}</a>
                              </div>
                              <div className="detail-item">
                                <span>Phone:</span>
                                <a href={`tel:${lead.contact?.phone}`}>{lead.contact?.phone}</a>
                              </div>
                            </div>

                            <div className="detail-section">
                              <h5>📍 Location</h5>
                              <div className="detail-item">
                                <span>{lead.location?.city}, {lead.location?.state} {lead.location?.zip}</span>
                              </div>
                            </div>

                            <div className="detail-section">
                              <h5>💰 Purchase Info</h5>
                              <div className="detail-item">
                                <span>Purchased:</span>
                                <span>{formatDateTime(transaction.createdAt)}</span>
                              </div>
                              <div className="detail-item">
                                <span>Price:</span>
                                <span>{formatCurrency(transaction.amount)}</span>
                              </div>
                            </div>
                          </div>

                          {lead.aiReason && (
                            <div className="detail-section full-width">
                              <h5>🤖 AI Analysis</h5>
                              <p className="ai-reason">{lead.aiReason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {getLeadsByStage(selectedStage).length === 0 && (
                    <div className="empty-stage">
                      <p>No leads in this stage yet.</p>
                      {selectedStage !== 'new_match' && (
                        <p className="empty-hint">Move leads here by updating their stage above.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
  );
}

export default PurchaseHistory;
