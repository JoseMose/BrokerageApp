import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator, isExpired } from '../utils/helpers';
import { getConfig, APIGatewayEvent, Lead, Agent, Transaction } from '../utils/types';

const config = getConfig();

/**
 * Admin Handler
 * Handles administrative operations: manage leads, agents, analytics, refunds
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Admin request:', {
      method: event.httpMethod,
      path: event.path,
      queryParams: event.queryStringParameters,
      groups: event.requestContext?.authorizer?.claims?.['cognito:groups']
    });

    // Verify admin access
    if (!RequestValidator.isAdmin(event)) {
      console.error('Admin access denied - not in Admin group');
      return ResponseBuilder.forbidden('Admin access required');
    }

    const httpMethod = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET /admin?action=dashboard - Get dashboard overview
    if (httpMethod === 'GET' && queryParams.action === 'dashboard') {
      console.log('Calling getDashboard');
      return await getDashboard();
    }

    // GET /admin?action=leads - List all leads with filters
    if (httpMethod === 'GET' && queryParams.action === 'leads') {
      console.log('Calling listAllLeads');
      return await listAllLeads(queryParams);
    }

    // GET /admin?action=agents - List all agents
    if (httpMethod === 'GET' && queryParams.action === 'agents') {
      console.log('Calling listAllAgents');
      return await listAllAgents(queryParams);
    }

    // GET /admin?action=transactions - List all transactions
    if (httpMethod === 'GET' && queryParams.action === 'transactions') {
      console.log('Calling listAllTransactions');
      return await listAllTransactions(queryParams);
    }

    // GET /admin?action=analytics - Get analytics charts data
    if (httpMethod === 'GET' && queryParams.action === 'analytics') {
      console.log('Calling getAnalytics');
      return await getAnalytics(queryParams);
    }

    // GET /admin?action=agent-performance - Get agent leaderboard
    if (httpMethod === 'GET' && queryParams.action === 'agent-performance') {
      console.log('Calling getAgentPerformance');
      return await getAgentPerformance();
    }

    // GET /admin?action=verification-requests - Get pending verification requests
    if (httpMethod === 'GET' && queryParams.action === 'verification-requests') {
      console.log('Calling getVerificationRequests');
      return await getVerificationRequests();
    }

    // POST /admin - Admin actions (suspend agent, refund, etc.)
    if (httpMethod === 'POST') {
      console.log('Calling handleAdminAction');
      return await handleAdminAction(event);
    }

    console.error('No matching admin route found');
    return ResponseBuilder.error('Invalid admin request', 400);
  } catch (error: any) {
    console.error('Admin handler error:', error);
    return ResponseBuilder.serverError('Admin operation failed', error);
  }
};

/**
 * Get admin dashboard overview
 */
async function getDashboard() {
  try {
    // Get all leads
    const allLeads = await DynamoDBService.scanItems(config.LEADS_TABLE_NAME);

    // Get all agents
    const allAgents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      'SK = :sk',
      { ':sk': 'profile' }
    );

    // Get all transactions
    const allTransactions = await DynamoDBService.scanItems(config.TRANSACTIONS_TABLE_NAME);

    // Calculate statistics
    const stats = {
      leads: {
        total: allLeads.length,
        available: allLeads.filter((l: Lead) => l.status === 'available' && !isExpired(l.expiresAt))
          .length,
        sold: allLeads.filter((l: Lead) => l.status === 'sold').length,
        expired: allLeads.filter((l: Lead) => isExpired(l.expiresAt) && l.status !== 'sold').length,
        buyers: allLeads.filter((l: Lead) => l.leadType === 'buyer').length,
        sellers: allLeads.filter((l: Lead) => l.leadType === 'seller').length,
        averageScore:
          allLeads.reduce((sum: number, l: Lead) => sum + l.score, 0) / allLeads.length || 0,
      },
      agents: {
        total: allAgents.length,
        active: allAgents.filter((a: Agent) => a.status === 'active').length,
        suspended: allAgents.filter((a: Agent) => a.status === 'suspended').length,
      },
      revenue: {
        total: allTransactions
          .filter((t: Transaction) => t.status === 'completed')
          .reduce((sum: number, t: Transaction) => sum + t.amount, 0),
        thisMonth: allTransactions
          .filter(
            (t: Transaction) =>
              t.status === 'completed' &&
              new Date(t.createdAt).getMonth() === new Date().getMonth()
          )
          .reduce((sum: number, t: Transaction) => sum + t.amount, 0),
        refunded: allTransactions
          .filter((t: Transaction) => t.status === 'refunded')
          .reduce((sum: number, t: Transaction) => sum + t.amount, 0),
      },
      transactions: {
        total: allTransactions.length,
        completed: allTransactions.filter((t: Transaction) => t.status === 'completed').length,
        pending: allTransactions.filter((t: Transaction) => t.status === 'pending').length,
        refunded: allTransactions.filter((t: Transaction) => t.status === 'refunded').length,
      },
    };

    // Recent activity
    const recentLeads = allLeads
      .sort((a: Lead, b: Lead) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const recentTransactions = allTransactions
      .sort(
        (a: Transaction, b: Transaction) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10);

    return ResponseBuilder.success({
      stats: {
        totalLeads: stats.leads.total,
        totalRevenue: stats.revenue.total,
        totalAgents: stats.agents.total,
        totalTransactions: stats.transactions.total,
      },
      detailedStats: stats,
      recentLeads,
      recentTransactions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    throw error;
  }
}

/**
 * List all leads with filters
 */
async function listAllLeads(queryParams: any) {
  try {
    let leads = await DynamoDBService.scanItems(config.LEADS_TABLE_NAME);

    // Apply filters
    if (queryParams.status) {
      leads = leads.filter((l: Lead) => l.status === queryParams.status);
    }

    if (queryParams.leadType) {
      leads = leads.filter((l: Lead) => l.leadType === queryParams.leadType);
    }

    if (queryParams.minScore) {
      leads = leads.filter((l: Lead) => l.score >= parseInt(queryParams.minScore));
    }

    if (queryParams.maxScore) {
      leads = leads.filter((l: Lead) => l.score <= parseInt(queryParams.maxScore));
    }

    // Sort by creation date (newest first)
    leads.sort(
      (a: Lead, b: Lead) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const page = parseInt(queryParams.page || '1');
    const limit = parseInt(queryParams.limit || '50');
    const startIndex = (page - 1) * limit;
    const paginatedLeads = leads.slice(startIndex, startIndex + limit);

    return ResponseBuilder.success({
      leads: paginatedLeads,
      pagination: {
        total: leads.length,
        page,
        limit,
        totalPages: Math.ceil(leads.length / limit),
      },
    });
  } catch (error) {
    console.error('List leads error:', error);
    throw error;
  }
}

/**
 * List all agents
 */
async function listAllAgents(queryParams: any) {
  try {
    let agents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      'SK = :sk',
      { ':sk': 'profile' }
    );

    // Apply filters
    if (queryParams.status) {
      agents = agents.filter((a: Agent) => a.status === queryParams.status);
    }

    // Sort by creation date (newest first)
    agents.sort(
      (a: Agent, b: Agent) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const page = parseInt(queryParams.page || '1');
    const limit = parseInt(queryParams.limit || '50');
    const startIndex = (page - 1) * limit;
    const paginatedAgents = agents.slice(startIndex, startIndex + limit);

    return ResponseBuilder.success({
      agents: paginatedAgents,
      pagination: {
        total: agents.length,
        page,
        limit,
        totalPages: Math.ceil(agents.length / limit),
      },
    });
  } catch (error) {
    console.error('List agents error:', error);
    throw error;
  }
}

/**
 * List all transactions
 */
async function listAllTransactions(queryParams: any) {
  try {
    let transactions = await DynamoDBService.scanItems(config.TRANSACTIONS_TABLE_NAME);

    // Apply filters
    if (queryParams.status) {
      transactions = transactions.filter((t: Transaction) => t.status === queryParams.status);
    }

    if (queryParams.agentId) {
      transactions = transactions.filter((t: Transaction) => t.agentId === queryParams.agentId);
    }

    // Sort by creation date (newest first)
    transactions.sort(
      (a: Transaction, b: Transaction) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const page = parseInt(queryParams.page || '1');
    const limit = parseInt(queryParams.limit || '50');
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    return ResponseBuilder.success({
      transactions: paginatedTransactions,
      pagination: {
        total: transactions.length,
        page,
        limit,
        totalPages: Math.ceil(transactions.length / limit),
      },
    });
  } catch (error) {
    console.error('List transactions error:', error);
    throw error;
  }
}

/**
 * Handle admin actions
 */
async function handleAdminAction(event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<any>(event);

    RequestValidator.validateRequired({
      action: body.action,
    });

    switch (body.action) {
      case 'suspend_agent':
        return await suspendAgent(body.agentId, body.reason);

      case 'activate_agent':
        return await activateAgent(body.agentId);

      case 'approve_agent':
        return await approveAgent(body.agentId, event.requestContext.authorizer.claims.sub);

      case 'deny_agent':
        return await denyAgent(body.agentId, body.reason, event.requestContext.authorizer.claims.sub);

      case 'delete_lead':
        return await deleteLead(body.leadId);

      case 'update_lead_status':
        return await updateLeadStatus(body.leadId, body.status);

      case 'refund_transaction':
        return await refundTransaction(body.transactionId, body.reason);

      default:
        return ResponseBuilder.error('Unknown admin action', 400);
    }
  } catch (error) {
    console.error('Handle admin action error:', error);
    throw error;
  }
}

/**
 * Suspend an agent
 */
async function suspendAgent(agentId: string, reason: string) {
  if (!agentId) {
    return ResponseBuilder.error('agentId is required');
  }

  await DynamoDBService.updateItem(
    config.AGENTS_TABLE_NAME,
    { agentId, SK: 'profile' },
    'SET #status = :status, suspensionReason = :reason, updatedAt = :updatedAt',
    {
      ':status': 'suspended',
      ':reason': reason || 'Suspended by admin',
      ':updatedAt': new Date().toISOString(),
    },
    {
      '#status': 'status',
    }
  );

  return ResponseBuilder.success({
    message: 'Agent suspended successfully',
    agentId,
  });
}

/**
 * Activate an agent
 */
async function activateAgent(agentId: string) {
  if (!agentId) {
    return ResponseBuilder.error('agentId is required');
  }

  await DynamoDBService.updateItem(
    config.AGENTS_TABLE_NAME,
    { agentId, SK: 'profile' },
    'SET #status = :status, updatedAt = :updatedAt REMOVE suspensionReason',
    {
      ':status': 'active',
      ':updatedAt': new Date().toISOString(),
    },
    {
      '#status': 'status',
    }
  );

  return ResponseBuilder.success({
    message: 'Agent activated successfully',
    agentId,
  });
}

/**
 * Delete a lead
 */
async function deleteLead(leadId: string) {
  if (!leadId) {
    return ResponseBuilder.error('leadId is required');
  }

  // In production, you might want to soft-delete instead
  await DynamoDBService.updateItem(
    config.LEADS_TABLE_NAME,
    { leadId, timestamp: leadId },
    'SET #status = :status, updatedAt = :updatedAt',
    {
      ':status': 'deleted',
      ':updatedAt': new Date().toISOString(),
    },
    {
      '#status': 'status',
    }
  );

  return ResponseBuilder.success({
    message: 'Lead deleted successfully',
    leadId,
  });
}

/**
 * Update lead status
 */
async function updateLeadStatus(leadId: string, status: string) {
  if (!leadId || !status) {
    return ResponseBuilder.error('leadId and status are required');
  }

  if (!['available', 'sold', 'expired', 'deleted'].includes(status)) {
    return ResponseBuilder.error('Invalid status');
  }

  await DynamoDBService.updateItem(
    config.LEADS_TABLE_NAME,
    { leadId, timestamp: leadId },
    'SET #status = :status, updatedAt = :updatedAt',
    {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    },
    {
      '#status': 'status',
    }
  );

  return ResponseBuilder.success({
    message: 'Lead status updated successfully',
    leadId,
    status,
  });
}

/**
 * Refund a transaction (admin override)
 */
async function refundTransaction(transactionId: string, reason: string) {
  if (!transactionId) {
    return ResponseBuilder.error('transactionId is required');
  }

  // Update transaction status
  await DynamoDBService.updateItem(
    config.TRANSACTIONS_TABLE_NAME,
    { transactionId, timestamp: transactionId },
    'SET #status = :status, refundedAt = :refundedAt, refundReason = :reason',
    {
      ':status': 'refunded',
      ':refundedAt': new Date().toISOString(),
      ':reason': reason || 'Refunded by admin',
    },
    {
      '#status': 'status',
    }
  );

  // Note: Actual Stripe refund should be initiated separately

  return ResponseBuilder.success({
    message: 'Transaction marked as refunded',
    transactionId,
    note: 'Please process the Stripe refund separately',
  });
}

/**
 * Get analytics charts data
 */
async function getAnalytics(queryParams: any) {
  try {
    const allLeads = await DynamoDBService.scanItems(config.LEADS_TABLE_NAME);
    const allTransactions = await DynamoDBService.scanItems(config.TRANSACTIONS_TABLE_NAME);

    // Leads generated over time (last 6 months)
    const leadsOverTime = generateTimeSeriesData(allLeads, 6, 'month');

    // Revenue by month (last 6 months)
    const revenueByMonth = generateRevenueByMonth(allTransactions, 6);

    // Lead score distribution
    const scoreDistribution = {
      '1-3': allLeads.filter((l: Lead) => l.score >= 1 && l.score <= 3).length,
      '4-5': allLeads.filter((l: Lead) => l.score >= 4 && l.score <= 5).length,
      '6-7': allLeads.filter((l: Lead) => l.score >= 6 && l.score <= 7).length,
      '8-10': allLeads.filter((l: Lead) => l.score >= 8 && l.score <= 10).length,
    };

    // Lead type breakdown
    const leadTypeBreakdown = {
      buyer: allLeads.filter((l: Lead) => l.leadType === 'buyer').length,
      seller: allLeads.filter((l: Lead) => l.leadType === 'seller').length,
    };

    // Status breakdown
    const statusBreakdown = {
      available: allLeads.filter((l: Lead) => l.status === 'available').length,
      sold: allLeads.filter((l: Lead) => l.status === 'sold').length,
      assigned: allLeads.filter((l: Lead) => l.status === 'assigned').length,
      expired: allLeads.filter((l: Lead) => isExpired(l.expiresAt)).length,
    };

    return ResponseBuilder.success({
      leadsOverTime,
      revenueByMonth,
      scoreDistribution,
      leadTypeBreakdown,
      statusBreakdown,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    throw error;
  }
}

/**
 * Get agent performance leaderboard
 */
async function getAgentPerformance() {
  try {
    const allAgents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      'SK = :sk',
      { ':sk': 'profile' }
    );

    const allTransactions = await DynamoDBService.scanItems(config.TRANSACTIONS_TABLE_NAME);

    // Calculate performance metrics for each agent
    const agentPerformance = allAgents.map((agent: Agent) => {
      const agentTransactions = allTransactions.filter(
        (t: Transaction) => t.agentId === agent.agentId && t.status === 'completed'
      );

      return {
        agentId: agent.agentId,
        name: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.email,
        email: agent.email,
        status: agent.status,
        metrics: {
          totalPurchases: agentTransactions.length,
          totalSpent: agentTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0),
          averageLeadScore:
            agentTransactions.reduce((sum: number, t: Transaction) => sum + (t.leadScore || 0), 0) /
              agentTransactions.length || 0,
          joinedDate: agent.createdAt,
          lastActivity: agent.lastActivityAt || agent.createdAt,
        },
      };
    });

    // Sort by total purchases (descending)
    agentPerformance.sort((a, b) => b.metrics.totalPurchases - a.metrics.totalPurchases);

    return ResponseBuilder.success({
      leaderboard: agentPerformance.slice(0, 20), // Top 20
      totalAgents: agentPerformance.length,
    });
  } catch (error) {
    console.error('Get agent performance error:', error);
    throw error;
  }
}

/**
 * Helper: Generate time series data for leads
 */
function generateTimeSeriesData(leads: Lead[], months: number, interval: 'day' | 'month') {
  const now = new Date();
  const data: any[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    
    const leadsInMonth = leads.filter((l: Lead) => {
      const leadDate = new Date(l.createdAt);
      return (
        leadDate.getMonth() === date.getMonth() && 
        leadDate.getFullYear() === date.getFullYear()
      );
    });

    data.push({
      period: monthName,
      count: leadsInMonth.length,
      buyers: leadsInMonth.filter((l: Lead) => l.leadType === 'buyer').length,
      sellers: leadsInMonth.filter((l: Lead) => l.leadType === 'seller').length,
    });
  }

  return data;
}

/**
 * Helper: Generate revenue by month
 */
function generateRevenueByMonth(transactions: Transaction[], months: number) {
  const now = new Date();
  const data: any[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    
    const transactionsInMonth = transactions.filter((t: Transaction) => {
      const txDate = new Date(t.createdAt);
      return (
        t.status === 'completed' &&
        txDate.getMonth() === date.getMonth() && 
        txDate.getFullYear() === date.getFullYear()
      );
    });

    const revenue = transactionsInMonth.reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    data.push({
      period: monthName,
      revenue,
      transactions: transactionsInMonth.length,
    });
  }

  return data;
}

/**
 * Approve agent verification
 */
async function approveAgent(agentId: string, adminUserId: string) {
  if (!agentId) {
    return ResponseBuilder.error('agentId is required');
  }

  const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
    agentId,
    SK: 'profile',
  });

  if (!agent) {
    return ResponseBuilder.notFound('Agent not found');
  }

  if (agent.verificationStatus !== 'pending') {
    return ResponseBuilder.error('Agent is not pending verification');
  }

  const timestamp = new Date().toISOString();

  await DynamoDBService.updateItem(
    config.AGENTS_TABLE_NAME,
    { agentId, SK: 'profile' },
    'SET verificationStatus = :status, verificationReviewedAt = :reviewedAt, verificationReviewedBy = :reviewedBy, updatedAt = :updatedAt',
    {
      ':status': 'approved',
      ':reviewedAt': timestamp,
      ':reviewedBy': adminUserId,
      ':updatedAt': timestamp,
    }
  );

  // Send approval email
  const EmailService = require('../utils/email-service').EmailService;
  EmailService.sendWelcomeEmail(agent.email, agent.name, '').catch((err: any) => {
    console.error('Failed to send approval email:', err);
  });

  // Send approval SMS
  if (agent.phone) {
    const SMSService = require('../utils/sms-service').SMSService;
    SMSService.sendWelcomeSMS(agent.phone, agent.name).catch((err: any) => {
      console.error('Failed to send approval SMS:', err);
    });
  }

  return ResponseBuilder.success({
    message: 'Agent approved successfully',
    agentId,
  });
}

/**
 * Deny agent verification
 */
async function denyAgent(agentId: string, reason: string, adminUserId: string) {
  if (!agentId) {
    return ResponseBuilder.error('agentId is required');
  }

  if (!reason) {
    return ResponseBuilder.error('Denial reason is required');
  }

  const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
    agentId,
    SK: 'profile',
  });

  if (!agent) {
    return ResponseBuilder.notFound('Agent not found');
  }

  if (agent.verificationStatus !== 'pending') {
    return ResponseBuilder.error('Agent is not pending verification');
  }

  const timestamp = new Date().toISOString();

  await DynamoDBService.updateItem(
    config.AGENTS_TABLE_NAME,
    { agentId, SK: 'profile' },
    'SET verificationStatus = :status, verificationDenialReason = :reason, verificationReviewedAt = :reviewedAt, verificationReviewedBy = :reviewedBy, updatedAt = :updatedAt',
    {
      ':status': 'denied',
      ':reason': reason,
      ':reviewedAt': timestamp,
      ':reviewedBy': adminUserId,
      ':updatedAt': timestamp,
    }
  );

  // Send denial email (could add a separate template for this)
  const EmailService = require('../utils/email-service').EmailService;
  const emailBody = `
    Dear ${agent.name},

    Thank you for your interest in joining the Realtor Lead Platform.

    Unfortunately, we are unable to approve your verification request at this time.

    Reason: ${reason}

    If you believe this is an error or would like to provide additional information, please contact our support team.

    Best regards,
    Realtor Lead Platform Team
  `;

  EmailService.sendEmail(agent.email, 'Verification Request Update', emailBody).catch((err: any) => {
    console.error('Failed to send denial email:', err);
  });

  return ResponseBuilder.success({
    message: 'Agent denied',
    agentId,
  });
}

/**
 * Get verification requests (agents pending approval)
 */
async function getVerificationRequests() {
  try {
    // Get all agents
    const allAgents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      'SK = :sk',
      { ':sk': 'profile' }
    );

    // Filter pending agents and sort by request date
    const pendingAgents = allAgents
      .filter((agent: Agent) => agent.verificationStatus === 'pending')
      .sort((a: Agent, b: Agent) => {
        const dateA = a.verificationRequestedAt || a.createdAt || '';
        const dateB = b.verificationRequestedAt || b.createdAt || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

    return ResponseBuilder.success({
      requests: pendingAgents,
      count: pendingAgents.length,
    });
  } catch (error: any) {
    console.error('Get verification requests error:', error);
    return ResponseBuilder.serverError('Failed to get verification requests', error);
  }
}
