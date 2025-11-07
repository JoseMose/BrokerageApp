const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

/**
 * Lock a lead for 15 seconds
 * Uses atomic conditional write to ensure only one agent can lock
 */
exports.handler = async (event) => {
  console.log('Lock lead request:', JSON.stringify(event, null, 2));
  
  const { leadId } = JSON.parse(event.body);
  const agentId = event.requestContext.authorizer.claims.sub; // From Cognito JWT
  
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
  
  const now = new Date().toISOString();
  const lockExpiration = Math.floor(Date.now() / 1000) + 15; // 15 seconds from now (Unix timestamp)
  
  try {
    // ATOMIC CONDITIONAL UPDATE
    // Only succeeds if status is "available"
    const result = await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId },
      UpdateExpression: `
        SET 
          #status = :locked,
          lockedBy = :agentId,
          lockedAt = :now,
          lockExpiresAt = :expiration,
          lockVersion = if_not_exists(lockVersion, :zero) + :one,
          statusType = :lockedType
      `,
      ConditionExpression: '#status = :available',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':available': 'available',
        ':locked': 'locked',
        ':agentId': agentId,
        ':now': now,
        ':expiration': lockExpiration,
        ':zero': 0,
        ':one': 1,
        ':lockedType': 'locked#buyer' // Will need to dynamically determine from lead
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    const lockedLead = result.Attributes;
    
    console.log('Lead locked successfully:', lockedLead);
    
    // Note: AppSync subscription will automatically broadcast this change
    // if the mutation is triggered via AppSync
    // For REST API, you would need to call AppSync mutation here
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          lead: lockedLead,
          lockExpiresAt: lockExpiration,
          message: 'Lead locked successfully. You have 15 seconds to complete payment.'
        }
      })
    };
    
  } catch (error) {
    console.error('Lock failed:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      // Lead is no longer available (already locked or claimed)
      
      // Fetch current lead status to provide better error message
      try {
        const currentLead = await ddb.send(new GetCommand({
          TableName: process.env.LEADS_TABLE_NAME,
          Key: { leadId }
        }));
        
        const lead = currentLead.Item;
        
        if (lead.status === 'locked') {
          const isLockedByMe = lead.lockedBy === agentId;
          
          return {
            statusCode: 409,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'LEAD_ALREADY_LOCKED',
              message: isLockedByMe 
                ? 'You already have this lead locked'
                : 'This lead was just locked by another agent',
              data: {
                status: lead.status,
                lockedBy: lead.lockedBy,
                lockExpiresAt: lead.lockExpiresAt
              }
            })
          };
        }
        
        if (lead.status === 'claimed') {
          return {
            statusCode: 410,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'LEAD_ALREADY_CLAIMED',
              message: 'This lead has already been purchased',
              data: { status: 'claimed' }
            })
          };
        }
        
      } catch (getError) {
        console.error('Error fetching lead status:', getError);
      }
      
      return {
        statusCode: 409,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'LEAD_NOT_AVAILABLE',
          message: 'This lead is no longer available'
        })
      };
    }
    
    // Other errors (network, permissions, etc.)
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'LOCK_FAILED',
        message: 'Failed to lock lead. Please try again.',
        details: error.message
      })
    };
  }
};
