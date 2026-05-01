import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getCurrentUser, logout } from './utils/ibmAuth';

// Components
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import PurchaseHistory from './pages/PurchaseHistory';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import RealtorAuth from './pages/RealtorAuth';
import AuthCallback from './pages/AuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import HelpCenter from './pages/HelpCenter';
import HowItWorks from './pages/HowItWorks';
import HomeMatchPage from './pages/HomeMatchPage';
import ProspectingHub from './pages/ProspectingHub';
import PortalLogin from './pages/portal/PortalLogin';
import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalProperties from './pages/portal/PortalProperties';
import PortalCashflow from './pages/portal/PortalCashflow';
import PortalAI from './pages/portal/PortalAI';
import PortalDocuments from './pages/portal/PortalDocuments';
import PortalAlerts from './pages/portal/PortalAlerts';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  // isAuthenticated() is a synchronous localStorage check
  if (!isAuthenticated()) {
    return <Navigate to="/realtor-login" replace />;
  }
  return children;
}

// Layout wrapper for authenticated pages
function AuthedLayout({ children }) {
  const user = getCurrentUser();

  return (
    <div className="app">
      <Navigation user={user} signOut={logout} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Routes */}
        <Route path="/"                element={<LandingPage />} />
        <Route path="/realtor-login"   element={<RealtorAuth />} />
        <Route path="/realtor-signup"  element={<RealtorAuth />} />
        <Route path="/auth/callback"   element={<AuthCallback />} />
        <Route path="/privacy-policy"  element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/cookie-policy"   element={<CookiePolicy />} />
        <Route path="/contact"         element={<Contact />} />
        <Route path="/faq"             element={<FAQ />} />
        <Route path="/help"            element={<HelpCenter />} />
        <Route path="/how-it-works"    element={<HowItWorks />} />
        <Route path="/homematch"       element={<HomeMatchPage />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AuthedLayout><Dashboard /></AuthedLayout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <AuthedLayout><Profile /></AuthedLayout>
          </ProtectedRoute>
        } />
        <Route path="/prospecting" element={
          <ProtectedRoute>
            <AuthedLayout><ProspectingHub /></AuthedLayout>
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <AuthedLayout><PurchaseHistory /></AuthedLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Portal Routes */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalLayout />}>
          <Route index                  element={<PortalDashboard />} />
          <Route path="properties"      element={<PortalProperties />} />
          <Route path="cashflow"        element={<PortalCashflow />} />
          <Route path="ai"              element={<PortalAI />} />
          <Route path="documents"       element={<PortalDocuments />} />
          <Route path="alerts"          element={<PortalAlerts />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
