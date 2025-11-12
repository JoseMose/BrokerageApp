import React, { useState, useEffect } from 'react';
import { bulkPackagesAPI, paymentAPI } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './BulkLeads.css';

const BulkLeads = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchPackages(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, []);

  const fetchPackages = async (signal) => {
    try {
      setLoading(true);
      setError(null);
      const response = await bulkPackagesAPI.getAvailablePackages();
      
      if (!signal?.aborted) {
        const pkgs = response.data.packages || response.data.data?.packages || [];
        setPackages(pkgs);
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error fetching packages:', err);
      if (!signal?.aborted) {
        setError(err.response?.data?.message || 'Failed to load bulk packages');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handlePurchase = async (packageId) => {
    if (!confirm('Are you sure you want to purchase this bulk package?')) {
      return;
    }

    try {
      setPurchasing(packageId);
      setError(null);
      setSuccessMessage(null);

      const response = await bulkPackagesAPI.purchasePackage(packageId);
      
      setSuccessMessage(response.data.message || 'Package purchased successfully!');
      
      // Refresh packages list
      await fetchPackages();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error purchasing package:', err);
      setError(err.response?.data?.message || 'Failed to purchase package');
    } finally {
      setPurchasing(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bulk-leads-page">
        <LoadingSpinner message="Loading bulk packages..." />
      </div>
    );
  }

  return (
    <div className="bulk-leads-page">
      <div className="bulk-leads-header">
        <h1>Bulk Lead Packages</h1>
        <p className="subtitle">
          Get discounted bundles of 50-100 leads. Perfect for volume-based prospecting.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          {successMessage}
        </div>
      )}

      {packages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>No Bulk Packages Available</h2>
          <p>Check back later for new bulk lead packages.</p>
        </div>
      ) : (
        <div className="packages-grid">
          {packages.map((pkg) => (
            <div key={pkg.packageId} className="package-card">
              <div className="package-header">
                <div className="package-badge">
                  <span className="badge-label">Bulk Package</span>
                  <span className="discount-badge">-{pkg.discountPercent}%</span>
                </div>
                <h3>{pkg.leadCount} Leads</h3>
              </div>

              <div className="package-details">
                <div className="detail-row">
                  <span className="detail-label">Price per Lead:</span>
                  <span className="detail-value">{formatCurrency(pkg.pricePerLead)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Regular Price:</span>
                  <span className="detail-value strikethrough">
                    {formatCurrency(pkg.leadCount * 80)}
                  </span>
                </div>
                <div className="detail-row highlight">
                  <span className="detail-label">Total Price:</span>
                  <span className="detail-value total-price">
                    {formatCurrency(pkg.totalPrice)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">You Save:</span>
                  <span className="detail-value savings">
                    {formatCurrency((pkg.leadCount * 80) - pkg.totalPrice)}
                  </span>
                </div>
              </div>

              <div className="package-meta">
                <p className="package-date">
                  Created: {formatDate(pkg.createdAt)}
                </p>
                {pkg.description && (
                  <p className="package-description">{pkg.description}</p>
                )}
              </div>

              <button
                className="btn btn-primary purchase-btn"
                onClick={() => handlePurchase(pkg.packageId)}
                disabled={purchasing === pkg.packageId}
              >
                {purchasing === pkg.packageId ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase Package - {formatCurrency(pkg.totalPrice)}
                  </>
                )}
              </button>

              <div className="package-info">
                <p className="info-text">
                  ✓ All {pkg.leadCount} leads unlocked immediately<br />
                  ✓ Full contact information included<br />
                  ✓ CSV export available after purchase
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bulk-leads-info">
        <h2>About Bulk Packages</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">💰</div>
            <h3>Save Money</h3>
            <p>Get leads at 50-87% off regular pricing when you buy in bulk.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">📊</div>
            <h3>Volume Prospecting</h3>
            <p>Perfect for agents who prefer quantity and want to build their own pipeline.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">⚡</div>
            <h3>Instant Access</h3>
            <p>All leads are unlocked immediately upon purchase with full contact details.</p>
          </div>
          <div className="info-card">
            <div className="info-icon">📥</div>
            <h3>Easy Export</h3>
            <p>Download all lead data as CSV for easy import into your CRM system.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkLeads;
