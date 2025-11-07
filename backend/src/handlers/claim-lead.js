const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

/**
 * Claim a lead after successful payment
 * Only succeeds if the lead is locked by the requesting agent
 */
exports.handler = async (event) => {
  console.log('Claim lead request:', JSON.stringify(event, null, 2));
  
  const { leadId, transactionId } = JSON.parse(event.body);
  const agentId = event.requestContext.authorizer.claims.sub;
  
  if (!leadId || !transactionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: 'Lead ID and transaction ID are required'
      })
    };
  }
  
  const now = new Date().toISOString();
  
  try {
    // Conditional update: Only if locked by this agent and not expired
    const result = await ddb.send(new UpdateCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Key: { leadId },
      UpdateExpression: `
        SET 
          #status = :claimed,
          claimedBy = :agentId,
          claimedAt = :now,
          transactionId = :txnId,
          statusType = :claimedType
        REMOVE lockedBy, lockedAt, lockExpiresAt, lockVersion
      `,
      ConditionExpression: '(#status = :locked) AND (lockedBy = :agentId)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':locked': 'locked',
        ':claimed': 'claimed',
        ':agentId': agentId,
        ':now': now,
        ':txnId': transactionId,
        ':claimedType': 'claimed#buyer' // Dynamically determine from lead
      },
      ReturnValues: 'ALL_NEW'
    }));
    
    const claimedLead = result.Attributes;
    
    console.log('Lead claimed successfully:', claimedLead);
    
    // TODO: Send notification to agent with lead contact details
    // TODO: Log transaction for analytics
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          lead: claimedLead,
          message: 'Congratulations! Lead successfully purchased.',
          contactInfo: {
            name: claimedLead.contact?.name,
            email: claimedLead.contact?.email,
            phone: claimedLead.contact?.phone
          }
        }
      })
    };
    
  } catch (error) {
    console.error('Claim failed:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      // Lead was not locked by this agent or lock expired
      return {
        statusCode: 409,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'CLAIM_FAILED',
          message: 'Cannot claim this lead. Your lock may have expired or the lead was not locked by you.',
          action: 'RETRY_LOCK'
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
        error: 'CLAIM_FAILED',
        message: 'Failed to claim lead',
        details: error.message
      })
    };
  }
};
