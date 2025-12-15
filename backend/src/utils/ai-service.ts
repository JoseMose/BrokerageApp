import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig, AIScoreResponse, BehaviorMetrics } from './types';

const config = getConfig();
const bedrockClient = new BedrockRuntimeClient({ region: config.AWS_REGION });

export interface ScoringPromptData {
  leadType: 'buyer' | 'seller';
  responses: Record<string, any>;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  behaviorMetrics?: BehaviorMetrics | null;
}

export class AIService {
  /**
   * Score a lead using Amazon Bedrock (Nova only - no fallback)
   */
  static async scoreLead(data: ScoringPromptData): Promise<AIScoreResponse> {
    const prompt = this.buildPrompt(data);
    
    // Use primary model only - fail if it doesn't work
    return await this.invokeModel(config.BEDROCK_MODEL_ID, prompt);
  }

  /**
   * Invoke a Bedrock model with the scoring prompt
   */
  private static async invokeModel(modelId: string, prompt: string): Promise<AIScoreResponse> {
    // Use the Converse API - works with all Bedrock models including Nova
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [
            {
              text: prompt
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: 1000,
        temperature: 0.3,
        topP: 0.9,
      },
    });

    const response = await bedrockClient.send(command);
    
    // Extract text from the response
    const textResponse = response.output?.message?.content?.[0]?.text || '';
    
    if (!textResponse) {
      throw new Error('Empty response from AI model');
    }

    // Extract JSON from response
    return this.parseAIResponse(textResponse);
  }

  /**
   * Build the scoring prompt based on lead type
   */
  private static buildPrompt(data: ScoringPromptData): string {
    const basePrompt = `You are an expert real estate lead qualification specialist. Analyze the following lead and provide a quality score from 1-10, where:

- Score 10 = Highly qualified, ready to transact (pre-approved, clear timeline, strong intent)
- Score 7-9 = Well-qualified, serious buyer/seller with most factors in place
- Score 4-6 = Moderate potential, needs nurturing or clarification
- Score 1-3 = Low quality, early stage, or missing critical information

Your response MUST be valid JSON with this exact structure:
{
  "lead_score": <number 1-10>,
  "lead_type": "${data.leadType}",
  "reason": "<brief 1-2 sentence explanation>"
}

`;

    if (data.leadType === 'buyer') {
      return basePrompt + this.getBuyerPrompt(data);
    } else {
      return basePrompt + this.getSellerPrompt(data);
    }
  }

  /**
   * Buyer-specific scoring prompt
   */
  private static getBuyerPrompt(data: ScoringPromptData): string {
    const { responses, contact, behaviorMetrics } = data;

    let behaviorSection = '';
    if (behaviorMetrics) {
      const behaviors = [];
      if (behaviorMetrics.behavior_summary?.fast_filler) {
        behaviors.push('Completed form very quickly (possible low engagement)');
      }
      if (behaviorMetrics.behavior_summary?.hesitant) {
        behaviors.push('Made multiple edits to answers (thoughtful or uncertain)');
      }
      if (behaviorMetrics.behavior_summary?.likely_bot) {
        behaviors.push('WARNING: Possible bot activity detected');
      }
      if (behaviorMetrics.interaction_metrics?.copy_paste_flag) {
        behaviors.push('Used copy/paste (possible duplicate submission)');
      }
      if (behaviorMetrics.timing_metrics?.total_form_time_ms) {
        const minutes = Math.round(behaviorMetrics.timing_metrics.total_form_time_ms / 60000);
        behaviors.push(`Total time spent: ${minutes} minute(s)`);
      }
      
      if (behaviors.length > 0) {
        behaviorSection = `\n\nBehavioral Analysis:\n${behaviors.map(b => `- ${b}`).join('\n')}`;
      }
    }

    return `BUYER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Buyer Details:
${Object.entries(responses)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}${behaviorSection}

Scoring Factors to Consider:
1. Pre-approval Status (Critical): Is the buyer pre-approved? Pre-approved = higher score
2. Commitment Level (NEW): If found the right home, how soon would they make an offer? (immediately/within-week = high, still-researching = medium-low)
3. Search Activity (NEW): Have they been actively looking? (yes-actively = high, browsing-online = medium, not-yet = lower)
4. Reality Check (NEW): Are they prepared for competitive offers? (yes-understand = higher, still-learning = lower - but not penalized heavily)
5. Timeline: How soon are they looking to buy? (ASAP/1-3 months = high, 6+ months = low)
6. Budget Clarity: Do they have a clear budget and price range?
7. Motivation: Why are they buying? (first-home, relocating, upgrading, etc.)
8. Earnest Money: Do they have funds ready?
9. Current Housing: Are they renting (easier) or need to sell first (complex)?
10. Important Factors (NEW - Context Only): Review their open-ended response for genuine intent signals (don't over-weight this, use for context)
11. Agent Commitment (NEW): Did they confirm openness to speaking with an agent? (Should always be true, reduce score if false)
12. Communication Quality: Are responses detailed and thoughtful?
13. Behavioral Signals: Consider engagement patterns, hesitation, completion time
14. Bot Detection: Reduce score significantly if bot-like behavior detected

Provide your JSON response now:`;
  }

  /**
   * Seller-specific scoring prompt
   */
  private static getSellerPrompt(data: ScoringPromptData): string {
    const { responses, contact, behaviorMetrics } = data;

    let behaviorSection = '';
    if (behaviorMetrics) {
      const behaviors = [];
      if (behaviorMetrics.behavior_summary?.fast_filler) {
        behaviors.push('Completed form very quickly (possible low engagement)');
      }
      if (behaviorMetrics.behavior_summary?.hesitant) {
        behaviors.push('Made multiple edits to answers (thoughtful or uncertain)');
      }
      if (behaviorMetrics.behavior_summary?.likely_bot) {
        behaviors.push('WARNING: Possible bot activity detected');
      }
      if (behaviorMetrics.interaction_metrics?.copy_paste_flag) {
        behaviors.push('Used copy/paste (possible duplicate submission)');
      }
      if (behaviorMetrics.timing_metrics?.total_form_time_ms) {
        const minutes = Math.round(behaviorMetrics.timing_metrics.total_form_time_ms / 60000);
        behaviors.push(`Total time spent: ${minutes} minute(s)`);
      }
      
      if (behaviors.length > 0) {
        behaviorSection = `\n\nBehavioral Analysis:\n${behaviors.map(b => `- ${b}`).join('\n')}`;
      }
    }

    return `SELLER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Seller Details:
${Object.entries(responses)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}${behaviorSection}

Scoring Factors to Consider:
1. Timeline to Sell (Critical): How soon do they need to sell? (ASAP/1-3 months = high, 6+ months = low)
2. Commitment Level (NEW): If agreed on price/timing, would they be ready to list? (yes = high, possibly = medium, not-yet = lower)
3. Reality Check (NEW): Are they open to pricing based on current market data? (yes = high, depends/not-sure = medium-low - shows flexibility vs rigidity)
4. Motivation: Why selling? (relocating, financial, inherited = varied urgency)
5. Property Condition: Move-in ready/minor repairs (high) vs major repairs needed (lower)
6. Estimated Value: Realistic property value expectations
7. Occupancy Status: Owner-occupied, tenant, or vacant
8. Pricing Expectations: Are they realistic about market value?
9. Important Factors (NEW - Context Only): Review their open-ended response for genuine intent signals
10. Agent Commitment (NEW): Did they confirm openness to speaking with an agent? (Should always be true)
11. Already Working with Agent?: Fresh lead vs already engaged
12. Property Type: Straightforward sale vs complex situation
13. Communication Quality: Detailed responses indicate serious intent
14. Behavioral Signals: Consider engagement patterns and bot detection

Provide your JSON response now:`;
  }

  /**
   * Parse AI response text to extract JSON
   */
  private static parseAIResponse(text: string): AIScoreResponse {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (
      typeof parsed.lead_score !== 'number' ||
      parsed.lead_score < 1 ||
      parsed.lead_score > 10
    ) {
      throw new Error('Invalid lead_score in AI response');
    }

    if (!['buyer', 'seller'].includes(parsed.lead_type)) {
      throw new Error('Invalid lead_type in AI response');
    }

    if (typeof parsed.reason !== 'string' || parsed.reason.length < 10) {
      throw new Error('Invalid or missing reason in AI response');
    }

    return {
      lead_score: Math.round(parsed.lead_score), // Ensure integer
      lead_type: parsed.lead_type,
      reason: parsed.reason,
    };
  }

  /**
   * Validate lead responses before scoring
   */
  static validateLeadData(data: ScoringPromptData): string[] {
    const errors: string[] = [];

    if (!data.leadType || !['buyer', 'seller'].includes(data.leadType)) {
      errors.push('Invalid lead type');
    }

    if (!data.contact?.name || data.contact.name.length < 2) {
      errors.push('Invalid contact name');
    }

    if (!data.contact?.email || !data.contact.email.includes('@')) {
      errors.push('Invalid contact email');
    }

    if (!data.contact?.phone || data.contact.phone.length < 10) {
      errors.push('Invalid contact phone');
    }

    if (!data.responses || Object.keys(data.responses).length < 3) {
      errors.push('Insufficient lead responses (minimum 3 questions required)');
    }

    return errors;
  }
}
