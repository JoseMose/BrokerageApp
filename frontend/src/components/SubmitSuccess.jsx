import React from 'react';
import './SubmitSuccess.css';

/**
 * Success confirmation screen after lead submission
 */
function SubmitSuccess({ onReset }) {
  return (
    <div className="success-container">
      <div className="success-content">
        <div className="success-icon">
          <span className="checkmark">✓</span>
        </div>
        
        <h2 className="success-title">Thank You!</h2>
        
        <p className="success-message">
          Your information has been submitted successfully. A qualified local realtor 
          will contact you within 24 hours.
        </p>
        
        <div className="success-steps">
          <div className="success-step">
            <span className="step-number">1</span>
            <p className="step-text">We're matching you with the best agents in your area</p>
          </div>
          
          <div className="success-step">
            <span className="step-number">2</span>
            <p className="step-text">A top-rated agent will reach out to you soon</p>
          </div>
          
          <div className="success-step">
            <span className="step-number">3</span>
            <p className="step-text">Start your real estate journey with confidence</p>
          </div>
        </div>
        
        <div className="success-notice">
          <p>
            📧 Check your email for confirmation and next steps
          </p>
        </div>
        
        {onReset && (
          <button 
            className="btn-reset"
            onClick={onReset}
          >
            Submit Another Lead
          </button>
        )}
      </div>
    </div>
  );
}

export default SubmitSuccess;
