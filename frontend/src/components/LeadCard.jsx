import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import './LeadCard.css';

/**
 * LeadCard component with lock status indicators
 * Shows real-time lock status and countdown timer
 */
function LeadCard({ lead, onLock, onUnlock, currentAgentId }) {
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  const isLockedByMe = lead.lockedBy === currentAgentId;
  const isLockedByOther = lead.lockedBy && !isLockedByMe;
  const isAvailable = lead.status === 'available';
  const isClaimed = lead.status === 'claimed';
  
  // Countdown timer for locked leads
  useEffect(() => {
    if (lead.lockExpiresAt && isLockedByMe) {
      const updateTimer = () => {
        const remaining = lead.lockExpiresAt - Math.floor(Date.now() / 1000);
        setTimeRemaining(remaining > 0 ? remaining : 0);
        
        if (remaining <= 0) {
          // Lock expired, refresh lead list
          console.log('Lock expired for lead:', lead.leadId);
        }
      };
      
      updateTimer(); // Initial update
      const interval = setInterval(updateTimer, 100); // Update every 100ms for smooth countdown
      
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [lead.lockExpiresAt, lead.leadId, isLockedByMe]);
  
  const handleLockClick = async () => {
    setIsLocking(true);
    setError(null);
    
    try {
      await onLock(lead.leadId);
    } catch (err) {
      setError(err.message || 'Failed to lock lead');
    } finally {
      setIsLocking(false);
    }
  };
  
  const handleUnlockClick = async () => {
    if (onUnlock) {
      try {
        await onUnlock(lead.leadId);
      } catch (err) {
        setError(err.message || 'Failed to unlock lead');
      }
    }
  };
  
  const getScoreColor = (score) => {
    if (score >= 8) return '#00c853'; // Green
    if (score >= 6) return '#ffc107'; // Yellow
    return '#ff5722'; // Red
  };
  
  return (
    <div className={`lead-card lead-card-${lead.status.toLowerCase()}`}>
      {/* Lock Status Banner */}
      {isLockedByMe && (
        <div className="lock-banner lock-mine">
          <span className="lock-icon">⏰</span>
          <span className="lock-text">
            You have <strong>{timeRemaining}s</strong> to complete payment
          </span>
        </div>
      )}
      
      {isLockedByOther && (
        <div className="lock-banner lock-other">
          <span className="lock-icon">🔒</span>
          <span className="lock-text">Locked by another agent</span>
        </div>
      )}
      
      {isClaimed && (
        <div className="lock-banner claimed">
          <span className="lock-icon">✅</span>
          <span className="lock-text">Claimed</span>
        </div>
      )}
      
      {/* Lead Content */}
      <div className="lead-content">
        <div className="lead-header">
          <div className="lead-type">
            {lead.leadType === 'buyer' ? '🏠 Buyer Lead' : '💰 Seller Lead'}
          </div>
          <div className="lead-score" style={{ color: getScoreColor(lead.score) }}>
            <span className="score-number">{lead.score}</span>
            <span className="score-label">/10</span>
          </div>
        </div>
        
        <div className="lead-price">
          ${lead.price}
        </div>
        
        <div className="lead-reason">
          {lead.aiReason || 'No AI analysis available'}
        </div>
        
        {lead.location && (
          <div className="lead-location">
            📍 {lead.location.city}, {lead.location.state}
          </div>
        )}
        
        {error && (
          <div className="lead-error">
            ⚠️ {error}
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="lead-actions">
        {isAvailable && (
          <button
            className="btn-lock"
            onClick={handleLockClick}
            disabled={isLocking}
          >
            {isLocking ? '⏳ Locking...' : '🎯 Claim This Lead'}
          </button>
        )}
        
        {isLockedByMe && (
          <div className="locked-actions">
            <button className="btn-payment" onClick={() => {/* Open payment modal */}}>
              💳 Complete Payment
            </button>
            <button className="btn-unlock" onClick={handleUnlockClick}>
              ❌ Cancel
            </button>
          </div>
        )}
        
        {isLockedByOther && (
          <button className="btn-locked" disabled>
            🔒 Locked
          </button>
        )}
        
        {isClaimed && (
          <button className="btn-claimed" disabled>
            ✅ Sold
          </button>
        )}
      </div>
    </div>
  );
}

export default LeadCard;
