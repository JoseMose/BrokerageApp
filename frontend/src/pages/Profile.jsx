import React, { useState, useEffect } from 'react';
import { agentAPI } from '../utils/api';
import { validateEmail, validatePhone, validateZipCode } from '../utils/helpers';
import './Profile.css';

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    licenseId: '',
    brokerage: '',
    phone: '',
    location: {
      address: '',
      city: '',
      state: '',
      zip: '',
    },
    radius: 15,
    preferences: {
      leadTypes: ['buyer', 'seller'],
      minScore: 5,
      maxPrice: 200,
      propertyTypes: ['residential'],
    },
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await agentAPI.getProfile();
      const profileData = response.data.data.profile;
      setProfile(profileData);
      setFormData({
        name: profileData.name || '',
        licenseId: profileData.licenseId || '',
        brokerage: profileData.brokerage || '',
        phone: profileData.phone || '',
        location: profileData.location || { address: '', city: '', state: '', zip: '' },
        radius: profileData.radius || 15,
        preferences: profileData.preferences || {
          leadTypes: ['buyer', 'seller'],
          minScore: 5,
          maxPrice: 200,
          propertyTypes: ['residential'],
        },
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setIsNewProfile(true);
      } else {
        setError(err.response?.data?.error || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('location.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, [field]: value }
      }));
    } else if (name.startsWith('preferences.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        preferences: { ...prev.preferences, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLeadTypeChange = (type) => {
    setFormData(prev => {
      const currentTypes = prev.preferences.leadTypes;
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter(t => t !== type)
        : [...currentTypes, type];
      
      return {
        ...prev,
        preferences: { ...prev.preferences, leadTypes: newTypes }
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!validateEmail(formData.email)) {
      setError('Invalid email format');
      return;
    }

    if (!validatePhone(formData.phone)) {
      setError('Invalid phone number format');
      return;
    }

    if (!validateZipCode(formData.location.zip)) {
      setError('Invalid zip code format');
      return;
    }

    if (formData.radius < 5 || formData.radius > 40) {
      setError('Radius must be between 5 and 40 miles');
      return;
    }

    if (formData.preferences.leadTypes.length === 0) {
      setError('Please select at least one lead type');
      return;
    }

    try {
      setSaving(true);
      
      if (isNewProfile) {
        await agentAPI.createProfile(formData);
      } else {
        await agentAPI.updateProfile(formData);
      }

      setSuccess(true);
      setIsNewProfile(false);
      
      // Refresh profile
      await fetchProfile();
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
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

  return (
    <div className="container profile-page">
      <h1>{isNewProfile ? 'Create Your Profile' : 'Your Profile'}</h1>
      <p className="subtitle">
        {isNewProfile 
          ? 'Complete your profile to start viewing and purchasing leads' 
          : 'Update your information and preferences'}
      </p>

      {success && (
        <div className="alert alert-success">
          Profile {isNewProfile ? 'created' : 'updated'} successfully!
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">License ID *</label>
              <input
                type="text"
                name="licenseId"
                value={formData.licenseId}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brokerage *</label>
              <input
                type="text"
                name="brokerage"
                value={formData.brokerage}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              placeholder="(555) 123-4567"
              required
            />
          </div>
        </div>

        <div className="card">
          <h2>Service Location</h2>
          
          <div className="form-group">
            <label className="form-label">Street Address *</label>
            <input
              type="text"
              name="location.address"
              value={formData.location.address}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">City *</label>
              <input
                type="text"
                name="location.city"
                value={formData.location.city}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">State *</label>
              <input
                type="text"
                name="location.state"
                value={formData.location.state}
                onChange={handleChange}
                className="form-input"
                maxLength="2"
                placeholder="CA"
                required
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">ZIP Code *</label>
              <input
                type="text"
                name="location.zip"
                value={formData.location.zip}
                onChange={handleChange}
                className="form-input"
                placeholder="12345"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Service Radius (miles) *</label>
              <input
                type="number"
                name="radius"
                value={formData.radius}
                onChange={handleChange}
                className="form-input"
                min="5"
                max="40"
                required
              />
              <small className="form-help">Between 5 and 40 miles</small>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Lead Preferences</h2>
          
          <div className="form-group">
            <label className="form-label">Lead Types *</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.preferences.leadTypes.includes('buyer')}
                  onChange={() => handleLeadTypeChange('buyer')}
                />
                <span>Buyer Leads</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.preferences.leadTypes.includes('seller')}
                  onChange={() => handleLeadTypeChange('seller')}
                />
                <span>Seller Leads</span>
              </label>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Minimum Lead Score</label>
              <select
                name="preferences.minScore"
                value={formData.preferences.minScore}
                onChange={handleChange}
                className="form-input"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                  <option key={score} value={score}>{score}+</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Maximum Price per Lead</label>
              <select
                name="preferences.maxPrice"
                value={formData.preferences.maxPrice}
                onChange={handleChange}
                className="form-input"
              >
                <option value="50">$50</option>
                <option value="70">$70</option>
                <option value="100">$100</option>
                <option value="150">$150</option>
                <option value="200">$200</option>
                <option value="500">$500</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
            {saving ? 'Saving...' : (isNewProfile ? 'Create Profile' : 'Update Profile')}
          </button>
          {!isNewProfile && (
            <button type="button" onClick={fetchProfile} className="btn btn-outline">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default Profile;
