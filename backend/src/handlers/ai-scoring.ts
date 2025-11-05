import { DynamoDBService } from '../utils/dynamodb';
import { AIService } from '../utils/ai-service';
import { getConfig, StepFunctionEvent } from '../utils/types';

const config = getConfig();

/**
 * AI Scoring Handler
 * Invoked by Step Functions to score leads using Amazon Bedrock
 */
export const handler = async (event: StepFunctionEvent) => {
  try {
    console.log('AI scoring request:', JSON.stringify(event, null, 2));

    const { leadId, leadType, responses, contact, location } = event;

    // Validate lead data
    const validationErrors = AIService.validateLeadData({
      leadType,
      responses,
      contact,
    });

    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      throw new Error(`Lead validation failed: ${validationErrors.join(', ')}`);
    }

    // Score the lead using AI
    const aiScore = await AIService.scoreLead({
      leadType,
      responses,
      contact,
    });

    console.log('AI scoring result:', aiScore);

    // Calculate price based on score
    const price = aiScore.lead_score * config.PRICE_PER_POINT;

    // Update lead with score and price
    const timestamp = new Date().toISOString();
    const scoreStr = aiScore.lead_score.toString().padStart(2, '0');

    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId, timestamp: event.leadId }, // Using leadId for both PK and SK lookup
      'SET score = :score, price = :price, aiReason = :reason, #status = :status, GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
      {
        ':score': aiScore.lead_score,
        ':price': price,
        ':reason': aiScore.reason,
        ':status': 'available',
        ':gsi1pk': `available#${leadType}`,
        ':gsi1sk': `${scoreStr}#${timestamp}`,
      },
      {
        '#status': 'status',
      }
    );

    console.log(`Lead ${leadId} scored: ${aiScore.lead_score}/10 ($${price})`);

    // Return enriched lead data for next step
    return {
      leadId,
      leadType,
      score: aiScore.lead_score,
      price,
      reason: aiScore.reason,
      location,
      timestamp,
    };
  } catch (error: any) {
    console.error('AI scoring error:', error);
    
    // Update lead with error status
    try {
      await DynamoDBService.updateItem(
        config.LEADS_TABLE_NAME,
        { leadId: event.leadId, timestamp: event.leadId },
        'SET #status = :status, aiReason = :reason',
        {
          ':status': 'error',
          ':reason': `Scoring failed: ${error.message}`,
        },
        {
          '#status': 'status',
        }
      );
    } catch (updateError) {
      console.error('Failed to update lead with error status:', updateError);
    }

    throw error;
  }
};
