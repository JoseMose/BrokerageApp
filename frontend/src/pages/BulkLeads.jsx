import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { bulkPackagesAPI, paymentAPI } from '../utils/api';
import { stripePromise } from '../utils/stripe';
import LoadingSpinner from '../components/LoadingSpinner';
import './BulkLeads.css';

// Stripe Payment Modal Component
function PaymentModal({ pkg, onClose, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Call backend to process payment for bulk package
      const response = await paymentAPI.purchaseLead({
        packageId: pkg.packageId,
        paymentMethodId: paymentMethod.id,
        amount: pkg.totalPrice,
        type: 'bulk_package',
      });

      if (response.data.success) {
        onSuccess(response.data);
      } else {
        setError(response.data.message || 'Payment failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Complete Your Purchase</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="payment-summary">
          <h3>Bulk Package Details</h3>
          <div className="summary-row">
            <span>Leads:</span>
            <strong>{pkg.leadCount} leads</strong>
          </div>
          <div className="summary-row">
            <span>Price per lead:</span>
            <span>{formatCurrency(pkg.pricePerLead)}</span>
          </div>
          <div className="summary-row">
            <span>Regular price:</span>
            <span className="strikethrough">{formatCurrency(pkg.leadCount * 80)}</span>
          </div>
          <div className="summary-row highlight">
            <span>Total:</span>
            <strong className="total-amount">{formatCurrency(pkg.totalPrice)}</strong>
          </div>
          <div className="summary-row savings-row">
            <span>You save:</span>
            <strong className="savings-amount">
              {formatCurrency((pkg.leadCount * 80) - pkg.totalPrice)} ({pkg.discountPercent}% off)
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-group">
            <label>Card Information</label>
            <div className="card-element-wrapper">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!stripe || processing}
            >
              {processing ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>Pay {formatCurrency(pkg.totalPrice)}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const BulkLeads = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [availableLowScoreLeads, setAvailableLowScoreLeads] = useState(0);
  const [customLeadCount, setCustomLeadCount] = useState(0);
  const [showCustomPackage, setShowCustomPackage] = useState(false);

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
        
        // Get count of low-score leads (4 or below)
        const lowScoreCount = response.data.availableLowScoreLeads || 0;
        setAvailableLowScoreLeads(lowScoreCount);
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

  const handlePurchase = (pkg) => {
    console.log('Purchase clicked for package:', pkg);
    setSelectedPackage(pkg);
    setError(null);
  };

  const calculatePricePerLead = (leadCount) => {
    // Bulk discount tiers
    if (leadCount === 0) return 0;  // No leads selected
    if (leadCount >= 100) return 10;  // 87.5% off ($80 -> $10)
    if (leadCount >= 50) return 20;   // 75% off ($80 -> $20)
    if (leadCount >= 25) return 30;   // 62.5% off ($80 -> $30)
    if (leadCount >= 10) return 40;   // 50% off ($80 -> $40)
    return 80; // Regular price for 1-9 leads
  };

  const calculateDiscount = (leadCount) => {
    const pricePerLead = calculatePricePerLead(leadCount);
    return Math.round(((80 - pricePerLead) / 80) * 100);
  };

  const handleCustomPackagePurchase = () => {
    const customPkg = {
      packageId: `custom-${Date.now()}`,
      leadCount: customLeadCount,
      pricePerLead: calculatePricePerLead(customLeadCount),
      totalPrice: customLeadCount * calculatePricePerLead(customLeadCount),
      discountPercent: calculateDiscount(customLeadCount),
      description: 'Custom bulk package (Score 4 or below)',
      isCustom: true
    };
    setSelectedPackage(customPkg);
    setError(null);
  };

  const handlePaymentSuccess = async (data) => {
    setSuccessMessage(`Successfully purchased ${data.package?.leadCount || 'bulk'} leads!`);
    setSelectedPackage(null);
    
    // Refresh packages list
    await fetchPackages();
    
    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleCloseModal = () => {
    setSelectedPackage(null);
    setError(null);
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

      {/* Custom Package Builder */}
      <div className="custom-package-section">
        <div className="custom-package-header">
          <div className="custom-header-content">
            <h2>🎯 Custom Bulk Package</h2>
            <p className="low-score-count">
              <strong>{availableLowScoreLeads}</strong> leads with score 4 or below available
            </p>
          </div>
          <button 
            className="btn btn-outline"
            onClick={() => setShowCustomPackage(!showCustomPackage)}
          >
            {showCustomPackage ? 'Hide Builder' : 'Build Custom Package'}
          </button>
        </div>

        {showCustomPackage && (
          <div className="custom-package-builder">
            <div className="builder-content">
              <div className="slider-section">
                <label htmlFor="lead-count-slider" className="slider-label">
                  How many leads do you want?
                </label>
                <div className="slider-value-display">
                  <span className="lead-count-badge">{customLeadCount} Leads</span>
                </div>
                <input
                  id="lead-count-slider"
                  type="range"
                  min="0"
                  max={Math.min(availableLowScoreLeads, 200)}
                  step="5"
                  value={customLeadCount}
                  onChange={(e) => setCustomLeadCount(parseInt(e.target.value))}
                  className="lead-count-slider"
                  disabled={availableLowScoreLeads === 0}
                />
                <div className="slider-range">
                  <span>0</span>
                  <span>{Math.min(availableLowScoreLeads, 200)}</span>
                </div>
              </div>

              <div className="custom-pricing">
                <div className="pricing-row">
                  <span>Price per lead:</span>
                  <strong>{formatCurrency(calculatePricePerLead(customLeadCount))}</strong>
                </div>
                <div className="pricing-row">
                  <span>Regular price:</span>
                  <span className="strikethrough">{formatCurrency(customLeadCount * 80)}</span>
                </div>
                <div className="pricing-row discount-row">
                  <span>Discount:</span>
                  <strong className="discount-text">-{calculateDiscount(customLeadCount)}%</strong>
                </div>
                <div className="pricing-row total-row">
                  <span>Total:</span>
                  <strong className="total-price">{formatCurrency(customLeadCount * calculatePricePerLead(customLeadCount))}</strong>
                </div>
                <div className="pricing-row savings-row">
                  <span>You save:</span>
                  <strong className="savings-amount">
                    {formatCurrency((customLeadCount * 80) - (customLeadCount * calculatePricePerLead(customLeadCount)))}
                  </strong>
                </div>
              </div>

              <button
                className="btn btn-primary btn-large"
                onClick={() => handleCustomPackagePurchase()}
                disabled={availableLowScoreLeads === 0 || customLeadCount === 0}
              >
                {availableLowScoreLeads === 0 
                  ? 'No Leads Available' 
                  : customLeadCount === 0
                  ? 'Select Lead Quantity'
                  : `Purchase ${customLeadCount} Leads - ${formatCurrency(customLeadCount * calculatePricePerLead(customLeadCount))}`
                }
              </button>
            </div>
          </div>
        )}
      </div>

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
                onClick={() => handlePurchase(pkg)}
              >
                Purchase Package - {formatCurrency(pkg.totalPrice)}
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

      {/* Stripe Payment Modal */}
      {selectedPackage && (
        <Elements stripe={stripePromise}>
          <PaymentModal
            pkg={selectedPackage}
            onClose={handleCloseModal}
            onSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
    </div>
  );
};

export default BulkLeads;
