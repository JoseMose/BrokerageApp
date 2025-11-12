# Amazon Bedrock Setup Guide

## Current IAM Configuration ✅

Your CDK infrastructure **already has** the necessary IAM permissions configured:

### Lambda Role Permissions (Lines 213-234)
```typescript
lambdaRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'bedrock:InvokeModel',
      'bedrock:InvokeModelWithResponseStream',
    ],
    resources: [
      'arn:aws:bedrock:region::foundation-model/amazon.nova-micro-v1:0',
      'arn:aws:bedrock:region::foundation-model/amazon.nova-pro-v1:0',
      'arn:aws:bedrock:region::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
      'arn:aws:bedrock:region::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
    ],
  })
);
```

### Create-Lead Lambda Permissions (Line 667-671)
```typescript
createLeadLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['*'],
}));
```

## ⚠️ REQUIRED: Enable Bedrock Model Access

**IMPORTANT:** Even though IAM permissions are configured, you **MUST manually enable model access** in the AWS Console.

### Steps to Enable Bedrock Models:

1. **Open AWS Console**
   - Go to https://console.aws.amazon.com/bedrock/

2. **Navigate to Model Access**
   - In the left sidebar, click **"Model access"**
   - Or go directly to: https://console.aws.amazon.com/bedrock/home#/modelaccess

3. **Enable Required Models**
   
   Click **"Manage model access"** or **"Enable specific models"**, then enable:
   
   **Primary Model (Required):**
   - ✅ **Amazon Nova Micro** (`amazon.nova-micro-v1:0`)
     - Fast, cost-effective
     - Used for lead scoring
     - **CRITICAL:** This is the ONLY model used - no fallback!
   
   **Optional (not used currently):**
   - ☐ Anthropic Claude 3 Sonnet (fallback removed)
   - ☐ Amazon Nova Pro
   - ☐ Anthropic Claude 3 Haiku

4. **Submit Request**
   - Click **"Request model access"** or **"Save changes"**
   - **Amazon Nova Micro:** Usually instant approval ⚡
   - **IMPORTANT:** Nova Micro is the ONLY model needed - if it fails, you'll get an error (no silent fallback)

5. **Verify Access**
   - Status should show **"Access granted"** in green
   - You should see a green checkmark next to each enabled model

## Model Access Status Check

Run this command to check if models are enabled:

```bash
aws bedrock get-foundation-model \
  --model-identifier amazon.nova-micro-v1:0 \
  --region us-east-1 \
  --output json
```

## Pricing (as of 2024)

### Amazon Nova Micro (ONLY model used)
- **Input:** $0.035 per 1M tokens (~$0.000035 per lead)
- **Output:** $0.14 per 1M tokens (~$0.0001 per lead)
- **Estimated cost per lead:** < $0.001 (less than 1/10th of a cent)

**No fallback models configured** - if Nova Micro fails, the API will return an error.

## Testing AI Scoring

After enabling model access, test with:

```bash
# Test lead creation (this will invoke AI scoring)
curl -X POST https://your-api-endpoint/create-lead \
  -H "Content-Type: application/json" \
  -d '{
    "leadType": "buyer",
    "contact": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "5555555555"
    },
    "location": {
      "address": "123 Main St",
      "city": "Atlanta",
      "state": "GA",
      "zipCode": "30301"
    },
    "responses": {
      "motivation": "first-home",
      "timeline": "1-3-months",
      "preApproved": true
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "leadId": "...",
    "score": 8,
    "price": 120,
    "aiReason": "Pre-approved buyer with clear 1-3 month timeline - Score 8/10"
  }
}
```

## Troubleshooting

### Error: "AccessDeniedException"
**Cause:** Amazon Nova Micro not enabled in Bedrock console
**Solution:** Enable Nova Micro model access (see steps above)
**Note:** This will cause lead submissions to fail - intentional behavior (no silent fallback)

### Error: "ValidationException: The provided model identifier is invalid"
**Cause:** Model not available in your region
**Solution:** 
- Nova models: Available in us-east-1, us-west-2
- Use us-east-1 for best availability
- Check: https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html

### Error: "ThrottlingException: Rate exceeded"
**Cause:** Too many requests (unlikely with your usage)
**Solution:** Retry with exponential backoff (already implemented in code)

## Current Configuration

Your app is configured to use:
- **Region:** `us-east-1` (or your deployed region)
- **Primary Model:** `amazon.nova-micro-v1:0`
- **Fallback Model:** ❌ NONE (removed - fail fast on errors)
- **Error Handling:** ✅ Throws error if AI fails (you'll see it immediately)
- **No Silent Failures:** ✅ If Nova Micro is down/not enabled, API returns 500 error

## Summary

### ✅ Already Configured (No Action Needed)
- IAM permissions for Lambda functions
- Bedrock client initialization
- Error handling and fallbacks
- Model configuration in environment variables

### ⚠️ ACTION REQUIRED
1. **Enable Amazon Nova Micro in Bedrock Console** (takes 30 seconds)
   - This is the ONLY model - no fallback!
   - If not enabled, all lead submissions will fail
2. Test a lead submission to verify it works

### After Enabling Model
The AI scoring will work **immediately** - no code changes or redeployment needed!

**Important:** If Nova Micro fails for any reason, you'll get a clear error in:
- CloudWatch Logs (Lambda function logs)
- API response (500 error with details)
- This is intentional - you want to know immediately if AI is failing!

---

**Need help?** Check CloudWatch Logs for the `create-lead` Lambda function to see detailed AI scoring logs.
