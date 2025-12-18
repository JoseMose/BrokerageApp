import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent } from '../utils/types';

const config = getConfig();

interface LeadFeedback {
  feedbackId: string;
  leadId: string;
  agentId: string;
  timestamp: string;
  // Quality ratings (1-5 stars)
  contactability: number; // How easy was it to reach the client?
  accuracy: number; // How accurate was the lead information?
  engagement: number; // How engaged was the client?
  conversionPotential: number; // How likely to convert?
  overallQuality: number; // Overall lead quality
  // Additional feedback
  contacted: boolean;
  contactedAt?: string;
  contactMethod?: 'phone' | 'email' | 'text' | 'in-person';
  clientResponsiveness?: 'immediate' | 'same-day' | 'delayed' | 'no-response';
  actualTimeline?: string; // Did timeline match what lead said?
  actualBudget?: string; // Did budget match what lead said?
  comments?: string;
  wouldRecommend: boolean;
  // Flags
  leadDataMismatch: boolean; // Did any info not match?
  mismatchDetails?: string;
}

interface ClientSurvey {
  surveyId: string;
  leadId: string;
  agentId: string;
  timestamp: string;
  // Ratings (1-5)
  agentProfessionalism: number;
  agentResponsiveness: number;
  agentKnowledge: number;
  overallSatisfaction: number;
  // Yes/No questions
  needsMet: boolean;
  wouldRecommendAgent: boolean;
  // Open ended
  positiveExperience?: string;
  improvementSuggestions?: string;
  // Metadata
  completedAt: string;
  source: 'email' | 'sms' | 'web';
}

interface FeedbackStats {
  totalFeedback: number;
  averageQuality: number;
  contactRate: number;
  conversionRate: number;
  recommendationRate: number;
  commonIssues: string[];
  qualityTrend: Array<{ month: string; avgQuality: number }>;
}

/**
 * Feedback Handler
 * Manages lead quality ratings and client satisfaction surveys
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Feedback request:', event.httpMethod, event.path);

    const httpMethod = event.httpMethod;
    const pathParts = event.path.split('/').filter(Boolean);
    const agentId = RequestValidator.getUserId(event);

    // POST /feedback/lead - Submit lead quality feedback
    if (httpMethod === 'POST' && pathParts[1] === 'lead') {
      return await submitLeadFeedback(event, agentId);
    }

    // POST /feedback/survey - Submit client satisfaction survey
    if (httpMethod === 'POST' && pathParts[1] === 'survey') {
      return await submitClientSurvey(event);
    }

    // GET /feedback/lead/:leadId - Get feedback for a specific lead
    if (httpMethod === 'GET' && pathParts[1] === 'lead' && pathParts[2]) {
      return await getLeadFeedback(pathParts[2], agentId);
    }

    // GET /feedback/stats - Get feedback statistics for agent
    if (httpMethod === 'GET' && pathParts[1] === 'stats') {
      return await getFeedbackStats(agentId);
    }

    // GET /feedback/pending - Get leads awaiting feedback
    if (httpMethod === 'GET' && pathParts[1] === 'pending') {
      return await getPendingFeedback(agentId);
    }

    // GET /feedback/analytics - Get AI improvement analytics (admin only)
    if (httpMethod === 'GET' && pathParts[1] === 'analytics') {
      if (!RequestValidator.isAdmin(event)) {
        return ResponseBuilder.forbidden('Admin access required');
      }
      return await getAIAnalytics();
    }

    return ResponseBuilder.error('Invalid feedback request', 400);
  } catch (error: any) {
    console.error('Feedback handler error:', error);
    return ResponseBuilder.error(error.message || 'Internal server error');
  }
};

/**
 * Submit lead quality feedback from agent
 */
async function submitLeadFeedback(event: APIGatewayEvent, agentId: string) {
  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  if (!body.leadId) {
    return ResponseBuilder.error('Lead ID is required', 400);
  }

  // Validate ratings (1-5)
  const ratings = ['contactability', 'accuracy', 'engagement', 'conversionPotential', 'overallQuality'];
  for (const rating of ratings) {
    if (body[rating] && (body[rating] < 1 || body[rating] > 5)) {
      return ResponseBuilder.error(`${rating} must be between 1 and 5`, 400);
    }
  }

  // Verify agent owns this lead
  const transactions = await DynamoDBService.queryItems(
    config.TRANSACTIONS_TABLE_NAME,
    'agentId = :agentId',
    { ':agentId': agentId },
    'AgentTransactionsIndex'
  );

  const ownedLead = transactions.find(
    (t: any) => t.leadId === body.leadId && t.status === 'completed'
  );

  if (!ownedLead) {
    return ResponseBuilder.error('Lead not found or not owned by agent', 403);
  }

  const feedbackId = `FEEDBACK-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();

  const feedback: LeadFeedback = {
    feedbackId,
    leadId: body.leadId,
    agentId,
    timestamp,
    contactability: body.contactability || 0,
    accuracy: body.accuracy || 0,
    engagement: body.engagement || 0,
    conversionPotential: body.conversionPotential || 0,
    overallQuality: body.overallQuality || 0,
    contacted: body.contacted || false,
    contactedAt: body.contactedAt,
    contactMethod: body.contactMethod,
    clientResponsiveness: body.clientResponsiveness,
    actualTimeline: body.actualTimeline,
    actualBudget: body.actualBudget,
    comments: body.comments,
    wouldRecommend: body.wouldRecommend || false,
    leadDataMismatch: body.leadDataMismatch || false,
    mismatchDetails: body.mismatchDetails,
  };

  // Store feedback in DynamoDB
  await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, {
    transactionId: feedbackId,
    timestamp,
    type: 'FEEDBACK',
    ...feedback,
  });

  // Update lead with feedback flag
  await DynamoDBService.updateItem(
    config.LEADS_TABLE_NAME,
    { leadId: body.leadId, timestamp: ownedLead.leadTimestamp || timestamp },
    'SET hasFeedback = :true, feedbackAt = :timestamp',
    { ':true': true, ':timestamp': timestamp }
  );

  // If quality is very low (avg < 2), flag for review
  const avgQuality =
    (feedback.contactability +
      feedback.accuracy +
      feedback.engagement +
      feedback.conversionPotential +
      feedback.overallQuality) /
    5;

  if (avgQuality < 2) {
    console.log('Low quality feedback detected:', {
      leadId: body.leadId,
      avgQuality,
      agentId,
    });
    // TODO: Trigger admin notification
  }

  return ResponseBuilder.success({
    feedbackId,
    message: 'Feedback submitted successfully',
    avgQuality,
  });
}

/**
 * Submit client satisfaction survey
 */
async function submitClientSurvey(event: APIGatewayEvent) {
  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  if (!body.leadId || !body.agentId) {
    return ResponseBuilder.error('Lead ID and Agent ID are required', 400);
  }

  // Validate ratings (1-5)
  const ratings = [
    'agentProfessionalism',
    'agentResponsiveness',
    'agentKnowledge',
    'overallSatisfaction',
  ];
  for (const rating of ratings) {
    if (body[rating] && (body[rating] < 1 || body[rating] > 5)) {
      return ResponseBuilder.error(`${rating} must be between 1 and 5`, 400);
    }
  }

  const surveyId = `SURVEY-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();

  const survey: ClientSurvey = {
    surveyId,
    leadId: body.leadId,
    agentId: body.agentId,
    timestamp,
    agentProfessionalism: body.agentProfessionalism || 0,
    agentResponsiveness: body.agentResponsiveness || 0,
    agentKnowledge: body.agentKnowledge || 0,
    overallSatisfaction: body.overallSatisfaction || 0,
    needsMet: body.needsMet || false,
    wouldRecommendAgent: body.wouldRecommendAgent || false,
    positiveExperience: body.positiveExperience,
    improvementSuggestions: body.improvementSuggestions,
    completedAt: timestamp,
    source: body.source || 'web',
  };

  // Store survey in DynamoDB
  await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, {
    transactionId: surveyId,
    timestamp,
    type: 'SURVEY',
    ...survey,
  });

  // Update agent stats
  const avgSatisfaction =
    (survey.agentProfessionalism +
      survey.agentResponsiveness +
      survey.agentKnowledge +
      survey.overallSatisfaction) /
    4;

  console.log('Client survey submitted:', {
    surveyId,
    agentId: body.agentId,
    avgSatisfaction,
  });

  return ResponseBuilder.success({
    surveyId,
    message: 'Survey submitted successfully',
    avgSatisfaction,
  });
}

/**
 * Get feedback for a specific lead
 */
async function getLeadFeedback(leadId: string, agentId: string) {
  const allFeedback = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    'leadId = :leadId AND #type = :type',
    { ':leadId': leadId, ':type': 'FEEDBACK' },
    { '#type': 'type' }
  );

  const agentFeedback = allFeedback.filter((f: any) => f.agentId === agentId);

  if (agentFeedback.length === 0) {
    return ResponseBuilder.success({
      hasFeedback: false,
      message: 'No feedback found for this lead',
    });
  }

  return ResponseBuilder.success({
    hasFeedback: true,
    feedback: agentFeedback[0],
  });
}

/**
 * Get feedback statistics for agent
 */
async function getFeedbackStats(agentId: string) {
  // Get all feedback from this agent
  const allFeedback = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    'agentId = :agentId AND #type = :type',
    { ':agentId': agentId, ':type': 'FEEDBACK' },
    undefined,
    { '#type': 'type' }
  );

  if (allFeedback.length === 0) {
    return ResponseBuilder.success({
      totalFeedback: 0,
      message: 'No feedback submitted yet',
    });
  }

  // Calculate statistics
  const totalFeedback = allFeedback.length;
  const contacted = allFeedback.filter((f: any) => f.contacted).length;
  const wouldRecommend = allFeedback.filter((f: any) => f.wouldRecommend).length;
  const hasMismatch = allFeedback.filter((f: any) => f.leadDataMismatch).length;

  const avgQuality =
    allFeedback.reduce((sum: number, f: any) => sum + (f.overallQuality || 0), 0) /
    totalFeedback;

  const avgContactability =
    allFeedback.reduce((sum: number, f: any) => sum + (f.contactability || 0), 0) /
    totalFeedback;

  const avgAccuracy =
    allFeedback.reduce((sum: number, f: any) => sum + (f.accuracy || 0), 0) / totalFeedback;

  const avgEngagement =
    allFeedback.reduce((sum: number, f: any) => sum + (f.engagement || 0), 0) / totalFeedback;

  // Quality trend by month
  const monthlyQuality = new Map<string, { sum: number; count: number }>();
  allFeedback.forEach((f: any) => {
    const month = new Date(f.timestamp).toISOString().substring(0, 7); // YYYY-MM
    const current = monthlyQuality.get(month) || { sum: 0, count: 0 };
    monthlyQuality.set(month, {
      sum: current.sum + (f.overallQuality || 0),
      count: current.count + 1,
    });
  });

  const qualityTrend = Array.from(monthlyQuality.entries())
    .map(([month, data]) => ({
      month,
      avgQuality: data.sum / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const stats: FeedbackStats = {
    totalFeedback,
    averageQuality: avgQuality,
    contactRate: (contacted / totalFeedback) * 100,
    conversionRate: 0, // TODO: Calculate from funnel stage
    recommendationRate: (wouldRecommend / totalFeedback) * 100,
    commonIssues: hasMismatch > 0 ? ['Data mismatch reported'] : [],
    qualityTrend,
  };

  return ResponseBuilder.success({
    stats,
    breakdown: {
      avgContactability: avgContactability.toFixed(2),
      avgAccuracy: avgAccuracy.toFixed(2),
      avgEngagement: avgEngagement.toFixed(2),
    },
  });
}

/**
 * Get leads pending feedback
 */
async function getPendingFeedback(agentId: string) {
  // Get all completed transactions for this agent
  const transactions = await DynamoDBService.queryItems(
    config.TRANSACTIONS_TABLE_NAME,
    'agentId = :agentId AND #type = :type',
    { ':agentId': agentId, ':type': 'TRANSACTION' },
    'AgentTransactionsIndex',
    { '#type': 'type' }
  );

  const completedLeads = transactions.filter((t: any) => t.status === 'completed');

  // Get all feedback submitted by this agent
  const submittedFeedback = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    'agentId = :agentId AND #type = :type',
    { ':agentId': agentId, ':type': 'FEEDBACK' },
    undefined,
    { '#type': 'type' }
  );

  const feedbackLeadIds = new Set(submittedFeedback.map((f: any) => f.leadId));

  // Filter leads without feedback
  const pending = completedLeads.filter((t: any) => !feedbackLeadIds.has(t.leadId));

  // Get lead details for pending items
  const pendingWithDetails = await Promise.all(
    pending.slice(0, 20).map(async (t: any) => {
      try {
        const lead = await DynamoDBService.getItem(config.LEADS_TABLE_NAME, {
          leadId: t.leadId,
        });
        return {
          leadId: t.leadId,
          purchasedAt: t.createdAt,
          leadType: lead?.leadType,
          score: lead?.score,
          location: lead?.location,
        };
      } catch (error) {
        return {
          leadId: t.leadId,
          purchasedAt: t.createdAt,
        };
      }
    })
  );

  return ResponseBuilder.success({
    total: pending.length,
    pending: pendingWithDetails,
    message:
      pending.length > 0
        ? `You have ${pending.length} leads awaiting feedback`
        : 'No pending feedback',
  });
}

/**
 * Get AI analytics for model improvement (admin only)
 */
async function getAIAnalytics() {
  // Get all feedback
  const allFeedback = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    '#type = :type',
    { ':type': 'FEEDBACK' },
    undefined,
    { '#type': 'type' }
  );

  if (allFeedback.length === 0) {
    return ResponseBuilder.success({
      message: 'No feedback data available',
      totalFeedback: 0,
    });
  }

  // Analyze AI accuracy by comparing predicted score to actual quality
  const scoreAccuracy = new Map<number, { predicted: number; actual: number; count: number }>();

  for (const feedback of allFeedback) {
    // Get original lead to see AI predicted score
    try {
      const lead = await DynamoDBService.getItem(config.LEADS_TABLE_NAME, {
        leadId: feedback.leadId,
      });

      if (lead && lead.score) {
        const current = scoreAccuracy.get(lead.score) || { predicted: 0, actual: 0, count: 0 };
        scoreAccuracy.set(lead.score, {
          predicted: current.predicted + lead.score,
          actual: current.actual + (feedback.overallQuality || 0),
          count: current.count + 1,
        });
      }
    } catch (error) {
      console.error('Error fetching lead for analytics:', error);
    }
  }

  const accuracyAnalysis = Array.from(scoreAccuracy.entries()).map(([score, data]) => ({
    predictedScore: score,
    avgActualQuality: data.actual / data.count,
    sampleSize: data.count,
    accuracyDelta: Math.abs(score - data.actual / data.count),
  }));

  // Overall metrics
  const avgPredictedAccuracy =
    accuracyAnalysis.reduce((sum, a) => sum + a.accuracyDelta, 0) / accuracyAnalysis.length;

  const highQualityLeads = allFeedback.filter((f: any) => f.overallQuality >= 4).length;
  const lowQualityLeads = allFeedback.filter((f: any) => f.overallQuality <= 2).length;

  return ResponseBuilder.success({
    totalFeedback: allFeedback.length,
    aiAccuracy: {
      avgDelta: avgPredictedAccuracy.toFixed(2),
      byScore: accuracyAnalysis,
    },
    qualityDistribution: {
      high: highQualityLeads,
      medium: allFeedback.length - highQualityLeads - lowQualityLeads,
      low: lowQualityLeads,
    },
    recommendations: [
      avgPredictedAccuracy > 1.5 ? 'Consider retraining AI model with feedback data' : null,
      lowQualityLeads > allFeedback.length * 0.3
        ? 'High percentage of low-quality leads - review scoring criteria'
        : null,
    ].filter(Boolean),
  });
}
