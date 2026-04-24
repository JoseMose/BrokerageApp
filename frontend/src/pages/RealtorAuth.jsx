import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import './RealtorAuth.css';

function RealtorAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already authenticated and redirect
    const checkAuth = async () => {
      try {
        await getCurrentUser();
        navigate('/dashboard');
      } catch (error) {
        // Not authenticated, stay on this page
      }
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="realtor-auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Joseph Esfandiari Real Estate</h1>
          <p className="auth-subtitle">Agent portal — sign in to access your dashboard</p>
        </div>

        <div style={{
          marginBottom: '1.5rem', padding: '0.875rem 1rem',
          background: 'rgba(201,168,76,0.07)', borderRadius: '12px',
          border: '1px solid rgba(201,168,76,0.18)',
        }}>
          <p style={{ margin: 0, color: '#C9A84C', fontSize: '0.82rem', lineHeight: 1.6 }}>
            Applications are reviewed by an administrator before access is granted.
          </p>
        </div>

        <Authenticator
          socialProviders={[]}
          variation="default"
          signUpAttributes={[
            'name',
            'email',
            'phone_number',
            'custom:licenseId',
            'custom:licenseState',
            'custom:brokerage'
          ]}
          formFields={{
            signUp: {
              name: {
                order: 1,
                isRequired: true,
                label: 'Full Name',
                placeholder: 'John Doe'
              },
              email: {
                order: 2,
                isRequired: true,
                label: 'Email',
                placeholder: 'your@email.com'
              },
              'custom:licenseId': {
                order: 3,
                isRequired: true,
                label: 'Real Estate License Number',
                placeholder: 'e.g., CA-DRE-12345678'
              },
              'custom:licenseState': {
                order: 4,
                isRequired: true,
                label: 'License State',
                placeholder: 'e.g., CA'
              },
              'custom:brokerage': {
                order: 5,
                isRequired: true,
                label: 'Brokerage Name',
                placeholder: 'e.g., Keller Williams, RE/MAX, etc.'
              },
              phone_number: {
                order: 6,
                isRequired: true,
                label: 'Phone Number',
                placeholder: '+1234567890'
              },
              password: {
                order: 7,
                isRequired: true,
                label: 'Password',
                placeholder: 'Enter your password'
              },
            },
          }}
        >
          {({ user }) => {
            // Redirect authenticated users
            if (user) {
              navigate('/dashboard', { replace: true });
              return (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Redirecting to dashboard...</p>
                </div>
              );
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
