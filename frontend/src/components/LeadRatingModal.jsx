import React, { useState } from 'react';
import './LeadRatingModal.css';

const LeadRatingModal = ({ lead, isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    contacted: false,
    contactMethod: 'phone',
    contactedAt: '',
    clientResponsiveness: '',
    contactability: 0,
    accuracy: 0,
    engagement: 0,
    conversionPotential: 0,
    overallQuality: 0,
    actualTimeline: '',
    actualBudget: '',
    leadDataMismatch: false,
    mismatchDetails: '',
    wouldRecommend: false,
    comments: '',
  });

  const [hoveredRating, setHoveredRating] = useState({});

  if (!isOpen) return null;

  const handleRatingClick = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRatingHover = (field, value) => {
    setHoveredRating({ ...hoveredRating, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    if (!formData.contacted) {
      alert('Please indicate if you have contacted this lead');
      return;
    }

    if (formData.contacted && !formData.contactMethod) {
      alert('Please select a contact method');
      return;
    }

    if (formData.contacted && !formData.clientResponsiveness) {
      alert('Please select the client\'s responsiveness level');
      return;
    }

    // Validate all 5 rating categories are filled
    if (formData.contactability === 0) {
      alert('Please rate the Contactability (how easy was it to reach the client)');
      return;
    }

    if (formData.accuracy === 0) {
      alert('Please rate the Information Accuracy');
      return;
    }

    if (formData.engagement === 0) {
      alert('Please rate the Client Engagement level');
      return;
    }

    if (formData.conversionPotential === 0) {
      alert('Please rate the Conversion Potential');
      return;
    }

    if (formData.overallQuality === 0) {
      alert('Please provide an Overall Quality rating');
      return;
    }

    await onSubmit(formData);
    onClose();
  };

  const renderStars = (field, label, description) => {
    const value = formData[field];
    const hovered = hoveredRating[field] || 0;

    return (
      <div className="rating-group">
        <label>
          {label}
          <span className="rating-description">{description}</span>
        </label>
        <div className="star-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`star ${star <= (hovered || value) ? 'filled' : ''}`}
              onClick={() => handleRatingClick(field, star)}
              onMouseEnter={() => handleRatingHover(field, star)}
              onMouseLeave={() => handleRatingHover(field, 0)}
            >
              ★
            </button>
          ))}
          <span className="rating-value">
            {value > 0 ? `${value}/5` : 'Not rated'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rating-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Rate Lead Quality</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="lead-info">
          <h3>{lead.name}</h3>
          <p>
            {lead.leadType === 'buyer' ? '🏠 Buyer' : '💰 Seller'} • 
            AI Score: {lead.score}/10 • 
            ${lead.price}
          </p>
          <p className="lead-location">📍 {lead.location?.city}, {lead.location?.state} {lead.location?.zip}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Contact Status */}
          <div className="form-section">
            <h3>📞 Contact Information</h3>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.contacted}
                  onChange={(e) => setFormData({ ...formData, contacted: e.target.checked })}
                />
                I have contacted this lead
              </label>
            </div>

            {formData.contacted && (
              <>
                <div className="form-group">
                  <label>Contact Method</label>
                  <select
                    value={formData.contactMethod}
                    onChange={(e) => setFormData({ ...formData, contactMethod: e.target.value })}
                  >
                    <option value="phone">Phone Call</option>
                    <option value="text">Text Message</option>
                    <option value="email">Email</option>
                    <option value="in-person">In Person</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Contact Date</label>
                  <input
                    type="date"
                    value={formData.contactedAt}
                    onChange={(e) => setFormData({ ...formData, contactedAt: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Client Responsiveness</label>
                  <select
                    value={formData.clientResponsiveness}
                    onChange={(e) => setFormData({ ...formData, clientResponsiveness: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="immediate">Immediate Response</option>
                    <option value="same-day">Same Day Response</option>
                    <option value="delayed">Delayed Response (2+ days)</option>
                    <option value="no-response">No Response</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Quality Ratings */}
          <div className="form-section">
            <h3>⭐ Quality Ratings</h3>
            
            {renderStars(
              'contactability',
              'Contactability',
              'How easy was it to reach this lead?'
            )}
            
            {renderStars(
              'accuracy',
              'Information Accuracy',
              'How accurate was the lead information?'
            )}
            
            {renderStars(
              'engagement',
              'Client Engagement',
              'How engaged was the client in the conversation?'
            )}
            
            {renderStars(
              'conversionPotential',
              'Conversion Potential',
              'How likely is this lead to convert?'
            )}
            
            {renderStars(
              'overallQuality',
              'Overall Quality',
              'Overall assessment of this lead'
            )}
          </div>

          {/* Additional Details */}
          <div className="form-section">
            <h3>📋 Additional Details</h3>
            
            <div className="form-group">
              <label>Actual Timeline (if discussed)</label>
              <input
                type="text"
                placeholder="e.g., Looking to buy in 3 months"
                value={formData.actualTimeline}
                onChange={(e) => setFormData({ ...formData, actualTimeline: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Actual Budget (if discussed)</label>
              <input
                type="text"
                placeholder="e.g., $400k - $500k"
                value={formData.actualBudget}
                onChange={(e) => setFormData({ ...formData, actualBudget: e.target.value })}
              />
            </div>

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.leadDataMismatch}
                  onChange={(e) => setFormData({ ...formData, leadDataMismatch: e.target.checked })}
                />
                Lead information didn't match what I was told
              </label>
            </div>

            {formData.leadDataMismatch && (
              <div className="form-group">
                <label>What didn't match?</label>
                <textarea
                  rows="3"
                  placeholder="Describe the discrepancy..."
                  value={formData.mismatchDetails}
                  onChange={(e) => setFormData({ ...formData, mismatchDetails: e.target.value })}
                />
              </div>
            )}

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.wouldRecommend}
                  onChange={(e) => setFormData({ ...formData, wouldRecommend: e.target.checked })}
                />
                I would purchase similar leads in the future
              </label>
            </div>

            <div className="form-group">
              <label>Additional Comments (Optional)</label>
              <textarea
                rows="4"
                placeholder="Any other feedback about this lead..."
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadRatingModal;
