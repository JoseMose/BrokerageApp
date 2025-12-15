#!/bin/bash

echo "🚀 Checking CloudFormation deployment status..."
echo ""

while true; do
    STATUS=$(aws cloudformation describe-stacks --stack-name RealtorLeadPlatformStack --query 'Stacks[0].StackStatus' --output text 2>&1)
    
    if [[ $STATUS == *"does not exist"* ]]; then
        echo "⏳ Stack being created..."
    elif [[ $STATUS == "CREATE_IN_PROGRESS" ]]; then
        echo "⏳ Creating resources... ($STATUS)"
    elif [[ $STATUS == "CREATE_COMPLETE" ]]; then
        echo "✅ DEPLOYMENT SUCCESSFUL!"
        echo ""
        echo "📊 Stack Outputs:"
        aws cloudformation describe-stacks --stack-name RealtorLeadPlatformStack --query 'Stacks[0].Outputs' --output table
        exit 0
    elif [[ $STATUS == "ROLLBACK"* ]] || [[ $STATUS == *"FAILED"* ]]; then
        echo "❌ DEPLOYMENT FAILED: $STATUS"
        echo ""
        echo "Recent errors:"
        aws cloudformation describe-stack-events --stack-name RealtorLeadPlatformStack --max-items 10 --query 'StackEvents[?contains(ResourceStatus, `FAILED`)].{Resource:LogicalResourceId,Reason:ResourceStatusReason}' --output table
        exit 1
    else
        echo "📡 Status: $STATUS"
    fi
    
    sleep 30
done
