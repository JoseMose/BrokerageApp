import React from 'react';
import './RealtorCheckModal.css';

/**
 * Compliance modal shown when user already has a realtor
 * Prevents lead submission and displays clear compliance message
 */
function RealtorCheckModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content realtor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <span className="icon-warning">⚠️</span>
        </div>
        
        <h2 className="modal-title">Already Represented</h2>
        
        <div className="modal-body">
          <p className="modal-message">
            We appreciate your interest, but you must work directly with your current realtor.
          </p>
          
          <p className="modal-message">
            If you no longer wish to work with your current realtor, please terminate your 
            existing agreement before using this service.
          </p>
          
          <div className="modal-notice">
            <p className="notice-title">💼 Professional Ethics</p>
            <p className="notice-text">
              Real estate agents are bound by professional ethics to not interfere with 
              existing client-agent relationships. This protects both you and the agents 
              in our network.
            </p>
          </div>
        </div>
        
        <div className="modal-actions">
          <button 
            className="btn-modal-primary"
            onClick={onClose}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default RealtorCheckModal;
