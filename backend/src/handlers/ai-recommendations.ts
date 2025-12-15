import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig } from '../utils/types';
import { DynamoDBService } from '../utils/dynamodb';

const config = getConfig();
const bedrockClient = new BedrockRuntimeClient({ region: config.AWS_REGION });

interface LeadData {
  leadId: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  leadType: 'buyer' | 'seller';
  score: number;
  location: {
    city: string;
    state: string;
  };
  funnelStage: string;
  purchaseDate: string;
  activities: Array<{
    type: string;
    timestamp: string;
    notes: string;
  }>;
}

interface AIRecommendation {
  leadId: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  action: string;
  confidence: number;
}

/**
 * Check if AI has already run today for this agent
 */
async function hasAIRunToday(agentId: string): Promise<boolean> {
  try {
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, { agentId });
    if (!agent || !agent.lastAIRun) return false;

    const lastRun = new Date(agent.lastAIRun);
    const now = new Date();
    
    // Check if same day
    return (
      lastRun.getFullYear() === now.getFullYear() &&
      lastRun.getMonth() === now.getMonth() &&
      lastRun.getDate() === now.getDate()
    );
  } catch (error) {
    console.error('Error checking AI run status:', error);
    return false;
  }
}

/**
 * Update agent's last AI run timestamp
 */
async function updateAIRunTimestamp(agentId: string): Promise<void> {
  try {
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId },
      'SET lastAIRun = :timestamp',
      { ':timestamp': new Date().toISOString() }
    );
  } catch (error) {
    console.error('Error updating AI run timestamp:', error);
  }
}

/**
 * Generate AI-powered lead recommendations
 * This should ONLY be called once per day at 8 AM via scheduled Lambda
 */
export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
      },
      body: '',
    };
  }

  try {
    console.log('🤖 AI RECOMMENDATIONS - Starting analysis');
    
    // Extract agentId from Cognito auth claims
    const agentId = event.requestContext?.authorizer?.claims?.sub;
    if (!agentId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Unauthorized: No agent ID found' }),
      };
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { leads } = body;

    if (!leads || !Array.isArray(leads)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        },
        body: JSON.stringify({
          error: 'Invalid request: leads array required',
        }),
      };
    }

    // ✅ CHECK: Has AI already run today for this agent?
    const alreadyRan = await hasAIRunToday(agentId);
    if (alreadyRan) {
      console.log(`✅ AI already ran today for agent ${agentId}. Skipping Bedrock call.`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        },
        body: JSON.stringify({
          message: 'AI already ran today',
          alreadyRan: true,
          recommendations: [],
        }),
      };
    }

    console.log(`Analyzing ${leads.length} leads for agent ${agentId}`);

    // Build the AI prompt with all lead data
    const prompt = buildRecommendationsPrompt(leads);

    // Call AWS Bedrock for AI analysis
    const recommendations = await callBedrockForRecommendations(prompt);

    // ✅ UPDATE: Mark that AI has run today for this agent
    await updateAIRunTimestamp(agentId);

    console.log(`✅ Generated ${recommendations.length} recommendations`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
      },
      body: JSON.stringify({
        success: true,
        recommendations,
        timestamp: new Date().toISOString(),
        model: config.BEDROCK_MODEL_ID,
      }),
    };
  } catch (error: any) {
    console.error('❌ AI Recommendations Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
      },
      body: JSON.stringify({
        error: 'Failed to generate recommendations',
        message: error.message,
      }),
    };
  }
};

/**
 * Build the AI prompt for recommendations analysis
 */
function buildRecommendationsPrompt(leads: LeadData[]): string {
  const now = new Date();
  
  const leadsContext = leads.map((lead, index) => {
    const purchaseDate = new Date(lead.purchaseDate);
    const daysSincePurchase = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const lastActivity = lead.activities.length > 0 
      ? new Date(lead.activities[lead.activities.length - 1].timestamp)
      : null;
    const daysSinceContact = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : daysSincePurchase;

    return `
LEAD ${index + 1}:
- ID: ${lead.leadId}
- Name: ${lead.contact.name}
- Type: ${lead.leadType}
- Quality Score: ${lead.score}/10
- Location: ${lead.location.city}, ${lead.location.state}
- Current Stage: ${lead.funnelStage}
- Days Since Purchase: ${daysSincePurchase}
- Days Since Last Contact: ${daysSinceContact}
- Total Interactions: ${lead.activities.length}
- Recent Activities: ${lead.activities.slice(-3).map(a => `${a.type} (${a.notes.substring(0, 50)}...)`).join(', ') || 'None'}
`;
  }).join('\n');

  return `You are an expert real estate sales coach and lead management specialist. Analyze the following leads and provide actionable recommendations for which leads need immediate attention today.

CURRENT DATE: ${now.toLocaleDateString()}
CURRENT TIME: 8:00 AM

${leadsContext}

Your task:
1. Identify which leads need attention TODAY (maximum ${Math.min(leads.length, 5)} recommendations)
2. IMPORTANT: Only recommend leads that actually exist in the list above
3. Prioritize based on:
   - Time sensitivity (no recent contact = urgent)
   - Lead quality (higher scores = more valuable)
   - Funnel stage (active stages need more attention)
   - Engagement patterns (consistent follow-up needed)
   - Business impact (high-value opportunities)

4. For each recommended lead, provide:
   - Priority level (high/medium/low)
   - Specific reason WHY this lead needs attention
   - Concrete action the agent should take
   - Confidence score (0-100) in this recommendation

IMPORTANT RULES:
- Only recommend leads that are NOT in "closed" stage
- Only return recommendations for leads that actually exist in the list above
- Maximum ${Math.min(leads.length, 5)} recommendations (don't exceed the number of available leads)
- Prioritize HIGH leads with no contact in 3+ days
- Prioritize MEDIUM leads with scores 7+ that haven't been contacted in 2+ days
- Consider leads in active stages (qualified, appointment_set, active_client, under_contract) as higher priority
- Be specific and actionable in your recommendations

Return ONLY valid JSON with this structure:
{
  "recommendations": [
    {
      "leadId": "string",
      "priority": "high|medium|low",
      "reason": "specific 1-2 sentence reason",
      "action": "specific action to take",
      "confidence": number (0-100)
    }
  ]
}`;
}

/**
 * Call AWS Bedrock for AI-powered recommendations
 */
async function callBedrockForRecommendations(
  prompt: string
): Promise<AIRecommendation[]> {
  console.log('📞 Calling AWS Bedrock...');
  
  const command = new ConverseCommand({
    modelId: config.BEDROCK_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 2000,
      temperature: 0.3,
      topP: 0.9,
    },
  });

  const response = await bedrockClient.send(command);
  const textResponse = response.output?.message?.content?.[0]?.text || '';

  if (!textResponse) {
    throw new Error('Empty response from Bedrock');
  }

  console.log('📥 Bedrock response received');

  // Parse JSON from response
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Bedrock response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
    throw new Error('Invalid recommendations format from Bedrock');
  }

  // Validate and return recommendations
  return parsed.recommendations.map((rec: any) => ({
    leadId: rec.leadId,
    priority: rec.priority,
    reason: rec.reason,
    action: rec.action,
    confidence: rec.confidence || 75,
  }));
}
