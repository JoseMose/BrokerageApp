const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

/**
 * Cleanup expired locks
 * Runs every minute via EventBridge scheduled rule
 * Finds all locked leads where lockExpiresAt < now and resets them to available
 */
exports.handler = async (event) => {
  console.log('Running expired lock cleanup...');
  
  const now = Math.floor(Date.now() / 1000); // Unix timestamp
  let cleanedCount = 0;
  let errors = [];
  
  try {
    // Query locked leads from both buyer and seller indexes
    const leadTypes = ['buyer', 'seller'];
    
    for (const leadType of leadTypes) {
      const statusTypeValue = `locked#${leadType}`;
      
      // Query all locked leads of this type
      const result = await ddb.send(new QueryCommand({
        TableName: process.env.LEADS_TABLE_NAME,
        IndexName: 'StatusTypeIndex',
        KeyConditionExpression: 'statusType = :statusType',
        ExpressionAttributeValues: {
          ':statusType': statusTypeValue
        }
      }));
      
      console.log(`Found ${result.Items?.length || 0} locked ${leadType} leads`);
      
      // Filter for expired locks and unlock them
      if (result.Items && result.Items.length > 0) {
        for (const lead of result.Items) {
          // Check if lock has expired
          if (lead.lockExpiresAt && lead.lockExpiresAt < now) {
            try {
              console.log(`Unlocking expired lead: ${lead.leadId} (expired at ${lead.lockExpiresAt}, now is ${now})`);
              
              await ddb.send(new UpdateCommand({
                TableName: process.env.LEADS_TABLE_NAME,
                Key: { leadId: lead.leadId },
                UpdateExpression: `
                  SET 
                    #status = :available,
                    statusType = :availableType
                  REMOVE lockedBy, lockedAt, lockExpiresAt, lockVersion
                `,
                ConditionExpression: '#status = :locked',
                ExpressionAttributeNames: {
                  '#status': 'status'
                },
                ExpressionAttributeValues: {
                  ':locked': 'locked',
                  ':available': 'available',
                  ':availableType': `available#${leadType}`
                }
              }));
              
              cleanedCount++;
              console.log(`Successfully unlocked lead: ${lead.leadId}`);
              
              // TODO: Publish to AppSync to notify all clients
              // await publishLeadUnlocked(lead.leadId);
              
            } catch (unlockError) {
              console.error(`Failed to unlock lead ${lead.leadId}:`, unlockError);
              errors.push({
                leadId: lead.leadId,
                error: unlockError.message
              });
            }
          }
        }
      }
    }
    
    console.log(`Cleanup complete. Unlocked ${cleanedCount} expired leads.`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        cleanedCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        cleanedCount,
        timestamp: new Date().toISOString()
      })
    };
  }
};

/**
 * Helper function to publish unlock event to AppSync
 * TODO: Implement AppSync GraphQL mutation call
 */
async function publishLeadUnlocked(leadId) {
  // This would call AppSync GraphQL API to trigger subscription
  // For now, subscriptions will rely on DynamoDB Streams
  console.log(`TODO: Publish unlock event for lead ${leadId} to AppSync`);
}
