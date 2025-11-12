import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { formatCurrency, formatDateTime, getLeadTypeLabel } from '../utils/helpers';
import './PurchaseHistory.css';

function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [bulkPackages, setBulkPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const downloadCSV = (packageData) => {
    // In a real implementation, you would fetch the actual lead data for the package
    // For now, we'll create a sample CSV
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip', 'Lead Type', 'Score'],
      // Sample data - in production, fetch actual leads from the package
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
      <h1>My Leads</h1>
      <p className="subtitle">View all your purchased leads and contact information</p>

      {purchases.length === 0 && bulkPackages.length === 0 ? (
        <div className="card text-center">
          <p>You haven't purchased any leads yet.</p>
          <a href="/marketplace" className="btn btn-primary">
            Browse Available Leads
          </a>
        </div>
      ) : (
        <>
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

          {/* Individual Leads Section */}
          {purchases.length > 0 && (
            <div className="individual-leads-section">
              <h2>🎯 Individual Leads</h2>
              <div className="purchases-count">
                <strong>{purchases.length}</strong> lead{purchases.length !== 1 ? 's' : ''} purchased
              </div>

              <div className="purchases-list">{purchases.map(({ transaction, lead }) => (
              <div key={transaction.transactionId} className="purchase-card card">
                <div className="purchase-header">
                  <div>
                    <h3>
                      {getLeadTypeLabel(lead?.leadType)} Lead - Score {lead?.score}/10
                    </h3>
                    <p className="purchase-date">
                      Purchased on {formatDateTime(transaction.createdAt)}
                    </p>
                  </div>
                  <div className="purchase-amount">
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>

                {lead && lead.contact && (
                  <div className="lead-info-purchase">
                    <div className="info-section">
                      <h4>Contact Information</h4>
                      <div className="contact-details">
                        <div className="contact-row">
                          <span className="label">Name:</span>
                          <span className="value">{lead.contact?.name || 'N/A'}</span>
                        </div>
                        <div className="contact-row">
                          <span className="label">Email:</span>
                          <a href={`mailto:${lead.contact?.email}`} className="value link">
                            {lead.contact?.email || 'N/A'}
                          </a>
                        </div>
                        <div className="contact-row">
                          <span className="label">Phone:</span>
                          <a href={`tel:${lead.contact?.phone}`} className="value link">
                            {lead.contact?.phone || 'N/A'}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="info-section">
                      <h4>Location</h4>
                      <p>
                        {lead.location?.address || 'N/A'}<br />
                        {lead.location?.city || 'N/A'}, {lead.location?.state || 'N/A'} {lead.location?.zip || ''}
                      </p>
                    </div>

                    <div className="info-section">
                      <h4>AI Analysis</h4>
                      <p className="ai-reason">{lead.aiReason || 'No analysis available'}</p>
                    </div>

                    {lead.responses && Object.keys(lead.responses).length > 0 && (
                      <div className="info-section">
                        <h4>Questionnaire Responses</h4>
                        <div className="responses-list">
                          {Object.entries(lead.responses).map(([question, answer]) => (
                            <div key={question} className="response-row">
                              <div className="question">{question}:</div>
                              <div className="answer">{JSON.stringify(answer)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
        </>
      )}
    </div>
  );
}

export default PurchaseHistory;
