import React, { useState, useEffect, useRef } from 'react';
import ProgressIndicator from './ProgressIndicator';
import LoadingSpinner from './LoadingSpinner';
import RealtorComplianceModal from './RealtorComplianceModal';
import ConfirmationScreen from './ConfirmationScreen';
import { submitLead } from '../utils/api';

// North Atlanta cities and ZIP codes (including Cobb County)
const NORTH_ATLANTA_CITIES = [
  'alpharetta', 'roswell', 'johns creek', 'milton', 'sandy springs',
  'dunwoody', 'brookhaven', 'peachtree corners', 'duluth', 'suwanee',
  'cumming', 'sugar hill', 'buford', 'lawrenceville', 'norcross',
  'marietta', 'kennesaw', 'smyrna', 'acworth', 'powder springs',
  'austell', 'mableton', 'vinings', 'east cobb', 'cobb county'
];

// North Atlanta ZIP codes (including Cobb County 30060-30082, 30090, 30106-30127, 30152, 30168)
const NORTH_ATLANTA_ZIPS = [
  // Fulton County - North Atlanta
  '30004', '30005', '30009', '30022', '30024', '30040', '30041', '30060',
  '30062', '30066', '30068', '30075', '30076', '30077', '30078', '30079',
  '30080', '30092', '30093', '30094', '30096', '30097', '30188', '30338',
  '30339', '30340', '30341', '30342', '30345', '30346', '30350', '30360',
  '30518', '30519',
  // Cobb County - Marietta and surrounding
  '30060', '30061', '30062', '30063', '30064', '30066', '30067', '30068',
  '30069', '30080', '30082', '30090', '30106', '30107', '30108', '30109',
  '30126', '30127', '30152', '30168'
];

const isNorthAtlantaZip = (zip) => NORTH_ATLANTA_ZIPS.includes(zip.trim());
const isNorthAtlantaCity = (location) => {
  const lowerLocation = location.toLowerCase().trim();
  return NORTH_ATLANTA_CITIES.some(city => lowerLocation.includes(city));
};

const LeadForm = ({ initialLeadType = null }) => {
  const [currentStep, setCurrentStep] = useState(initialLeadType ? 2 : 1);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState({});
  const [showTransition, setShowTransition] = useState(false);
  const [transitionText, setTransitionText] = useState('');

  // Behavioral telemetry state
  const [behaviorMetrics, setBehaviorMetrics] = useState({
    timing_metrics: {},
    interaction_metrics: {
      edits_count: {},
      focus_events: 0,
      copy_paste_flag: false,
      device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      user_agent: navigator.userAgent,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
    },
    behavior_summary: {},
  });

  const stepStartTime = useRef(Date.now());
  const formStartTime = useRef(Date.now());
  const typingStartTime = useRef(null);
  const fieldEditCounts = useRef({});
  const previousValues = useRef({});

  const [formData, setFormData] = useState({
    leadType: initialLeadType || '',           // Step 1
    motivation: '',         // Step 2
    timeline: '',           // Step 3
    commitmentLevel: '',    // Step 4 - NEW: Commitment question after timeline
    location: '',           // Step 5
    preApproved: null,      // Step 6 (buyer)
    priceRange: '',         // Step 6 (buyer)
    rentingOrSelling: '',   // Step 6 (buyer)
    earnestMoney: null,     // Step 6 (buyer)
    estimatedValue: '',     // Step 6 (seller)
    occupiedStatus: '',     // Step 6 (seller)
    majorRepairs: null,     // Step 6 (seller)
    searchActivity: '',     // Step 7 - NEW: Search activity question
    realityCheck: '',       // Step 8 - NEW: Reality check question
    hasRealtor: null,       // Step 9
    importantFactors: '',   // Step 10 - NEW: Open-ended question
    name: '',               // Step 11
    phone: '',              // Step 11
    email: '',              // Step 11
    agentCommitment: false, // Step 12 - NEW: Final commitment checkbox
    submissionResponse: null, // Store API response with score
  });

  const totalSteps = 12;

  // Track step timing
  useEffect(() => {
    stepStartTime.current = Date.now();
  }, [currentStep]);

  // Track field edits and typing
  const handleFieldChange = (fieldName, value) => {
    // Track if value actually changed (edit count)
    if (previousValues.current[fieldName] !== undefined && previousValues.current[fieldName] !== value) {
      fieldEditCounts.current[fieldName] = (fieldEditCounts.current[fieldName] || 0) + 1;
    }
    previousValues.current[fieldName] = value;

    // Track typing start time
    if (!typingStartTime.current) {
      typingStartTime.current = Date.now();
    }

    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Track focus events
  const handleFocus = () => {
    setBehaviorMetrics(prev => ({
      ...prev,
      interaction_metrics: {
        ...prev.interaction_metrics,
        focus_events: prev.interaction_metrics.focus_events + 1,
      },
    }));
  };

  // Track copy/paste
  const handlePaste = () => {
    setBehaviorMetrics(prev => ({
      ...prev,
      interaction_metrics: {
        ...prev.interaction_metrics,
        copy_paste_flag: true,
      },
    }));
  };

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
    if (step === 4 && !formData.commitmentLevel) {
      newErrors.commitmentLevel = 'Please select an option';
    }
    if (step === 5) {
      if (!formData.location.trim()) {
        newErrors.location = 'Please enter a city or ZIP code';
      } else {
        const input = formData.location.trim();
        const zipMatch = input.match(/\d{5}/);
        const isValidZip = zipMatch && isNorthAtlantaZip(zipMatch[0]);
        const isValidCity = isNorthAtlantaCity(input);
        
        if (!isValidZip && !isValidCity) {
          newErrors.location = 'Sorry, we currently only serve North Atlanta & Cobb County. Please enter a valid city or ZIP code from our service area.';
        }
      }
    }
    if (step === 6) {
      if (formData.leadType === 'buyer') {
        if (!formData.preApproved) {
          newErrors.preApproved = 'Please select your pre-approval status';
        }
        if (!formData.priceRange) {
          newErrors.priceRange = 'Please select your price range';
        }
        if (!formData.rentingOrSelling) {
          newErrors.rentingOrSelling = 'Please select your current situation';
        }
        if (!formData.earnestMoney) {
          newErrors.earnestMoney = 'Please indicate if you have earnest money ready';
        }
      } else if (formData.leadType === 'seller') {
        if (!formData.estimatedValue) {
          newErrors.estimatedValue = 'Please provide an estimate';
        }
        if (!formData.occupiedStatus) {
          newErrors.occupiedStatus = 'Please select the occupancy status';
        }
        if (!formData.majorRepairs) {
          newErrors.majorRepairs = 'Please indicate if repairs are needed';
        }
      }
    }
    if (step === 7 && !formData.searchActivity) {
      newErrors.searchActivity = 'Please select an option';
    }
    if (step === 8 && !formData.realityCheck) {
      newErrors.realityCheck = 'Please select an option';
    }
    if (step === 11) {
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
      // Calculate time spent on this step
      const timeOnStep = Date.now() - stepStartTime.current;
      const typingDuration = typingStartTime.current ? Date.now() - typingStartTime.current : 0;
      
      // Store timing for this step
      setBehaviorMetrics(prev => ({
        ...prev,
        timing_metrics: {
          ...prev.timing_metrics,
          [`step_${currentStep}_time_ms`]: timeOnStep,
          [`step_${currentStep}_typing_ms`]: typingDuration,
        },
      }));
      
      // Reset typing timer
      typingStartTime.current = null;

      if (currentStep === 9) {
        if (formData.hasRealtor === true) {
          setShowComplianceModal(true);
          return;
        }
      }
      
      // Show transition animation with random delay (600-1000ms)
      const transitionMessages = [
        'Analyzing your answers...',
        'Processing...',
        'One moment...',
        'Checking your information...',
        'Almost there...',
      ];
      
      setTransitionText(transitionMessages[Math.floor(Math.random() * transitionMessages.length)]);
      setShowTransition(true);
      
      const delay = 600 + Math.random() * 400; // Random 600-1000ms
      
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setShowTransition(false);
        setErrors({});
      }, delay);
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
    if (!formData.agentCommitment) submitErrors.agentCommitment = 'Please confirm you are open to speaking with an agent';
    
    if (Object.keys(submitErrors).length > 0) {
      setErrors(submitErrors);
      setCurrentStep(11); // Go back to contact info step
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Calculate total form time
      const totalFormTime = Date.now() - formStartTime.current;
      
      // Calculate behavior summary flags
      const avgStepTime = totalFormTime / totalSteps;
      const isFastFiller = avgStepTime < 3000; // Less than 3s per step
      const isHesitant = Object.values(fieldEditCounts.current).some(count => count > 3);
      const isLikelyBot = isFastFiller && !behaviorMetrics.interaction_metrics.focus_events;

      // Build responses object for AI scoring
      const responses = {
        motivation: formData.motivation,
        timeline: formData.timeline,
        commitmentLevel: formData.commitmentLevel, // NEW
        searchActivity: formData.searchActivity, // NEW
        realityCheck: formData.realityCheck, // NEW
        importantFactors: formData.importantFactors, // NEW
        agentCommitment: formData.agentCommitment, // NEW
      };
      
      // Add buyer/seller-specific responses
      if (formData.leadType === 'buyer') {
        responses.preApproved = formData.preApproved;
        responses.buyingTimeline = formData.timeline;
        responses.priceRange = formData.priceRange;
        responses.rentingOrSelling = formData.rentingOrSelling;
        responses.earnestMoney = formData.earnestMoney;
      } else {
        responses.estimatedValue = formData.estimatedValue;
        responses.sellingTimeline = formData.timeline;
        responses.occupiedStatus = formData.occupiedStatus;
        responses.majorRepairs = formData.majorRepairs;
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
        // Add behavioral telemetry
        behaviorMetrics: {
          timing_metrics: {
            ...behaviorMetrics.timing_metrics,
            total_form_time_ms: totalFormTime,
          },
          interaction_metrics: {
            ...behaviorMetrics.interaction_metrics,
            edits_count: fieldEditCounts.current,
          },
          behavior_summary: {
            fast_filler: isFastFiller,
            hesitant: isHesitant,
            likely_bot: isLikelyBot,
          },
        },
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

  // Helper function to format field labels for display
  const formatFieldLabel = (field) => {
    const labelMap = {
      leadType: 'Lead Type',
      motivation: 'Motivation',
      timeline: 'Timeline',
      location: 'Location',
      preApproved: 'Pre-Approval Status',
      priceRange: 'Budget Range',
      rentingOrSelling: 'Current Housing Situation',
      earnestMoney: 'Earnest Money Ready',
      estimatedValue: 'Estimated Property Value',
      occupiedStatus: 'Occupancy Status',
      majorRepairs: 'Repairs Needed',
      hasRealtor: 'Working with Realtor',
      name: 'Name',
      email: 'Email',
      phone: 'Phone'
    };
    return labelMap[field] || field;
  };

  // Helper function to format field values for display
  const formatFieldValue = (field, value) => {
    if (value === null || value === undefined || value === '') return 'Not specified';

    // Format specific fields
    const valueMap = {
      // Lead type
      buyer: 'Buying a home',
      seller: 'Selling a home',
      
      // Motivation
      'first-home': 'Buying my first home',
      relocating: 'Relocating for work/family',
      upgrading: formData.leadType === 'buyer' ? 'Upgrading to a bigger home' : 'Buying a bigger home',
      downsizing: 'Downsizing/Empty nester',
      investment: 'Investment/rental property',
      financial: 'Financial reasons',
      inherited: 'Inherited property',
      'investment-exit': 'Selling investment property',
      divorce: 'Divorce/Life changes',
      other: 'Other reasons',
      
      // Timeline
      asap: formData.leadType === 'buyer' ? 'ASAP (Ready to buy now!)' : 'ASAP (Ready to list now!)',
      '1-3-months': 'Within 1-3 months',
      '3-6-months': 'Within 3-6 months',
      '6-plus-months': formData.leadType === 'buyer' ? '6+ months (Just exploring)' : '6+ months (Just researching)',
      
      // Pre-approval
      yes: 'Yes, pre-approved',
      'not-yet': 'Not yet, but working on it',
      no: 'No, not yet',
      
      // Price/Value ranges
      '0-200k': 'Under $200k',
      '200k-400k': '$200k - $400k',
      '400k-600k': '$400k - $600k',
      '600k-1m': '$600k - $1M',
      '1m-plus': '$1M+',
      flexible: 'Flexible',
      'not-sure': 'Not sure',
      
      // Renting/Selling
      renting: 'Currently renting',
      'selling-first': 'Need to sell my home first',
      'first-time': 'First-time buyer (living with family)',
      
      // Occupancy
      owner: 'Owner-occupied (I live here)',
      tenant: 'Tenant-occupied (rental)',
      vacant: 'Vacant',
      
      // Repairs
      minor: 'Minor cosmetic fixes',
      major: 'Yes, major repairs needed',
      
      // Boolean values
      true: 'Yes',
      false: 'No'
    };

    // Check if it's a mapped value
    if (valueMap[value]) return valueMap[value];
    
    // For yes/no earnest money or repairs "no"
    if (field === 'earnestMoney' && value === 'yes') return 'Yes, ready now';
    if (field === 'earnestMoney' && value === 'no') return 'Not yet';
    if (field === 'majorRepairs' && value === 'no') return 'No, move-in ready';
    
    // Return the value as-is if no mapping found
    return value;
  };

  if (isSubmitting) {
    return <LoadingSpinner message="Finding the perfect agent match for you..." />;
  }

  if (showTransition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pearl via-white to-pearl-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner message={transitionText} />
        </div>
      </div>
    );
  }

  if (showConfirmation) {
    return <ConfirmationScreen leadData={formData.submissionResponse} />;
  }

  if (showComplianceModal) {
    return <RealtorComplianceModal onRestart={handleRestart} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pearl via-white to-pearl-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl shadow-navy/5 p-8 md:p-12 border border-pearl-300">
          <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

          {isSubmitting ? (
            <LoadingSpinner message="Analyzing your answers..." />
          ) : (
            <div className="transition-opacity duration-300 ease-in-out opacity-100">
              {/* Step 1: Lead Type */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  {/* Trust Reassurance - MUST be seen immediately */}
                  <div className="text-center mb-6 animate-fade-in" style={{animationDelay: '100ms'}}>
                    <p className="text-base text-gray-600 font-medium">
                      Free to use. You'll only be matched with ONE local realtor — no spam, no pressure.
                    </p>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      What are you looking to do today?
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button
                      onClick={() => {
                        setFormData({ ...formData, leadType: 'buyer' });
                        setErrors({});
                        setCurrentStep(2);
                      }}
                      className={`p-10 rounded-2xl border-2 transition-all duration-300 animate-fade-in ${
                        formData.leadType === 'buyer'
                          ? 'border-electric bg-electric-50 shadow-lg shadow-electric/20 scale-105'
                          : 'border-gray-300 hover:border-electric-400 hover:shadow-lg hover:bg-electric-50/30 hover:scale-102'
                      }`}
                      style={{animationDelay: '200ms'}}
                    >
                      <div className="text-6xl mb-4">🏠</div>
                      <h3 className="text-2xl font-bold text-navy mb-2">Buy a home</h3>
                      <p className="text-sm text-gray-600">Find your dream property</p>
                    </button>

                    <button
                      onClick={() => {
                        setFormData({ ...formData, leadType: 'seller' });
                        setErrors({});
                        setCurrentStep(2);
                      }}
                      className={`p-10 rounded-2xl border-2 transition-all duration-300 animate-fade-in ${
                        formData.leadType === 'seller'
                          ? 'border-electric bg-electric-50 shadow-lg scale-105'
                          : 'border-gray-300 hover:border-electric-400 hover:shadow-lg hover:bg-electric-50/30 hover:scale-102'
                      }`}
                      style={{animationDelay: '300ms'}}
                    >
                      <div className="text-6xl mb-4">🏡</div>
                      <h3 className="text-2xl font-bold text-navy mb-2">Sell a home</h3>
                      <p className="text-sm text-gray-600">Get the best value</p>
                    </button>
                  </div>
                  {errors.leadType && (
                    <p className="text-danger text-sm text-center mt-2">{errors.leadType}</p>
                  )}
                </div>
              )}

              {/* Step 2: Motivation - Buyer */}
              {currentStep === 2 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      What's motivating your home purchase?
                    </h2>
                    <p className="text-slate">This helps us find the perfect agent for your needs</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'first-home', label: 'Buying my first home', icon: '🎉' },
                      { value: 'relocating', label: 'Relocating for work/family', icon: '✈️' },
                      { value: 'upgrading', label: 'Upgrading to a bigger home', icon: '⬆️' },
                      { value: 'downsizing', label: 'Downsizing/Empty nester', icon: '📦' },
                      { value: 'investment', label: 'Investment/rental property', icon: '💰' },
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
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.motivation && (
                    <p className="text-danger text-sm text-center mt-2">{errors.motivation}</p>
                  )}
                </div>
              )}

              {/* Step 2: Motivation - Seller */}
              {currentStep === 2 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Why are you selling your home?
                    </h2>
                    <p className="text-slate">This helps us match you with the right agent</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'relocating', label: 'Relocating for work/family', icon: '✈️' },
                      { value: 'upgrading', label: 'Buying a bigger home', icon: '⬆️' },
                      { value: 'downsizing', label: 'Downsizing/Empty nester', icon: '📦' },
                      { value: 'financial', label: 'Financial reasons', icon: '💵' },
                      { value: 'inherited', label: 'Inherited property', icon: '🏡' },
                      { value: 'investment-exit', label: 'Selling investment property', icon: '💰' },
                      { value: 'divorce', label: 'Divorce/Life changes', icon: '�' },
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
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.motivation && (
                    <p className="text-danger text-sm text-center mt-2">{errors.motivation}</p>
                  )}
                </div>
              )}

              {/* Step 3: Timeline - Buyer */}
              {currentStep === 3 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      When do you want to buy?
                    </h2>
                    <p className="text-slate">Your timeline helps us prioritize your match</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'asap', label: 'ASAP (Ready to buy now!)', icon: '⚡' },
                      { value: '1-3-months', label: 'Within 1-3 months', icon: '📅' },
                      { value: '3-6-months', label: 'Within 3-6 months', icon: '🗓️' },
                      { value: '6-plus-months', label: '6+ months (Just exploring)', icon: '🔍' },
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
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.timeline && (
                    <p className="text-danger text-sm text-center mt-2">{errors.timeline}</p>
                  )}
                </div>
              )}

              {/* Step 3: Timeline - Seller */}
              {currentStep === 3 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      When do you want to sell?
                    </h2>
                    <p className="text-slate">Your timeline helps us find the right agent</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'asap', label: 'ASAP (Ready to list now!)', icon: '⚡' },
                      { value: '1-3-months', label: 'Within 1-3 months', icon: '📅' },
                      { value: '3-6-months', label: 'Within 3-6 months', icon: '🗓️' },
                      { value: '6-plus-months', label: '6+ months (Just researching)', icon: '📊' },
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
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.timeline && (
                    <p className="text-danger text-sm text-center mt-2">{errors.timeline}</p>
                  )}
                </div>
              )}

              {/* Step 4: Commitment Level - Buyer (NEW) */}
              {currentStep === 4 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="inline-block mb-3 text-electric-600 text-sm font-semibold">Got it ✓</div>
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      If you found the right home, how soon would you feel comfortable making an offer?
                    </h2>
                    <p className="text-slate">This helps us match you with the right availability</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'immediately', label: 'Immediately', icon: '🚀' },
                      { value: 'within-week', label: 'Within a week', icon: '📆' },
                      { value: 'still-researching', label: 'Still researching', icon: '🔍' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, commitmentLevel: option.value });
                          setErrors({});
                          setCurrentStep(5);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.commitmentLevel === option.value
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.commitmentLevel && (
                    <p className="text-danger text-sm text-center mt-2">{errors.commitmentLevel}</p>
                  )}
                </div>
              )}

              {/* Step 4: Commitment Level - Seller (NEW) */}
              {currentStep === 4 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="inline-block mb-3 text-electric-600 text-sm font-semibold">That helps ✓</div>
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      If we agreed on price and timing, would you be ready to list your home?
                    </h2>
                    <p className="text-slate">This helps us understand your readiness</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'yes', label: 'Yes', icon: '✅' },
                      { value: 'possibly', label: 'Possibly', icon: '🤔' },
                      { value: 'not-yet', label: 'Not yet', icon: '⏳' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, commitmentLevel: option.value });
                          setErrors({});
                          setCurrentStep(5);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.commitmentLevel === option.value
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.commitmentLevel && (
                    <p className="text-danger text-sm text-center mt-2">{errors.commitmentLevel}</p>
                  )}
                </div>
              )}

              {/* Step 5: Location - Buyer */}
              {currentStep === 5 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Where do you want to buy?
                    </h2>
                    <p className="text-slate">Enter a North Atlanta city or ZIP code</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="e.g., Alpharetta, Marietta, or 30022"
                        value={formData.location}
                        onChange={(e) => handleFieldChange('location', e.target.value)}
                        onFocus={handleFocus}
                        onPaste={handlePaste}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleNext();
                          }
                        }}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all ${
                          errors.location ? 'border-danger' : 'border-pearl-300'
                        }`}
                      />
                      {errors.location && (
                        <p className="text-danger text-sm mt-2">{errors.location}</p>
                      )}
                    </div>

                    <div className="bg-electric-50 border border-electric-200 rounded-xl p-4">
                      <p className="text-sm text-navy">
                        <strong>📍 Service Area:</strong> North Atlanta & Cobb County (Alpharetta, Roswell, Johns Creek, Milton, Sandy Springs, Dunwoody, Marietta, Kennesaw, Smyrna, and surrounding areas)
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-pearl-50 transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-electric to-electric-600 text-white font-semibold rounded-xl hover:from-electric-600 hover:to-electric-700 transition-all shadow-lg"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Location - Seller */}
              {currentStep === 5 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Where is your property located?
                    </h2>
                    <p className="text-slate">Enter the city or ZIP code</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="e.g., Alpharetta, Marietta, or 30022"
                        value={formData.location}
                        onChange={(e) => handleFieldChange('location', e.target.value)}
                        onFocus={handleFocus}
                        onPaste={handlePaste}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleNext();
                          }
                        }}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all ${
                          errors.location ? 'border-danger' : 'border-pearl-300'
                        }`}
                      />
                      {errors.location && (
                        <p className="text-danger text-sm mt-2">{errors.location}</p>
                      )}
                    </div>

                    <div className="bg-electric-50 border border-electric-200 rounded-xl p-4">
                      <p className="text-sm text-navy">
                        <strong>📍 Service Area:</strong> North Atlanta & Cobb County (Alpharetta, Roswell, Johns Creek, Milton, Sandy Springs, Dunwoody, Marietta, Kennesaw, Smyrna, and surrounding areas)
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-pearl-50 transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-electric to-electric-600 text-white font-semibold rounded-xl hover:from-electric-600 hover:to-electric-700 transition-all shadow-lg"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Financial Details (Buyer) */}
              {currentStep === 6 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Tell us about your buying situation
                    </h2>
                    <p className="text-slate">This helps us match you with the right agent</p>
                  </div>

                  <div className="space-y-6">
                    {/* Pre-approval Status */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        Are you pre-approved for a mortgage? *
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'yes', label: "Yes, I'm pre-approved ✓", icon: '✅' },
                          { value: 'not-yet', label: 'Not yet, but working on it', icon: '🏦' },
                          { value: 'no', label: 'No, not yet', icon: '⏳' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('preApproved', option.value)}
                            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                              formData.preApproved === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 hover:shadow-sm bg-pearl-50'
                            }`}
                          >
                            <span className="text-2xl">{option.icon}</span>
                            <span className="text-base font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.preApproved && (
                        <p className="text-danger text-sm mt-2">{errors.preApproved}</p>
                      )}
                    </div>

                    {/* Price Range */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        What's your budget range? *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: '0-200k', label: 'Under $200k' },
                          { value: '200k-400k', label: '$200k-$400k' },
                          { value: '400k-600k', label: '$400k-$600k' },
                          { value: '600k-1m', label: '$600k-$1M' },
                          { value: '1m-plus', label: '$1M+' },
                          { value: 'flexible', label: 'Flexible' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('priceRange', option.value)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                              formData.priceRange === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 bg-pearl-50'
                            }`}
                          >
                            <span className="text-sm font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.priceRange && (
                        <p className="text-danger text-sm mt-2">{errors.priceRange}</p>
                      )}
                    </div>

                    {/* Current Housing Situation */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        Are you currently renting or selling first? *
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'renting', label: 'Currently renting', icon: '🏢' },
                          { value: 'selling-first', label: 'Need to sell my home first', icon: '🔄' },
                          { value: 'first-time', label: 'First-time buyer (living with family)', icon: '🏠' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('rentingOrSelling', option.value)}
                            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                              formData.rentingOrSelling === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 hover:shadow-sm bg-pearl-50'
                            }`}
                          >
                            <span className="text-2xl">{option.icon}</span>
                            <span className="text-base font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.rentingOrSelling && (
                        <p className="text-danger text-sm mt-2">{errors.rentingOrSelling}</p>
                      )}
                    </div>

                    {/* Earnest Money */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        Do you have earnest money ready? *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'yes', label: 'Yes, ready now', icon: '✅' },
                          { value: 'no', label: 'Not yet', icon: '⏳' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('earnestMoney', option.value)}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                              formData.earnestMoney === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 bg-pearl-50'
                            }`}
                          >
                            <span className="text-3xl">{option.icon}</span>
                            <span className="text-sm font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.earnestMoney && (
                        <p className="text-danger text-sm mt-2">{errors.earnestMoney}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-pearl-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-electric to-electric-600 text-white font-semibold rounded-xl hover:from-electric-600 hover:to-electric-700 transition-all shadow-lg"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6: Financial Details (Seller) */}
              {currentStep === 6 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Tell us about your property
                    </h2>
                    <p className="text-slate">This helps us find the best agent for your sale</p>
                  </div>

                  <div className="space-y-6">
                    {/* Estimated Value */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        What's your home's estimated value? *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: '0-200k', label: 'Under $200k', icon: '🏘️' },
                          { value: '200k-400k', label: '$200k-$400k', icon: '🏠' },
                          { value: '400k-600k', label: '$400k-$600k', icon: '🏡' },
                          { value: '600k-1m', label: '$600k-$1M', icon: '🏰' },
                          { value: '1m-plus', label: '$1M+', icon: '🏛️' },
                          { value: 'not-sure', label: 'Not sure', icon: '🤔' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('estimatedValue', option.value)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 flex items-center justify-center gap-2 ${
                              formData.estimatedValue === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 bg-pearl-50'
                            }`}
                          >
                            <span className="text-xl">{option.icon}</span>
                            <span className="text-sm font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.estimatedValue && (
                        <p className="text-danger text-sm mt-2">{errors.estimatedValue}</p>
                      )}
                    </div>

                    {/* Occupancy Status */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        Is the property currently occupied? *
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'owner', label: 'Owner-occupied (I live here)', icon: '👨‍👩‍👧‍👦' },
                          { value: 'tenant', label: 'Tenant-occupied (rental)', icon: '🏘️' },
                          { value: 'vacant', label: 'Vacant', icon: '🏚️' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('occupiedStatus', option.value)}
                            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                              formData.occupiedStatus === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 hover:shadow-sm bg-pearl-50'
                            }`}
                          >
                            <span className="text-2xl">{option.icon}</span>
                            <span className="text-base font-semibold text-navy">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.occupiedStatus && (
                        <p className="text-danger text-sm mt-2">{errors.occupiedStatus}</p>
                      )}
                    </div>

                    {/* Major Repairs Needed */}
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-3">
                        Does your property need any major repairs? *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'no', label: 'No, move-in ready', icon: '✅' },
                          { value: 'minor', label: 'Minor cosmetic fixes', icon: '🔧' },
                          { value: 'major', label: 'Yes, major repairs needed', icon: '🚧' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleFieldChange('majorRepairs', option.value)}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                              formData.majorRepairs === option.value
                                ? 'border-electric bg-electric-50 shadow-md'
                                : 'border-pearl-300 hover:border-electric-300 bg-pearl-50'
                            }`}
                          >
                            <span className="text-3xl">{option.icon}</span>
                            <span className="text-sm font-semibold text-navy text-center">{option.label}</span>
                          </button>
                        ))}
                      </div>
                      {errors.majorRepairs && (
                        <p className="text-danger text-sm mt-2">{errors.majorRepairs}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-pearl-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-electric to-electric-600 text-white font-semibold rounded-xl hover:from-electric-600 hover:to-electric-700 transition-all shadow-lg"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 7: Search Activity (NEW) */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="inline-block mb-3 text-electric-600 text-sm font-semibold">Almost done ✓</div>
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Have you already been looking at homes?
                    </h2>
                    <p className="text-slate">This helps us understand where you are in the process</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'yes-actively', label: 'Yes, actively (in person or serious online search)', icon: '🏠' },
                      { value: 'browsing-online', label: 'Mostly browsing online', icon: '💻' },
                      { value: 'not-yet', label: 'Not yet', icon: '🆕' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, searchActivity: option.value });
                          setErrors({});
                          setCurrentStep(8);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.searchActivity === option.value
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.searchActivity && (
                    <p className="text-danger text-sm text-center mt-2">{errors.searchActivity}</p>
                  )}
                </div>
              )}

              {/* Step 8: Reality Check - Buyer (NEW) */}
              {currentStep === 8 && formData.leadType === 'buyer' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Homes in your area can sell quickly. Are you prepared for competitive offers?
                    </h2>
                    <p className="text-slate">Understanding market conditions is important</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'yes-understand', label: 'Yes, I understand the process', icon: '✅' },
                      { value: 'still-learning', label: "I'm still learning", icon: '📚' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, realityCheck: option.value });
                          setErrors({});
                          setCurrentStep(9);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.realityCheck === option.value
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.realityCheck && (
                    <p className="text-danger text-sm text-center mt-2">{errors.realityCheck}</p>
                  )}
                </div>
              )}

              {/* Step 8: Reality Check - Seller (NEW) */}
              {currentStep === 8 && formData.leadType === 'seller' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Are you open to pricing your home based on current market data?
                    </h2>
                    <p className="text-slate">Realistic pricing leads to better results</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { value: 'yes', label: 'Yes', icon: '✅' },
                      { value: 'depends', label: 'It depends', icon: '🤔' },
                      { value: 'not-sure', label: 'Not sure yet', icon: '❓' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormData({ ...formData, realityCheck: option.value });
                          setErrors({});
                          setCurrentStep(9);
                        }}
                        className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                          formData.realityCheck === option.value
                            ? 'border-electric bg-electric-50 shadow-lg'
                            : 'border-pearl-300 hover:border-electric-300 hover:shadow-md bg-pearl-50'
                        }`}
                      >
                        <span className="text-3xl">{option.icon}</span>
                        <span className="text-lg font-semibold text-navy">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {errors.realityCheck && (
                    <p className="text-danger text-sm text-center mt-2">{errors.realityCheck}</p>
                  )}
                </div>
              )}

              {/* Step 9: Realtor Check */}
              {currentStep === 9 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Are you currently working with a realtor?
                    </h2>
                    <p className="text-slate">Important for compliance purposes</p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setFormData({ ...formData, hasRealtor: false });
                        setErrors({});
                        setCurrentStep(10);
                      }}
                      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                        formData.hasRealtor === false
                          ? 'border-emerald bg-emerald-50 shadow-lg'
                          : 'border-pearl-300 hover:border-emerald-300 hover:shadow-md bg-pearl-50'
                      }`}
                    >
                      <span className="text-3xl">✅</span>
                      <span className="text-lg font-semibold text-navy">No, I need help finding one</span>
                    </button>

                    <button
                      onClick={() => {
                        setFormData({ ...formData, hasRealtor: true });
                        setErrors({});
                        setShowComplianceModal(true);
                      }}
                      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
                        formData.hasRealtor === true
                          ? 'border-amber bg-amber-50 shadow-lg'
                          : 'border-pearl-300 hover:border-amber-300 hover:shadow-md bg-pearl-50'
                      }`}
                    >
                      <span className="text-3xl">⚠️</span>
                      <span className="text-lg font-semibold text-navy">Yes, I already have a realtor</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 10: Open-Ended Question (NEW) */}
              {currentStep === 10 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="inline-block mb-3 text-electric-600 text-sm font-semibold">Great! One last thing ✓</div>
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      What's most important to you in this move?
                    </h2>
                    <p className="text-slate">1-2 sentences is perfect. This helps agents understand your priorities.</p>
                  </div>

                  <div className="space-y-4">
                    <textarea
                      placeholder="Example: timing, price, school district, flexibility…"
                      value={formData.importantFactors}
                      onChange={(e) => handleFieldChange('importantFactors', e.target.value)}
                      onFocus={handleFocus}
                      rows={4}
                      className="w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all border-pearl-300 resize-none"
                    />
                    <p className="text-xs text-slate-500 text-center">Optional, but helpful for better matches</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-pearl-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(11)}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-electric to-electric-600 text-white font-semibold rounded-xl hover:from-electric-600 hover:to-electric-700 transition-all shadow-lg"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 11: Contact Info */}
              {currentStep === 11 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      Almost done! How can we reach you?
                    </h2>
                    <p className="text-slate">Your matched agent will contact you soon</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        onFocus={handleFocus}
                        onPaste={handlePaste}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all ${
                          errors.name ? 'border-danger' : 'border-pearl-300'
                        }`}
                      />
                      {errors.name && <p className="text-danger text-sm mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        onFocus={handleFocus}
                        onPaste={handlePaste}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all ${
                          errors.email ? 'border-danger' : 'border-pearl-300'
                        }`}
                      />
                      {errors.email && <p className="text-danger text-sm mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="(555) 555-5555"
                        value={formData.phone}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        onFocus={handleFocus}
                        onPaste={handlePaste}
                        className={`w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-electric transition-all ${
                          errors.phone ? 'border-danger' : 'border-pearl-300'
                        }`}
                      />
                      {errors.phone && <p className="text-danger text-sm mt-1">{errors.phone}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 12: Submit with Commitment Checkbox (NEW) */}
              {currentStep === 12 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎯</div>
                    <h2 className="text-3xl font-bold text-navy mb-2">
                      You're all set!
                    </h2>
                    <p className="text-slate">Ready to match you with the perfect agent</p>
                  </div>

                  <div className="bg-gradient-to-r from-electric-50 to-electric-100 rounded-2xl p-6 mb-6">
                    <h3 className="font-bold text-navy mb-4">Review Your Information:</h3>
                    <div className="space-y-3 text-sm">
                      {/* Lead Type */}
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Lead Type:</span>
                        <span className="text-navy">{formatFieldValue('leadType', formData.leadType)}</span>
                      </div>

                      {/* Motivation */}
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Motivation:</span>
                        <span className="text-navy text-right max-w-xs">{formatFieldValue('motivation', formData.motivation)}</span>
                      </div>

                      {/* Timeline */}
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Timeline:</span>
                        <span className="text-navy text-right max-w-xs">{formatFieldValue('timeline', formData.timeline)}</span>
                      </div>

                      {/* Location */}
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Location:</span>
                        <span className="text-navy">{formData.location}</span>
                      </div>

                      {/* Buyer-specific fields */}
                      {formData.leadType === 'buyer' && (
                        <>
                          {formData.preApproved && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Pre-Approval:</span>
                              <span className="text-navy text-right max-w-xs">{formatFieldValue('preApproved', formData.preApproved)}</span>
                            </div>
                          )}
                          {formData.priceRange && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Budget Range:</span>
                              <span className="text-navy">{formatFieldValue('priceRange', formData.priceRange)}</span>
                            </div>
                          )}
                          {formData.rentingOrSelling && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Current Situation:</span>
                              <span className="text-navy text-right max-w-xs">{formatFieldValue('rentingOrSelling', formData.rentingOrSelling)}</span>
                            </div>
                          )}
                          {formData.earnestMoney && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Earnest Money:</span>
                              <span className="text-navy">{formatFieldValue('earnestMoney', formData.earnestMoney)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Seller-specific fields */}
                      {formData.leadType === 'seller' && (
                        <>
                          {formData.estimatedValue && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Property Value:</span>
                              <span className="text-navy">{formatFieldValue('estimatedValue', formData.estimatedValue)}</span>
                            </div>
                          )}
                          {formData.occupiedStatus && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Occupancy:</span>
                              <span className="text-navy text-right max-w-xs">{formatFieldValue('occupiedStatus', formData.occupiedStatus)}</span>
                            </div>
                          )}
                          {formData.majorRepairs && (
                            <div className="flex justify-between py-2 border-b border-electric-200">
                              <span className="font-semibold text-navy-700">Repairs Needed:</span>
                              <span className="text-navy text-right max-w-xs">{formatFieldValue('majorRepairs', formData.majorRepairs)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Contact Info */}
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Name:</span>
                        <span className="text-navy">{formData.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Email:</span>
                        <span className="text-navy">{formData.email}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-electric-200">
                        <span className="font-semibold text-navy-700">Phone:</span>
                        <span className="text-navy">{formData.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Micro-Friction Commitment Moment (NEW) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
                    <p className="text-slate-700 text-base mb-4 text-center">
                      Before we match you, we want to respect our agents' time.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.agentCommitment}
                        onChange={(e) => setFormData({ ...formData, agentCommitment: e.target.checked })}
                        className="mt-1 w-5 h-5 text-electric focus:ring-electric border-slate-300 rounded cursor-pointer"
                      />
                      <span className="text-slate-700 text-sm leading-relaxed group-hover:text-navy transition-colors">
                        I'm actively looking and open to speaking with a realtor if the fit is right.
                      </span>
                    </label>
                    {errors.agentCommitment && (
                      <p className="text-danger text-sm mt-2">{errors.agentCommitment}</p>
                    )}
                  </div>

                  {errors.submit && (
                    <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 mb-4">
                      <p className="text-danger-800 text-sm">{errors.submit}</p>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!formData.agentCommitment}
                    className={`w-full font-bold text-xl py-5 px-8 rounded-xl transition-all duration-200 shadow-xl ${
                      formData.agentCommitment
                        ? 'bg-gradient-to-r from-electric to-electric-600 hover:from-electric-600 hover:to-electric-700 text-white transform hover:scale-105'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    🚀 Match Me With My Realtor
                  </button>
                </div>
              )}

              {/* Navigation Buttons */}
              {currentStep < 11 && currentStep !== 1 && (
                <div className="flex justify-between mt-8 pt-6 border-t border-pearl-300">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-slate-600 hover:text-navy font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                </div>
              )}

              {currentStep === 11 && (
                <div className="flex justify-between mt-8 pt-6 border-t border-pearl-300">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-slate-600 hover:text-navy font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 bg-electric hover:bg-electric-600 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    Review & Submit
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {currentStep === 12 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleBack}
                    className="px-6 py-3 text-slate-600 hover:text-navy font-semibold transition-colors flex items-center gap-2"
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
          <p className="text-sm text-slate-500">
            🔒 Your information is secure and will only be shared with your matched agent
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeadForm;
