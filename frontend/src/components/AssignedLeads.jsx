import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { agentAPI, paymentAPI } from '../utils/api';
import { stripePromise } from '../utils/stripe';
import { formatCurrency, formatDate, getTimeRemaining } from '../utils/helpers';

function PaymentModal({ lead, onClose, onSuccess }) {
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
      setError(err.response?.data?.error || err.response?.data?.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Complete Purchase</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Lead Score</span>
            <span className="text-2xl font-bold text-indigo-600">{lead.score}/10</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Type</span>
            <span className="font-semibold">{lead.leadType === 'buyer' ? '🏠 Buyer' : '🏡 Seller'}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Location</span>
            <span className="font-semibold">{lead.location.city}, {lead.location.state}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-indigo-200">
            <span className="text-gray-900 font-bold">Total Amount</span>
            <span className="text-2xl font-bold text-green-600">{formatCurrency(lead.price)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Card Details
            </label>
            <div className="border border-gray-300 rounded-lg p-3 bg-white">
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

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || processing}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
              !stripe || processing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                Processing Payment...
              </span>
            ) : (
              `Pay ${formatCurrency(lead.price)}`
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            🔒 Secure payment powered by Stripe
          </p>
        </form>
      </div>
    </div>
  );
}

function AssignedLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchAssignedLeads(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, []);

  const fetchAssignedLeads = async (signal) => {
    try {
      setLoading(true);
      setError(null);
      const response = await agentAPI.getAssignedLeads();
      
      if (!signal?.aborted) {
        setLeads(response.data.data.leads || []);
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Error fetching assigned leads:', err);
      if (!signal?.aborted) {
        setError(err.response?.data?.message || 'Failed to load assigned leads');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const handleClaimLead = (lead) => {
    setSelectedLead(lead);
  };

  const handlePaymentSuccess = (data) => {
    setSelectedLead(null);
    alert(`Lead claimed successfully! Full contact information:\n\nName: ${data.lead.contact.name}\nEmail: ${data.lead.contact.email}\nPhone: ${data.lead.contact.phone}\n\nYou can view this in My Leads.`);
    fetchAssignedLeads(); // Refresh list
  };

  const handlePassLead = async (leadId) => {
    if (!confirm('Pass this lead to the next agent in rotation? You will not be able to claim it again.')) {
      return;
    }
    
    try {
      setClaiming(leadId);
      // Call API to unassign and reassign to next agent
      await agentAPI.passLead(leadId);
      alert('Lead passed to next agent successfully!');
      await fetchAssignedLeads(); // Refresh list
    } catch (err) {
      console.error('Error passing lead:', err);
      alert(err.response?.data?.message || 'Failed to pass lead');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
        <p className="font-semibold">Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">📬</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No Assigned Leads Yet
        </h3>
        <p className="text-gray-600">
          Standard quality leads (score 5-7) are automatically assigned to you via round-robin rotation. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h2 className="text-2xl font-bold text-gray-900">
            Auto-Assigned Leads ({leads.length})
          </h2>
        </div>
        <p className="text-gray-700">
          These leads were automatically assigned to you based on fair round-robin distribution.
          Claim them to access full contact information.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {leads.map((lead) => (
          <div 
            key={lead.leadId} 
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
              <div className="flex justify-between items-center text-white">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-semibold">
                  {lead.leadType === 'buyer' ? '🏠 Buyer' : '🏡 Seller'}
                </span>
                <div className="text-right">
                  <div className="text-2xl font-bold">{lead.score}/10</div>
                  <div className="text-xs opacity-90">AI Score</div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Client Name */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  <div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Client Name</div>
                    <div className="text-lg font-bold text-gray-900">{lead.contact?.name || 'Name Hidden'}</div>
                  </div>
                </div>
              </div>

              {/* AI Reason */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700 italic">"{lead.aiReason}"</p>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium text-gray-900">
                    {lead.location.city}, {lead.location.state}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-bold text-green-600">{formatCurrency(lead.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned:</span>
                  <span className="font-medium">{formatDate(lead.assignedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expires:</span>
                  <span className="font-medium text-orange-600">
                    {getTimeRemaining(lead.expiresAt)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleClaimLead(lead)}
                  disabled={claiming === lead.leadId}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                    claiming === lead.leadId
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {claiming === lead.leadId ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </span>
                  ) : (
                    `Claim for ${formatCurrency(lead.price)}`
                  )}
                </button>
                
                <button
                  onClick={() => handlePassLead(lead.leadId)}
                  disabled={claiming === lead.leadId}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                    claiming === lead.leadId
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }`}
                >
                  Pass to Next Agent →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {selectedLead && (
        <Elements stripe={stripePromise}>
          <PaymentModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
    </div>
  );
}

export default AssignedLeads;
