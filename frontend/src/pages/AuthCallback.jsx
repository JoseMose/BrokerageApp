import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback } from '../utils/ibmAuth';

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const code       = params.get('code');
    const errParam   = params.get('error');
    const errDesc    = params.get('error_description');

    if (errParam) {
      setError(errDesc || errParam);
      return;
    }

    if (!code) {
      navigate('/realtor-login', { replace: true });
      return;
    }

    handleCallback(code)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(err  => setError(err.message));
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: '#e53e3e', textAlign: 'center' }}>Authentication failed: {error}</p>
        <a href="/realtor-login" style={{ color: '#C9A84C' }}>← Back to Sign In</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner"></div>
      <p style={{ color: '#8a99b3' }}>Signing you in…</p>
    </div>
  );
}

export default AuthCallback;
