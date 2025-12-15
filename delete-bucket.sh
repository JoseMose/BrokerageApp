#!/bin/bash

BUCKET="realtor-lead-frontend-663003476104"

echo "Deleting all versions from $BUCKET..."

# Delete all versions
aws s3api list-object-versions --bucket $BUCKET --query 'Versions[].[Key,VersionId]' --output text | \
while read key versionId; do
    echo "Deleting $key version $versionId"
    aws s3api delete-object --bucket $BUCKET --key "$key" --version-id "$versionId"
done

# Delete all delete markers
aws s3api list-object-versions --bucket $BUCKET --query 'DeleteMarkers[].[Key,VersionId]' --output text | \
while read key versionId; do
    echo "Deleting delete marker $key version $versionId"
    aws s3api delete-object --bucket $BUCKET --key "$key" --version-id "$versionId"
done

echo "Deleting bucket..."
aws s3api delete-bucket --bucket $BUCKET

echo "Done!"
