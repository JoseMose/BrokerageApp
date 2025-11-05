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
    console.log('Admin request:', event.httpMethod, event.path);

    // Verify admin access
    if (!RequestValidator.isAdmin(event)) {
      return ResponseBuilder.forbidden('Admin access required');
    }

    const httpMethod = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET /admin?action=dashboard - Get dashboard overview
    if (httpMethod === 'GET' && queryParams.action === 'dashboard') {
      return await getDashboard();
    }

    // GET /admin?action=leads - List all leads with filters
    if (httpMethod === 'GET' && queryParams.action === 'leads') {
      return await listAllLeads(queryParams);
    }

    // GET /admin?action=agents - List all agents
    if (httpMethod === 'GET' && queryParams.action === 'agents') {
      return await listAllAgents(queryParams);
    }

    // GET /admin?action=transactions - List all transactions
    if (httpMethod === 'GET' && queryParams.action === 'transactions') {
      return await listAllTransactions(queryParams);
    }

    // POST /admin - Admin actions (suspend agent, refund, etc.)
    if (httpMethod === 'POST') {
      return await handleAdminAction(event);
    }

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
      stats,
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
