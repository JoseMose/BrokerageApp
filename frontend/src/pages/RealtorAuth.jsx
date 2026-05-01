import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, isAuthenticated } from '../utils/ibmAuth';
import './RealtorAuth.css';

function RealtorAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
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

        <button
          onClick={login}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)',
            color: '#0A0F1E',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.03em',
          }}
        >
          Sign In / Create Account
        </button>

        <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
          <p>
            <a href="/">← Back to Home</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RealtorAuth;
