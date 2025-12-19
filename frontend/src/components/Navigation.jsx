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
          <h2>🏠 HomeMatch AI</h2>
        </Link>
        
        <div className="nav-menu">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/marketplace" className="nav-link">Marketplace</Link>
          <Link to="/bulk-leads" className="nav-link">Bulk Leads</Link>
          <Link to="/history" className="nav-link">My Leads</Link>
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
