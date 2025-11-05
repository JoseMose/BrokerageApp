# Security Checklist - Review Before Each Commit

## ✅ Files That Should NEVER Be Committed

### Environment Variables
- [ ] `backend/.env` - Contains Stripe secret key
- [ ] `frontend/.env` - Contains API endpoints and Cognito IDs
- [ ] Any file with actual API keys or secrets

### Build Artifacts
- [ ] `node_modules/` directories
- [ ] `dist/` or `build/` directories
- [ ] `cdk.out/` directory

## ✅ Safe to Commit

### Example Files (No Real Credentials)
- [x] `backend/.env.example` - Template with placeholders
- [x] `frontend/.env.example` - Template with placeholders

### Documentation
- [x] README.md
- [x] DEPLOYMENT.md
- [x] API_DOCUMENTATION.md
- [x] TROUBLESHOOTING.md

### Source Code
- [x] All `.ts`, `.tsx`, `.js`, `.jsx` files
- [x] CDK infrastructure code
- [x] Lambda handler source code
- [x] React components and pages

## 🔍 Pre-Commit Verification

Run these commands before pushing:

```bash
# Check for accidentally staged .env files
git status | grep -E "\.env$"

# Search for hardcoded API keys in staged files
git diff --cached | grep -E "(sk_|pk_|aws_access|aws_secret)"

# Verify .gitignore is working
git check-ignore backend/.env frontend/.env
```

## 🚨 If You Accidentally Commit Secrets

1. **Rotate all credentials immediately**:
   - Generate new Stripe API keys
   - Rotate AWS access keys
   - Update Cognito app client secrets

2. **Remove from Git history**:
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

3. **Update deployment**:
   - Update environment variables in Lambda
   - Redeploy frontend with new values

## 📊 API Call Audit

### Frontend API Calls (All have proper dependency arrays):
- ✅ Dashboard: Loads once on mount
- ✅ Marketplace: Loads on mount + when filters change
- ✅ LeadDetails: Loads once per lead
- ✅ Profile: Loads once on mount
- ✅ PurchaseHistory: Loads once on mount

### No Polling or Infinite Loops:
- ✅ No `setInterval` in any component
- ✅ All `useEffect` hooks have proper dependencies
- ✅ No recursive API calls

## 🔒 Production Security Checklist

Before going to production:

- [ ] Switch all Stripe keys from test to live mode
- [ ] Enable MFA on AWS accounts
- [ ] Set up AWS Secrets Manager for sensitive values
- [ ] Enable CloudWatch alarms for unusual API activity
- [ ] Implement rate limiting on API Gateway
- [ ] Add AWS WAF rules
- [ ] Enable CloudTrail for audit logs
- [ ] Set up automated secret rotation
- [ ] Review IAM permissions (principle of least privilege)
- [ ] Enable DynamoDB point-in-time recovery
- [ ] Set up automated backups

## 📝 Current Deployment Values (Safe to Share)

**These are safe because they're backend-generated and public-facing:**

- CloudFront Domain: `d3c5829div2bld.cloudfront.net`
- API Gateway Endpoint: `https://sn03irrpo0.execute-api.us-east-1.amazonaws.com/prod`
- Cognito User Pool ID: `us-east-1_H1UV88Mcy`
- Cognito Client ID: `33mprdrkqhfa76ra02jju1r14s`
- S3 Bucket: `realtor-lead-frontend-663003476104`

**These must remain secret:**
- Stripe Secret Key (sk_test_...)
- Stripe Webhook Secret (whsec_...)
- AWS Access Keys
- JWT tokens
