#!/bin/bash

echo "🧹 Cleaning up ALL retained resources..."

# Delete all S3 buckets
for bucket in realtor-lead-frontend-663003476104 realtor-lead-cloudfront-logs-663003476104 realtor-lead-logs-663003476104; do
    echo "Deleting bucket: $bucket"
    
    # Suspend versioning
    aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Suspended 2>/dev/null
    
    # Delete all versions
    aws s3api list-object-versions --bucket $bucket --query 'Versions[].[Key,VersionId]' --output text 2>/dev/null | \
    while read key versionId; do
        if [ ! -z "$key" ] && [ "$key" != "None" ]; then
            aws s3api delete-object --bucket $bucket --key "$key" --version-id "$versionId" 2>/dev/null
        fi
    done
    
    # Delete all delete markers
    aws s3api list-object-versions --bucket $bucket --query 'DeleteMarkers[].[Key,VersionId]' --output text 2>/dev/null | \
    while read key versionId; do
        if [ ! -z "$key" ] && [ "$key" != "None" ]; then
            aws s3api delete-object --bucket $bucket --key "$key" --version-id "$versionId" 2>/dev/null
        fi
    done
    
    # Delete remaining objects
    aws s3 rm s3://$bucket --recursive 2>/dev/null
    
    # Delete bucket
    aws s3api delete-bucket --bucket $bucket 2>/dev/null && echo "✅ Deleted $bucket" || echo "⚠️ $bucket already deleted or doesn't exist"
done

# Delete all DynamoDB tables
for table in RealtorLeads RealtorAgents RealtorTransactions; do
    echo "Deleting table: $table"
    aws dynamodb delete-table --table-name $table 2>/dev/null && echo "✅ Deleted $table" || echo "⚠️ $table already deleted or doesn't exist"
done

echo "⏳ Waiting for tables to be deleted..."
sleep 30

echo "✅ Cleanup complete!"
