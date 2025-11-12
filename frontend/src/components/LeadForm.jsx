import React, { useState } from 'react';
import ProgressIndicator from './ProgressIndicator';
import LoadingSpinner from './LoadingSpinner';
import RealtorComplianceModal from './RealtorComplianceModal';
import ConfirmationScreen from './ConfirmationScreen';
import { submitLead } from '../utils/api';

const GEORGIA_CITIES = ['atlanta', 'savannah', 'augusta', 'columbus', 'macon', 'athens', 'sandy springs', 'roswell', 'johns creek', 'albany', 'warner robins', 'alpharetta', 'marietta', 'valdosta', 'smyrna', 'dunwoody'];

const LeadForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    leadType: '',           // Step 1
    motivation: '',         // Step 2
    timeline: '',           // Step 3
    location: '',           // Step 4
    preApproved: null,      // Step 5 (buyer)
    estimatedValue: '',     // Step 5 (seller)
    hasRealtor: null,       // Step 6
    name: '',               // Step 7
    phone: '',              // Step 7
    email: '',              // Step 7
    submissionResponse: null, // Store API response with score
  });

  const totalSteps = 8;

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1 && !formData.leadType) {
      newErrors.leadType = 'Please select an option';
    }
    if (step === 2 && !formData.motivation) {
      newErrors.motivation = 'Please select an option';
    }
    if (step === 3 && !formData.timeline) {
      newErrors.timeline = 'Please select an option';
    }
    if (step === 4) {
      if (!formData.location.trim()) {
        newErrors.location = 'Please enter a city or ZIP code';
      } else {
        const isZip = /^(30|31)\d{3}$/.test(formData.location.trim());
        const isGeorgiaCity = GEORGIA_CITIES.some(city => 
          formData.location.toLowerCase().includes(city)
        );
        if (!isZip && !isGeorgiaCity) {
          newErrors.location = 'We currently only serve Georgia. Please enter a Georgia city or ZIP code.';
        }
      }
    }
    if (step === 5) {
      if (formData.leadType === 'buyer' && formData.preApproved === null) {
        newErrors.preApproved = 'Please select an option';
      }
      if (formData.leadType === 'seller' && !formData.estimatedValue) {
        newErrors.estimatedValue = 'Please provide an estimate';
      }
    }
    if (step === 7) {
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (formData.phone.replace(/\D/g, '').length !== 10) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 6) {
        if (formData.hasRealtor === true) {
          setShowComplianceModal(true);
          return;
        }
      }
      
      setCurrentStep(currentStep + 1);
      setErrors({});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields
    const submitErrors = {};
    
    if (!formData.leadType) submitErrors.leadType = 'Lead type is required';
    if (!formData.motivation) submitErrors.motivation = 'Motivation is required';
    if (!formData.timeline) submitErrors.timeline = 'Timeline is required';
    if (!formData.location) submitErrors.location = 'Location is required';
    if (!formData.name?.trim()) submitErrors.name = 'Name is required';
    if (!formData.email?.trim()) submitErrors.email = 'Email is required';
    if (!formData.phone?.trim()) submitErrors.phone = 'Phone is required';
    
    if (Object.keys(submitErrors).length > 0) {
      setErrors(submitErrors);
      setCurrentStep(7); // Go back to contact info step
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Build responses object for AI scoring
      const responses = {
        motivation: formData.motivation,
        timeline: formData.timeline,
      };
      
      // Add buyer/seller-specific responses
      if (formData.leadType === 'buyer') {
        responses.preApproved = formData.preApproved;
        responses.buyingTimeline = formData.timeline;
      } else {
        responses.estimatedValue = formData.estimatedValue;
        responses.sellingTimeline = formData.timeline;
      }

      const payload = {
        leadType: formData.leadType,
        contact: {
          name: formData.name.trim(),
          phone: formData.phone.replace(/\D/g, ''),
          email: formData.email.toLowerCase().trim(),
        },
        location: {
          address: formData.location,
          city: formData.location.split(',')[0] || formData.location,
          state: 'GA',
          zipCode: formData.location.match(/\d{5}/) ? formData.location.match(/\d{5}/)[0] : '30301',
        },
        responses,
      };

      const response = await submitLead(payload);
      
      if (response.success) {
        // Store the response data including score
        setFormData(prev => ({
          ...prev,
          submissionResponse: response.data
        }));
        setShowConfirmation(true);
      } else {
        setErrors({ submit: response.message || 'Something went wrong. Please try again.' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ submit: 'Failed to submit. Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setShowComplianceModal(false);
    setCurrentStep(1);
    setFormData({
      leadType: '',
      motivation: '',
      timeline: '',
      location: '',
      preApproved: null,
      estimatedValue: '',
      hasRealtor: null,
      name: '',
      phone: '',
      email: '',
    });
    setErrors({});
  };

  if (isSubmitting) {
    return <LoadingSpinner message="Finding the perfect agent match for you..." />;
  }

  if (showConfirmation) {
    return <ConfirmationScreen leadData={formData.submissionResponse} />;
  }

  if (showComplianceModal) {
    return <RealtorComplianceModal onRestart={handleRestart} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
          <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

          {isSubmitting ? (
            <LoadingSpinner message="Analyzing your answers..." />
          ) : (
            <div className="animate-fade-in">
              {/* Step 1: Lead Type */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Let's find the right realtor for you
                    </h2>
                    <p className="text-gray-600">Choose one to get started</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setFormData({ ...formData, leadType: 'buyer' });
                        setErrors({});
                        setCurrentStep(2);
                      }}
                      className={`p-8 rounded-2xl border-2 transition-all duration-200 ${
                        formData.leadType === 'buyer'
                          ? 'border-primary-500 bg-primary-50 shadow-lg scale-105'
                          : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                      }`}
                    >
                      <div className="text-5xl mb-4">🏠</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">I want to buy a home</h3>
                      <p className="text-sm text-gray-600">Find your dream property</p>
                    </button>

                    <button
                      onClick={() => {
                        setFormData({ ...formData, leadType: 'seller' });
                        setErrors({});
                        setCurrentStep(2);
                      }}
                      className={`p-8 rounded-2xl border-2 transition-all duration-200 ${
                        formData.leadType === 'seller'
                          ? 'border-primary-500 bg-primary-50 shadow-lg scale-105'
                          : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                      }`}
                    >
                      <div className="text-5xl mb-4">🏡</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">I want to sell a home</h3>
                      <p className="text-sm text-gray-600">Get the best value</p>
                    </button>
                  </div>
                  {errors.leadType && (
                    <p className="text-red-500 text-sm text-center mt-2">{errors.leadType}</p>
                  )}
                </div>
              )}

              {/* Step 2: Motivation */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      What's motivating your move?
                    </h2>
                    <p className="text-gray-600">This helps us understand your needs</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'first-home', label: 'Buying my first home', icon: '🎉' },
                      { value: 'relocating', label: 'Relocating for work/family', icon: '✈️' },
                      { value: 'investing', label: 'Investment property', icon: '💰' },
                      { value: 'upsizing', label: 'Upsizing/Downsizing', icon: '📏' },
                      { value: 'other', label: 'Other reasons', icon: '🤔' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, motivation: option.value });
                          setErrors({});
                          setCurrentStep(3);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.motivation === option.value
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-gray-900">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.motivation && (
                    <p className="text-red-500 text-sm text-center mt-2">{errors.motivation}</p>
                  )}
                </div>
              )}

              {/* Step 3: Timeline */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      When are you planning to move?
                    </h2>
                    <p className="text-gray-600">Your timeline helps us prioritize your match</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'asap', label: 'ASAP (Ready now!)', icon: '⚡' },
                      { value: '1-3-months', label: '1-3 months', icon: '📅' },
                      { value: '3-6-months', label: '3-6 months', icon: '🗓️' },
                      { value: '6-plus-months', label: '6+ months (Just planning)', icon: '🤷' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, timeline: option.value });
                          setErrors({});
                          setCurrentStep(4);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.timeline === option.value
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-gray-900">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.timeline && (
                    <p className="text-red-500 text-sm text-center mt-2">{errors.timeline}</p>
                  )}
                </div>
              )}

              {/* Step 4: Location */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Where are you looking?
                    </h2>
                    <p className="text-gray-600">Enter a Georgia city or ZIP code</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="e.g., Atlanta or 30301"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleNext();
                          }
                        }}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.location ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.location && (
                        <p className="text-red-500 text-sm mt-2">{errors.location}</p>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm text-blue-900">
                        <strong>📍 Currently serving:</strong> All of Georgia
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-secondary-600 transition-all shadow-lg"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Financial Details (Buyer) */}
              {currentStep === 5 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Have you been pre-approved for a mortgage?
                    </h2>
                    <p className="text-gray-600">This helps gauge your readiness</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: true, label: "Yes, I'm pre-approved ✓", icon: '✅' },
                      { value: false, label: 'No, not yet', icon: '⏳' },
                      { value: 'not-yet', label: 'Not yet, but working on it', icon: '🏦' },
                    ].map((option) => (
                      <button
                        key={String(option.value)}
                        onClick={() => {
                          setFormData({ ...formData, preApproved: option.value });
                          setErrors({});
                          setCurrentStep(6);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.preApproved === option.value
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-gray-900">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.preApproved && (
                    <p className="text-red-500 text-sm text-center mt-2">{errors.preApproved}</p>
                  )}
                </div>
              )}

              {/* Step 5: Financial Details (Seller) */}
              {currentStep === 5 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      What's your home's estimated value?
                    </h2>
                    <p className="text-gray-600">A rough estimate is fine</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: '0-200k', label: 'Under $200k', icon: '🏘️' },
                      { value: '200k-400k', label: '$200k - $400k', icon: '🏠' },
                      { value: '400k-600k', label: '$400k - $600k', icon: '🏡' },
                      { value: '600k-1m', label: '$600k - $1M', icon: '🏰' },
                      { value: '1m-plus', label: '$1M+', icon: '🏛️' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, estimatedValue: option.value });
                          setErrors({});
                          setCurrentStep(6);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.estimatedValue === option.value
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-gray-900">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.estimatedValue && (
                    <p className="text-red-500 text-sm text-center mt-2">{errors.estimatedValue}</p>
                  )}
                </div>
              )}

              {/* Step 6: Realtor Check */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Are you currently working with a realtor?
                    </h2>
                    <p className="text-gray-600">Important for compliance purposes</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setFormData({ ...formData, hasRealtor: false });
                        setErrors({});
                        setCurrentStep(7);
                      }}
                      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                        formData.hasRealtor === false
                          ? 'border-green-500 bg-green-50 shadow-lg'
                          : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                      }`}
                    >
                      <span className="text-3xl">✅</span>
                      <span className="text-lg font-semibold text-gray-900">No, I need help finding one</span>
                    </button>

                    <button
                      onClick={() => {
                        setFormData({ ...formData, hasRealtor: true });
                        setErrors({});
                        setShowComplianceModal(true);
                      }}
                      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                        formData.hasRealtor === true
                          ? 'border-yellow-500 bg-yellow-50 shadow-lg'
                          : 'border-gray-200 hover:border-yellow-300 hover:shadow-md'
                      }`}
                    >
                      <span className="text-3xl">⚠️</span>
                      <span className="text-lg font-semibold text-gray-900">Yes, I already have a realtor</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 7: Contact Info */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      Almost done! How can we reach you?
                    </h2>
                    <p className="text-gray-600">Your matched agent will contact you soon</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="(555) 555-5555"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                          errors.phone ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 8: Submit */}
              {currentStep === 8 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎯</div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      You're all set!
                    </h2>
                    <p className="text-gray-600">Ready to match you with the perfect agent</p>
                  </div>

                  <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl p-6 mb-6">
                    <h3 className="font-bold text-gray-800 mb-4">Your Information:</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><strong>Type:</strong> {formData.leadType === 'buyer' ? 'Buyer' : 'Seller'}</p>
                      <p><strong>Motivation:</strong> {formData.motivation}</p>
                      <p><strong>Timeline:</strong> {formData.timeline}</p>
                      <p><strong>Location:</strong> {formData.location}</p>
                      <p><strong>Contact:</strong> {formData.name} ({formData.email})</p>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                      <p className="text-red-800 text-sm">{errors.submit}</p>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-xl py-5 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-xl"
                  >
                    🚀 Match Me With My Realtor
                  </button>
                </div>
              )}

              {/* Navigation Buttons */}
              {currentStep < 7 && currentStep !== 1 && (
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>
              )}

              {currentStep === 7 && (
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    Review & Submit
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {currentStep === 8 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Go Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            🔒 Your information is secure and will only be shared with your matched agent
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeadForm;
