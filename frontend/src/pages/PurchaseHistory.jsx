import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { formatCurrency, formatDateTime, getLeadTypeLabel } from '../utils/helpers';
import './PurchaseHistory.css';

function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPurchaseHistory();
  }, []);

  const fetchPurchaseHistory = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getProfile();
      setPurchases(response.data.data.purchasedLeads || []);
    } catch (err) {
      console.error('Error fetching purchase history:', err);
      setError(err.response?.data?.error || 'Failed to load purchase history');
    } finally {
      setLoading(false);
    }
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
      <h1>Purchase History</h1>
      <p className="subtitle">View all your purchased leads and contact information</p>

      {purchases.length === 0 ? (
        <div className="card text-center">
          <p>You haven't purchased any leads yet.</p>
          <a href="/marketplace" className="btn btn-primary">
            Browse Available Leads
          </a>
        </div>
      ) : (
        <>
          <div className="purchases-count">
            <strong>{purchases.length}</strong> lead{purchases.length !== 1 ? 's' : ''} purchased
          </div>

          <div className="purchases-list">
            {purchases.map(({ transaction, lead }) => (
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

                {lead && (
                  <div className="lead-info-purchase">
                    <div className="info-section">
                      <h4>Contact Information</h4>
                      <div className="contact-details">
                        <div className="contact-row">
                          <span className="label">Name:</span>
                          <span className="value">{lead.contact.name}</span>
                        </div>
                        <div className="contact-row">
                          <span className="label">Email:</span>
                          <a href={`mailto:${lead.contact.email}`} className="value link">
                            {lead.contact.email}
                          </a>
                        </div>
                        <div className="contact-row">
                          <span className="label">Phone:</span>
                          <a href={`tel:${lead.contact.phone}`} className="value link">
                            {lead.contact.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="info-section">
                      <h4>Location</h4>
                      <p>
                        {lead.location.address}<br />
                        {lead.location.city}, {lead.location.state} {lead.location.zip}
                      </p>
                    </div>

                    <div className="info-section">
                      <h4>AI Analysis</h4>
                      <p className="ai-reason">{lead.aiReason}</p>
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
        </>
      )}
    </div>
  );
}

export default PurchaseHistory;
