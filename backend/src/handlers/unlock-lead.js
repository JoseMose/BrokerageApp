const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

/**
 * Unlock a lead (cancel the lock)
 * Only the agent who locked it can unlock it
 */
exports.handler = async (event) => {
  console.log('Unlock lead request:', JSON.stringify(event, null, 2));
  
  const { leadId } = JSON.parse(event.body);
  const agentId = event.requestContext.authorizer.claims.sub;
  
  if (!leadId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'MISSING_LEAD_ID',
        message: 'Lead ID is required'
      })
    };
  }
  
  try {
    // Conditional update: Only if locked by this agent
    const result = await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId },
      UpdateExpression: `
        SET 
          #status = :available,
          statusType = :availableType
        REMOVE lockedBy, lockedAt, lockExpiresAt, lockVersion
      `,
      ConditionExpression: '(#status = :locked) AND (lockedBy = :agentId)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':locked': 'locked',
        ':available': 'available',
        ':agentId': agentId,
        ':availableType': 'available#buyer' // Dynamically determine from lead
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    console.log('Lead unlocked successfully:', result.Attributes);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          lead: result.Attributes,
          message: 'Lead unlocked successfully'
        }
      })
    };
    
  } catch (error) {
    console.error('Unlock failed:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'UNLOCK_FAILED',
          message: 'Cannot unlock this lead. It may not be locked by you or may have expired.'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'UNLOCK_FAILED',
        message: 'Failed to unlock lead',
        details: error.message
      })
    };
  }
};
