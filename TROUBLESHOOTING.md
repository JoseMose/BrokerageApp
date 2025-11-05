# Troubleshooting Guide - Realtor Lead Platform

## Table of Contents

1. [Deployment Issues](#deployment-issues)
2. [Authentication Problems](#authentication-problems)
3. [Payment Processing Errors](#payment-processing-errors)
4. [AI Scoring Issues](#ai-scoring-issues)
5. [Location Service Problems](#location-service-problems)
6. [Database Issues](#database-issues)
7. [Frontend Issues](#frontend-issues)
8. [Performance Problems](#performance-problems)
9. [Monitoring and Debugging](#monitoring-and-debugging)

---

## Deployment Issues

### CDK Deployment Fails with "Unable to resolve AWS account"

**Cause**: AWS credentials not configured or incorrect region.

**Solution**:
```bash
# Verify credentials
aws sts get-caller-identity

# Configure if needed
aws configure

# Specify account/region explicitly
cdk deploy --profile your-profile --region us-east-1
```

### CDK Bootstrap Error

**Cause**: CDK not bootstrapped in account/region.

**Solution**:
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Lambda Deployment Fails - Package Too Large

**Cause**: node_modules included in deployment package.

**Solution**:
```bash
# Build backend with production dependencies only
cd backend
rm -rf node_modules
npm ci --production
npm run build

# Redeploy
cd ../infrastructure
cdk deploy
```

### CloudFormation Stack Stuck in UPDATE_ROLLBACK_FAILED

**Cause**: Manual intervention or permission issues.

**Solution**:
```bash
# Continue rollback
aws cloudformation continue-update-rollback --stack-name RealtorLeadPlatformStack

# Or delete and recreate
cdk destroy
cdk deploy
```

---

## Authentication Problems

### "User is not authenticated" Error

**Cause**: JWT token expired or missing.

**Solution**:
1. Check token in localStorage: `localStorage.getItem('token')`
2. Sign out and sign back in
3. Verify Cognito User Pool ID and Client ID in frontend/.env

### Email Verification Not Working

**Cause**: SES in sandbox mode (AWS default).

**Solution**:
1. Go to AWS SES Console
2. Request production access
3. Or verify individual email addresses in sandbox

**Temporary Fix**:
```bash
# Manually verify user
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id YOUR_POOL_ID \
  --username user@example.com
```

### "NotAuthorizedException: Incorrect username or password"

**Cause**: Wrong credentials or user doesn't exist.

**Solution**:
```bash
# Check if user exists
aws cognito-idp admin-get-user \
  --user-pool-id YOUR_POOL_ID \
  --username user@example.com

# Reset password
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_POOL_ID \
  --username user@example.com \
  --password NewPassword123! \
  --permanent
```

### CORS Errors on API Calls

**Cause**: CORS not configured properly or wrong API endpoint.

**Solution**:
1. Verify `REACT_APP_API_ENDPOINT` in frontend/.env includes `/prod`
2. Check API Gateway CORS configuration in CDK stack
3. Redeploy infrastructure if CORS settings changed

```typescript
// In infrastructure/lib/realtor-lead-platform-stack.ts
defaultCorsPreflightOptions: {
  allowOrigins: ['*'], // Change to specific domain in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}
```

---

## Payment Processing Errors

### Stripe Payment Fails - "No such customer"

**Cause**: Customer not created or Stripe keys mismatch.

**Solution**:
1. Verify `STRIPE_SECRET_KEY` in backend/.env
2. Check you're using same environment (test vs live)
3. View payment logs:

```bash
aws logs tail /aws/lambda/RealtorPayment --follow
```

### Webhook Not Receiving Events

**Cause**: Webhook URL incorrect or signature verification failing.

**Solution**:
1. Verify webhook URL in Stripe Dashboard matches API Gateway endpoint
2. Confirm `STRIPE_WEBHOOK_SECRET` matches Stripe webhook secret
3. Test webhook:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local
stripe listen --forward-to https://YOUR_API/prod/payments/webhook
```

### "Payment intent not found" Error

**Cause**: PaymentIntent created in different Stripe account.

**Solution**:
- Ensure frontend and backend use matching Stripe keys (both test or both live)
- Check `REACT_APP_STRIPE_PUBLISHABLE_KEY` matches `STRIPE_SECRET_KEY` environment

### Webhook Returns 401 Unauthorized

**Cause**: Webhook endpoint requires authentication but shouldn't.

**Solution**:
Check API Gateway configuration - webhook endpoint should NOT have Cognito authorizer:

```typescript
// In infrastructure/lib/realtor-lead-platform-stack.ts
payments.addMethod('POST', new LambdaIntegration(paymentHandler), {
  authorizer: undefined, // No auth for webhooks
});
```

---

## AI Scoring Issues

### "AccessDeniedException" from Bedrock

**Cause**: Model access not enabled or wrong region.

**Solution**:
1. Enable model access in Bedrock console (see DEPLOYMENT.md Step 4)
2. Verify region supports your chosen model:
   - Nova models: us-east-1, us-west-2, eu-west-1
   - Claude models: Most regions
3. Change region or model if needed:

```bash
# In backend/.env
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
AWS_REGION=us-east-1
```

### AI Scoring Takes Too Long / Times Out

**Cause**: Lambda timeout too short or Bedrock throttling.

**Solution**:
1. Increase Lambda timeout in CDK:

```typescript
// In infrastructure/lib/realtor-lead-platform-stack.ts
const aiScoringHandler = new lambda.Function(this, 'AIScoringHandler', {
  timeout: cdk.Duration.seconds(120), // Increase from 60
});
```

2. Implement exponential backoff for retries
3. Use faster model (Nova Micro instead of Claude)

### AI Returns Invalid Scores (Not 1-10)

**Cause**: Prompt parsing error or model hallucination.

**Solution**:
Check CloudWatch logs for parsing errors:

```bash
aws logs tail /aws/lambda/RealtorAIScoring --follow --format short
```

Fallback is implemented in `backend/src/utils/ai-service.ts` - score will default to 5 with warning.

### Leads Stuck in "pending_scoring" Status

**Cause**: Step Function workflow failed or AI Lambda crashed.

**Solution**:
1. Check Step Functions execution:

```bash
aws stepfunctions list-executions \
  --state-machine-arn YOUR_STATE_MACHINE_ARN \
  --status-filter FAILED
```

2. View failed execution details
3. Manually trigger scoring:

```bash
aws lambda invoke \
  --function-name RealtorAIScoring \
  --payload '{"leadId": "LEAD_UUID"}' \
  response.json
```

---

## Location Service Problems

### Geocoding Fails - "Resource not found"

**Cause**: Place Index not created or wrong name.

**Solution**:
1. Verify Place Index exists:

```bash
aws location list-place-indexes
```

2. Check `PLACE_INDEX_NAME` in backend/.env matches actual name
3. Redeploy infrastructure if missing

### Distance Calculation Returns 0

**Cause**: Route calculator unavailable or coordinates invalid.

**Solution**:
1. Verify Route Calculator exists:

```bash
aws location list-route-calculators
```

2. System falls back to Haversine formula - check logs for warnings
3. Validate coordinates are within valid range:
   - Latitude: -90 to 90
   - Longitude: -180 to 180

### No Leads Showing in Marketplace Despite Availability

**Cause**: Agent location not geocoded or radius too small.

**Solution**:
1. Check agent profile has valid coordinates:

```bash
aws dynamodb get-item \
  --table-name RealtorAgents \
  --key '{"agentId": {"S": "AGENT_UUID"}}'
```

2. Increase agent radius in profile
3. Verify leads have coordinates

---

## Database Issues

### "ResourceNotFoundException: Requested resource not found"

**Cause**: DynamoDB table doesn't exist or wrong name.

**Solution**:
```bash
# List tables
aws dynamodb list-tables

# Check environment variable
echo $LEADS_TABLE_NAME

# Redeploy infrastructure if missing
cd infrastructure
cdk deploy
```

### "ProvisionedThroughputExceededException"

**Cause**: Too many requests (shouldn't happen with on-demand billing).

**Solution**:
1. Verify tables use on-demand billing mode:

```bash
aws dynamodb describe-table --table-name RealtorLeads --query 'Table.BillingModeSummary'
```

2. If not, update to on-demand in CDK:

```typescript
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
```

### Data Inconsistency - Lead Purchased But Still Available

**Cause**: Transaction failed between payment and status update.

**Solution**:
1. Check transaction record:

```bash
aws dynamodb query \
  --table-name RealtorTransactions \
  --index-name AgentTransactionsIndex \
  --key-condition-expression "agentId = :aid" \
  --expression-attribute-values '{":aid": {"S": "AGENT_UUID"}}'
```

2. Manually update lead status:

```bash
aws dynamodb update-item \
  --table-name RealtorLeads \
  --key '{"leadId": {"S": "LEAD_UUID"}}' \
  --update-expression "SET #status = :sold" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{":sold": {"S": "sold"}}'
```

---

## Frontend Issues

### Blank Page After Deployment

**Cause**: Environment variables not set or wrong API endpoint.

**Solution**:
1. Check browser console for errors (F12)
2. Verify frontend/.env has all required variables
3. Rebuild and redeploy:

```bash
cd frontend
npm run build
aws s3 sync build/ s3://YOUR_BUCKET --delete
```

4. Clear CloudFront cache:

```bash
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Infinite Redirect Loop on Login

**Cause**: Cognito configuration mismatch.

**Solution**:
1. Verify `REACT_APP_COGNITO_USER_POOL_ID` and `REACT_APP_COGNITO_CLIENT_ID`
2. Check Cognito App Client settings allow OAuth flows
3. Clear browser cache and localStorage

### "Failed to fetch" on API Calls

**Cause**: Network issue, CORS, or wrong API endpoint.

**Solution**:
1. Test API directly:

```bash
curl https://YOUR_API/prod/marketplace
```

2. Check API Gateway stage is deployed:

```bash
aws apigateway get-stages --rest-api-id YOUR_API_ID
```

3. Verify endpoint has `/prod` suffix

### Stripe Elements Not Loading

**Cause**: Publishable key invalid or network blocked.

**Solution**:
1. Verify `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_` or `pk_live_`
2. Check browser console for Stripe.js errors
3. Ensure stripe.js loaded:

```javascript
// In browser console
typeof Stripe === 'function'
```

---

## Performance Problems

### Lambda Cold Starts Taking 5+ Seconds

**Cause**: Large deployment package or many dependencies.

**Solution**:
1. Enable Lambda SnapStart (for Java) or Provisioned Concurrency
2. Reduce deployment package size
3. Keep frequently-used functions warm with CloudWatch Events

```typescript
// In CDK
const rule = new events.Rule(this, 'WarmerRule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
});
rule.addTarget(new targets.LambdaFunction(handler));
```

### DynamoDB Queries Slow

**Cause**: Missing GSI or full table scan.

**Solution**:
1. Use GSI for queries:
   - StatusTypeIndex for filtering by status
   - EmailIndex for agent lookups
   - AgentTransactionsIndex for purchase history

2. Add FilterExpression after query, not in KeyConditionExpression

### High Bedrock Costs

**Cause**: Using expensive models or too many requests.

**Solution**:
1. Switch to Nova Micro (cheapest):

```bash
# In backend/.env
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
```

2. Cache scores for similar leads
3. Implement request batching
4. Use Claude Haiku for fallback instead of Sonnet

---

## Monitoring and Debugging

### View Lambda Logs in Real-Time

```bash
# Specific function
aws logs tail /aws/lambda/RealtorAIScoring --follow

# All functions
aws logs tail /aws/lambda/Realtor --follow
```

### Query DynamoDB for Debugging

```bash
# Get specific lead
aws dynamodb get-item \
  --table-name RealtorLeads \
  --key '{"leadId": {"S": "LEAD_UUID"}}'

# Query available leads
aws dynamodb query \
  --table-name RealtorLeads \
  --index-name StatusTypeIndex \
  --key-condition-expression "#status = :avail AND leadType = :type" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{":avail": {"S": "available"}, ":type": {"S": "buyer"}}'
```

### Check API Gateway Logs

```bash
# Enable CloudWatch logs in API Gateway settings
aws apigateway update-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod \
  --patch-operations op=replace,path=/*/logging/loglevel,value=INFO

# View logs
aws logs tail /aws/apigateway/YOUR_API_ID/prod --follow
```

### Test Authentication Token

```bash
# Decode JWT
echo $TOKEN | cut -d'.' -f2 | base64 -D | jq

# Verify token is valid
aws cognito-idp get-user --access-token $ACCESS_TOKEN
```

### Monitor CloudWatch Metrics

Key metrics to watch:
- Lambda invocations and errors
- API Gateway 4XX/5XX errors
- DynamoDB consumed capacity
- Bedrock throttling

```bash
# Get Lambda error count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=RealtorAIScoring \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Enable X-Ray Tracing

Add to Lambda functions in CDK:

```typescript
tracing: lambda.Tracing.ACTIVE,
```

View traces:
```bash
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

### Debug Step Functions

```bash
# List executions
aws stepfunctions list-executions \
  --state-machine-arn YOUR_STATE_MACHINE_ARN \
  --max-results 10

# Get execution details
aws stepfunctions describe-execution \
  --execution-arn EXECUTION_ARN

# View execution history
aws stepfunctions get-execution-history \
  --execution-arn EXECUTION_ARN
```

---

## Getting Help

If you're still stuck:

1. **Check AWS Service Health**: https://status.aws.amazon.com
2. **Review CloudWatch Logs**: Look for stack traces and error messages
3. **Test with curl**: Isolate whether issue is frontend or backend
4. **Verify IAM Permissions**: Ensure Lambda execution roles have needed permissions
5. **Check Billing**: Verify services aren't suspended due to billing issues

### Useful Debug Commands

```bash
# Full system health check
cd infrastructure
cdk diff  # See what would change

# Check all Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `Realtor`)].FunctionName'

# Check all DynamoDB tables
aws dynamodb list-tables

# Check Cognito users
aws cognito-idp list-users --user-pool-id YOUR_POOL_ID --limit 10

# Check recent Stripe events
stripe events list --limit 10
```

### Common Root Causes

1. **Environment Variables**: 90% of issues stem from incorrect .env configuration
2. **IAM Permissions**: Lambda execution role missing required permissions
3. **Region Mismatch**: Services deployed in different regions
4. **Stale Cache**: CloudFront cache not invalidated after deployment
5. **Test vs Live Keys**: Mixing Stripe test and live environments
