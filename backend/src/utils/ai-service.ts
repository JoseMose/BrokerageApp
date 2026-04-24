/**
 * AI Service — IBM WatsonX AI (replaces AWS Bedrock and Anthropic SDK)
 * Model: ibm/granite-13b-instruct-v2
 * Same public interface; handlers require zero changes.
 */

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';
import { AIScoreResponse, BehaviorMetrics } from './types';

const REGION     = process.env.WATSONX_REGION     || 'us-south';
const MODEL_ID   = process.env.WATSONX_MODEL_ID   || 'ibm/granite-13b-instruct-v2';
const PROJECT_ID = process.env.WATSONX_PROJECT_ID || '';

function getClient(): WatsonXAI {
  return WatsonXAI.newInstance({
    authenticator: new IamAuthenticator({
      apikey: process.env.WATSONX_API_KEY || '',
    }),
    serviceUrl: `https://${REGION}.ml.cloud.ibm.com`,
    version: '2024-01-29',
  });
}

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
   * Score a lead using IBM WatsonX AI (Granite).
   */
  static async scoreLead(data: ScoringPromptData): Promise<AIScoreResponse> {
    const prompt = AIService.buildPrompt(data);
    const client = getClient();

    const response = await client.generateText({
      input: prompt,
      modelId: MODEL_ID,
      projectId: PROJECT_ID,
      parameters: {
        decoding_method: 'greedy',
        max_new_tokens: 500,
        temperature: 0.3,
        repetition_penalty: 1.1,
        stop_sequences: ['\n\n\n'],
      },
    });

    const text: string =
      (response.result as any).results?.[0]?.generated_text || '';

    if (!text) throw new Error('Empty response from WatsonX AI');

    return AIService.parseAIResponse(text);
  }

  // ── Prompt builders (identical to original Bedrock prompts) ──────────────

  private static buildPrompt(data: ScoringPromptData): string {
    const base = `You are an expert real estate lead qualification specialist. Analyze the following lead and provide a quality score from 1-10, where:

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
    return data.leadType === 'buyer'
      ? base + AIService.getBuyerPrompt(data)
      : base + AIService.getSellerPrompt(data);
  }

  private static getBuyerPrompt(data: ScoringPromptData): string {
    const { responses, contact, behaviorMetrics } = data;
    const behaviorSection = AIService.formatBehavior(behaviorMetrics);

    return `BUYER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Buyer Details:
${Object.entries(responses).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}${behaviorSection}

Scoring Factors to Consider:
1. Pre-approval Status (Critical): Is the buyer pre-approved? Pre-approved = higher score
2. Commitment Level: If found the right home, how soon would they make an offer?
3. Search Activity: Have they been actively looking?
4. Timeline: How soon are they looking to buy? (ASAP/1-3 months = high, 6+ months = low)
5. Budget Clarity: Do they have a clear budget and price range?
6. Motivation: Why are they buying?
7. Current Housing: Are they renting (easier) or need to sell first (complex)?
8. Agent Commitment: Did they confirm openness to speaking with an agent?
9. Communication Quality: Are responses detailed and thoughtful?
10. Behavioral Signals: Consider engagement patterns, bot detection

Provide your JSON response now:`;
  }

  private static getSellerPrompt(data: ScoringPromptData): string {
    const { responses, contact, behaviorMetrics } = data;
    const behaviorSection = AIService.formatBehavior(behaviorMetrics);

    return `SELLER LEAD ANALYSIS

Contact Information:
- Name: ${contact.name}
- Email: ${contact.email}
- Phone: ${contact.phone}

Seller Details:
${Object.entries(responses).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}${behaviorSection}

Scoring Factors to Consider:
1. Timeline to Sell (Critical): How soon do they need to sell?
2. Commitment Level: If agreed on price/timing, would they be ready to list?
3. Reality Check: Are they open to pricing based on current market data?
4. Motivation: Why selling? (relocating, financial, inherited = varied urgency)
5. Property Condition: Move-in ready (high) vs major repairs needed (lower)
6. Pricing Expectations: Are they realistic about market value?
7. Occupancy Status: Owner-occupied, tenant, or vacant
8. Agent Commitment: Did they confirm openness to speaking with an agent?
9. Communication Quality: Detailed responses indicate serious intent
10. Behavioral Signals: Engagement patterns and bot detection

Provide your JSON response now:`;
  }

  private static formatBehavior(metrics?: BehaviorMetrics | null): string {
    if (!metrics) return '';
    const signals: string[] = [];
    if (metrics.behavior_summary?.fast_filler)
      signals.push('Completed form very quickly (possible low engagement)');
    if (metrics.behavior_summary?.hesitant)
      signals.push('Made multiple edits to answers (thoughtful or uncertain)');
    if (metrics.behavior_summary?.likely_bot)
      signals.push('WARNING: Possible bot activity detected');
    if (metrics.interaction_metrics?.copy_paste_flag)
      signals.push('Used copy/paste (possible duplicate submission)');
    if (metrics.timing_metrics?.total_form_time_ms) {
      const minutes = Math.round(metrics.timing_metrics.total_form_time_ms / 60000);
      signals.push(`Total time spent: ${minutes} minute(s)`);
    }
    return signals.length
      ? `\n\nBehavioral Analysis:\n${signals.map(s => `- ${s}`).join('\n')}`
      : '';
  }

  // ── Response parser ───────────────────────────────────────────────────────

  private static parseAIResponse(text: string): AIScoreResponse {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in WatsonX AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    if (typeof parsed.lead_score !== 'number' || parsed.lead_score < 1 || parsed.lead_score > 10)
      throw new Error('Invalid lead_score in AI response');
    if (!['buyer', 'seller'].includes(parsed.lead_type))
      throw new Error('Invalid lead_type in AI response');
    if (typeof parsed.reason !== 'string' || parsed.reason.length < 10)
      throw new Error('Invalid or missing reason in AI response');

    return {
      lead_score: Math.round(parsed.lead_score),
      lead_type:  parsed.lead_type,
      reason:     parsed.reason,
    };
  }

  // ── Validation ────────────────────────────────────────────────────────────

  static validateLeadData(data: ScoringPromptData): string[] {
    const errors: string[] = [];
    if (!data.leadType || !['buyer', 'seller'].includes(data.leadType))
      errors.push('Invalid lead type');
    if (!data.contact?.name || data.contact.name.length < 2)
      errors.push('Invalid contact name');
    if (!data.contact?.email || !data.contact.email.includes('@'))
      errors.push('Invalid contact email');
    if (!data.contact?.phone || data.contact.phone.length < 10)
      errors.push('Invalid contact phone');
    if (!data.responses || Object.keys(data.responses).length < 3)
      errors.push('Insufficient lead responses (minimum 3 questions required)');
    return errors;
  }
}
