# Environment Variables Setup

## Required Environment Variables

### Backend (`backend/.env`)
```env
# AWS Configuration
AWS_REGION=us-east-1

# DynamoDB Tables
LEADS_TABLE_NAME=RealtorLeads
AGENTS_TABLE_NAME=RealtorAgents
TRANSACTIONS_TABLE_NAME=RealtorTransactions

# Stripe (Get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Email
FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# AWS Bedrock
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
BEDROCK_FALLBACK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Configuration
PRICE_PER_POINT=10
LEAD_EXPIRY_HOURS=72
DEFAULT_RADIUS_MILES=15
```

### Frontend (`frontend/.env`)
```env
# API Configuration
VITE_API_ENDPOINT=https://YOUR_API_GATEWAY_URL/prod

# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=us-east-1_YOUR_POOL_ID
VITE_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
VITE_COGNITO_REGION=us-east-1

# AWS Region
VITE_AWS_REGION=us-east-1

# Stripe Publishable Key (Get from https://dashboard.stripe.com/test/apikeys)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

## Setup Instructions

1. **Copy example files:**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. **Get your Stripe keys:**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy your Secret Key (starts with `sk_test_`)
   - Copy your Publishable Key (starts with `pk_test_`)

3. **Deploy infrastructure first:**
   ```bash
   cd infrastructure
   npx cdk deploy
   ```

4. **Update environment files with deployed resource IDs:**
   - Copy the Cognito User Pool ID from CDK output
   - Copy the API Gateway endpoint from CDK output
   - Update both backend/.env and frontend/.env

5. **For Lambda environment variables:**
   - Set `STRIPE_SECRET_KEY` environment variable before deploying:
     ```bash
     export STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
     npx cdk deploy
     ```

## Security Notes

⚠️ **NEVER commit these files to Git:**
- `backend/.env`
- `frontend/.env`
- `CREDENTIALS.local.md`
- Any file containing API keys or secrets

✅ **Safe to commit:**
- `.env.example` files (with placeholder values)
- `frontend/.env.production` (contains only public resource IDs, no secrets)

## Test Credentials

For local testing, create a `CREDENTIALS.local.md` file with your test account credentials. This file is automatically ignored by Git.
