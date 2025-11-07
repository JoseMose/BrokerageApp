import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeadForm from '../components/LeadForm';
import './LandingPage.css';

/**
 * Public-facing landing page for lead generation
 * Users see this BEFORE becoming a lead in the system
 */
function LandingPage() {
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const handleGetStarted = () => {
    setShowForm(true);
    // Smooth scroll to form
    setTimeout(() => {
      document.getElementById('lead-form-section')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const handleRealtorLogin = () => {
    navigate('/realtor-login');
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="container nav-content">
          <div className="nav-logo">
            <h2>🏠 Realtor Lead Platform</h2>
          </div>
          <button 
            className="realtor-login-btn"
            onClick={handleRealtorLogin}
          >
            Realtor Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay">
          <div className="hero-content">
            <h1 className="hero-title">
              Find the Right Realtor for You
            </h1>
            <p className="hero-subtitle">
              Answer a few quick questions and we'll connect you with an agent who genuinely wants to work with you.
            </p>
            <button 
              className="cta-button"
              onClick={handleGetStarted}
            >
              Get Started
              <span className="cta-arrow">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* By Realtors, For Realtors Section */}
      <section className="realtor-commitment-section">
        <div className="container">
          <div className="commitment-badge">
            <span className="badge-icon">⭐</span>
            <h3>Made by Realtors, for Realtors</h3>
          </div>
          <p className="commitment-text">
            We're real estate professionals who understand the challenges of lead generation. 
            That's why we built a platform that connects clients with agents who truly want to work with them—
            no cold calls, no pressure, just genuine connections.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Our Realtors Stand Out</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚖️</div>
              <h3>The Fairest System</h3>
              <p>Our revolutionary fair-access system ensures every realtor gets equal opportunity—no favoritism, no hidden advantages. When you work with our agents, you're working with professionals who earned your lead fairly.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Agents Who Want You</h3>
              <p>Unlike traditional lead generation, agents actively choose to work with you based on your specific needs. This means you get someone genuinely interested in helping you succeed.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast Response Time</h3>
              <p>Because agents opt-in to work with you, they respond within minutes—not days. No more waiting around wondering if someone will call you back.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>100% Free for You</h3>
              <p>Clients never pay anything. Ever. Our realtors invest in quality leads because they know it leads to better partnerships.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Fair System Explainer */}
      <section className="fair-system-section">
        <div className="container">
          <h2 className="section-title">The Fairest Lead System in Real Estate</h2>
          <div className="fair-system-content">
            <div className="fair-system-text">
              <p className="lead-text">
                Traditional lead platforms favor whoever pays the most or has the best connections. 
                We reject that model entirely.
              </p>
              <ul className="fair-system-list">
                <li>
                  <span className="check-icon">✓</span>
                  <strong>Equal Access:</strong> Every realtor sees new leads at exactly the same time
                </li>
                <li>
                  <span className="check-icon">✓</span>
                  <strong>No Favoritism:</strong> No VIP tiers, no paying extra for priority
                </li>
                <li>
                  <span className="check-icon">✓</span>
                  <strong>Transparent Pricing:</strong> All agents pay the same fair price based on lead quality
                </li>
                <li>
                  <span className="check-icon">✓</span>
                  <strong>Quality Matters:</strong> Agents choose leads that fit their expertise
                </li>
              </ul>
              <p className="highlight-text">
                This fairness is exactly why clients prefer working with our realtors—
                they know their agent genuinely wants to help them succeed.
              </p>
            </div>
            <div className="fair-system-visual">
              <div className="fair-icon">⚖️</div>
              <p className="fair-caption">Fair for realtors = Better for clients</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Form Section */}
      {showForm && (
        <section id="lead-form-section" className="form-section">
          <div className="container">
            <LeadForm />
          </div>
        </section>
      )}

      {/* Trust Indicators */}
      <section className="trust-section">
        <div className="container">
          <p className="trust-text">
            🔐 Your information is secure and will only be shared with your matched agent
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <p>© 2025 Realtor Lead Platform. Built by realtors, for realtors.</p>
          <p>
            <a href="/realtor-login">Realtor Login</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
