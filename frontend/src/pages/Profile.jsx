import React, { useState, useEffect, useRef } from 'react';
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
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // basic, preferences, settings
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    licenseId: '',
    licenseState: '',
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
      propertyTypes: ['residential'],
      priceRange: {
        min: 0,
        max: 10000000,
      },
    },
    roundRobin: {
      isOnline: true,
      maxCapacity: 10,
      assignedLeadCount: 0,
    },
    licenseVerified: false,
    profilePhoto: null,
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
        email: profileData.email || '',
        licenseId: profileData.licenseId || '',
        licenseState: profileData.licenseState || '',
        brokerage: profileData.brokerage || '',
        phone: profileData.phone || '',
        location: profileData.location || { address: '', city: '', state: '', zip: '' },
        radius: profileData.radius || 15,
        preferences: profileData.preferences || {
          propertyTypes: ['residential'],
          priceRange: { min: 0, max: 10000000 },
        },
        roundRobin: profileData.roundRobin || {
          isOnline: true,
          maxCapacity: 10,
          assignedLeadCount: 0,
        },
        licenseVerified: profileData.licenseVerified || false,
        profilePhoto: profileData.profilePhoto || null,
      });
      
      if (profileData.profilePhoto) {
        setPhotoPreview(profileData.profilePhoto);
      }
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      
      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    
    try {
      setUploadingPhoto(true);
      setError(null);
      
      // TODO: Implement actual S3 upload
      // For now, we'll store the base64 data URL
      // In production, you'd want to upload to S3 and store the URL
      
      const updatedData = {
        ...formData,
        profilePhoto: photoPreview,
      };
      
      await agentAPI.updateProfile(updatedData);
      setSuccess(true);
      setPhotoFile(null);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      setError(null);
      const newStatus = !formData.roundRobin.isOnline;
      
      await agentAPI.updateProfile({
        ...formData,
        roundRobin: {
          ...formData.roundRobin,
          isOnline: newStatus,
        },
      });
      
      setFormData(prev => ({
        ...prev,
        roundRobin: {
          ...prev.roundRobin,
          isOnline: newStatus,
        },
      }));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError('Failed to update status');
    }
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
      <div className="profile-header">
        <div>
          <h1>{isNewProfile ? 'Create Your Profile' : 'Your Profile'}</h1>
          <p className="subtitle">
            {isNewProfile 
              ? 'Complete your profile to get started' 
              : 'Manage your information, preferences, and settings'}
          </p>
        </div>
        
        {!isNewProfile && (
          <div className="profile-status">
            <button
              onClick={toggleOnlineStatus}
              className={`status-toggle ${formData.roundRobin?.isOnline ? 'online' : 'offline'}`}
            >
              <span className="status-dot"></span>
              {formData.roundRobin?.isOnline ? 'Online' : 'Offline'}
            </button>
          </div>
        )}
      </div>

      {success && (
        <div className="alert alert-success">
          ✓ {isNewProfile ? 'Profile created' : 'Changes saved'} successfully!
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!isNewProfile && (
        <div className="profile-tabs">
          <button
            className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button
            className={`tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
          <button
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {(isNewProfile || activeTab === 'basic') && (
          <>
            <div className="card">
              <h2>Profile Photo</h2>
              <div className="photo-upload-section">
                <div className="photo-preview">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" className="profile-photo" />
                  ) : (
                    <div className="photo-placeholder">
                      <span>📷</span>
                      <p>No photo</p>
                    </div>
                  )}
                </div>
                <div className="photo-upload-controls">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-outline"
                  >
                    Choose Photo
                  </button>
                  {photoFile && (
                    <button
                      type="button"
                      onClick={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="btn btn-primary"
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </button>
                  )}
                  <small className="form-help">JPG, PNG or GIF. Max 5MB.</small>
                </div>
              </div>
            </div>

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

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">
                    License ID *
                  </label>
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
                  <label className="form-label">License State *</label>
                  <select
                    name="licenseState"
                    value={formData.licenseState}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    <option value="">Select State</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">License Number *</label>
                <input
                  type="text"
                  name="brokerage"
                  value={formData.brokerage}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
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
          </>
        )}

        {(isNewProfile || activeTab === 'basic') && (
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
          </div>
        )}

        {(isNewProfile || activeTab === 'preferences') && (
          <>
            <div className="card">
              <h2>Property Preferences</h2>
              
              <div className="form-group">
                <label className="form-label">Property Types</label>
                <div className="checkbox-group">
                  {['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land', 'Commercial'].map(type => (
                    <label key={type} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.preferences.propertyTypes?.includes(type.toLowerCase().replace(' ', '-')) || false}
                        onChange={() => {
                          const typeKey = type.toLowerCase().replace(' ', '-');
                          const current = formData.preferences.propertyTypes || [];
                          const updated = current.includes(typeKey)
                            ? current.filter(t => t !== typeKey)
                            : [...current, typeKey];
                          setFormData(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, propertyTypes: updated }
                          }));
                        }}
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Client Price Range</label>
                <div className="grid grid-2">
                  <div>
                    <input
                      type="number"
                      placeholder="Minimum"
                      value={formData.preferences.priceRange?.min || 0}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          priceRange: {
                            ...prev.preferences.priceRange,
                            min: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Maximum"
                      value={formData.preferences.priceRange?.max || 10000000}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          priceRange: {
                            ...prev.preferences.priceRange,
                            max: parseInt(e.target.value) || 10000000
                          }
                        }
                      }))}
                      className="form-input"
                    />
                  </div>
                </div>
                <small className="form-help">
                  Property price range your clients are typically looking for
                </small>
              </div>
            </div>
          </>
        )}

        {!isNewProfile && activeTab === 'settings' && (
          <>
            <div className="card">
              <h2>Availability Settings</h2>

              <div className="form-group">
                <label className="form-label">Online Status</label>
                <div className="status-control">
                  <button
                    type="button"
                    onClick={toggleOnlineStatus}
                    className={`status-toggle-large ${formData.roundRobin?.isOnline ? 'online' : 'offline'}`}
                  >
                    <span className="status-dot"></span>
                    <div>
                      <div className="status-label">
                        {formData.roundRobin?.isOnline ? 'Online' : 'Offline'}
                      </div>
                      <div className="status-description">
                        {formData.roundRobin?.isOnline
                          ? 'You are visible and available for new leads'
                          : 'You are currently marked as unavailable'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Account Information</h2>
              
              <div className="info-grid">
                <div className="info-item">
                  <label>Account Status</label>
                  <span className="badge badge-success">Active</span>
                </div>
                <div className="info-item">
                  <label>Member Since</label>
                  <span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Total Leads Owned</label>
                  <span>{profile?.performanceMetrics?.leadsOwned || 0}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
            {saving ? 'Saving...' : (isNewProfile ? 'Create Profile' : 'Save Changes')}
          </button>
          {!isNewProfile && activeTab !== 'settings' && (
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
