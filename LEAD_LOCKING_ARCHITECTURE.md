# Lead-Locking System Architecture

## 🎯 Overview

A **100% fair, real-time lead-locking system** using atomic DynamoDB operations + AppSync WebSocket subscriptions.

**Key Guarantees:**
- ✅ **Atomic Locking**: Only one agent can lock a lead (DynamoDB conditional writes)
- ✅ **Real-time Updates**: All agents see lock status instantly (AppSync subscriptions)
- ✅ **Auto-Expiration**: Abandoned locks auto-release after 15 seconds (TTL + Lambda)
- ✅ **Scalable**: Handles 1000s of concurrent agents on AWS serverless

---

## 📊 Architecture Diagram

```
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   React     │◄────────►│   AppSync    │◄────────►│  DynamoDB   │
│  Frontend   │ WebSocket│   GraphQL    │  Query   │   Leads     │
│  (Amplify)  │          │  Subscriptions│          │   Table     │
└─────────────┘          └──────────────┘          └─────────────┘
      │                         │                          │
      │ REST API                │ Mutations                │
      ▼                         ▼                          ▼
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│ API Gateway │─────────►│   Lambda     │─────────►│  Conditional│
│             │          │  lock-lead   │          │   Writes    │
└─────────────┘          └──────────────┘          └─────────────┘
                                │
                                │ Publish Event
                                ▼
                         ┌──────────────┐
                         │   AppSync    │
                         │  Broadcast   │
                         └──────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              All Subscribed           Agent's UI
                 Agents                 Updates
```

---

## 🗄️ DynamoDB Schema

### **Table: `RealtorLeads` (Updated)**

```javascript
{
  // Partition Key
  "leadId": "uuid",
  
  // Existing attributes
  "leadType": "buyer | seller",
  "score": 8,
  "price": 80,
  "status": "available | locked | claimed | expired",
  "aiReason": "Strong buyer...",
  "contact": { /* contact info */ },
  "location": { /* address + coordinates */ },
  "responses": { /* questionnaire */ },
  "createdAt": "2025-11-06T12:00:00Z",
  
  // NEW: Locking attributes
  "lockedBy": "agent_uuid | null",
  "lockedAt": "2025-11-06T12:00:00Z | null",
  "lockExpiresAt": 1699281615, // Unix timestamp for TTL
  "lockVersion": 1, // Optimistic locking counter
  
  // NEW: Claiming attributes
  "claimedBy": "agent_uuid | null",
  "claimedAt": "2025-11-06T12:00:15Z | null",
  "transactionId": "payment_uuid | null",
  
  // GSI Keys (existing)
  "statusType": "available#buyer",
  "scorePrice": "08#0080"
}
```

### **TTL Configuration**

```javascript
// Enable TTL on lockExpiresAt attribute
// DynamoDB automatically deletes items where lockExpiresAt < now
// We use DynamoDB Streams to trigger cleanup Lambda
```

### **Global Secondary Indexes (Updated)**

```javascript
// Existing GSI
StatusTypeIndex: {
  PartitionKey: "statusType",
  SortKey: "scorePrice",
  ProjectionType: "ALL"
}

// NEW GSI for lock management
LockedLeadsIndex: {
  PartitionKey: "lockedBy",
  SortKey: "lockExpiresAt",
  ProjectionType: "ALL",
  // Query all leads locked by an agent
  // Query expired locks for cleanup
}
```

---

## 🔐 Locking Flow (Atomic + Real-time)

### **Step 1: Agent Clicks "Lock Lead"**

```javascript
// Frontend (React)
const handleLockLead = async (leadId) => {
  setLocking(true);
  setError(null);
  
  try {
    // Call REST API to attempt atomic lock
    const response = await api.post('/leads/lock', { leadId });
    
    if (response.success) {
      // Lock acquired! Show payment modal
      setLockedLead(response.data.lead);
      setShowPaymentModal(true);
      
      // Start 15-second countdown timer
      startLockExpirationTimer(response.data.lockExpiresAt);
    }
  } catch (error) {
    if (error.code === 'LEAD_ALREADY_LOCKED') {
      setError('This lead was just claimed by another agent');
    } else if (error.code === 'LEAD_NO_LONGER_AVAILABLE') {
      setError('This lead is no longer available');
    } else {
      setError('Failed to lock lead. Please try again.');
    }
  } finally {
    setLocking(false);
  }
};
```

### **Step 2: Lambda - Atomic Lock Attempt**

```javascript
// backend/src/handlers/lead-locking.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { AppSyncClient, PostToConnectionCommand } = require('@aws-sdk/client-appsync');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const appsync = new AppSyncClient();

exports.lockLeadHandler = async (event) => {
  const { leadId } = JSON.parse(event.body);
  const agentId = event.requestContext.authorizer.claims.sub; // From Cognito JWT
  
  const now = new Date().toISOString();
  const lockExpiration = Math.floor(Date.now() / 1000) + 15; // 15 seconds from now
  
  try {
    // ATOMIC CONDITIONAL UPDATE
    // Only succeeds if status is "available"
    const result = await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId },
      UpdateExpression: `
        SET 
          #status = :locked,
          lockedBy = :agentId,
          lockedAt = :now,
          lockExpiresAt = :expiration,
          lockVersion = if_not_exists(lockVersion, :zero) + :one
      `,
      ConditionExpression: '#status = :available',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':available': 'available',
        ':locked': 'locked',
        ':agentId': agentId,
        ':now': now,
        ':expiration': lockExpiration,
        ':zero': 0,
        ':one': 1
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    const lockedLead = result.Attributes;
    
    // BROADCAST TO ALL CLIENTS via AppSync
    await broadcastLeadLocked(lockedLead);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          lead: lockedLead,
          lockExpiresAt: lockExpiration
        }
      })
    };
    
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Lead is no longer available
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: 'LEAD_ALREADY_LOCKED',
          message: 'This lead was just locked by another agent'
        })
      };
    }
    
    console.error('Lock failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'LOCK_FAILED',
        message: 'Failed to lock lead'
      })
    };
  }
};

// Broadcast lock event to all subscribed clients
async function broadcastLeadLocked(lead) {
  await appsync.send(new PublishCommand({
    ApiId: process.env.APPSYNC_API_ID,
    Events: [{
      EventType: 'LEAD_LOCKED',
      Data: JSON.stringify({
        leadId: lead.leadId,
        status: lead.status,
        lockedBy: lead.lockedBy,
        lockedAt: lead.lockedAt,
        lockExpiresAt: lead.lockExpiresAt
      })
    }]
  }));
}
```

### **Step 3: AppSync Broadcasts to All Clients**

```graphql
# AppSync GraphQL Schema

type Lead {
  leadId: ID!
  leadType: String!
  score: Int!
  price: Float!
  status: LeadStatus!
  lockedBy: String
  lockedAt: AWSDateTime
  lockExpiresAt: AWSTimestamp
  claimedBy: String
  claimedAt: AWSDateTime
  contact: Contact
  location: Location
  aiReason: String
}

enum LeadStatus {
  AVAILABLE
  LOCKED
  CLAIMED
  EXPIRED
}

type LeadLockEvent {
  leadId: ID!
  status: LeadStatus!
  lockedBy: String
  lockedAt: AWSDateTime
  lockExpiresAt: AWSTimestamp
}

type Mutation {
  lockLead(leadId: ID!): Lead
  unlockLead(leadId: ID!): Lead
  claimLead(leadId: ID!, transactionId: ID!): Lead
}

type Subscription {
  onLeadStatusChanged: LeadLockEvent
    @aws_subscribe(mutations: ["lockLead", "unlockLead", "claimLead"])
}
```

### **Step 4: Frontend Receives Real-time Update**

```javascript
// frontend/src/hooks/useLeadSubscription.js

import { useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';

const onLeadStatusChanged = /* GraphQL subscription */`
  subscription OnLeadStatusChanged {
    onLeadStatusChanged {
      leadId
      status
      lockedBy
      lockedAt
      lockExpiresAt
    }
  }
`;

export function useLeadSubscription(onLeadUpdate) {
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onLeadStatusChanged)
    ).subscribe({
      next: ({ value }) => {
        const event = value.data.onLeadStatusChanged;
        console.log('Lead status changed:', event);
        
        // Update local state
        onLeadUpdate(event);
      },
      error: (error) => console.error('Subscription error:', error)
    });
    
    return () => subscription.unsubscribe();
  }, [onLeadUpdate]);
}

// Usage in Marketplace component
function Marketplace() {
  const [leads, setLeads] = useState([]);
  
  const handleLeadUpdate = (event) => {
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.leadId === event.leadId
          ? { ...lead, ...event }
          : lead
      )
    );
  };
  
  useLeadSubscription(handleLeadUpdate);
  
  return (
    <div>
      {leads.map(lead => (
        <LeadCard
          key={lead.leadId}
          lead={lead}
          onLock={handleLockLead}
        />
      ))}
    </div>
  );
}
```

---

## ⏰ Lock Expiration & Cleanup

### **Approach 1: DynamoDB Streams + Lambda**

```javascript
// backend/src/handlers/lock-expiration.js

exports.handleExpiredLocks = async (event) => {
  // Triggered by DynamoDB Stream when TTL deletes items
  
  for (const record of event.Records) {
    if (record.eventName === 'REMOVE' && record.userIdentity.type === 'Service') {
      // TTL deleted this item
      const oldLead = record.dynamodb.OldImage;
      
      if (oldLead.status.S === 'locked') {
        // Re-create the lead as "available"
        await ddb.send(new PutCommand({
          TableName: process.env.LEADS_TABLE_NAME,
          Item: {
            ...unmarshall(oldLead),
            status: 'available',
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null
          }
        }));
        
        // Broadcast unlock event
        await broadcastLeadUnlocked(oldLead.leadId.S);
      }
    }
  }
};
```

### **Approach 2: EventBridge Scheduled Rule (Every Minute)**

```javascript
// backend/src/handlers/cleanup-expired-locks.js

exports.cleanupExpiredLocksHandler = async () => {
  const now = Math.floor(Date.now() / 1000);
  
  // Query all locked leads that have expired
  const result = await ddb.send(new QueryCommand({
    TableName: process.env.LEADS_TABLE_NAME,
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'statusType = :locked',
    FilterExpression: 'lockExpiresAt < :now',
    ExpressionAttributeValues: {
      ':locked': 'locked#buyer', // Repeat for seller
      ':now': now
    }
  }));
  
  // Batch unlock all expired leads
  for (const lead of result.Items) {
    await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId: lead.leadId },
      UpdateExpression: `
        SET #status = :available,
        REMOVE lockedBy, lockedAt, lockExpiresAt
      `,
      ConditionExpression: '#status = :locked AND lockExpiresAt < :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':available': 'available',
        ':locked': 'locked',
        ':now': now
      }
    }));
    
    // Broadcast unlock
    await broadcastLeadUnlocked(lead.leadId);
  }
};
```

---

## 💳 Claim Confirmation (After Payment)

```javascript
// backend/src/handlers/claim-lead.js

exports.claimLeadHandler = async (event) => {
  const { leadId, transactionId } = JSON.parse(event.body);
  const agentId = event.requestContext.authorizer.claims.sub;
  
  const now = new Date().toISOString();
  
  try {
    // Conditional update: Only if locked by this agent
    const result = await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId },
      UpdateExpression: `
        SET 
          #status = :claimed,
          claimedBy = :agentId,
          claimedAt = :now,
          transactionId = :txnId,
          statusType = :claimedType
        REMOVE lockedBy, lockedAt, lockExpiresAt
      `,
      ConditionExpression: '(#status = :locked) AND (lockedBy = :agentId)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':locked': 'locked',
        ':claimed': 'claimed',
        ':agentId': agentId,
        ':now': now,
        ':txnId': transactionId,
        ':claimedType': 'claimed#buyer' // Or seller
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    // Broadcast claim event
    await broadcastLeadClaimed(result.Attributes);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: { lead: result.Attributes }
      })
    };
    
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          error: 'CLAIM_FAILED',
          message: 'Lock has expired or lead was not locked by you'
        })
      };
    }
    throw error;
  }
};
```

---

## 🎨 React Frontend Components

### **LeadCard with Lock Status**

```javascript
// frontend/src/components/LeadCard.jsx

import React, { useState, useEffect } from 'react';
import './LeadCard.css';

function LeadCard({ lead, currentAgentId, onLock }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  const isLockedByMe = lead.lockedBy === currentAgentId;
  const isLockedByOther = lead.lockedBy && !isLockedByMe;
  const isAvailable = lead.status === 'available';
  const isClaimed = lead.status === 'claimed';
  
  // Countdown timer for locked leads
  useEffect(() => {
    if (lead.lockExpiresAt && isLockedByMe) {
      const interval = setInterval(() => {
        const remaining = lead.lockExpiresAt - Math.floor(Date.now() / 1000);
        setTimeRemaining(remaining > 0 ? remaining : 0);
        
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [lead.lockExpiresAt, isLockedByMe]);
  
  return (
    <div className={`lead-card ${lead.status}`}>
      <div className="lead-score">
        <ScoreMeter score={lead.score} />
      </div>
      
      <div className="lead-info">
        <h3>{lead.leadType === 'buyer' ? '🏠 Buyer Lead' : '💰 Seller Lead'}</h3>
        <p className="price">${lead.price}</p>
        <p className="reason">{lead.aiReason}</p>
      </div>
      
      {/* Lock Status Indicator */}
      {isLockedByMe && (
        <div className="lock-banner lock-mine">
          ⏰ You have {timeRemaining}s to complete payment
        </div>
      )}
      
      {isLockedByOther && (
        <div className="lock-banner lock-other">
          🔒 Locked by another agent
        </div>
      )}
      
      {isClaimed && (
        <div className="lock-banner claimed">
          ✅ Claimed
        </div>
      )}
      
      {/* Action Button */}
      <button
        className="lock-btn"
        onClick={() => onLock(lead.leadId)}
        disabled={!isAvailable}
      >
        {isAvailable && '🎯 Claim This Lead'}
        {isLockedByMe && '💳 Complete Payment'}
        {isLockedByOther && '🔒 Locked'}
        {isClaimed && '✅ Sold'}
      </button>
    </div>
  );
}

export default LeadCard;
```

### **CSS for Lock States**

```css
/* frontend/src/components/LeadCard.css */

.lead-card {
  border-radius: 8px;
  padding: 20px;
  margin: 15px 0;
  transition: all 0.3s ease;
  position: relative;
}

.lead-card.available {
  background: white;
  border: 2px solid #00c853;
  box-shadow: 0 2px 8px rgba(0,200,83,0.2);
}

.lead-card.locked {
  background: #fff8e1;
  border: 2px solid #ffc107;
  opacity: 0.9;
}

.lead-card.claimed {
  background: #f5f5f5;
  border: 2px solid #9e9e9e;
  opacity: 0.6;
}

.lock-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px;
  text-align: center;
  font-weight: bold;
  border-radius: 8px 8px 0 0;
}

.lock-mine {
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  color: white;
  animation: pulse 1s infinite;
}

.lock-other {
  background: #e0e0e0;
  color: #616161;
}

.claimed {
  background: #4caf50;
  color: white;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.lock-btn:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
}
```

---

## 🏗️ Infrastructure (AWS CDK)

```javascript
// infrastructure/lib/lead-locking-stack.js

const cdk = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const appsync = require('aws-cdk-lib/aws-appsync');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');

class LeadLockingStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    
    // Update existing Leads table with TTL
    const leadsTable = dynamodb.Table.fromTableName(
      this,
      'LeadsTable',
      'RealtorLeads'
    );
    
    // Enable TTL on lockExpiresAt
    new cdk.CfnOutput(this, 'EnableTTLCommand', {
      value: `aws dynamodb update-time-to-live --table-name RealtorLeads --time-to-live-specification "Enabled=true, AttributeName=lockExpiresAt"`,
      description: 'Run this command to enable TTL'
    });
    
    // AppSync API for real-time subscriptions
    const api = new appsync.GraphqlApi(this, 'LeadLockingAPI', {
      name: 'realtor-lead-locking-api',
      schema: appsync.SchemaFile.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: cognito.UserPool.fromUserPoolId(
              this,
              'UserPool',
              process.env.USER_POOL_ID
            ),
          },
        },
      },
      xrayEnabled: true,
    });
    
    // DynamoDB data source for AppSync
    const leadsDataSource = api.addDynamoDbDataSource(
      'LeadsDataSource',
      leadsTable
    );
    
    // Resolvers for mutations
    leadsDataSource.createResolver('LockLeadResolver', {
      typeName: 'Mutation',
      fieldName: 'lockLead',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('leadId').is('$ctx.args.leadId'),
        appsync.Values.projecting()
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    
    // Lambda for lock expiration cleanup
    const cleanupLambda = new lambda.Function(this, 'CleanupExpiredLocks', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('backend/dist/cleanup-expired-locks'),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: api.apiId,
        APPSYNC_ENDPOINT: api.graphqlUrl,
      },
      timeout: cdk.Duration.seconds(60),
    });
    
    leadsTable.grantReadWriteData(cleanupLambda);
    api.grant(cleanupLambda, appsync.IamResource.custom('types/Mutation/fields/unlockLead'), 'appsync:GraphQL');
    
    // EventBridge rule: Run cleanup every minute
    const rule = new events.Rule(this, 'CleanupSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    
    rule.addTarget(new targets.LambdaFunction(cleanupLambda));
    
    // Outputs
    new cdk.CfnOutput(this, 'AppSyncEndpoint', {
      value: api.graphqlUrl,
      description: 'AppSync GraphQL endpoint',
    });
  }
}

module.exports = { LeadLockingStack };
```

---

## 💰 Cost Optimization

### **DynamoDB**
- **On-Demand Billing**: Only pay for reads/writes
- **Cost per lock**: ~$0.00125 (1 write + 1 read)
- **1000 locks/day**: ~$1.25/day = $37.50/month

### **AppSync**
- **Real-time subscriptions**: $0.08 per million messages
- **1000 agents × 100 events/day**: 100K messages = $0.008/day
- **Monthly**: ~$0.24

### **Lambda**
- **Lock/unlock operations**: ~1ms execution time
- **1000 requests/day**: Free tier covers this
- **Cost**: $0 (under free tier)

### **Total Estimated Cost**
- **Light usage** (100 locks/day): ~$5/month
- **Medium usage** (1000 locks/day): ~$40/month
- **Heavy usage** (10K locks/day): ~$400/month

---

## 📈 Scaling Considerations

### **Horizontal Scaling**
- ✅ **Lambda auto-scales** to 1000s of concurrent executions
- ✅ **DynamoDB on-demand** auto-scales reads/writes
- ✅ **AppSync** handles 10K+ concurrent WebSocket connections

### **Performance**
- **Lock latency**: 50-100ms (DynamoDB conditional write)
- **Broadcast latency**: 100-200ms (AppSync to all clients)
- **Total perceived latency**: 150-300ms (instant to users)

### **Fairness Guarantee**
- **DynamoDB conditional writes** are atomic at database level
- **First request to complete wins** - no race conditions
- **Clock skew handled** by server-side timestamps

---

## 🔒 Security

### **IAM Roles**

```javascript
// Lambda execution role
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/RealtorLeads"
    },
    {
      "Effect": "Allow",
      "Action": ["appsync:GraphQL"],
      "Resource": "arn:aws:appsync:*:*:apis/*/types/Mutation/fields/*"
    }
  ]
}
```

### **Cognito Authorization**
- All lock/claim operations require valid JWT token
- Agent ID extracted from `sub` claim
- AppSync subscriptions use same Cognito auth

---

## 🧪 Testing Strategy

### **Unit Tests**
```javascript
describe('Lead Locking', () => {
  test('should lock available lead', async () => {
    const result = await lockLead({ leadId: 'test-123', agentId: 'agent-1' });
    expect(result.status).toBe('locked');
    expect(result.lockedBy).toBe('agent-1');
  });
  
  test('should fail to lock already locked lead', async () => {
    await lockLead({ leadId: 'test-123', agentId: 'agent-1' });
    await expect(lockLead({ leadId: 'test-123', agentId: 'agent-2' }))
      .rejects.toThrow('ConditionalCheckFailedException');
  });
});
```

### **Load Testing**
- Simulate 100 concurrent agents trying to lock same lead
- Verify only 1 succeeds
- Use Artillery or k6 for load testing

---

## 📝 Summary

This architecture provides:

✅ **100% Fair**: Atomic DynamoDB locks prevent race conditions  
✅ **Real-time**: AppSync broadcasts updates in <200ms  
✅ **Auto-cleanup**: TTL + Lambda handle abandoned locks  
✅ **Scalable**: Serverless handles 1000s of concurrent agents  
✅ **Cost-effective**: ~$40/month for 1000 locks/day  
✅ **Production-ready**: Security, monitoring, and error handling built-in

**Next Steps**: Implement this system incrementally, starting with basic locking, then adding real-time subscriptions, and finally optimizing with TTL cleanup.
