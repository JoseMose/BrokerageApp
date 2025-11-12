#!/bin/bash

echo "🔍 Checking Amazon Bedrock Model Access..."
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli"
    exit 1
fi

# Get current AWS region
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-east-1"
    echo "ℹ️  No default region set, using us-east-1"
fi

echo "📍 Region: $REGION"
echo ""

# Check for Nova Micro model (ONLY model used - no fallback)
echo "Checking Amazon Nova Micro (CRITICAL - no fallback)..."
aws bedrock get-foundation-model \
    --model-identifier amazon.nova-micro-v1:0 \
    --region $REGION \
    --output json 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Amazon Nova Micro is available"
    echo "   Your AI scoring is ready to work!"
else
    echo "❌ Amazon Nova Micro not accessible"
    echo "   ⚠️  CRITICAL: Lead submissions will FAIL without this model"
    echo "   Action: Enable it in AWS Console immediately"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 To enable Nova Micro:"
echo "   1. Go to: https://console.aws.amazon.com/bedrock/home?region=$REGION#/modelaccess"
echo "   2. Click 'Manage model access' or 'Enable specific models'"
echo "   3. Enable 'Amazon Nova Micro'"
echo "   4. Click 'Save changes'"
echo ""
echo "⚠️  IMPORTANT: No fallback model configured!"
echo "   If Nova Micro fails, you'll get an error (intentional)"
echo ""
