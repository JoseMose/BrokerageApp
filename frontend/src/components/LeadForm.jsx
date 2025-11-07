import React, { useState } from 'react';
import RealtorCheckModal from './RealtorCheckModal';
import SubmitSuccess from './SubmitSuccess';
import { validateLeadForm, formatPhoneNumber } from '../utils/validation';
import { submitLead } from '../utils/api';
import './LeadForm.css';

/**
 * Multi-step lead generation form
 * Steps: 1) Lead Type → 2) Realtor Check → 3) Basic Info → 4) Location → 5) Details → 6) Submit
 */
function LeadForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showRealtorModal, setShowRealtorModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    // Step 1: Lead Type
    leadType: '',
    
    // Step 2: Realtor Check
    hasRealtor: null,
    
    // Step 3: Basic Info
    name: '',
    email: '',
    phone: '',
    
    // Step 4: Location
    address: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Step 5: Details (buyer)
    buyingTimeline: '',
    preApproved: null,
    priceRange: '',
    
    // Step 5: Details (seller)
    sellingTimeline: '',
    hasListedBefore: null,
    estimatedValue: '',
    propertyType: '',
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let formattedValue = value;
    
    // Auto-format phone number
    if (name === 'phone') {
      formattedValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'radio' ? (value === 'true') : formattedValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleRealtorCheck = (hasRealtor) => {
    setFormData(prev => ({ ...prev, hasRealtor }));
    
    if (hasRealtor === true) {
      // Show compliance modal and STOP
      setShowRealtorModal(true);
    } else {
      // Continue to next step
      setCurrentStep(3);
    }
  };

  const handleRestartForm = () => {
    setShowRealtorModal(false);
    setCurrentStep(1);
    setFormData({
      leadType: '',
      hasRealtor: null,
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      buyingTimeline: '',
      preApproved: null,
      priceRange: '',
      sellingTimeline: '',
      hasListedBefore: null,
      estimatedValue: '',
      propertyType: '',
    });
    setErrors({});
  };

  const validateCurrentStep = () => {
    const newErrors = {};
    
    if (currentStep === 1 && !formData.leadType) {
      newErrors.leadType = 'Please select whether you are buying or selling';
    }
    
    if (currentStep === 3) {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
      else if (formData.phone.replace(/\D/g, '').length !== 10) {
        newErrors.phone = 'Phone must be 10 digits';
      }
    }
    
    if (currentStep === 4) {
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.state) newErrors.state = 'State is required';
      if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
      else if (!/^\d{5}$/.test(formData.zipCode)) {
        newErrors.zipCode = 'ZIP must be 5 digits';
      }
    }
    
    if (currentStep === 5) {
      if (formData.leadType === 'buyer') {
        if (!formData.buyingTimeline) newErrors.buyingTimeline = 'Timeline is required';
        if (formData.preApproved === null) newErrors.preApproved = 'Pre-approval status required';
      } else {
        if (!formData.sellingTimeline) newErrors.sellingTimeline = 'Timeline is required';
        if (formData.hasListedBefore === null) newErrors.hasListedBefore = 'Previous listing status required';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep === 1) {
        setCurrentStep(2); // Go to realtor check
      } else if (currentStep < 5) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 3) {
      // Skip back over realtor check
      setCurrentStep(1);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      // Submit to backend
      const response = await submitLead(formData);
      
      if (response.success) {
        setShowSuccess(true);
      } else {
        setErrors({ submit: response.message || 'Submission failed' });
      }
    } catch (error) {
      console.error('Lead submission error:', error);
      setErrors({ 
        submit: error.message || 'Failed to submit. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Show success screen
  if (showSuccess) {
    return <SubmitSuccess onReset={handleRestartForm} />;
  }

  return (
    <>
      <div className="lead-form-container">
        <div className="form-header">
          <h2 className="form-title">Get Connected with a Top Agent</h2>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
          <p className="step-indicator">Step {currentStep} of 5</p>
        </div>

        <form onSubmit={handleSubmit} className="lead-form">
          {/* Step 1: Lead Type */}
          {currentStep === 1 && (
            <div className="form-step fade-in">
              <h3 className="step-title">Are you looking to buy or sell?</h3>
              <div className="radio-group">
                <label className={`radio-card ${formData.leadType === 'buyer' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="leadType"
                    value="buyer"
                    checked={formData.leadType === 'buyer'}
                    onChange={handleInputChange}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">🏠</span>
                    <span className="radio-label">I'm Buying</span>
                  </div>
                </label>
                
                <label className={`radio-card ${formData.leadType === 'seller' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="leadType"
                    value="seller"
                    checked={formData.leadType === 'seller'}
                    onChange={handleInputChange}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">💰</span>
                    <span className="radio-label">I'm Selling</span>
                  </div>
                </label>
              </div>
              {errors.leadType && <p className="error-message">{errors.leadType}</p>}
            </div>
          )}

          {/* Step 2: Realtor Check */}
          {currentStep === 2 && (
            <div className="form-step fade-in">
              <h3 className="step-title">Do you currently have a realtor representing you?</h3>
              <div className="radio-group">
                <label className={`radio-card ${formData.hasRealtor === false ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="hasRealtor"
                    value="false"
                    checked={formData.hasRealtor === false}
                    onChange={(e) => handleRealtorCheck(false)}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">✅</span>
                    <span className="radio-label">No, I don't have a realtor</span>
                  </div>
                </label>
                
                <label className={`radio-card ${formData.hasRealtor === true ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="hasRealtor"
                    value="true"
                    checked={formData.hasRealtor === true}
                    onChange={(e) => handleRealtorCheck(true)}
                  />
                  <div className="radio-content">
                    <span className="radio-icon">🤝</span>
                    <span className="radio-label">Yes, I have a realtor</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Basic Info */}
          {currentStep === 3 && (
            <div className="form-step fade-in">
              <h3 className="step-title">Tell us about yourself</h3>
              
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <p className="error-message">{errors.name}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@example.com"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <p className="error-message">{errors.email}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                  className={errors.phone ? 'error' : ''}
                />
                {errors.phone && <p className="error-message">{errors.phone}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Location */}
          {currentStep === 4 && (
            <div className="form-step fade-in">
              <h3 className="step-title">Where is the property located?</h3>
              
              <div className="form-group">
                <label htmlFor="address">Street Address *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main St"
                  className={errors.address ? 'error' : ''}
                />
                {errors.address && <p className="error-message">{errors.address}</p>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">City *</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Los Angeles"
                    className={errors.city ? 'error' : ''}
                  />
                  {errors.city && <p className="error-message">{errors.city}</p>}
                </div>

                <div className="form-group">
                  <label htmlFor="state">State *</label>
                  <select
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className={errors.state ? 'error' : ''}
                  >
                    <option value="">Select State</option>
                    <option value="CA">California</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    <option value="NY">New York</option>
                    {/* Add more states as needed */}
                  </select>
                  {errors.state && <p className="error-message">{errors.state}</p>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="zipCode">ZIP Code *</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="90210"
                  maxLength="5"
                  className={errors.zipCode ? 'error' : ''}
                />
                {errors.zipCode && <p className="error-message">{errors.zipCode}</p>}
              </div>
            </div>
          )}

          {/* Step 5: Details (Buyer) */}
          {currentStep === 5 && formData.leadType === 'buyer' && (
            <div className="form-step fade-in">
              <h3 className="step-title">A few more details</h3>
              
              <div className="form-group">
                <label htmlFor="buyingTimeline">When are you looking to buy? *</label>
                <select
                  id="buyingTimeline"
                  name="buyingTimeline"
                  value={formData.buyingTimeline}
                  onChange={handleInputChange}
                  className={errors.buyingTimeline ? 'error' : ''}
                >
                  <option value="">Select timeline</option>
                  <option value="immediately">Immediately</option>
                  <option value="1-3-months">1-3 months</option>
                  <option value="3-6-months">3-6 months</option>
                  <option value="6-12-months">6-12 months</option>
                  <option value="just-browsing">Just browsing</option>
                </select>
                {errors.buyingTimeline && <p className="error-message">{errors.buyingTimeline}</p>}
              </div>

              <div className="form-group">
                <label>Have you been pre-approved for a mortgage? *</label>
                <div className="radio-inline">
                  <label>
                    <input
                      type="radio"
                      name="preApproved"
                      value="true"
                      checked={formData.preApproved === true}
                      onChange={handleInputChange}
                    />
                    Yes
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="preApproved"
                      value="false"
                      checked={formData.preApproved === false}
                      onChange={handleInputChange}
                    />
                    No
                  </label>
                </div>
                {errors.preApproved && <p className="error-message">{errors.preApproved}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="priceRange">Price Range (Optional)</label>
                <select
                  id="priceRange"
                  name="priceRange"
                  value={formData.priceRange}
                  onChange={handleInputChange}
                >
                  <option value="">Select range</option>
                  <option value="0-200k">Under $200k</option>
                  <option value="200k-400k">$200k - $400k</option>
                  <option value="400k-600k">$400k - $600k</option>
                  <option value="600k-1m">$600k - $1M</option>
                  <option value="1m+">$1M+</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 5: Details (Seller) */}
          {currentStep === 5 && formData.leadType === 'seller' && (
            <div className="form-step fade-in">
              <h3 className="step-title">A few more details</h3>
              
              <div className="form-group">
                <label htmlFor="sellingTimeline">When are you looking to sell? *</label>
                <select
                  id="sellingTimeline"
                  name="sellingTimeline"
                  value={formData.sellingTimeline}
                  onChange={handleInputChange}
                  className={errors.sellingTimeline ? 'error' : ''}
                >
                  <option value="">Select timeline</option>
                  <option value="immediately">Immediately</option>
                  <option value="1-3-months">1-3 months</option>
                  <option value="3-6-months">3-6 months</option>
                  <option value="6-12-months">6-12 months</option>
                  <option value="just-researching">Just researching</option>
                </select>
                {errors.sellingTimeline && <p className="error-message">{errors.sellingTimeline}</p>}
              </div>

              <div className="form-group">
                <label>Have you listed a property before? *</label>
                <div className="radio-inline">
                  <label>
                    <input
                      type="radio"
                      name="hasListedBefore"
                      value="true"
                      checked={formData.hasListedBefore === true}
                      onChange={handleInputChange}
                    />
                    Yes
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hasListedBefore"
                      value="false"
                      checked={formData.hasListedBefore === false}
                      onChange={handleInputChange}
                    />
                    No
                  </label>
                </div>
                {errors.hasListedBefore && <p className="error-message">{errors.hasListedBefore}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="estimatedValue">Estimated Property Value (Optional)</label>
                <select
                  id="estimatedValue"
                  name="estimatedValue"
                  value={formData.estimatedValue}
                  onChange={handleInputChange}
                >
                  <option value="">Select range</option>
                  <option value="0-200k">Under $200k</option>
                  <option value="200k-400k">$200k - $400k</option>
                  <option value="400k-600k">$400k - $600k</option>
                  <option value="600k-1m">$600k - $1M</option>
                  <option value="1m+">$1M+</option>
                </select>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="error-banner">
              <p>{errors.submit}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="form-actions">
            {currentStep > 1 && currentStep !== 2 && (
              <button
                type="button"
                onClick={handleBack}
                className="btn-secondary"
                disabled={loading}
              >
                ← Back
              </button>
            )}
            
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary"
                disabled={loading}
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Realtor Compliance Modal */}
      {showRealtorModal && (
        <RealtorCheckModal onClose={handleRestartForm} />
      )}
    </>
  );
}

export default LeadForm;
