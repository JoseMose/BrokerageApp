# Pre-Commit Security Checklist

Before pushing to Git, verify:

## ✅ Secrets Removed
- [x] No Stripe API keys in code (only env var references)
- [x] No AWS credentials in code
- [x] No hardcoded passwords
- [x] Test account credentials moved to CREDENTIALS.local.md
- [x] .env files listed in .gitignore
- [x] CREDENTIALS.local.md listed in .gitignore

## ✅ Build Artifacts Ignored
- [x] node_modules/ ignored
- [x] dist/ folders ignored
- [x] build/ folders ignored
- [x] cdk.out/ ignored

## ✅ Safe to Commit
- [x] Source code in backend/src/
- [x] Source code in frontend/src/
- [x] Infrastructure code in infrastructure/lib/
- [x] .env.example files (with placeholders)
- [x] Documentation files
- [x] frontend/.env.production (public resource IDs only)

## ✅ Security Improvements Made
- [x] Removed hardcoded Stripe keys from CDK stack
- [x] Created ENV_SETUP.md with setup instructions
- [x] Created CREDENTIALS.local.md for local-only credentials
- [x] Updated .gitignore to catch credential files

## Final Verification Command
```bash
# Run this before committing:
git diff HEAD | grep -iE "(sk_test|pk_test|AKIA|Admin@2025|TestAgent)"
```

If the command returns nothing (or only variable names), you're safe to commit!

## Quick Security Scan
```bash
# Check what will be committed:
git status --short

# Verify no secrets in changes:
git diff HEAD backend/src infrastructure/lib frontend/src | grep -iE "secret.*=|password.*=.*['\"]|api.*key.*=" 
```

## After Deployment
Remember to set environment variables:
```bash
# Set Stripe key for Lambda deployment
export STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE

# Deploy infrastructure
cd infrastructure
npx cdk deploy
```
