import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import './Dashboard.css';

function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getProfile();
      setProfile(response.data.data.profile);
      setStats(response.data.data.stats);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">{error}</div>
        {error.includes('not found') && (
          <div className="card">
            <h3>Welcome! Complete Your Profile</h3>
            <p>To start viewing and purchasing leads, please complete your agent profile.</p>
            <a href="/profile" className="btn btn-primary">
              Set Up Profile
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container dashboard">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats?.totalPurchased || 0}</div>
            <div className="stat-label">Leads Purchased</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats?.totalSpent || 0)}</div>
            <div className="stat-label">Total Spent</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-value">
              {((stats?.conversionRate || 0) * 100).toFixed(1)}%
            </div>
            <div className="stat-label">Conversion Rate</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">{profile?.radius || 15} mi</div>
            <div className="stat-label">Service Radius</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Your Profile</h3>
          <div className="profile-info">
            <div className="profile-item">
              <span className="profile-label">Name:</span>
              <span className="profile-value">{profile?.name}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Email:</span>
              <span className="profile-value">{profile?.email}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">License ID:</span>
              <span className="profile-value">{profile?.licenseId}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Brokerage:</span>
              <span className="profile-value">{profile?.brokerage}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Location:</span>
              <span className="profile-value">
                {profile?.location.city}, {profile?.location.state}
              </span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Status:</span>
              <span className={`badge ${profile?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {profile?.status}
              </span>
            </div>
          </div>
          <a href="/profile" className="btn btn-outline" style={{ marginTop: '1rem' }}>
            Edit Profile
          </a>
        </div>

        <div className="card">
          <h3>Preferences</h3>
          <div className="profile-info">
            <div className="profile-item">
              <span className="profile-label">Lead Types:</span>
              <span className="profile-value">
                {profile?.preferences.leadTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
              </span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Min Score:</span>
              <span className="profile-value">{profile?.preferences.minScore}/10</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Max Price:</span>
              <span className="profile-value">{formatCurrency(profile?.preferences.maxPrice)}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Property Types:</span>
              <span className="profile-value">
                {profile?.preferences.propertyTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <a href="/marketplace" className="btn btn-primary">
            Browse Available Leads
          </a>
          <a href="/history" className="btn btn-outline">
            View Purchase History
          </a>
          <a href="/profile" className="btn btn-outline">
            Update Preferences
          </a>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
