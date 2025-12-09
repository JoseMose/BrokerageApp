export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getScoreColor = (score) => {
  if (score >= 9) return '#10b981'; // green
  if (score >= 7) return '#3b82f6'; // blue
  if (score >= 5) return '#f59e0b'; // orange
  if (score >= 3) return '#ef4444'; // red
  return '#6b7280'; // gray
};

export const getScoreLabel = (score) => {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Very Good';
  if (score >= 5) return 'Good';
  if (score >= 3) return 'Fair';
  return 'Low';
};

export const getLeadTypeLabel = (type) => {
  return type === 'buyer' ? 'Buyer' : 'Seller';
};

export const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'available':
      return 'badge-success';
    case 'sold':
      return 'badge-primary';
    case 'expired':
      return 'badge-warning';
    default:
      return 'badge-danger';
  }
};

export const isLeadExpired = (expiresAt) => {
  return new Date(expiresAt) < new Date();
};

export const getTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff < 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 1) return `${days} days`;
  if (days === 1) return '1 day';
  if (hours > 1) return `${hours} hours`;
  return 'Less than 1 hour';
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone) => {
  const re = /^\+?1?\d{10,14}$/;
  return re.test(phone.replace(/\D/g, ''));
};

export const validateZipCode = (zip) => {
  const re = /^\d{5}(-\d{4})?$/;
  return re.test(zip);
};

export const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Format field labels for professional display
 */
export const formatFieldLabel = (field) => {
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
    phone: 'Phone',
    // Legacy fields that might appear in old leads
    cashBuyer: 'Cash Buyer',
    budget: 'Budget',
    immediate: 'Timeline',
    propertyValue: 'Property Value'
  };
  
  // If we have a mapped label, use it
  if (labelMap[field]) {
    return labelMap[field];
  }
  
  // Otherwise, convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

/**
 * Format field values for professional display (no quotes)
 */
export const formatFieldValue = (field, value) => {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle objects (should be rare, but just in case)
  if (typeof value === 'object' && !Array.isArray(value)) {
    return 'Multiple values';
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  // Map common values to readable text
  const valueMap = {
    // Lead type
    buyer: 'Buying a home',
    seller: 'Selling a home',
    
    // Motivation
    'first-home': 'Buying my first home',
    relocating: 'Relocating for work/family',
    upgrading: 'Upgrading to a bigger home',
    downsizing: 'Downsizing/Empty nester',
    investment: 'Investment/rental property',
    financial: 'Financial reasons',
    inherited: 'Inherited property',
    'investment-exit': 'Selling investment property',
    divorce: 'Divorce/Life changes',
    other: 'Other reasons',
    
    // Timeline
    asap: 'ASAP (Ready now)',
    immediate: 'ASAP (Ready now)',
    '1-3-months': 'Within 1-3 months',
    '3-6-months': 'Within 3-6 months',
    '6-plus-months': '6+ months',
    
    // Pre-approval
    yes: 'Yes',
    'not-yet': 'Not yet, but working on it',
    no: 'No',
    
    // Price/Value ranges
    '0-200k': 'Under $200k',
    '200k-400k': '$200k - $400k',
    '400k-600k': '$400k - $600k',
    '600k-1m': '$600k - $1M',
    '1m-plus': '$1M+',
    '500000+': '$500k+',
    flexible: 'Flexible',
    'not-sure': 'Not sure',
    
    // Renting/Selling
    renting: 'Currently renting',
    'selling-first': 'Need to sell my home first',
    'first-time': 'First-time buyer',
    
    // Occupancy
    owner: 'Owner-occupied (I live here)',
    tenant: 'Tenant-occupied (rental)',
    vacant: 'Vacant',
    
    // Repairs
    minor: 'Minor cosmetic fixes',
    major: 'Major repairs needed',
    
    // Boolean text values
    true: 'Yes',
    false: 'No'
  };

  // Check if value is in our map (convert to string first for boolean comparison)
  const stringValue = String(value).toLowerCase();
  if (valueMap[stringValue]) {
    return valueMap[stringValue];
  }

  // If it looks like a budget number, format it as currency
  if (field === 'budget' && !isNaN(value)) {
    return formatCurrency(parseFloat(value));
  }

  // Return the value as-is (no quotes!)
  return String(value);
};
