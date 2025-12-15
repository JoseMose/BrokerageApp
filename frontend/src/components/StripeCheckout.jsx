import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { paymentAPI } from '../utils/api';
import './StripeCheckout.css';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
};

function StripeCheckout({ lead, onSuccess, onCancel, lockExpiresAt }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [lockExpired, setLockExpired] = useState(false);

  // Lock countdown timer
  useEffect(() => {
    if (!lockExpiresAt) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = lockExpiresAt - now;

      if (remaining <= 0) {
        setLockExpired(true);
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [lockExpiresAt]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (lockExpired) {
      setError('Lock expired. Please try again.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get card element
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

      // Call backend to process purchase
      const response = await paymentAPI.purchaseLead({
        leadId: lead.leadId,
        paymentMethodId: paymentMethod.id,
      });

      if (response.data.data.status === 'completed') {
        // Success! Call the success callback
        onSuccess(response.data.data);
      } else {
        setError('Payment processing failed. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const progress = (timeRemaining / 15) * 100;

  return (
    <div className="stripe-checkout-modal">
      <div className="stripe-checkout-content">
        <div className="checkout-header">
          <h2>Purchase Lead</h2>
          <button onClick={onCancel} className="close-button" disabled={processing}>
            ×
          </button>
        </div>

        {/* Lock Timer */}
        <div className="lock-timer">
          <div className="timer-text">
            {lockExpired ? (
              <span className="timer-expired">⏰ Lock Expired</span>
            ) : (
              <>
                <span className="timer-icon">🔒</span>
                <span className="timer-countdown">{timeRemaining}s</span>
                <span className="timer-label">remaining</span>
              </>
            )}
          </div>
          <div className="timer-progress-bar">
            <div
              className="timer-progress-fill"
              style={{
                width: `${progress}%`,
                backgroundColor: lockExpired
                  ? '#f44336'
                  : timeRemaining <= 5
                  ? '#ff9800'
                  : '#4caf50',
              }}
            ></div>
          </div>
        </div>

        {/* Lead Summary */}
        <div className="lead-summary">
          <div className="summary-row">
            <span className="summary-label">Lead Type:</span>
            <span className={`badge ${lead.leadType === 'seller' ? 'badge-success' : 'badge-primary'}`}>
              {lead.leadType === 'seller' ? 'Seller' : 'Buyer'}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">AI Score:</span>
            <span className="summary-value">{lead.score}/10</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Location:</span>
            <span className="summary-value">
              {lead.location.city}, {lead.location.state}
            </span>
          </div>
          <div className="summary-row summary-row-total">
            <span className="summary-label">Total:</span>
            <span className="summary-price">${lead.price.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-group">
            <label className="form-label">Card Information</label>
            <div className="card-element-wrapper">
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="checkout-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-outline"
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!stripe || processing || lockExpired}
            >
              {processing ? (
                <>
                  <span className="spinner-small"></span>
                  Processing...
                </>
              ) : lockExpired ? (
                'Lock Expired'
              ) : (
                `Pay $${lead.price.toFixed(2)}`
              )}
            </button>
          </div>
        </form>

        <div className="payment-secure">
          <span className="secure-icon">🔒</span>
          <span className="secure-text">Secure payment powered by Stripe</span>
        </div>
      </div>
    </div>
  );
}

export default StripeCheckout;
