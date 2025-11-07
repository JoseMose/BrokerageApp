/**
 * Form validation utilities
 */

// Validate email format
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (US format)
export function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
}

// Validate ZIP code (US format)
export function validateZipCode(zip) {
  return /^\d{5}$/.test(zip);
}

// Format phone number: (555) 123-4567
export function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
}

// Sanitize string input
export function sanitizeString(str) {
  return str.trim().replace(/[<>]/g, '');
}

// Validate complete lead form
export function validateLeadForm(formData) {
  const errors = {};
  
  // Lead Type
  if (!formData.leadType) {
    errors.leadType = 'Lead type is required';
  }
  
  // Realtor Check
  if (formData.hasRealtor === null) {
    errors.hasRealtor = 'Please indicate if you have a realtor';
  }
  
  // Basic Info
  if (!formData.name || !sanitizeString(formData.name)) {
    errors.name = 'Name is required';
  }
  
  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Invalid email format';
  }
  
  if (!formData.phone) {
    errors.phone = 'Phone number is required';
  } else if (!validatePhone(formData.phone)) {
    errors.phone = 'Phone must be 10 digits';
  }
  
  // Location
  if (!formData.address || !sanitizeString(formData.address)) {
    errors.address = 'Address is required';
  }
  
  if (!formData.city || !sanitizeString(formData.city)) {
    errors.city = 'City is required';
  }
  
  if (!formData.state) {
    errors.state = 'State is required';
  }
  
  if (!formData.zipCode) {
    errors.zipCode = 'ZIP code is required';
  } else if (!validateZipCode(formData.zipCode)) {
    errors.zipCode = 'ZIP must be 5 digits';
  }
  
  // Lead-specific details
  if (formData.leadType === 'buyer') {
    if (!formData.buyingTimeline) {
      errors.buyingTimeline = 'Buying timeline is required';
    }
    if (formData.preApproved === null) {
      errors.preApproved = 'Pre-approval status is required';
    }
  }
  
  if (formData.leadType === 'seller') {
    if (!formData.sellingTimeline) {
      errors.sellingTimeline = 'Selling timeline is required';
    }
    if (formData.hasListedBefore === null) {
      errors.hasListedBefore = 'Previous listing status is required';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// US States list
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];
