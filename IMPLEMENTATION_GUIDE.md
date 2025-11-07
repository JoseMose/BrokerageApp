# Lead-Locking System Implementation Guide

## 🚀 Quick Start

This guide walks you through implementing the complete lead-locking system step-by-step.

---

## Step 1: Update DynamoDB Schema

### Add Lock Attributes to Existing Leads Table

Run this AWS CLI command to enable TTL on the `lockExpiresAt` attribute:

```bash
aws dynamodb update-time-to-live \
  --table-name RealtorLeads \
  --time-to-live-specification "Enabled=true, AttributeName=lockExpiresAt"
```

### Update Lead Items with New Attributes

When creating or updating leads, include these new fields:

```javascript
{
  // Existing attributes...
  "leadId": "uuid",
  "status": "available", // available | locked | claimed
  
  // NEW: Locking attributes
  "lockedBy": null,       // agent_id when locked
  "lockedAt": null,       // ISO timestamp
  "lockExpiresAt": null,  // Unix timestamp for TTL
  "lockVersion": 0,       // Optimistic locking counter
  
  // NEW: Claiming attributes
  "claimedBy": null,
  "claimedAt": null,
  "transactionId": null
}
```

---

## Step 2: Deploy Backend Lambda Functions

### Build the Lambda handlers:

```bash
cd backend
npm run build
```

This will bundle the following handlers using esbuild:
- `lock-lead.js` → `dist/lock-lead/`
- `unlock-lead.js` → `dist/unlock-lead/`
- `claim-lead.js` → `dist/claim-lead/`
- `cleanup-expired-locks.js` → `dist/cleanup-expired-locks/`

### Update backend/scripts/bundle.js

Add the new handlers to the bundle script:

```javascript
const handlers = [
  'lead-intake',
  'ai-scoring',
  'lead-matching',
  'marketplace',
  'payment',
  'agent-management',
  'admin',
  // NEW HANDLERS:
  'lock-lead',
  'unlock-lead',
  'claim-lead',
  'cleanup-expired-locks'
];
```

---

## Step 3: Deploy AppSync GraphQL API

### Option A: Using AWS CDK (Recommended)

```bash
cd infrastructure

# Deploy the lead-locking stack
npx cdk deploy LeadLockingStack

# Note the outputs:
# - AppSyncGraphQLEndpoint
# - AppSyncAPIId
```

### Option B: Manual Setup via AWS Console

1. Go to AWS AppSync Console
2. Create new API: "realtor-lead-locking-api"
3. Schema: Copy from `graphql/schema.graphql`
4. Data source: Connect to DynamoDB table "RealtorLeads"
5. Create resolvers:
   - `Query.getLead`
   - `Query.listAvailableLeads`
   - `Mutation.lockLead`
   - `Mutation.unlockLead`
   - `Mutation.claimLead`

---

## Step 4: Update Frontend Configuration

### Add AppSync to Amplify Configuration

```javascript
// frontend/src/index.jsx

import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      region: import.meta.env.VITE_COGNITO_REGION,
    }
  },
  // NEW: AppSync Configuration
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_APPSYNC_ENDPOINT,
      region: import.meta.env.VITE_AWS_REGION,
      defaultAuthMode: 'userPool'
    }
  }
});
```

### Add Environment Variables

Add to `frontend/.env`:

```bash
# Existing variables...
VITE_API_ENDPOINT=https://sn03irrpo0.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_H1UV88Mcy
VITE_COGNITO_CLIENT_ID=33mprdrkqhfa76ra02jju1r14s
VITE_COGNITO_REGION=us-east-1
VITE_AWS_REGION=us-east-1

# NEW: AppSync endpoint
VITE_APPSYNC_ENDPOINT=https://[your-appsync-id].appsync-api.us-east-1.amazonaws.com/graphql
```

Add to `amplify.yml` (for Amplify Console):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
        # Create .env file with all variables
        - echo "VITE_API_ENDPOINT=$VITE_API_ENDPOINT" >> .env
        - echo "VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID" >> .env
        - echo "VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID" >> .env
        - echo "VITE_COGNITO_REGION=$VITE_COGNITO_REGION" >> .env
        - echo "VITE_AWS_REGION=$VITE_AWS_REGION" >> .env
        - echo "VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY" >> .env
        # NEW: AppSync endpoint
        - echo "VITE_APPSYNC_ENDPOINT=$VITE_APPSYNC_ENDPOINT" >> .env
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/build
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

---

## Step 5: Update Marketplace Component

The new `Marketplace.jsx` includes:
- ✅ Real-time AppSync subscriptions
- ✅ Lock/unlock/claim functionality
- ✅ Countdown timers
- ✅ Optimistic UI updates
- ✅ Error handling

### Integration with Existing Marketplace

Since you already have a Marketplace component, you need to add these features:

```javascript
// Import the subscription hook
import { useLeadSubscription } from '../hooks/useLeadSubscription';

// In your Marketplace component:
function Marketplace() {
  // ... existing state ...
  
  // Add real-time updates
  const handleLeadUpdate = useCallback((event) => {
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.leadId === event.leadId
          ? { ...lead, ...event }
          : lead
      )
    );
  }, []);
  
  useLeadSubscription(handleLeadUpdate);
  
  // ... rest of component ...
}
```

---

## Step 6: Add API Endpoints to API Utility

Update `frontend/src/utils/api.js`:

```javascript
// Add lock/unlock/claim methods
export const leadLockingAPI = {
  lockLead: (leadId) => 
    api.post('/leads/lock', { leadId }),
  
  unlockLead: (leadId) => 
    api.post('/leads/unlock', { leadId }),
  
  claimLead: (leadId, transactionId) => 
    api.post('/leads/claim', { leadId, transactionId }),
};
```

---

## Step 7: Update API Gateway Routes

Add the new routes to your API Gateway:

```bash
# Using AWS CDK (automatically done by lead-locking-stack.js)
npx cdk deploy

# Or manually via AWS Console:
# 1. Go to API Gateway → Your API
# 2. Create resource: /leads/lock (POST)
# 3. Create resource: /leads/unlock (POST)
# 4. Create resource: /leads/claim (POST)
# 5. All require Cognito authorizer
```

---

## Step 8: Testing

### Test Lead Locking Flow

1. **Login as Agent 1**
   ```
   Email: agent1@example.com
   ```

2. **Open Marketplace**
   - Should see available leads

3. **Click "Claim This Lead"**
   - Lead should lock immediately
   - Timer should show 15 seconds countdown
   - Payment modal should open

4. **Open another browser (Agent 2)**
   - Login as different agent
   - Same lead should show as "Locked by another agent"
   - Button should be disabled

5. **Complete payment (Agent 1)**
   - Enter payment details
   - Lead should change to "Claimed"
   - Both agents should see update instantly

6. **Test lock expiration**
   - Lock a lead but don't pay
   - Wait 15 seconds
   - Lead should automatically unlock
   - Both agents should see it become available again

### Load Testing

Simulate 100 concurrent agents trying to lock the same lead:

```javascript
// test-concurrent-locks.js
const axios = require('axios');

async function testConcurrentLocks() {
  const leadId = 'test-lead-123';
  const agents = Array.from({ length: 100 }, (_, i) => `agent-${i}`);
  
  const results = await Promise.allSettled(
    agents.map(agentId => 
      axios.post('https://your-api.com/leads/lock', { leadId }, {
        headers: { Authorization: `Bearer ${getAgentToken(agentId)}` }
      })
    )
  );
  
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
  const failures = results.filter(r => r.status === 'fulfilled' && r.value.status === 409);
  
  console.log(`Successes: ${successes.length} (should be 1)`);
  console.log(`Failures: ${failures.length} (should be 99)`);
}
```

Expected result: **Exactly 1 success, 99 failures**

---

## Step 9: Monitor and Debug

### CloudWatch Logs

```bash
# Watch lock Lambda logs
aws logs tail /aws/lambda/LockLeadFunction --follow

# Watch cleanup Lambda logs
aws logs tail /aws/lambda/CleanupExpiredLocksFunction --follow

# Watch AppSync logs
aws logs tail /aws/appsync/apis/[your-api-id] --follow
```

### DynamoDB Monitoring

```bash
# Check for expired locks
aws dynamodb scan \
  --table-name RealtorLeads \
  --filter-expression "#status = :locked AND lockExpiresAt < :now" \
  --expression-attribute-names '{"#status":"status"}' \
  --expression-attribute-values '{":locked":{"S":"locked"},":now":{"N":"'$(date +%s)'"}}'
```

### AppSync Real-time Metrics

Go to AWS AppSync Console → Your API → Monitoring:
- Active WebSocket connections
- Subscription messages sent
- GraphQL request latency

---

## Step 10: Production Optimization

### 1. Add Rate Limiting

```javascript
// Prevent agent from locking too many leads at once
const MAX_CONCURRENT_LOCKS = 3;

// In lock-lead.js:
const agentLocks = await queryAgentLockedLeads(agentId);
if (agentLocks.length >= MAX_CONCURRENT_LOCKS) {
  return {
    statusCode: 429,
    body: JSON.stringify({
      error: 'TOO_MANY_LOCKS',
      message: `You can only lock ${MAX_CONCURRENT_LOCKS} leads at a time`
    })
  };
}
```

### 2. Add Analytics

```javascript
// Track lock conversion rate
await cloudwatch.putMetricData({
  Namespace: 'RealtorPlatform',
  MetricData: [{
    MetricName: 'LeadLockConversion',
    Value: 1,
    Unit: 'Count',
    Dimensions: [
      { Name: 'AgentId', Value: agentId },
      { Name: 'LeadType', Value: lead.leadType }
    ]
  }]
});
```

### 3. Add Notifications

```javascript
// Send SNS notification when lock expires
await sns.publish({
  TopicArn: process.env.LOCK_EXPIRATION_TOPIC,
  Message: JSON.stringify({
    agentId,
    leadId,
    message: 'Your lock on this lead has expired'
  })
});
```

---

## Troubleshooting

### Problem: Leads not unlocking after 15 seconds

**Solution:**
1. Check if TTL is enabled: `aws dynamodb describe-time-to-live --table-name RealtorLeads`
2. Verify cleanup Lambda is running: Check EventBridge rule
3. Check CloudWatch logs for cleanup Lambda errors

### Problem: Multiple agents can lock the same lead

**Solution:**
- DynamoDB conditional write failed
- Check that `ConditionExpression: '#status = :available'` is present
- Verify no race conditions in code

### Problem: AppSync subscriptions not working

**Solution:**
1. Check WebSocket connection in browser DevTools
2. Verify Cognito token is valid
3. Check AppSync logs for errors
4. Ensure subscription is set up before mutations occur

### Problem: High costs

**Solution:**
- Use DynamoDB on-demand billing
- Set CloudWatch log retention to 7 days
- Monitor AppSync subscription connections
- Consider caching lead list on frontend

---

## Cost Estimates (Production Scale)

### Scenario: 1000 locks/day, 500 active agents

| Service | Usage | Cost/Month |
|---------|-------|-----------|
| DynamoDB | 3000 writes + 6000 reads | $3.75 |
| Lambda | 3000 invocations × 100ms | $0.20 |
| AppSync | 500 connections × 24h | $0.50 |
| API Gateway | 3000 requests | $0.01 |
| EventBridge | 43,200 invocations (1/min) | $0.00 |
| **Total** | | **~$5/month** |

### Scaling to 10,000 locks/day:

| Service | Cost/Month |
|---------|-----------|
| DynamoDB | $37.50 |
| Lambda | $2.00 |
| AppSync | $5.00 |
| API Gateway | $0.10 |
| **Total** | **~$45/month** |

---

## Next Steps

1. ✅ Deploy infrastructure (Steps 1-3)
2. ✅ Update frontend (Steps 4-6)
3. ✅ Test thoroughly (Step 8)
4. ✅ Monitor in production (Step 9)
5. ✅ Optimize as needed (Step 10)

For questions or issues, refer to:
- `LEAD_LOCKING_ARCHITECTURE.md` - System design
- `graphql/schema.graphql` - AppSync schema
- `backend/src/handlers/lock-*.js` - Lambda implementations
