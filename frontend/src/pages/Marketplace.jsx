import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { marketplaceAPI, paymentAPI } from '../utils/api';
import ScoreMeter from '../components/ScoreMeter';
import StripeCheckout from '../components/StripeCheckout';
import { 
  formatCurrency, 
  getLeadTypeLabel, 
  getTimeRemaining,
  formatDate 
} from '../utils/helpers';
import './Marketplace.css';

function Marketplace() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    leadType: '',
    minScore: '',
    maxPrice: '',
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [lockExpiresAt, setLockExpiresAt] = useState(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchasedLeadData, setPurchasedLeadData] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchLeads(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, [filters]);

  const fetchLeads = async (signal) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filters.leadType) params.leadType = filters.leadType;
      if (filters.minScore) params.minScore = filters.minScore;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;

      const response = await marketplaceAPI.getLeads(params);
      
      // Only update state if request wasn't aborted
      if (!signal?.aborted) {
        setLeads(response.data.data.leads || []);
      }
    } catch (err) {
      // Ignore abort errors
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error fetching leads:', err);
      if (!signal?.aborted) {
        setError(err.response?.data?.error || 'Failed to load leads');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      leadType: '',
      minScore: '',
      maxPrice: '',
    });
  };

  const handlePurchaseClick = async (lead) => {
    try {
      setError(null);
      setSelectedLead(lead);
      
      // Check if beta mode is enabled (free leads)
      const isBetaMode = import.meta.env.VITE_BETA_MODE === 'true';
      
      if (isBetaMode) {
        // In beta mode, skip Stripe modal and purchase without payment
        try {
          const response = await paymentAPI.purchaseLead({
            leadId: lead.leadId,
            // No paymentMethodId - backend will skip payment processing
          });
          setPurchasedLeadData(response.data.data);
          setPurchaseSuccess(true);
          // Refresh leads list
          fetchLeads();
          return;
        } catch (claimError) {
          console.error('Error claiming lead:', claimError);
          setError(claimError.response?.data?.error || 'Failed to claim lead. Please try again.');
          return;
        }
      }
      
      // Normal payment flow
      // Lock expires 15 seconds from now
      const expiresAt = Math.floor(Date.now() / 1000) + 15;
      setLockExpiresAt(expiresAt);
      setShowPaymentModal(true);
      
      // TODO: Call backend to lock the lead
      // await marketplaceAPI.lockLead(lead.leadId);
    } catch (err) {
      console.error('Error locking lead:', err);
      setError(err.response?.data?.error || 'Failed to lock lead');
    }
  };

  const handlePurchaseSuccess = (data) => {
    setPurchasedLeadData(data);
    setShowPaymentModal(false);
    setPurchaseSuccess(true);
    
    // Refresh leads list
    fetchLeads();
  };

  const handlePurchaseCancel = () => {
    setShowPaymentModal(false);
    setSelectedLead(null);
    setLockExpiresAt(null);
    
    // TODO: Call backend to unlock the lead
    // await marketplaceAPI.unlockLead(selectedLead.leadId);
  };

  if (error && error.includes('not found')) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          Please complete your profile to view available leads.
        </div>
        <a href="/profile" className="btn btn-primary">Complete Profile</a>
      </div>
    );
  }

  return (
    <div className="container marketplace">
      <h1>Lead Marketplace</h1>
      <p className="subtitle">Browse and purchase AI-scored real estate leads within your service area</p>

      {/* Filters */}
      <div className="card filters-card">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="form-group">
            <label className="form-label">Lead Type</label>
            <select 
              name="leadType" 
              value={filters.leadType} 
              onChange={handleFilterChange}
              className="form-input"
            >
              <option value="">All Types</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Min Score</label>
            <select 
              name="minScore" 
              value={filters.minScore} 
              onChange={handleFilterChange}
              className="form-input"
            >
              <option value="">Any</option>
              {[8, 9].map(score => (
                <option key={score} value={score}>{score}+</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Max Price</label>
            <select 
              name="maxPrice" 
              value={filters.maxPrice} 
              onChange={handleFilterChange}
              className="form-input"
            >
              <option value="">Any</option>
              <option value="50">$50</option>
              <option value="70">$70</option>
              <option value="100">$100</option>
              <option value="150">$150</option>
            </select>
          </div>
        </div>
        
        <button onClick={clearFilters} className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Clear Filters
        </button>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : leads.length === 0 ? (
        <div className="card text-center">
          <p>No leads available matching your criteria.</p>
          <button onClick={clearFilters} className="btn btn-primary">
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="leads-count">
            <strong>{leads.length}</strong> lead{leads.length !== 1 ? 's' : ''} available
          </div>
          
          <div className="leads-grid">
            {leads.map(lead => (
              <div key={lead.leadId} className={`lead-card ${lead.leadType === 'seller' ? 'lead-card-seller' : 'lead-card-buyer'}`}>
                <div className="lead-header">
                  <div>
                    <span className={`badge ${lead.leadType === 'seller' ? 'badge-success' : 'badge-primary'}`}>
                      {getLeadTypeLabel(lead.leadType)}
                    </span>
                    <span className="lead-distance">📍 {lead.distance} mi away</span>
                  </div>
                  <div className="lead-price">{formatCurrency(lead.price)}</div>
                </div>

                <div className={`lead-score-section ${lead.leadType === 'seller' ? 'score-section-seller' : 'score-section-buyer'}`}>
                  <div className="score-display-inline">
                    <span className={`score-big ${lead.leadType === 'seller' ? 'score-seller' : 'score-buyer'}`}>{lead.score}</span>
                    <span className="score-small">/10</span>
                  </div>
                </div>

                <div className="lead-info">
                  <p className={`lead-reason ${lead.leadType === 'seller' ? 'lead-reason-seller' : 'lead-reason-buyer'}`}>{lead.aiReason}</p>
                  
                  <div className="lead-details">
                    <div className="detail-item">
                      <span className="detail-label">Location:</span>
                      <span>{lead.location.city}, {lead.location.state} {lead.location.zip}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Questions Answered:</span>
                      <span>{lead.responsePreview.questionCount}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Posted:</span>
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Expires:</span>
                      <span className="text-warning">{getTimeRemaining(lead.expiresAt)}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handlePurchaseClick(lead)} 
                  className="btn btn-primary btn-block"
                >
                  {import.meta.env.VITE_BETA_MODE === 'true' ? 'Claim Lead (Free Beta)' : 'Purchase Lead'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedLead && (
        <StripeCheckout
          lead={selectedLead}
          lockExpiresAt={lockExpiresAt}
          onSuccess={handlePurchaseSuccess}
          onCancel={handlePurchaseCancel}
        />
      )}

      {/* Purchase Success Modal */}
      {purchaseSuccess && purchasedLeadData && (
        <div className="stripe-checkout-modal">
          <div className="stripe-checkout-content">
            <div className="checkout-header">
              <h2>🎉 Purchase Successful!</h2>
              <button 
                onClick={() => setPurchaseSuccess(false)} 
                className="close-button"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ 
                fontSize: '4rem', 
                marginBottom: '1rem',
                animation: 'bounce 0.5s'
              }}>
                ✅
              </div>
              
              <h3 style={{ marginBottom: '1rem' }}>Lead Contact Information</h3>
              
              <div style={{ 
                background: '#f9fafb', 
                padding: '1.5rem', 
                borderRadius: '8px',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Name:</strong> {purchasedLeadData.contactInfo?.name || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Email:</strong> {purchasedLeadData.contactInfo?.email || 'N/A'}
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong>Phone:</strong> {purchasedLeadData.contactInfo?.phone || 'N/A'}
                </div>
                <div>
                  <strong>Lead Type:</strong> {getLeadTypeLabel(purchasedLeadData.leadType)}
                </div>
              </div>

              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                This lead has been added to your dashboard. Start reaching out right away!
              </p>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link to="/dashboard" className="btn btn-primary" style={{ flex: 1 }}>
                  View in My Leads
                </Link>
                <button 
                  onClick={() => setPurchaseSuccess(false)} 
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Marketplace;
