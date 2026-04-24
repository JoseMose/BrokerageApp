import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPortalSession, seedIfEmpty } from '../../utils/portalStorage';

const CREST = (
  <svg viewBox="0 0 120 120" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
    <polygon points="60,5 115,60 60,115 5,60" fill="none" stroke="#C9A84C" strokeWidth="1.2"/>
    <polygon points="60,17 103,60 60,103 17,60" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.3"/>
    <text x="60" y="66" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="28" fill="#C9A84C" letterSpacing="4">JE</text>
    <text x="60" y="79" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="6" fill="#C9A84C" letterSpacing="2.5" opacity="0.6">ATLANTA · GEORGIA</text>
  </svg>
);

export default function PortalLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const correct = import.meta.env.VITE_PORTAL_PASSWORD || 'je2026';
      if (password === correct) {
        setPortalSession();
        seedIfEmpty();
        navigate('/portal');
      } else {
        setError('Incorrect password. Please try again.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#07101E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Inter", sans-serif',
      padding: '2rem',
    }}>
      {/* Grid texture */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Crest */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          {CREST}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', fontWeight: 700, color: '#E8ECF4', letterSpacing: '0.02em' }}>
              Joseph Esfandiari
            </div>
            <div style={{ fontSize: '0.72rem', color: '#C9A84C', letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
              Portfolio Portal
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px',
          padding: '2.25rem',
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{ color: '#E8ECF4', fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>Private Access</h2>
          <p style={{ color: '#4A5568', fontSize: '0.82rem', marginBottom: '1.75rem' }}>
            This portal is restricted to authorized users.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7280', marginBottom: '0.5rem' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter portal password"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  color: '#E8ECF4',
                  fontSize: '0.9rem',
                  outline: 'none',
                  fontFamily: '"Inter", sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'; }}
              />
              {error && (
                <p style={{ color: '#F87171', fontSize: '0.78rem', marginTop: '0.4rem' }}>{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: password && !loading ? 'linear-gradient(135deg, #C9A84C, #D9BD6A)' : 'rgba(255,255,255,0.06)',
                color: password && !loading ? '#0A0F1E' : '#374151',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: password && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              {loading ? 'Verifying...' : 'Enter Portal'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#374151' }}>
          Default password: <span style={{ color: '#4A5568' }}>je2026</span> — set <code style={{ color: '#C9A84C', fontSize: '0.7rem' }}>VITE_PORTAL_PASSWORD</code> to override
        </p>
      </div>
    </div>
  );
}
