import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navigation.css';

function Navigation({ user, signOut }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="navigation">
      <div className="container nav-container">
        <Link to="/dashboard" className="nav-brand">
          <div
            style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #C9A84C, #D9BD6A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Playfair Display", serif', fontWeight: 700,
              fontSize: '12px', color: '#0A0F1E', flexShrink: 0,
            }}
          >
            JE
          </div>
          <h2>Joseph Esfandiari RE</h2>
        </Link>
        
        <div className="nav-menu">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/prospecting" className="nav-link">Prospecting</Link>
          <Link to="/history" className="nav-link">My Lead Funnel</Link>
          <Link to="/profile" className="nav-link">Profile</Link>
          
          <div className="nav-user">
            <span className="user-email">{user?.signInDetails?.loginId || user?.username}</span>
            <button onClick={handleSignOut} className="btn btn-outline btn-sm">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
