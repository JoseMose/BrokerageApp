# Agent Verification System Documentation

## Overview
Implemented a comprehensive verification system to approve realtors before they can access the platform. This ensures only legitimate, licensed real estate agents can view and purchase leads.

## How It Works

### 1. Agent Signup Flow
When a new realtor signs up:
1. They complete their profile with:
   - Name
   - Email
   - License ID
   - License State (dropdown of all 50 states)
   - Brokerage name
   - Phone number
   - Location (address, city, state, zip)
   - Service radius
   - Lead preferences

2. Upon profile creation:
   - `verificationStatus` is automatically set to `'pending'`
   - `verificationRequestedAt` timestamp is recorded
   - Agent receives a message: "Profile submitted successfully. Your account is pending verification and will be reviewed by an administrator."
   - **No welcome email/SMS is sent yet** - these are held until approval

3. Agent cannot access any platform features until approved:
   - Dashboard shows: "⏳ Account Pending Verification" message
   - Marketplace returns 403 error
   - Payment endpoints blocked
   - All other agent endpoints blocked

### 2. Admin Verification Dashboard
Admins have a new "Verification" tab in the admin dashboard:

**Features:**
- Shows all pending verification requests with a badge count
- Displays full agent details:
  - Name, email, phone
  - License ID and State
  - Brokerage name
  - Location (city, state)
  - Request timestamp

**Actions:**
- **Approve:** Sets `verificationStatus` to `'approved'`, sends welcome email/SMS, agent can now access platform
- **Deny:** Sets `verificationStatus` to `'denied'`, requires a denial reason, sends notification email

### 3. Verification States
- **pending:** Agent just signed up, waiting for admin review
- **approved:** Admin verified the agent, full platform access granted
- **denied:** Admin rejected the verification, agent cannot access platform

### 4. Backend Protection
All agent-facing endpoints check verification status:
- `agent-management.ts` - Profile operations
- `marketplace.ts` - Lead browsing
- `payment.ts` - Lead purchases
- Returns 403 error if not approved

## Database Schema Updates

### Agent Model (`RealtorAgents` table)
Added fields:
```typescript
{
  licenseState?: string;                    // State where license is issued (e.g., "CA", "TX")
  verificationStatus: 'pending' | 'approved' | 'denied';
  verificationRequestedAt: string;          // ISO timestamp
  verificationReviewedAt?: string;          // ISO timestamp when reviewed
  verificationReviewedBy?: string;          // Admin user ID who reviewed
  verificationDenialReason?: string;        // Reason if denied
}
```

## API Endpoints

### Admin Endpoints
```
GET /admin?action=verification-requests
- Returns: { requests: Agent[], count: number }
- Lists all agents with verificationStatus='pending'
- Sorted by verificationRequestedAt (oldest first)

POST /admin
Body: { action: 'approve_agent', agentId: string }
- Sets verificationStatus='approved'
- Records reviewer and timestamp
- Sends welcome email/SMS to agent

POST /admin
Body: { action: 'deny_agent', agentId: string, reason: string }
- Sets verificationStatus='denied'
- Records denial reason, reviewer, and timestamp
- Sends notification email to agent
```

## Frontend Components

### Profile.jsx
- Added `licenseState` field with dropdown of all 50 US states
- Required field during profile creation

### Dashboard.jsx
Shows verification status:
- **Pending:** ⏳ icon with message explaining review process
- **Denied:** ❌ icon with contact support message
- **Approved:** Normal dashboard access

### AdminDashboard.jsx
New "Verification" tab:
- Badge count showing pending requests
- Card-based layout for each pending agent
- Approve (green) and Deny (red) buttons
- Modal for denial reason input

## Migration
Run this ONCE after deployment to update existing agents:
```bash
cd backend
node migrate-existing-agents.js
```

This script:
- Scans all existing agents
- Sets `verificationStatus='approved'` (assumes existing agents are already verified)
- Sets `verificationRequestedAt` to their `createdAt` date
- Records migration timestamp and reviewer as 'MIGRATION_SCRIPT'

## Testing the Flow

### Test New Agent Signup
1. Go to CloudFront URL: https://d2jm01qx6zm242.cloudfront.net
2. Click "Sign Up" and create new account
3. Complete profile with license info and state
4. Verify you see "Account Pending Verification" message
5. Try to access Marketplace → Should get 403 error

### Test Admin Approval
1. Log in as admin (admin@realtorleads.com)
2. Go to Admin Dashboard → Verification tab
3. You should see the new agent in the pending list
4. Click "Approve"
5. Verify agent receives welcome email/SMS

### Test Approved Agent Access
1. Log in as the newly approved agent
2. Should see normal dashboard
3. Can access Marketplace
4. Can purchase leads

### Test Admin Denial
1. Create another test agent
2. As admin, click "Deny" instead of approve
3. Enter a denial reason (e.g., "License could not be verified")
4. Agent should see denial message when logging in

## Security Benefits
1. **Prevents fake accounts** - Only verified realtors can access leads
2. **Protects lead quality** - Ensures leads go to real professionals
3. **License verification** - Admin can cross-check license IDs with state databases
4. **Brokerage validation** - Can verify agent works with legitimate brokerages
5. **Audit trail** - All approval/denial decisions are logged with timestamps and admin IDs

## Future Enhancements
- **Automated license verification** - Integrate with state realtor board APIs
- **Document upload** - Allow agents to upload license photos
- **Stripe Connect verification** - Link to Stripe's identity verification
- **Re-verification** - Periodic reverification (e.g., annual license renewal)
- **Batch approval** - Approve multiple agents at once
- **Search/filter** - Search pending requests by name, state, brokerage

## Deployment
✅ Backend deployed with CDK hotswap
✅ Frontend deployed to S3 + CloudFront
✅ Existing agents migrated to 'approved' status
✅ All endpoints protected with verification checks

## Files Modified
- `backend/src/utils/types.ts` - Updated Agent interface
- `backend/src/handlers/agent-management.ts` - Added verification check, updated profile creation
- `backend/src/handlers/marketplace.ts` - Added verification check
- `backend/src/handlers/payment.ts` - Added verification check
- `backend/src/handlers/admin.ts` - Added verification endpoints and functions
- `backend/migrate-existing-agents.js` - Migration script (NEW)
- `frontend/src/pages/Profile.jsx` - Added licenseState field
- `frontend/src/pages/Dashboard.jsx` - Added verification status messages
- `frontend/src/pages/AdminDashboard.jsx` - Added Verification tab with approve/deny UI
- `frontend/src/utils/api.js` - Added getVerificationRequests API call

## Environment
- Region: us-east-1
- DynamoDB Table: RealtorAgents
- CloudFront: https://d2jm01qx6zm242.cloudfront.net
- API Gateway: https://9xoa0zbf64.execute-api.us-east-1.amazonaws.com/prod/
