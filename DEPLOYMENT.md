# Deployment Guide - AI-Powered Real Estate Lead Platform

This guide will walk you through deploying the complete platform to AWS.

## Prerequisites

Before you begin, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Node.js 18+** and npm installed
4. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
5. **Stripe Account** (for payment processing)
6. **Git** installed

## Cost Estimate

**Development/Testing**: $50-150/month
**Production (500 leads/month)**: $200-500/month

Main costs:
- Lambda executions
- DynamoDB on-demand
- Amazon Bedrock API calls
- API Gateway requests
- CloudFront distribution

## Step 1: Initial Setup

### 1.1 Clone or Navigate to Project

```bash
cd "Realtor Lead Generation App"
```

### 1.2 Install All Dependencies

```bash
npm run install:all
```

This will install dependencies for infrastructure, backend, and frontend.

## Step 2: Configure Stripe

### 2.1 Create Stripe Account

1. Go to https://stripe.com and create an account
2. Complete your business profile
3. Go to Developers → API Keys
4. Copy your **Publishable key** and **Secret key** (use test keys for development)

### 2.2 Set Up Webhook

1. In Stripe Dashboard, go to Developers → Webhooks
2. Click "Add endpoint"
3. You'll add the actual URL after deploying (https://your-api.execute-api.region.amazonaws.com/prod/payments/webhook)
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the **Webhook signing secret**

## Step 3: Configure Backend Environment

### 3.1 Create Backend .env File

```bash
cd backend
cp .env.example .env
```

### 3.2 Edit backend/.env

```bash
# Required: Add your Stripe keys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# AWS Region (adjust if needed)
AWS_REGION=us-east-1

# Application Settings (can keep defaults)
PRICE_PER_POINT=10
DEFAULT_RADIUS_MILES=15
LEAD_EXPIRY_HOURS=72
```

## Step 4: Enable Amazon Bedrock Models

### 4.1 Request Model Access

1. Log into AWS Console
2. Navigate to Amazon Bedrock
3. Go to "Model access" in the left sidebar
4. Click "Manage model access"
5. Enable access to:
   - **Amazon Nova Micro** (recommended primary)
   - **Amazon Nova Pro** (recommended backup)
   - **Claude 3 Sonnet** (optional fallback)
   - **Claude 3 Haiku** (optional fallback)
6. Click "Save changes"
7. Wait for "Access granted" status (usually instant)

**Note**: Model availability varies by region. Nova models are available in:
- us-east-1 (N. Virginia)
- us-west-2 (Oregon)
- eu-west-1 (Ireland)

If Nova isn't available in your region, use Claude models instead.

## Step 5: Bootstrap AWS CDK (First Time Only)

If you haven't used CDK in this AWS account/region before:

```bash
cd infrastructure
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace ACCOUNT-ID with your AWS account ID (find via `aws sts get-caller-identity`).

Example:
```bash
cdk bootstrap aws://123456789012/us-east-1
```

## Step 6: Deploy Infrastructure

### 6.1 Build Backend

```bash
cd ../backend
npm run build
```

### 6.2 Deploy CDK Stack

```bash
cd ../infrastructure
npm run deploy
```

This will:
- Create DynamoDB tables
- Set up Cognito user pools
- Deploy Lambda functions
- Configure API Gateway
- Create S3 buckets
- Set up CloudFront distribution
- Configure AWS Location Service
- Create CloudWatch alarms

**⏱️ Deployment takes 10-15 minutes.**

### 6.3 Save CDK Outputs

After deployment completes, CDK will output important values. **Save these**:

```
RealtorLeadPlatformStack.UserPoolId = us-east-1_xxxxxxxxx
RealtorLeadPlatformStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
RealtorLeadPlatformStack.ApiEndpoint = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/
RealtorLeadPlatformStack.CloudFrontDomainName = dxxxxxxxxxx.cloudfront.net
RealtorLeadPlatformStack.FrontendBucketName = realtor-lead-frontend-123456789012
```

## Step 7: Update Stripe Webhook

1. Go back to Stripe Dashboard → Webhooks
2. Edit the webhook you created earlier
3. Update the endpoint URL to: `https://YOUR_API_ENDPOINT/prod/payments/webhook`
4. Save the changes

## Step 8: Configure Frontend Environment

### 8.1 Create Frontend .env File

```bash
cd ../frontend
cp .env.example .env
```

### 8.2 Edit frontend/.env

Use the values from CDK output:

```bash
REACT_APP_API_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
REACT_APP_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_COGNITO_REGION=us-east-1
REACT_APP_AWS_REGION=us-east-1
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

## Step 9: Build and Deploy Frontend

### 9.1 Build Frontend

```bash
npm run build
```

### 9.2 Deploy to S3

```bash
aws s3 sync build/ s3://YOUR_FRONTEND_BUCKET_NAME --delete
```

Replace YOUR_FRONTEND_BUCKET_NAME with the value from CDK output.

### 9.3 Invalidate CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

Get distribution ID from CDK output or:
```bash
aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?Id=='S3-realtor-lead-frontend']].Id" --output text
```

## Step 10: Create Admin User

### 10.1 Sign Up via UI

1. Open your CloudFront URL in a browser
2. Sign up with an email address
3. Verify your email
4. Log in to the platform

### 10.2 Add User to Admin Group

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username your-email@example.com \
  --group-name Admins
```

## Step 11: Test the Platform

### 11.1 Create Agent Profile

1. Log in to the platform
2. Go to Profile page
3. Complete your agent profile with all required information
4. Save the profile

### 11.2 Submit a Test Lead (Optional)

You can submit a test lead via API or create a simple form. Example curl:

```bash
curl -X POST https://YOUR_API_ENDPOINT/prod/leads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadType": "buyer",
    "contact": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "5551234567"
    },
    "location": {
      "address": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105"
    },
    "responses": {
      "timeline": "30-60 days",
      "budget": "$500,000-$750,000",
      "preapproved": "Yes",
      "propertyType": "Single family home"
    }
  }'
```

### 11.3 View Lead in Marketplace

1. Go to Marketplace
2. You should see the AI-scored lead
3. Click "View Details"
4. Test the purchase flow with a Stripe test card:
   - Card: 4242 4242 4242 4242
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

## Step 12: Monitoring and Logs

### 12.1 View Lambda Logs

```bash
aws logs tail /aws/lambda/RealtorAIScoring --follow
```

### 12.2 View CloudWatch Dashboard

Go to AWS Console → CloudWatch → Dashboards

### 12.3 Check DynamoDB Tables

```bash
aws dynamodb scan --table-name RealtorLeads --max-items 10
```

## Production Checklist

Before going to production:

- [ ] Switch Stripe from test mode to live mode
- [ ] Update environment variables with production Stripe keys
- [ ] Set up custom domain name (Route 53 + ACM certificate)
- [ ] Enable CloudWatch alarms and SNS notifications
- [ ] Configure backup schedules for DynamoDB
- [ ] Set up WAF rules for API Gateway
- [ ] Review and adjust Lambda memory/timeout settings
- [ ] Enable X-Ray tracing for debugging
- [ ] Set up budget alerts in AWS Billing
- [ ] Review IAM roles and permissions
- [ ] Enable MFA for Cognito users
- [ ] Configure CORS properly for production domain
- [ ] Test all payment scenarios
- [ ] Load test the API endpoints
- [ ] Set up error monitoring (e.g., Sentry)

## Common Issues and Solutions

### Issue: CDK Deployment Fails

**Solution**: Check AWS credentials, region, and permissions. Ensure CDK is bootstrapped.

```bash
aws sts get-caller-identity  # Verify credentials
cdk doctor  # Check CDK environment
```

### Issue: Bedrock Model Access Denied

**Solution**: Verify model access is granted in Amazon Bedrock console. Check region compatibility.

### Issue: Frontend Shows CORS Errors

**Solution**: Verify API Gateway CORS configuration in CDK stack. Redeploy if needed.

### Issue: Stripe Payments Fail

**Solution**: 
- Verify webhook endpoint is accessible
- Check Stripe keys are correct (test vs live)
- View webhook events in Stripe dashboard
- Check Lambda logs for errors

### Issue: Geocoding Fails

**Solution**: Verify AWS Location Service resources are created. Check IAM permissions for Lambda role.

### Issue: Leads Not Appearing in Marketplace

**Solution**:
- Check lead status in DynamoDB
- Verify AI scoring Lambda completed successfully
- Check agent's radius and preferences
- Look for errors in CloudWatch logs

## Updating the Application

### Update Backend

```bash
cd backend
npm run build
cd ../infrastructure
npm run deploy
```

### Update Frontend

```bash
cd frontend
npm run build
aws s3 sync build/ s3://YOUR_BUCKET_NAME --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Cleanup/Destroy Resources

To remove all AWS resources:

```bash
cd infrastructure
npm run destroy
```

**⚠️ Warning**: This will delete all data permanently.

## Support

For issues or questions:
1. Check CloudWatch Logs
2. Review DynamoDB table data
3. Check API Gateway execution logs
4. Verify environment variables
5. Test with curl commands to isolate frontend vs backend issues

## Next Steps

- Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)
- Add automated testing
- Implement Phase 2 features (OpenSearch, SageMaker)
- Configure custom domain with SSL
- Add SMS notifications via SNS
- Implement lead assignment rules
- Add performance analytics dashboard
- Set up automated backups
