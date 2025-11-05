import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { getCurrentUser } from 'aws-amplify/auth';

// Components
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import LeadDetails from './pages/LeadDetails';
import Profile from './pages/Profile';
import PurchaseHistory from './pages/PurchaseHistory';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
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

  return (
    <Authenticator
      socialProviders={[]}
      variation="default"
      formFields={{
        signUp: {
          email: {
            order: 1,
            isRequired: true,
          },
          password: {
            order: 2,
            isRequired: true,
          },
          'custom:role': {
            order: 3,
            label: 'Role',
            placeholder: 'agent',
            isRequired: true,
          },
        },
      }}
    >
      {({ signOut, user }) => (
        <Router>
          <div className="app">
            <Navigation user={user} signOut={signOut} />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/leads/:leadId" element={<LeadDetails />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/history" element={<PurchaseHistory />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      )}
    </Authenticator>
  );
}

export default App;
