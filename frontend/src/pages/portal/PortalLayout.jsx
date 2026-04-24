import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { isPortalAuthenticated, clearPortalSession } from '../../utils/portalStorage';

const CREST = (
  <svg viewBox="0 0 120 120" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
    <polygon points="60,5 115,60 60,115 5,60" fill="none" stroke="#C9A84C" strokeWidth="1.4"/>
    <polygon points="60,17 103,60 60,103 17,60" fill="none" stroke="#C9A84C" strokeWidth="0.6" opacity="0.3"/>
    <text x="60" y="66" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="28" fill="#C9A84C" letterSpacing="4">JE</text>
    <text x="60" y="79" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontSize="6" fill="#C9A84C" letterSpacing="2.5" opacity="0.6">ATLANTA · GEORGIA</text>
  </svg>
);

const NAV_ITEMS = [
  {
    path: '/portal',
    label: 'Dashboard',
    exact: true,
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/portal/properties',
    label: 'Properties',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    path: '/portal/cashflow',
    label: 'Cash Flow',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    path: '/portal/ai',
    label: 'Portfolio AI',
    gold: true,
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    path: '/portal/documents',
    label: 'Documents',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    path: '/portal/alerts',
    label: 'Market Alerts',
    icon: (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
];

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isPortalAuthenticated()) {
      navigate('/portal/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearPortalSession();
    navigate('/portal/login', { replace: true });
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {CREST}
          <div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '0.9rem', fontWeight: 700, color: '#E8ECF4', lineHeight: 1.2 }}>
              Joseph Esfandiari RE
            </div>
            <div style={{ fontSize: '0.65rem', color: '#C9A84C', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '0.1rem' }}>
              Investor Portal
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.875rem',
                borderRadius: '10px',
                borderLeft: active ? '2px solid #C9A84C' : '2px solid transparent',
                background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                color: active ? '#C9A84C' : item.gold ? '#C9A84C' : '#6B7280',
                fontSize: '0.845rem',
                fontWeight: active ? 600 : 500,
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; if (!active) e.currentTarget.style.color = '#9CA3AF'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = item.gold ? '#C9A84C' : '#6B7280'; }}
            >
              <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
              {item.gold && !active && (
                <span style={{ marginLeft: 'auto', fontSize: '0.6rem', background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '8px', padding: '0.1rem 0.4rem', fontWeight: 700, letterSpacing: '0.06em' }}>AI</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.6rem 0.875rem', borderRadius: '10px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#4A5568', fontSize: '0.845rem', fontWeight: 500,
            transition: 'all 0.15s', textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#F87171'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4A5568'; }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#07101E', fontFamily: '"Inter", sans-serif' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'rgba(8,12,22,0.85)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        overflowY: 'auto', zIndex: 40,
        display: 'none',
      }}
        className="portal-sidebar-desktop"
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 48 }}
          />
          <aside style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px',
            background: '#0A0F1E', borderRight: '1px solid rgba(255,255,255,0.07)',
            zIndex: 49, overflowY: 'auto',
          }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <div style={{ flex: 1, marginLeft: 0, display: 'flex', flexDirection: 'column' }} className="portal-main">
        {/* Top bar (mobile + breadcrumb) */}
        <header style={{
          height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.5rem',
          background: 'rgba(8,12,22,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)',
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="portal-hamburger"
            style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: 'none', color: '#6B7280', cursor: 'pointer', borderRadius: '8px' }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#4A5568' }}>
            <a href="/" style={{ color: '#4A5568', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#6B7280'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4A5568'; }}
            >jesfandiari.com</a>
            <span>/</span>
            <span style={{ color: '#9CA3AF' }}>
              {NAV_ITEMS.find((i) => isActive(i))?.label || 'Portal'}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#374151', letterSpacing: '0.08em' }}>
            v1 · Private
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      </div>

      {/* Responsive CSS via style tag */}
      <style>{`
        @media (min-width: 768px) {
          .portal-sidebar-desktop { display: block !important; }
          .portal-main { margin-left: 240px !important; }
          .portal-hamburger { display: none !important; }
        }
        @media (max-width: 767px) {
          .portal-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
