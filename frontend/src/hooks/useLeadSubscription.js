import { useEffect, useCallback, useRef } from 'react';
import { API, graphqlOperation } from 'aws-amplify';

/**
 * AppSync subscription query for lead status changes
 */
const onLeadStatusChanged = /* GraphQL */ `
  subscription OnLeadStatusChanged {
    onLeadStatusChanged {
      leadId
      status
      lockedBy
      lockedAt
      lockExpiresAt
      eventType
    }
  }
`;

/**
 * Custom hook to subscribe to real-time lead updates via AppSync
 * @param {Function} onLeadUpdate - Callback function called when a lead status changes
 * @returns {Object} - { isConnected, error }
 */
export function useLeadSubscription(onLeadUpdate) {
  const subscriptionRef = useRef(null);
  const isConnectedRef = useRef(false);
  
  useEffect(() => {
    console.log('Setting up AppSync lead subscription...');
    
    // Subscribe to lead status changes
    const subscription = API.graphql(
      graphqlOperation(onLeadStatusChanged)
    ).subscribe({
      next: ({ value }) => {
        const event = value.data.onLeadStatusChanged;
        console.log('Lead status changed:', event);
        
        if (onLeadUpdate) {
          onLeadUpdate(event);
        }
      },
      error: (error) => {
        console.error('AppSync subscription error:', error);
        isConnectedRef.current = false;
      }
    });
    
    subscriptionRef.current = subscription;
    isConnectedRef.current = true;
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up AppSync subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      isConnectedRef.current = false;
    };
  }, [onLeadUpdate]);
  
  return {
    isConnected: isConnectedRef.current,
    error: null
  };
}

/**
 * Custom hook to subscribe to a specific lead's status changes
 * @param {string} leadId - The lead ID to watch
 * @param {Function} onLeadUpdate - Callback when this lead changes
 */
export function useLeadLockStatus(leadId, onLeadUpdate) {
  const onLeadLockStatusChanged = /* GraphQL */ `
    subscription OnLeadLockStatusChanged($leadId: ID!) {
      onLeadLockStatusChanged(leadId: $leadId) {
        leadId
        status
        lockedBy
        lockedAt
        lockExpiresAt
        eventType
      }
    }
  `;
  
  useEffect(() => {
    if (!leadId) return;
    
    console.log(`Setting up subscription for lead: ${leadId}`);
    
    const subscription = API.graphql(
      graphqlOperation(onLeadLockStatusChanged, { leadId })
    ).subscribe({
      next: ({ value }) => {
        const event = value.data.onLeadLockStatusChanged;
        console.log(`Lead ${leadId} status changed:`, event);
        
        if (onLeadUpdate) {
          onLeadUpdate(event);
        }
      },
      error: (error) => {
        console.error(`Subscription error for lead ${leadId}:`, error);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [leadId, onLeadUpdate]);
}
