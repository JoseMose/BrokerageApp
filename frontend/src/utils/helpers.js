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
