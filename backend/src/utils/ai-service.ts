import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig, AIScoreResponse } from './types';

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
}

export class AIService {
  /**
   * Score a lead using Amazon Bedrock (Nova or Claude models)
   */
  static async scoreLead(data: ScoringPromptData): Promise<AIScoreResponse> {
    try {
      const prompt = this.buildPrompt(data);
      
      // Try primary model (Nova Micro)
      try {
        return await this.invokeModel(config.BEDROCK_MODEL_ID, prompt);
      } catch (error) {
        console.error('Primary model failed, trying fallback:', error);
        // Fallback to Claude if Nova fails
        return await this.invokeModel(config.BEDROCK_FALLBACK_MODEL_ID, prompt);
      }
    } catch (error) {
      console.error('All models failed:', error);
      throw new Error('Failed to score lead with AI');
    }
  }

  /**
   * Invoke a Bedrock model with the scoring prompt
   */
  private static async invokeModel(modelId: string, prompt: string): Promise<AIScoreResponse> {
    const isNovaModel = modelId.includes('nova');
    const isClaude = modelId.includes('claude');

    let requestBody: any;
    
    if (isNovaModel) {
      // Amazon Nova models use this format
      requestBody = {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: 1000,
          temperature: 0.3,
          topP: 0.9,
        },
      };
    } else if (isClaude) {
      // Anthropic Claude models use this format
      requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };
    } else {
      throw new Error(`Unsupported model: ${modelId}`);
    }

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Parse response based on model type
    let textResponse: string;
    
    if (isNovaModel) {
      textResponse = responseBody.output?.message?.content?.[0]?.text || '';
    } else if (isClaude) {
      textResponse = responseBody.content?.[0]?.text || '';
    } else {
      throw new Error('Unexpected model response format');
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
    const { responses, contact } = data;

    return `BUYER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Buyer Details:
${Object.entries(responses)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Scoring Factors to Consider:
1. Pre-approval Status (Critical): Is the buyer pre-approved? Pre-approved = higher score
2. Budget Clarity: Do they have a clear budget and price range?
3. Timeline: How soon are they looking to buy? (30-60 days = high, 6+ months = low)
4. Motivation: Why are they buying? (Urgent relocation = high, just browsing = low)
5. Down Payment: Do they have funds ready?
6. Current Housing: Are they renting (easier) or need to sell first (complex) or first home buyers?
7. Property Preferences: Are their requirements specific and realistic?
8. Communication Quality: Are responses detailed and thoughtful?
9. Employment Stability: Stable income source?
10. First-time Buyer: May need more education (slightly lower initial score)

Provide your JSON response now:`;
  }

  /**
   * Seller-specific scoring prompt
   */
  private static getSellerPrompt(data: ScoringPromptData): string {
    const { responses, contact } = data;

    return `SELLER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Seller Details:
${Object.entries(responses)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Scoring Factors to Consider:
1. Timeline to Sell (Critical): How soon do they need to sell? (30-60 days = high, undecided = low)
2. Motivation: Why selling? (Job relocation/divorce = high, just curious = low)
3. Property Ownership: How long have they owned? (Enough equity built?)
4. Current Mortgage Status: Is it paid off or significant equity available?
5. Property Condition: Move-in ready (high) or needs major work (lower)?
6. Pricing Expectations: Are they realistic about market value?
7. Already Working with Agent?: If not, they're a fresh lead
8. Where Moving To?: Lined up (high urgency) or uncertain (lower)
9. Property Type: Single-family (easier) vs unique property (complex)
10. Communication Quality: Detailed responses indicate serious intent

Provide your JSON response now:`;
  }

  /**
   * Parse AI response text to extract JSON
   */
  private static parseAIResponse(text: string): AIScoreResponse {
    try {
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
    } catch (error) {
      console.error('Failed to parse AI response:', text, error);
      
      // Fallback: return a default moderate score
      return {
        lead_score: 5,
        lead_type: 'buyer',
        reason: 'AI scoring failed, using default moderate score pending manual review',
      };
    }
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
