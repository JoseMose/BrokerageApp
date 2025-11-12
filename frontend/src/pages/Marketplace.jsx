import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { marketplaceAPI } from '../utils/api';
import ScoreMeter from '../components/ScoreMeter';
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
              <div key={lead.leadId} className="lead-card">
                <div className="lead-header">
                  <div>
                    <span className="badge badge-primary">
                      {getLeadTypeLabel(lead.leadType)}
                    </span>
                    <span className="lead-distance">📍 {lead.distance} mi away</span>
                  </div>
                  <div className="lead-price">{formatCurrency(lead.price)}</div>
                </div>

                <div className="lead-score-section">
                  <div className="score-display-inline">
                    <span className="score-big">{lead.score}</span>
                    <span className="score-small">/10</span>
                  </div>
                </div>

                <div className="lead-info">
                  <p className="lead-reason">{lead.aiReason}</p>
                  
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

                <Link to={`/leads/${lead.leadId}`} className="btn btn-primary btn-block">
                  View Details & Purchase
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Marketplace;
