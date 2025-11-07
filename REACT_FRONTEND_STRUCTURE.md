# ⚛️ React Frontend Structure - Complete Component Hierarchy

## Overview

This document details the complete React frontend architecture for the Realtor Lead Platform, including component hierarchy, routing, state management, and data flow.

---

## 📁 Directory Structure

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── index.jsx                    # Entry point
│   ├── App.jsx                      # Main app component with routing
│   ├── index.css                    # Global styles
│   │
│   ├── pages/                       # Page-level components
│   │   ├── LandingPage.jsx         # 🌍 Public hero + lead form
│   │   ├── LandingPage.css
│   │   ├── RealtorAuth.jsx         # 🔐 Agent login/signup
│   │   ├── RealtorAuth.css
│   │   ├── Dashboard.jsx           # 📊 Agent dashboard (protected)
│   │   ├── Dashboard.css
│   │   ├── Marketplace.jsx         # 🛒 Available leads (protected)
│   │   ├── Marketplace.css
│   │   ├── LeadDetails.jsx         # 📄 Individual lead view
│   │   ├── LeadDetails.css
│   │   ├── Profile.jsx             # 👤 Agent profile
│   │   ├── Profile.css
│   │   ├── PurchaseHistory.jsx     # 💳 Transaction history
│   │   ├── PurchaseHistory.css
│   │   ├── AdminDashboard.jsx      # 🔧 Admin analytics
│   │   └── AdminDashboard.css
│   │
│   ├── components/                  # Reusable components
│   │   ├── Navigation.jsx          # Top navbar
│   │   ├── Navigation.css
│   │   ├── LeadForm.jsx            # Multi-step lead capture form
│   │   ├── LeadForm.css
│   │   ├── RealtorCheckModal.jsx   # Compliance modal
│   │   ├── RealtorCheckModal.css
│   │   ├── SubmitSuccess.jsx       # Success confirmation
│   │   ├── SubmitSuccess.css
│   │   ├── LeadCard.jsx            # Marketplace lead card
│   │   ├── LeadCard.css
│   │   ├── ScoreMeter.jsx          # Visual score display (1-10)
│   │   └── ScoreMeter.css
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useLeads.js             # Fetch/manage leads
│   │   ├── useAuth.js              # Auth state management
│   │   └── useRealtime.js          # AppSync subscriptions
│   │
│   ├── utils/                       # Utility functions
│   │   ├── api.js                  # API client (REST + GraphQL)
│   │   ├── validation.js           # Form validation
│   │   ├── formatting.js           # Phone/price formatting
│   │   └── constants.js            # App-wide constants
│   │
│   └── config/
│       └── amplify.js              # AWS Amplify configuration
│
├── package.json
└── vite.config.js                  # Vite bundler config
```

---

## 🗺️ Routing Structure

```jsx
// App.jsx - React Router v6

<Router>
  <Routes>
    {/* PUBLIC ROUTES - No Authentication */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/realtor-login" element={<RealtorAuth />} />

    {/* PROTECTED ROUTES - Requires Cognito Auth */}
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } />
    
    <Route path="/marketplace" element={
      <ProtectedRoute>
        <Marketplace />
      </ProtectedRoute>
    } />
    
    <Route path="/leads/:leadId" element={
      <ProtectedRoute>
        <LeadDetails />
      </ProtectedRoute>
    } />
    
    <Route path="/profile" element={
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    } />
    
    <Route path="/history" element={
      <ProtectedRoute>
        <PurchaseHistory />
      </ProtectedRoute>
    } />

    {/* ADMIN ROUTES - Requires Admin Group */}
    <Route path="/admin" element={
      <ProtectedRoute requiredRole="admin">
        <AdminDashboard />
      </ProtectedRoute>
    } />

    {/* 404 Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</Router>
```

---

## 📄 Page Components (Detailed)

### 1. LandingPage.jsx (Public)

**Purpose**: Client-facing lead generation page

**Sections**:
```jsx
<LandingPage>
  {/* Hero Section */}
  <section className="hero-section">
    <h1>Find a Realtor Who's Ready to Work for You</h1>
    <p>AI-powered matching based on fairness and fit</p>
    <button onClick={scrollToForm}>Get Started</button>
  </section>

  {/* How Our AI Works */}
  <section className="ai-explainer-section">
    <h2>How Our Smart Matching System Works</h2>
    <p>Scores 1-10 based on timeline, budget, readiness...</p>
    <div className="ai-steps-grid">
      <div className="ai-step-card">🔍 Analyze</div>
      <div className="ai-step-card">🎯 Match</div>
      <div className="ai-step-card">⚡ Connect</div>
    </div>
  </section>

  {/* Lead Capture Form */}
  {showForm && (
    <section className="form-section">
      <LeadForm onSuccess={handleFormSuccess} />
    </section>
  )}

  {/* Made by Realtors Section */}
  <section className="made-by-section">
    <h2>Made by Realtors, for Realtors</h2>
    <p>Built by agents who understand the challenges...</p>
  </section>

  {/* Fairest System Section */}
  <section className="fairness-section">
    <h2>The Fairest Lead System</h2>
    <ul>
      <li>✓ No bidding wars</li>
      <li>✓ AI-scored quality</li>
      <li>✓ Round-robin distribution</li>
      <li>✓ Transparent pricing</li>
    </ul>
  </section>

  {/* Compliance Footer */}
  <footer>
    <p>Complies with all real estate fair practice laws</p>
  </footer>
</LandingPage>
```

**State**:
```jsx
const [showForm, setShowForm] = useState(false);
const [successMessage, setSuccessMessage] = useState('');
```

**Key Functions**:
- `scrollToForm()` - Smooth scroll to form section
- `handleFormSuccess()` - Show success screen after submission

---

### 2. LeadForm.jsx (Multi-Step Form)

**Purpose**: 6-step lead capture with validation and compliance check

**Component Structure**:
```jsx
<LeadForm>
  {/* Form Header */}
  <div className="form-header">
    <h2>Get Connected with a Top Agent</h2>
    
    {/* AI Badge */}
    <div className="ai-badge">
      🤖 Our AI will analyze your answers to match you with the best agent
    </div>
    
    {/* Progress Bar */}
    <div className="progress-bar">
      <div style={{ width: `${(currentStep / 6) * 100}%` }} />
    </div>
    
    <p>Step {currentStep} of 6</p>
  </div>

  {/* Step Content */}
  {currentStep === 1 && <StepLeadType />}
  {currentStep === 2 && <StepRealtorCheck />}
  {currentStep === 3 && <StepBasicInfo />}
  {currentStep === 4 && <StepLocation />}
  {currentStep === 5 && <StepDetails />}
  {currentStep === 6 && <StepReview />}

  {/* Navigation Buttons */}
  <div className="form-actions">
    {currentStep > 1 && (
      <button onClick={handleBack}>← Back</button>
    )}
    {currentStep < 6 && (
      <button onClick={handleNext}>Next →</button>
    )}
    {currentStep === 6 && (
      <button onClick={handleSubmit}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    )}
  </div>

  {/* Compliance Modal (shown if hasRealtor === true) */}
  {showComplianceModal && (
    <RealtorCheckModal onClose={handleModalClose} />
  )}

  {/* Success Screen */}
  {isSuccess && <SubmitSuccess />}
</LeadForm>
```

**Steps Breakdown**:

```jsx
// STEP 1: Lead Type
<StepLeadType>
  <div className="radio-group">
    <label>
      <input type="radio" value="buyer" checked={formData.leadType === 'buyer'} />
      🏠 I'm Buying
    </label>
    <label>
      <input type="radio" value="seller" checked={formData.leadType === 'seller'} />
      💰 I'm Selling
    </label>
  </div>
</StepLeadType>

// STEP 2: Realtor Check (COMPLIANCE GATE)
<StepRealtorCheck>
  <p>Do you currently have a realtor representing you?</p>
  <div className="radio-group">
    <label>
      <input type="radio" value="no" />
      ✅ No, I don't have a realtor
    </label>
    <label>
      <input type="radio" value="yes" />
      ⚠️ Yes, I have a realtor
    </label>
  </div>
  
  {/* If "Yes" selected → Show modal and STOP */}
  {hasRealtor && <RealtorCheckModal />}
</StepRealtorCheck>

// STEP 3: Basic Info
<StepBasicInfo>
  <input name="name" placeholder="Full Name" />
  <input name="email" type="email" placeholder="Email" />
  <input 
    name="phone" 
    type="tel" 
    placeholder="(555) 123-4567"
    onChange={formatPhoneNumber} // Auto-format as user types
  />
</StepBasicInfo>

// STEP 4: Location
<StepLocation>
  <input name="address" placeholder="Street Address" />
  <input name="city" placeholder="City" />
  <select name="state">
    <option value="">Select State</option>
    <option value="AL">Alabama</option>
    {/* ... all 50 states */}
  </select>
  <input name="zipCode" placeholder="ZIP Code" maxLength="5" />
</StepLocation>

// STEP 5: Details (conditional based on leadType)
<StepDetails>
  {formData.leadType === 'buyer' ? (
    <>
      <select name="buyingTimeline">
        <option>Immediately</option>
        <option>1-3 months</option>
        <option>3-6 months</option>
        <option>6+ months</option>
      </select>
      <div className="radio-group">
        <label>Have you been pre-approved?</label>
        <input type="radio" value="yes" /> Yes
        <input type="radio" value="no" /> No
      </div>
      <select name="priceRange">
        <option>Under $200k</option>
        <option>$200k - $400k</option>
        <option>$400k - $600k</option>
        <option>$600k+</option>
      </select>
    </>
  ) : (
    <>
      <select name="sellingTimeline">
        <option>Immediately</option>
        <option>1-3 months</option>
        <option>3-6 months</option>
        <option>6+ months</option>
      </select>
      <div className="radio-group">
        <label>Listed before?</label>
        <input type="radio" value="yes" /> Yes
        <input type="radio" value="no" /> No
      </div>
      <select name="estimatedValue">
        <option>Under $200k</option>
        <option>$200k - $400k</option>
        <option>$400k - $600k</option>
        <option>$600k+</option>
      </select>
      <select name="propertyType">
        <option>Single Family</option>
        <option>Condo/Townhouse</option>
        <option>Multi-Family</option>
        <option>Land</option>
      </select>
    </>
  )}
</StepDetails>

// STEP 6: Review
<StepReview>
  <h3>Review Your Information</h3>
  <div className="review-section">
    <p><strong>Type:</strong> {formData.leadType}</p>
    <p><strong>Name:</strong> {formData.name}</p>
    <p><strong>Email:</strong> {formData.email}</p>
    <p><strong>Location:</strong> {formData.city}, {formData.state}</p>
    <p><strong>Timeline:</strong> {formData.timeline}</p>
  </div>
  <button onClick={editStep}>Edit</button>
</StepReview>
```

**State Management**:
```jsx
const [currentStep, setCurrentStep] = useState(1);
const [formData, setFormData] = useState({
  leadType: '',
  hasRealtor: false,
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  // ... buyer/seller specific fields
});
const [errors, setErrors] = useState({});
const [isSubmitting, setIsSubmitting] = useState(false);
const [showComplianceModal, setShowComplianceModal] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
```

**Key Functions**:
```jsx
const handleNext = () => {
  // Validate current step
  const stepErrors = validateStep(currentStep, formData);
  if (Object.keys(stepErrors).length > 0) {
    setErrors(stepErrors);
    return;
  }
  
  // Check compliance at step 2
  if (currentStep === 2 && formData.hasRealtor) {
    setShowComplianceModal(true);
    return; // STOP - don't proceed
  }
  
  setCurrentStep(currentStep + 1);
  setErrors({});
};

const handleSubmit = async () => {
  setIsSubmitting(true);
  
  try {
    // Call API
    const response = await submitLead(formData);
    
    if (response.success) {
      setIsSuccess(true);
      // Show SubmitSuccess component
    }
  } catch (error) {
    setErrors({ submit: error.message });
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### 3. Dashboard.jsx (Agent Dashboard)

**Purpose**: Personalized agent dashboard with stats and quick actions

**Component Structure**:
```jsx
<Dashboard>
  {/* Welcome Section */}
  <div className="welcome-section">
    <h1>Welcome back, {agentName}!</h1>
    <p>Here's your performance overview</p>
  </div>

  {/* Stats Cards */}
  <div className="stats-grid">
    <StatCard
      title="Available Leads"
      value={stats.availableLeads}
      icon="🎯"
      color="blue"
    />
    <StatCard
      title="My Leads"
      value={stats.myLeads}
      icon="📋"
      color="green"
    />
    <StatCard
      title="Total Spent"
      value={`$${stats.totalSpent}`}
      icon="💵"
      color="purple"
    />
    <StatCard
      title="Avg Lead Score"
      value={`${stats.avgScore}/10`}
      icon="⭐"
      color="orange"
    />
  </div>

  {/* Quick Actions */}
  <div className="quick-actions">
    <Link to="/marketplace">
      <button>Browse Marketplace</button>
    </Link>
    <Link to="/profile">
      <button>Update Preferences</button>
    </Link>
  </div>

  {/* Recent Leads */}
  <div className="recent-leads">
    <h2>Recently Assigned Leads</h2>
    {recentLeads.map(lead => (
      <LeadCard key={lead.leadId} lead={lead} compact />
    ))}
  </div>

  {/* Activity Chart */}
  <div className="activity-chart">
    <h2>Monthly Activity</h2>
    {/* Chart showing leads purchased per month */}
  </div>
</Dashboard>
```

**State & Data Fetching**:
```jsx
const [stats, setStats] = useState(null);
const [recentLeads, setRecentLeads] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchDashboardData();
  
  // Subscribe to real-time updates
  const subscription = subscribeToNewLeads((newLead) => {
    // Update stats when new lead arrives
    setStats(prev => ({
      ...prev,
      availableLeads: prev.availableLeads + 1
    }));
  });
  
  return () => subscription.unsubscribe();
}, []);

const fetchDashboardData = async () => {
  try {
    const [statsData, leadsData] = await Promise.all([
      api.get('/agents/stats'),
      api.get('/leads/recent?limit=5')
    ]);
    
    setStats(statsData);
    setRecentLeads(leadsData);
  } finally {
    setLoading(false);
  }
};
```

---

### 4. Marketplace.jsx (Lead Marketplace)

**Purpose**: Browse and purchase available leads

**Component Structure**:
```jsx
<Marketplace>
  {/* Filters */}
  <div className="filters">
    <select value={filters.leadType} onChange={handleFilterChange}>
      <option value="">All Types</option>
      <option value="buyer">Buyers Only</option>
      <option value="seller">Sellers Only</option>
    </select>
    
    <select value={filters.minScore}>
      <option value="0">All Scores</option>
      <option value="8">Premium (8-10)</option>
      <option value="5">Standard (5-7)</option>
      <option value="1">Bulk (1-4)</option>
    </select>
    
    <input 
      type="text" 
      placeholder="City or ZIP"
      value={filters.location}
      onChange={handleFilterChange}
    />
    
    <button onClick={applyFilters}>Apply Filters</button>
  </div>

  {/* Sort Options */}
  <div className="sort-options">
    <button onClick={() => setSortBy('score')}>Sort by Score</button>
    <button onClick={() => setSortBy('price')}>Sort by Price</button>
    <button onClick={() => setSortBy('date')}>Sort by Date</button>
  </div>

  {/* Lead Grid */}
  <div className="leads-grid">
    {leads.length === 0 ? (
      <div className="empty-state">
        <p>No leads match your filters</p>
      </div>
    ) : (
      leads.map(lead => (
        <LeadCard
          key={lead.leadId}
          lead={lead}
          onLock={handleLockLead}
          onPurchase={handlePurchaseLead}
        />
      ))
    )}
  </div>

  {/* Pagination */}
  <div className="pagination">
    <button disabled={page === 1} onClick={() => setPage(page - 1)}>
      Previous
    </button>
    <span>Page {page}</span>
    <button disabled={!hasMore} onClick={() => setPage(page + 1)}>
      Next
    </button>
  </div>
</Marketplace>
```

**Real-Time Updates**:
```jsx
useEffect(() => {
  // Fetch initial leads
  fetchLeads();
  
  // Subscribe to AppSync for real-time updates
  const subscription = API.graphql(
    graphqlOperation(subscriptions.onNewLeadCreated)
  ).subscribe({
    next: ({ value }) => {
      const newLead = value.data.onNewLeadCreated;
      
      // Add to leads array if matches filters
      if (matchesFilters(newLead, filters)) {
        setLeads(prev => [newLead, ...prev]);
        
        // Show toast notification
        toast.success('New lead available!');
      }
    }
  });
  
  return () => subscription.unsubscribe();
}, [filters]);
```

**Purchase Flow**:
```jsx
const handleLockLead = async (leadId) => {
  try {
    // Step 1: Lock lead (15 seconds)
    const lockResponse = await api.post('/leads/lock', {
      leadId,
      agentId: currentUser.id
    });
    
    if (lockResponse.success) {
      // Step 2: Open payment modal
      setSelectedLead(leadId);
      setShowPaymentModal(true);
      
      // Start 15-second countdown timer
      startLockTimer(lockResponse.lockExpiresAt);
    }
  } catch (error) {
    if (error.statusCode === 409) {
      toast.error('Lead already locked by another agent');
    }
  }
};

const handlePurchaseLead = async (paymentMethod) => {
  try {
    // Process payment via Stripe
    const paymentResult = await stripe.confirmPayment({
      paymentMethod,
      // ... Stripe config
    });
    
    if (paymentResult.success) {
      // Claim lead
      const claimResponse = await api.post('/leads/claim', {
        leadId: selectedLead,
        agentId: currentUser.id,
        paymentIntentId: paymentResult.paymentIntentId
      });
      
      // Show lead contact info
      setShowLeadDetails(claimResponse.lead);
      toast.success('Lead purchased successfully!');
    }
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

## 🧩 Reusable Components

### LeadCard.jsx

**Purpose**: Display lead preview with key info

```jsx
<LeadCard lead={lead} onLock={handleLock} compact={false}>
  <div className="lead-card">
    {/* Header */}
    <div className="lead-header">
      <span className="lead-type">{lead.leadType === 'buyer' ? '🏠 Buyer' : '💰 Seller'}</span>
      <span className="lead-tier">{getTierBadge(lead.tier)}</span>
    </div>

    {/* Score Meter */}
    <ScoreMeter score={lead.score} maxScore={10} />

    {/* Details */}
    <div className="lead-details">
      <p><strong>Location:</strong> {lead.location.city}, {lead.location.state}</p>
      <p><strong>Timeline:</strong> {lead.responses.timeline}</p>
      <p><strong>Budget:</strong> {lead.responses.priceRange || lead.responses.estimatedValue}</p>
    </div>

    {/* AI Reason */}
    {!compact && (
      <div className="ai-reason">
        <p>🤖 {lead.aiReason}</p>
      </div>
    )}

    {/* Price & Action */}
    <div className="lead-footer">
      <span className="price">${lead.price}</span>
      
      {lead.status === 'available' && (
        <button onClick={() => onLock(lead.leadId)}>
          Buy Lead
        </button>
      )}
      
      {lead.status === 'locked' && lead.lockedBy !== currentUser.id && (
        <button disabled>
          Locked by {lead.lockedByName}
        </button>
      )}
      
      {lead.status === 'locked' && lead.lockedBy === currentUser.id && (
        <button onClick={() => onPurchase(lead.leadId)}>
          Complete Purchase
        </button>
      )}
    </div>
  </div>
</LeadCard>
```

### ScoreMeter.jsx

**Purpose**: Visual representation of 1-10 score

```jsx
<ScoreMeter score={7} maxScore={10}>
  <div className="score-meter">
    <div className="score-bar">
      <div 
        className="score-fill"
        style={{ 
          width: `${(score / maxScore) * 100}%`,
          backgroundColor: getScoreColor(score) 
        }}
      />
    </div>
    <span className="score-text">{score}/10</span>
  </div>
</ScoreMeter>

// Helper function
const getScoreColor = (score) => {
  if (score >= 8) return '#10b981'; // Green (premium)
  if (score >= 5) return '#f59e0b'; // Orange (standard)
  return '#6b7280'; // Gray (bulk)
};
```

---

## 🪝 Custom Hooks

### useLeads.js

**Purpose**: Centralized lead data fetching and management

```jsx
// hooks/useLeads.js
import { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

export const useLeads = (filters = {}) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await API.get('RealtorAPI', `/marketplace?${queryParams}`);
      setLeads(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const lockLead = async (leadId) => {
    const response = await API.post('RealtorAPI', '/leads/lock', {
      body: { leadId }
    });
    return response;
  };

  const purchaseLead = async (leadId, paymentData) => {
    const response = await API.post('RealtorAPI', '/payments/purchase', {
      body: { leadId, ...paymentData }
    });
    
    // Update local state
    setLeads(prev => prev.filter(l => l.leadId !== leadId));
    
    return response;
  };

  return {
    leads,
    loading,
    error,
    lockLead,
    purchaseLead,
    refetch: fetchLeads
  };
};
```

### useRealtime.js

**Purpose**: AppSync WebSocket subscriptions

```jsx
// hooks/useRealtime.js
import { useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';

export const useRealtime = (subscriptionQuery, callback) => {
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(subscriptionQuery)
    ).subscribe({
      next: ({ value }) => {
        callback(value.data);
      },
      error: (err) => {
        console.error('Subscription error:', err);
      }
    });

    return () => subscription.unsubscribe();
  }, [subscriptionQuery, callback]);
};

// Usage in component:
// useRealtime(subscriptions.onNewLeadCreated, (data) => {
//   console.log('New lead:', data.onNewLeadCreated);
// });
```

---

## 🔐 Authentication Flow

```jsx
// App.jsx - Protected Route wrapper
function ProtectedRoute({ children, requiredRole }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(true);
      
      // Get user attributes from Cognito
      const attributes = await fetchUserAttributes();
      setUserRole(attributes['custom:role']);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/realtor-login" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
```

---

## 🌊 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT SUBMISSION FLOW                   │
└─────────────────────────────────────────────────────────────┘

LandingPage
     │
     ├─ User clicks "Get Started"
     │
     ▼
LeadForm (6 steps)
     │
     ├─ Step 1: Select lead type
     ├─ Step 2: Realtor check (compliance gate)
     ├─ Step 3: Basic info
     ├─ Step 4: Location
     ├─ Step 5: Details
     ├─ Step 6: Review & submit
     │
     ▼
api.submitLead(formData)
     │
     ├─ POST /create-lead (public endpoint)
     │
     ▼
Backend creates & scores lead
     │
     ▼
SubmitSuccess component shows
     │
     └─ "Agent will contact within 24 hours"


┌─────────────────────────────────────────────────────────────┐
│                   AGENT MARKETPLACE FLOW                    │
└─────────────────────────────────────────────────────────────┘

Dashboard
     │
     ├─ Agent logs in (Cognito auth)
     │
     ▼
Navigation → Marketplace
     │
     ▼
Marketplace.jsx
     │
     ├─ useLeads() hook fetches available leads
     ├─ useRealtime() subscribes to new leads
     │
     ▼
LeadCard component shows leads
     │
     ├─ Agent clicks "Buy Lead"
     │
     ▼
handleLockLead(leadId)
     │
     ├─ POST /leads/lock
     ├─ Start 15-second timer
     │
     ▼
Payment Modal (Stripe)
     │
     ├─ Agent enters card
     │
     ▼
handlePurchaseLead(paymentMethod)
     │
     ├─ POST /payments/purchase
     │
     ▼
Lead claimed → Contact info revealed
     │
     └─ Agent can now call client
```

---

## 🎨 Styling Approach

**Global Styles** (`index.css`):
```css
:root {
  --primary: #667eea;
  --primary-dark: #5568d3;
  --secondary: #764ba2;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --gray-50: #f9fafb;
  --gray-900: #111827;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--gray-900);
  background: var(--gray-50);
}
```

**Component-Level Styles**:
- Each component has its own `.css` file
- BEM naming convention for classes
- Responsive design with media queries
- CSS Grid and Flexbox for layouts

---

## 📦 State Management

**Current**: Local component state + React hooks

**Future Considerations** (if app grows):
- Zustand for global state
- React Query for server state caching
- Context API for theme/auth

---

## 🚀 Performance Optimizations

1. **Code Splitting**: Lazy load pages
   ```jsx
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

2. **Memoization**: Prevent unnecessary re-renders
   ```jsx
   const LeadCard = memo(({ lead }) => {
     // component logic
   });
   ```

3. **Virtual Scrolling**: For large lead lists
   ```jsx
   import { FixedSizeList } from 'react-window';
   ```

4. **Image Optimization**: Use WebP format, lazy loading

5. **Bundle Size**: Tree-shaking, code minification via Vite

---

This completes the React frontend structure documentation!
