import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      // For custom packages, purchase directly from the pool
      if (pkg.isCustom) {
        const response = await bulkPackagesAPI.purchaseCustomBulk(
          pkg.leadCount,
          pkg.pricePerLead
        );

        if (response.data.success || response.data.transaction) {
          onSuccess({
            success: true,
            package: {
              leadCount: pkg.leadCount,
              totalPrice: pkg.totalPrice,
            },
            transaction: response.data.transaction,
            leads: response.data.leads,
          });
          return;
        } else {
          setError(response.data.message || 'Purchase failed');
          setProcessing(false);
          return;
        }
      }

      // For pre-built packages, use Stripe payment
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
              {formatCurrency((pkg.leadCount * 20) - pkg.totalPrice)} ({pkg.discountPercent}% off)
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          {!pkg.isCustom && (
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
          )}

          {pkg.isCustom && (
            <div className="alert alert-info">
              <span className="alert-icon">ℹ️</span>
              Click "Confirm Purchase" to get {pkg.leadCount} leads from the available pool
            </div>
          )}

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
              disabled={pkg.isCustom ? processing : (!stripe || processing)}
            >
              {processing ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : pkg.isCustom ? (
                <>Confirm Purchase - {formatCurrency(pkg.totalPrice)}</>
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [availableLowScoreLeads, setAvailableLowScoreLeads] = useState(0);
  const [customLeadCount, setCustomLeadCount] = useState(10);

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
        // Get count of low-score leads (4 or below)
        const lowScoreCount = response.data.data?.availableLowScoreLeads || response.data.availableLowScoreLeads || 0;
        setAvailableLowScoreLeads(lowScoreCount);
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error fetching packages:', err);
      if (!signal?.aborted) {
        setError(err.response?.data?.message || 'Failed to load available leads');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const calculatePricePerLead = (leadCount) => {
    // Bulk discount tiers - much more affordable!
    if (leadCount < 10) return 20;  // Less than 10 leads, regular price
    if (leadCount >= 100) return 2;   // 90% off ($20 -> $2)
    if (leadCount >= 50) return 3;    // 85% off ($20 -> $3)
    if (leadCount >= 25) return 4;    // 80% off ($20 -> $4)
    if (leadCount >= 10) return 5;    // 75% off ($20 -> $5)
    return 20; // Regular price for 1-9 leads
  };

  const calculateDiscount = (leadCount) => {
    const pricePerLead = calculatePricePerLead(leadCount);
    return Math.round(((20 - pricePerLead) / 20) * 100);
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
    const leadCount = data.package?.leadCount || selectedPackage?.leadCount || 0;
    setSuccessMessage(`Successfully purchased ${leadCount} leads! Redirecting to My Leads...`);
    setSelectedPackage(null);
    
    // Navigate to My Leads after a brief delay
    setTimeout(() => {
      navigate('/history');
    }, 2000);
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
          Choose how many leads you want - the more you buy, the cheaper they get!
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

      {/* Custom Package Builder - Always Visible */}
      <div className="custom-package-section">
        <div className="custom-package-header">
          <div className="custom-header-content">
            <h2>🎯 Select Your Package</h2>
            <p className="low-score-count">
              <strong>{availableLowScoreLeads}</strong> leads available (Score 4 or below)
            </p>
          </div>
        </div>

        <div className="custom-package-builder active">
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
                min="10"
                max={availableLowScoreLeads >= 200 ? 200 : Math.max(10, availableLowScoreLeads)}
                step="5"
                value={customLeadCount}
                onChange={(e) => setCustomLeadCount(parseInt(e.target.value))}
                className="lead-count-slider"
                disabled={availableLowScoreLeads === 0}
              />
              <div className="slider-range">
                <span>10</span>
                <span>{availableLowScoreLeads >= 200 ? 200 : Math.max(10, availableLowScoreLeads)}</span>
              </div>
            </div>

            <div className="custom-pricing">
              <div className="pricing-row">
                <span>Price per lead:</span>
                <strong>{formatCurrency(calculatePricePerLead(customLeadCount))}</strong>
              </div>
              <div className="pricing-row">
                <span>Regular price:</span>
                <span className="strikethrough">{formatCurrency(customLeadCount * 20)}</span>
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
                  {formatCurrency((customLeadCount * 20) - (customLeadCount * calculatePricePerLead(customLeadCount)))}
                </strong>
              </div>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={() => handleCustomPackagePurchase()}
              disabled={availableLowScoreLeads === 0 || customLeadCount < 10}
            >
              {availableLowScoreLeads === 0 
                ? 'No Leads Available' 
                : customLeadCount < 10
                ? 'Select At Least 10 Leads'
                : `Purchase ${customLeadCount} Leads - ${formatCurrency(customLeadCount * calculatePricePerLead(customLeadCount))}`
              }
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Tiers Info */}
      <div className="bulk-leads-info">
        <h2>Volume Discounts</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">🎯</div>
            <h3>10-24 Leads</h3>
            <p><strong>$5 per lead</strong><br/>75% off regular price</p>
          </div>
          <div className="info-card">
            <div className="info-icon">📊</div>
            <h3>25-49 Leads</h3>
            <p><strong>$4 per lead</strong><br/>80% off regular price</p>
          </div>
          <div className="info-card">
            <div className="info-icon">💰</div>
            <h3>50-99 Leads</h3>
            <p><strong>$3 per lead</strong><br/>85% off regular price</p>
          </div>
          <div className="info-card">
            <div className="info-icon">⚡</div>
            <h3>100+ Leads</h3>
            <p><strong>$2 per lead</strong><br/>90% off regular price</p>
          </div>
        </div>
        <div className="info-features">
          <p>✓ All leads unlocked immediately with full contact information</p>
          <p>✓ Leads appear in your My Leads section at the top of your funnel</p>
          <p>✓ Each lead is exclusive - sold to one realtor only</p>
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
