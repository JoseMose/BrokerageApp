import React, { useState, useEffect } from 'react';
import './EditLeadModal.css';

const EditLeadModal = ({ lead, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyAddress: '',
    city: '',
    state: '',
    zipCode: '',
    leadType: 'buyer',
    buyingTimeframe: '',
    priceRange: '',
    prequalified: '',
    currentlyOwnHome: '',
    workingWithAgent: '',
    additionalInfo: '',
  });

  useEffect(() => {
    if (lead) {
      // Split name into first and last if it's in contact.name format
      const fullName = lead.contact?.name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setFormData({
        firstName: lead.firstName || firstName,
        lastName: lead.lastName || lastName,
        email: lead.contact?.email || lead.email || '',
        phone: lead.contact?.phone || lead.phone || '',
        propertyAddress: lead.propertyAddress || lead.location?.address || '',
        city: lead.location?.city || lead.city || '',
        state: lead.location?.state || lead.state || '',
        zipCode: lead.location?.zipCode || lead.zipCode || '',
        leadType: lead.leadType || 'buyer',
        buyingTimeframe: lead.questionnaire?.buyingTimeframe || lead.buyingTimeframe || '',
        priceRange: lead.questionnaire?.priceRange || lead.priceRange || '',
        prequalified: lead.questionnaire?.prequalified || lead.prequalified || '',
        currentlyOwnHome: lead.questionnaire?.currentlyOwnHome || lead.currentlyOwnHome || '',
        workingWithAgent: lead.questionnaire?.workingWithAgent || lead.workingWithAgent || '',
        additionalInfo: lead.questionnaire?.additionalInfo || lead.additionalInfo || '',
      });
    }
  }, [lead]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.firstName || !formData.lastName) {
      alert('First and last name are required');
      return;
    }

    if (!formData.email && !formData.phone) {
      alert('At least one contact method (email or phone) is required');
      return;
    }

    await onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container edit-lead-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Lead Information</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-lead-form">
          <div className="form-section">
            <h3>Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Property Information</h3>
            <div className="form-group">
              <label>Property Address</label>
              <input
                type="text"
                name="propertyAddress"
                value={formData.propertyAddress}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  maxLength="2"
                />
              </div>
              <div className="form-group">
                <label>Zip Code</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Lead Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Lead Type</label>
                <select
                  name="leadType"
                  value={formData.leadType}
                  onChange={handleChange}
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="form-group">
                <label>Timeframe</label>
                <input
                  type="text"
                  name="buyingTimeframe"
                  value={formData.buyingTimeframe}
                  onChange={handleChange}
                  placeholder="e.g., 0-3 months"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price Range</label>
                <input
                  type="text"
                  name="priceRange"
                  value={formData.priceRange}
                  onChange={handleChange}
                  placeholder="e.g., $200k-$300k"
                />
              </div>
              <div className="form-group">
                <label>Pre-qualified</label>
                <select
                  name="prequalified"
                  value={formData.prequalified}
                  onChange={handleChange}
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="in-progress">In Progress</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Currently Own Home</label>
                <select
                  name="currentlyOwnHome"
                  value={formData.currentlyOwnHome}
                  onChange={handleChange}
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Working with Agent</label>
                <select
                  name="workingWithAgent"
                  value={formData.workingWithAgent}
                  onChange={handleChange}
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Additional Information</label>
              <textarea
                name="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleChange}
                rows="4"
                placeholder="Any additional notes or details..."
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLeadModal;
