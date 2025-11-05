# AI-Powered Real Estate Lead Scoring & Distribution Platform

A production-ready, fully serverless platform built on AWS that uses AI to score and distribute real estate leads to agents based on quality, location, and agent preferences.

## 🏗️ Architecture Overview

### AWS Services Used
- **Lambda Functions**: Serverless compute for all backend logic
- **API Gateway**: REST API endpoints for frontend and external integrations
- **DynamoDB**: NoSQL database for leads, agents, transactions
- **Cognito**: Authentication and user management
- **Bedrock**: AI lead scoring using Nova Micro/Pro and Claude models
- **Location Service**: Geolocation and radius-based lead distribution
- **Step Functions**: Orchestration of lead intake → scoring → distribution workflow
- **S3**: Storage for backups, logs, and static assets
- **CloudWatch**: Monitoring, logging, and alarms
- **AppSync (Optional)**: Real-time GraphQL subscriptions for live updates

### System Architecture

```
┌─────────────────┐
│   React App     │
│  (S3+CloudFront)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  API Gateway    │────▶│  Cognito User    │
│   (REST API)    │     │      Pools       │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│              Lambda Functions               │
├─────────────────────────────────────────────┤
│ • Lead Intake    • Agent Management         │
│ • AI Scoring     • Payment Processing       │
│ • Marketplace    • Admin Operations         │
└────┬────────────────────────────────┬───────┘
     │                                │
     ▼                                ▼
┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│  DynamoDB   │   │   Bedrock    │   │  Location   │
│   Tables    │   │   (Nova/     │   │   Service   │
│             │   │   Claude)    │   │             │
└─────────────┘   └──────────────┘   └─────────────┘
     │
     ▼
┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│   Stripe    │   │      S3      │   │ CloudWatch  │
│  Payments   │   │   Storage    │   │  Logging    │
└─────────────┘   └──────────────┘   └─────────────┘
```

## 💡 Business Model

### Lead Scoring
- **Score Range**: 1-10 (AI-powered evaluation)
- **Pricing**: $10 per score point (Score 7 = $70 lead)
- **Lead Types**: Buyer leads and Seller leads (separate scoring algorithms)

### Scoring Factors
- Budget and financial readiness
- Preapproval status (buyers) / Property equity (sellers)
- Timeline and urgency
- Communication quality and responsiveness
- Information accuracy and completeness

### Lead Distribution
- **Fair Distribution**: Equal marketplace access for all agents
- **Radius-Based**: Only show leads within agent's service area (5-40 miles, default 15)
- **Real-Time**: Instant notifications when new leads match agent profile

## 📊 Database Schema

### DynamoDB Tables

#### `Leads`
```
PK: leadId (UUID)
SK: timestamp
- leadType: "buyer" | "seller"
- score: 1-10
- price: number
- status: "available" | "sold" | "expired"
- contact: { name, email, phone }
- location: { lat, lng, address, city, state, zip }
- responses: { ...questionnaire answers }
- aiReason: string
- createdAt: ISO timestamp
- expiresAt: ISO timestamp
- GSI1PK: status#leadType (for querying available leads)
- GSI1SK: score#timestamp (for sorting by score)
```

#### `Agents`
```
PK: agentId (Cognito sub)
SK: profile
- email: string
- name: string
- licenseId: string
- brokerage: string
- phone: string
- location: { lat, lng, address, city, state, zip }
- radius: number (miles, default 15)
- preferences: {
    leadTypes: ["buyer", "seller"],
    minScore: number,
    maxPrice: number,
    propertyTypes: ["residential", "commercial"],
    priceRange: { min, max }
  }
- performanceMetrics: {
    leadsOwned: number,
    leadsConverted: number,
    conversionRate: number,
    totalSpent: number
  }
- stripeCustomerId: string
- status: "active" | "suspended"
- createdAt: ISO timestamp
```

#### `Transactions`
```
PK: transactionId (UUID)
SK: timestamp
- agentId: string
- leadId: string
- amount: number
- score: number
- stripePaymentIntentId: string
- status: "pending" | "completed" | "refunded"
- createdAt: ISO timestamp
- GSI1PK: agentId (for agent transaction history)
- GSI1SK: timestamp
```

## 🤖 AI Scoring System

### Bedrock Models
- **Primary**: Amazon Nova Micro (fast, cost-effective for most leads)
- **Complex Cases**: Nova Pro or Claude 3 Sonnet (better reasoning)

### Prompt Templates

**Buyer Lead Scoring**:
Evaluates preapproval status, budget, timeline, property preferences, and readiness to transact.

**Seller Lead Scoring**:
Evaluates property equity, motivation, timeline, pricing expectations, and property condition.

### Output Format
```json
{
  "lead_score": 7,
  "lead_type": "buyer",
  "reason": "Preapproved buyer with clear budget and 60-day timeline. Needs minor guidance on neighborhoods."
}
```

## 🚀 Deployment

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- Stripe account with API keys

### Environment Variables

Create `.env` files:

**Backend** (`backend/.env`):
```bash
# AWS
AWS_REGION=us-east-1
LEADS_TABLE_NAME=RealtorLeads
AGENTS_TABLE_NAME=RealtorAgents
TRANSACTIONS_TABLE_NAME=RealtorTransactions

# Bedrock
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
BEDROCK_FALLBACK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Location Service
LOCATION_SERVICE_PLACE_INDEX=RealtorPlaceIndex
LOCATION_SERVICE_ROUTE_CALCULATOR=RealtorRouteCalculator

# App Config
LEAD_EXPIRY_HOURS=72
DEFAULT_RADIUS_MILES=15
MIN_RADIUS_MILES=5
MAX_RADIUS_MILES=40
PRICE_PER_POINT=10
```

**Frontend** (`frontend/.env`):
```bash
REACT_APP_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxx
REACT_APP_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_COGNITO_REGION=us-east-1
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_AWS_REGION=us-east-1
```

### Installation & Deployment

```bash
# 1. Install all dependencies
npm run install:all

# 2. Deploy infrastructure (CDK)
cd infrastructure
npm run deploy

# 3. Build and deploy backend Lambda functions
cd ../backend
npm run build

# 4. Build and deploy frontend
cd ../frontend
npm run build

# Deploy frontend to S3 (output from CDK deployment)
aws s3 sync build/ s3://your-frontend-bucket --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### CDK Deployment Commands

```bash
# Synthesize CloudFormation template
npm run cdk:synth

# Deploy all stacks
npm run cdk:deploy

# Deploy specific stack
cdk deploy RealtorLeadPlatformStack

# Destroy all resources (careful!)
npm run cdk:destroy
```

## 📱 Frontend Features

### Agent Dashboard
- **Lead Inbox**: View available leads within radius
- **Filters**: Score range, lead type, price range
- **Map View**: Visual representation of lead locations
- **AI Confidence Meter**: Visual 1-10 score indicator
- **Purchase Flow**: Secure Stripe checkout

### Agent Profile
- Update service radius
- Set lead preferences (type, score, price range)
- View purchase history
- Track performance metrics

### Admin Dashboard
- Manage all leads and agents
- Adjust scoring weights
- Set pricing rules
- Generate analytics reports
- Handle refunds and disputes

## 💰 Cost Optimization

### Serverless Architecture Benefits
- **No idle costs**: Pay only for actual usage
- **Auto-scaling**: Handle traffic spikes automatically
- **Maintenance-free**: No servers to patch or manage

### Estimated Monthly Costs (MVP)

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 100k requests | $0.20 |
| API Gateway | 100k requests | $0.35 |
| DynamoDB | On-demand, 10GB | $2.50 |
| Bedrock (Nova Micro) | 10k calls | $15-30 |
| Cognito | 1,000 MAU | Free tier |
| Location Service | 10k requests | $4.00 |
| S3 + CloudFront | 10GB + 100k requests | $5.00 |
| CloudWatch | Logs + Alarms | $10.00 |
| **Total** | | **$37-52** |

With 1,000 leads/month: **$75-200**

### Cost Alarms
CloudWatch alarms are automatically configured to alert when:
- Lambda executions exceed budget
- DynamoDB read/write units spike
- Bedrock API calls exceed threshold

## 🔒 Security

- **Authentication**: AWS Cognito with MFA support
- **Authorization**: JWT tokens, role-based access (agent/admin)
- **API Security**: API Gateway throttling and WAF integration
- **Data Encryption**: At-rest (DynamoDB, S3) and in-transit (TLS)
- **PCI Compliance**: Stripe handles all payment data
- **Secrets**: AWS Secrets Manager for API keys

## 🧪 Testing

```bash
# Backend unit tests
cd backend
npm test

# Integration tests
npm run test:integration

# Frontend tests
cd frontend
npm test
```

## 📈 Monitoring & Alerts

### CloudWatch Dashboards
- API request rates and latency
- Lambda execution metrics
- DynamoDB performance
- Bedrock API usage
- Error rates and types

### Alarms
- High error rates
- Unusual spending patterns
- API throttling
- Database capacity issues

## 🔄 Lead Workflow

```
1. Lead Submission → API Gateway
2. Lambda: Validate & Store → DynamoDB
3. Step Function: Orchestrate Scoring
4. Lambda: Call Bedrock API → AI Score 1-10
5. Lambda: Update Lead with Score → DynamoDB
6. Lambda: Geocode & Match Agents → Location Service
7. Lambda: Notify Matched Agents → AppSync/WebSocket
8. Agent Views & Purchases → Stripe Payment
9. Lambda: Mark Lead as Sold → DynamoDB
10. Lambda: Update Agent Metrics → DynamoDB
```

## 🛠️ Future Enhancements (Phase 2)

- **OpenSearch**: Fast full-text search and analytics
- **SageMaker**: Fine-tune custom scoring models on conversion data
- **SMS Notifications**: Real-time lead alerts via SNS
- **Mobile App**: React Native for iOS/Android
- **A/B Testing**: Optimize scoring algorithms
- **Predictive Analytics**: Forecast lead quality trends
- **Multi-language**: Support for Spanish and other languages

## 📞 Support

For deployment issues or questions, check:
- CloudWatch Logs for Lambda errors
- API Gateway execution logs
- DynamoDB table metrics
- Bedrock model invocation logs

## 📄 License

MIT License - See LICENSE file for details
