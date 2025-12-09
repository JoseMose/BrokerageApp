import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { marketplaceAPI, paymentAPI } from '../utils/api';
import { stripePromise } from '../utils/stripe';
import ScoreMeter from '../components/ScoreMeter';
import { 
  formatCurrency, 
  getLeadTypeLabel, 
  getTimeRemaining,
  formatDate,
  formatFieldLabel,
  formatFieldValue
} from '../utils/helpers';
import './LeadDetails.css';

function CheckoutForm({ lead, onSuccess, onError }) {
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
      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      // Purchase lead
      const response = await paymentAPI.purchaseLead({
        leadId: lead.leadId,
        paymentMethodId: paymentMethod.id,
      });

      onSuccess(response.data.data);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
      onError(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <div className="form-group">
        <label className="form-label">Card Details</label>
        <div className="card-element-container">
          <CardElement 
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button 
        type="submit" 
        disabled={!stripe || processing} 
        className="btn btn-primary btn-block btn-lg"
      >
        {processing ? 'Processing...' : `Purchase for ${formatCurrency(lead.price)}`}
      </button>

      <p className="payment-note">
        🔒 Secure payment powered by Stripe. Your card information is never stored on our servers.
      </p>
    </form>
  );
}

function LeadDetails() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [purchasedLead, setPurchasedLead] = useState(null);

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const response = await marketplaceAPI.getLead(leadId);
      setLead(response.data.data);
    } catch (err) {
      console.error('Error fetching lead details:', err);
      setError(err.response?.data?.error || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSuccess = (data) => {
    setPurchaseComplete(true);
    setPurchasedLead(data.lead);
  };

  const handlePurchaseError = (err) => {
    console.error('Purchase error:', err);
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
        <button onClick={() => navigate('/marketplace')} className="btn btn-outline">
          Back to Marketplace
        </button>
      </div>
    );
  }

  if (purchaseComplete) {
    return (
      <div className="container lead-details">
        <div className="alert alert-success">
          <h2>🎉 Purchase Successful!</h2>
          <p>You now have access to the full lead details.</p>
        </div>

        <div className="card">
          <h2>Lead Contact Information</h2>
          <div className="contact-info">
            <div className="contact-item">
              <span className="contact-label">Name:</span>
              <span className="contact-value">{purchasedLead?.contact?.name}</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">Email:</span>
              <span className="contact-value">{purchasedLead?.contact?.email}</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">Phone:</span>
              <span className="contact-value">{purchasedLead?.contact?.phone}</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">Address:</span>
              <span className="contact-value">
                {purchasedLead?.location?.address}, {purchasedLead?.location?.city}, {purchasedLead?.location?.state} {purchasedLead?.location?.zip}
              </span>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button onClick={() => navigate('/history')} className="btn btn-primary">
            View My Leads
          </button>
          <button onClick={() => navigate('/marketplace')} className="btn btn-outline">
            Browse More Leads
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container lead-details">
      <button onClick={() => navigate('/marketplace')} className="btn btn-outline btn-back">
        ← Back to Marketplace
      </button>

      <div className="grid grid-2">
        <div>
          <div className="card">
            <div className="lead-header-detail">
              <h1>{getLeadTypeLabel(lead.leadType)} Lead</h1>
              <div className="lead-price-detail">{formatCurrency(lead.price)}</div>
            </div>

            <div className="lead-meta">
              <span className="badge badge-primary">{getLeadTypeLabel(lead.leadType)}</span>
              <span className="lead-distance">📍 {lead.distance} miles away</span>
            </div>

            <ScoreMeter score={lead.score} />

            <div className="lead-reason-detail">
              <h3>AI Analysis</h3>
              <p>{lead.aiReason}</p>
            </div>
          </div>

          <div className="card">
            <h3>Location</h3>
            <div className="location-info">
              <p><strong>City:</strong> {lead.location.city}</p>
              <p><strong>State:</strong> {lead.location.state}</p>
              <p><strong>ZIP Code:</strong> {lead.location.zip}</p>
              <p className="text-secondary">Full address available after purchase</p>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Lead Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Posted:</span>
                <span>{formatDate(lead.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Expires:</span>
                <span className="text-warning">{getTimeRemaining(lead.expiresAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Contact Preview:</span>
                <span>
                  {lead.contact.nameInitial}***, 
                  ***@{lead.contact.emailDomain}, 
                  ({lead.contact.phoneArea})***-****
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Questionnaire Responses</h3>
            <div className="responses">
              {Object.entries(lead.responses || {}).map(([question, answer]) => (
                <div key={question} className="response-item">
                  <div className="response-question">{formatFieldLabel(question)}</div>
                  <div className="response-answer">{formatFieldValue(question, answer)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            {!showCheckout ? (
              <div>
                <h3>Ready to Purchase?</h3>
                <p>Get full access to contact information and lead details.</p>
                <button 
                  onClick={() => setShowCheckout(true)} 
                  className="btn btn-primary btn-block btn-lg"
                >
                  Purchase for {formatCurrency(lead.price)}
                </button>
              </div>
            ) : (
              <div>
                <h3>Complete Purchase</h3>
                <Elements stripe={stripePromise}>
                  <CheckoutForm 
                    lead={lead} 
                    onSuccess={handlePurchaseSuccess}
                    onError={handlePurchaseError}
                  />
                </Elements>
                <button 
                  onClick={() => setShowCheckout(false)} 
                  className="btn btn-outline btn-block"
                  style={{ marginTop: '1rem' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeadDetails;
