import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import './RealtorAuth.css';

function RealtorAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    checkIfAuthenticated();
  }, []);

  const checkIfAuthenticated = async () => {
    try {
      await getCurrentUser();
      navigate('/dashboard');
    } catch (error) {
      // Not authenticated, stay on this page
    }
  };

  return (
    <div className="realtor-auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>🏠 Realtor Lead Platform</h1>
          <p className="auth-subtitle">Sign in to access your dashboard</p>
        </div>

        <Authenticator
          socialProviders={[]}
          variation="default"
          formFields={{
            signUp: {
              email: {
                order: 1,
                isRequired: true,
                label: 'Email',
                placeholder: 'your@email.com'
              },
              password: {
                order: 2,
                isRequired: true,
                label: 'Password',
                placeholder: 'Enter your password'
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
          {({ signOut, user }) => {
            // Once authenticated, redirect to dashboard
            if (user) {
              navigate('/dashboard');
            }
            return null;
          }}
        </Authenticator>

        <div className="auth-footer">
          <p>
            <a href="/">← Back to Home</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RealtorAuth;
