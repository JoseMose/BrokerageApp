import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { getCurrentUser } from 'aws-amplify/auth';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Components
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import LeadDetails from './pages/LeadDetails';
import Profile from './pages/Profile';
import PurchaseHistory from './pages/PurchaseHistory';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import RealtorAuth from './pages/RealtorAuth';
import BulkLeads from './pages/BulkLeads';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await getCurrentUser();
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/realtor-login" replace />;
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/realtor-login" element={<RealtorAuth />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <div className="app">
                    <Navigation user={user} signOut={signOut} />
                    <main className="main-content">
                      <Dashboard />
                    </main>
                  </div>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <Elements stripe={stripePromise}>
                    <div className="app">
                      <Navigation user={user} signOut={signOut} />
                      <main className="main-content">
                        <Marketplace />
                      </main>
                    </div>
                  </Elements>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/:leadId"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <div className="app">
                    <Navigation user={user} signOut={signOut} />
                    <main className="main-content">
                      <LeadDetails />
                    </main>
                  </div>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <div className="app">
                    <Navigation user={user} signOut={signOut} />
                    <main className="main-content">
                      <Profile />
                    </main>
                  </div>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <div className="app">
                    <Navigation user={user} signOut={signOut} />
                    <main className="main-content">
                      <PurchaseHistory />
                    </main>
                  </div>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-leads"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <div className="app">
                    <Navigation user={user} signOut={signOut} />
                    <main className="main-content">
                      <BulkLeads />
                    </main>
                  </div>
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Authenticator>
                {({ signOut, user }) => (
                  <AdminDashboard />
                )}
              </Authenticator>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
