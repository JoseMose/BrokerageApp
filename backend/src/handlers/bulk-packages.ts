import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent } from '../utils/types';

const config = getConfig();

/**
 * Bulk Packages Handler
 * Handles bulk lead package creation (admin) and purchase (agents)
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Bulk packages request:', event);

    const httpMethod = event.httpMethod;
    const path = event.path;

    // Admin endpoints
    if (path.includes('/admin/bulk-packages')) {
      // TODO: Verify admin role from Cognito groups
      
      // POST /admin/bulk-packages - Create new package
      if (httpMethod === 'POST') {
        return await createBulkPackage(event);
      }

      // GET /admin/bulk-packages - List all packages
      if (httpMethod === 'GET') {
        return await listAllPackages();
      }

      return ResponseBuilder.error('Invalid admin request', 400);
    }

    // Agent endpoints
    const agentId = RequestValidator.getUserId(event);

    // GET /bulk-packages - List available packages for purchase
    if (httpMethod === 'GET' && !event.pathParameters?.packageId) {
      return await getAvailablePackages(agentId);
    }

    // POST /bulk-packages/{packageId}/purchase - Purchase a package
    if (httpMethod === 'POST' && event.pathParameters?.packageId && path.includes('/purchase')) {
      return await purchaseBulkPackage(agentId, event.pathParameters.packageId);
    }

    // POST /bulk-packages/custom - Purchase custom count of leads from pool
    if (httpMethod === 'POST' && path.endsWith('/bulk-packages/custom')) {
      return await purchaseCustomBulkLeads(agentId, event);
    }

    return ResponseBuilder.error('Invalid request', 400);
  } catch (error: any) {
    console.error('Bulk packages error:', error);
    return ResponseBuilder.serverError('Failed to process bulk package request', error);
  }
};

/**
 * Create a new bulk package (Admin only)
 */
async function createBulkPackage(event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<{
      name: string;
      description: string;
      leadCount: number;
      pricePerLead: number;
      minScore?: number;
      maxScore?: number;
      leadType?: 'buyer' | 'seller';
    }>(event);

    // Validate required fields
    RequestValidator.validateRequired({
      name: body.name,
      leadCount: body.leadCount,
      pricePerLead: body.pricePerLead,
    });

    // Generate package ID
    const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Query available bulk leads (score 1-4, not claimed)
    const bulkLeads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      '#status = :available AND score >= :minScore AND score <= :maxScore',
      {
        ':available': 'available',
        ':minScore': body.minScore || 1,
        ':maxScore': body.maxScore || 4,
      },
      {
        '#status': 'status',
      }
    );

    // Filter by lead type if specified
    let filteredLeads = bulkLeads;
    if (body.leadType) {
      filteredLeads = bulkLeads.filter((lead: any) => lead.leadType === body.leadType);
    }

    // Filter out expired and already claimed leads
    const now_ts = Math.floor(Date.now() / 1000);
    const availableLeads = filteredLeads.filter((lead: any) => {
      return !lead.claimedBy && (!lead.expiresAt || lead.expiresAt > now_ts);
    });

    if (availableLeads.length < body.leadCount) {
      return ResponseBuilder.error(
        `Not enough bulk leads available. Requested: ${body.leadCount}, Available: ${availableLeads.length}`,
        400
      );
    }

    // Select leads for this package
    const selectedLeads = availableLeads.slice(0, body.leadCount);
    const leadIds = selectedLeads.map((lead: any) => lead.leadId);

    // Calculate total price
    const totalPrice = body.leadCount * body.pricePerLead;
    const regularPrice = body.leadCount * 20; // $20 base price per lead
    const discount = regularPrice - totalPrice;
    const discountPercent = Math.round((discount / regularPrice) * 100);

    // Create package
    const bulkPackage = {
      packageId,
      PK: packageId,
      SK: 'metadata',
      name: body.name,
      description: body.description,
      leadCount: body.leadCount,
      leadIds: leadIds,
      pricePerLead: body.pricePerLead,
      totalPrice: totalPrice,
      regularPrice: regularPrice,
      discount: discount,
      discountPercent: discountPercent,
      status: 'available',
      purchasedBy: null,
      purchasedAt: null,
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 days
      leadType: body.leadType || 'mixed',
      scoreRange: {
        min: body.minScore || 1,
        max: body.maxScore || 4,
      },
    };

    await DynamoDBService.putItem(config.LEADS_TABLE_NAME, bulkPackage);

    return ResponseBuilder.success({
      package: bulkPackage,
      message: 'Bulk package created successfully',
    });
  } catch (error) {
    console.error('Create bulk package error:', error);
    throw error;
  }
}

/**
 * Get available packages for agents to purchase
 */
async function getAvailablePackages(agentId: string) {
  try {
    // Get agent profile to check preferences
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.error('Agent profile not found', 404);
    }

    // Query for available bulk packages using StatusTypeIndex
    const packages = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'GSI1PK = :pk',
      { ':pk': 'available#bulk-package' },
      'StatusTypeIndex'
    );

    // Filter out expired packages
    const now = Math.floor(Date.now() / 1000);
    const activePackages = packages.filter((pkg: any) => {
      return !pkg.expiresAt || pkg.expiresAt > now;
    });

    // Count available low-score leads (score 4 or below, not claimed)
    const lowScoreLeads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      '#status = :available AND score <= :maxScore',
      {
        ':available': 'available',
        ':maxScore': 4,
      },
      {
        '#status': 'status',
      }
    );

    return ResponseBuilder.success({
      packages: activePackages,
      total: activePackages.length,
      availableLowScoreLeads: lowScoreLeads.length,
    });
  } catch (error) {
    console.error('Get available packages error:', error);
    throw error;
  }
}

/**
 * Purchase a bulk package
 */
async function purchaseBulkPackage(agentId: string, packageId: string) {
  try {
    // Get package
    const bulkPackage = await DynamoDBService.getItem(config.LEADS_TABLE_NAME, {
      PK: packageId,
      SK: 'metadata',
    });

    if (!bulkPackage) {
      return ResponseBuilder.notFound('Package not found');
    }

    if (bulkPackage.status !== 'available') {
      return ResponseBuilder.error('Package is no longer available', 410);
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (bulkPackage.expiresAt && bulkPackage.expiresAt < now) {
      return ResponseBuilder.error('Package has expired', 410);
    }

    // TODO: Process payment via Stripe
    // For now, we'll simulate successful payment

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create transaction record
    const transaction = {
      transactionId,
      timestamp,
      agentId,
      packageId: bulkPackage.packageId,
      type: 'bulk_package',
      leadCount: bulkPackage.leadCount,
      leadIds: bulkPackage.leadIds,
      amount: bulkPackage.totalPrice,
      discount: bulkPackage.discount,
      status: 'completed',
      paymentMethod: 'stripe', // TODO: actual payment method
      createdAt: timestamp,
    };

    await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, transaction);

    // Update package status
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { PK: packageId, SK: 'metadata' },
      'SET #status = :purchased, purchasedBy = :agentId, purchasedAt = :now, transactionId = :txnId',
      {
        ':purchased': 'purchased',
        ':agentId': agentId,
        ':now': timestamp,
        ':txnId': transactionId,
      },
      {
        '#status': 'status',
      }
    );

    // Mark all leads in package as claimed
    const updatePromises = bulkPackage.leadIds.map((leadId: string) =>
      DynamoDBService.scanItems(
        config.LEADS_TABLE_NAME,
        'leadId = :leadId',
        { ':leadId': leadId }
      ).then((leads) => {
        if (leads.length > 0) {
          const lead = leads[0];
          return DynamoDBService.updateItem(
            config.LEADS_TABLE_NAME,
            { leadId: lead.leadId, timestamp: lead.timestamp },
            'SET #status = :claimed, claimedBy = :agentId, claimedAt = :now, transactionId = :txnId',
            {
              ':claimed': 'claimed',
              ':agentId': agentId,
              ':now': timestamp,
              ':txnId': transactionId,
            },
            {
              '#status': 'status',
            }
          );
        }
        return Promise.resolve();
      })
    );

    await Promise.all(updatePromises);

    // Get full lead details for response
    const leadDetailsPromises = bulkPackage.leadIds.map((leadId: string) =>
      DynamoDBService.scanItems(config.LEADS_TABLE_NAME, 'leadId = :leadId', {
        ':leadId': leadId,
      })
    );

    const leadResults = await Promise.all(leadDetailsPromises);
    const leads = leadResults.map((result) => result[0]).filter(Boolean);

    return ResponseBuilder.success({
      transaction,
      package: bulkPackage,
      leads,
      message: `Successfully purchased ${bulkPackage.leadCount} leads for ${bulkPackage.totalPrice}`,
    });
  } catch (error) {
    console.error('Purchase bulk package error:', error);
    throw error;
  }
}

/**
 * Purchase custom count of leads from available pool
 */
async function purchaseCustomBulkLeads(agentId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody(event);
    
    if (!body.leadCount || body.leadCount < 1) {
      return ResponseBuilder.error('Lead count must be at least 1', 400);
    }

    if (!body.pricePerLead || body.pricePerLead < 0) {
      return ResponseBuilder.error('Price per lead is required', 400);
    }

    // Get available low-score leads (score 4 or below, not claimed)
    const allLeads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      '#status = :available AND score <= :maxScore',
      {
        ':available': 'available',
        ':maxScore': 4,
      },
      {
        '#status': 'status',
      }
    );

    // Filter out expired leads
    const now_ts = Math.floor(Date.now() / 1000);
    const availableLeads = allLeads.filter((lead: any) => {
      return !lead.claimedBy && (!lead.expiresAt || lead.expiresAt > now_ts);
    });

    if (availableLeads.length < body.leadCount) {
      return ResponseBuilder.error(
        `Not enough leads available. Requested: ${body.leadCount}, Available: ${availableLeads.length}`,
        400
      );
    }

    // Select the requested number of leads
    const selectedLeads = availableLeads.slice(0, body.leadCount);
    const leadIds = selectedLeads.map((lead: any) => lead.leadId);

    // Calculate total price
    const totalPrice = body.leadCount * body.pricePerLead;
    const regularPrice = body.leadCount * 20;
    const discount = regularPrice - totalPrice;

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create individual transaction records for each lead (for compatibility with getAgentProfile)
    const transactionPromises = selectedLeads.map((lead: any, index: number) => {
      const txn = {
        transactionId: `${transactionId}_${index}`,
        timestamp,
        agentId,
        leadId: lead.leadId, // Single leadId for compatibility
        type: 'custom_bulk',
        leadCount: 1,
        amount: body.pricePerLead,
        status: 'completed',
        paymentMethod: 'stripe',
        createdAt: timestamp,
        bulkTransactionId: transactionId, // Reference to parent bulk transaction
      };
      return DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, txn);
    });

    await Promise.all(transactionPromises);

    // Mark all selected leads as claimed
    const updatePromises = selectedLeads.map((lead: any) =>
      DynamoDBService.updateItem(
        config.LEADS_TABLE_NAME,
        { leadId: lead.leadId, timestamp: lead.timestamp },
        'SET #status = :claimed, claimedBy = :agentId, claimedAt = :now, transactionId = :txnId, funnelStage = :stage',
        {
          ':claimed': 'claimed',
          ':agentId': agentId,
          ':now': timestamp,
          ':txnId': transactionId,
          ':stage': 'new_match',
        },
        {
          '#status': 'status',
        }
      )
    );

    await Promise.all(updatePromises);

    return ResponseBuilder.success({
      transactionId,
      leadCount: body.leadCount,
      totalAmount: totalPrice,
      leads: selectedLeads,
      message: `Successfully purchased ${body.leadCount} leads for $${totalPrice}`,
    });
  } catch (error) {
    console.error('Purchase custom bulk leads error:', error);
    throw error;
  }
}

/**
 * List all packages (admin view)
 */
async function listAllPackages() {
  try {
    const packages = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      'SK = :metadata',
      {
        ':metadata': 'metadata',
      }
    );

    const bulkPackages = packages.filter((pkg: any) => pkg.packageId);

    return ResponseBuilder.success({
      packages: bulkPackages,
      total: bulkPackages.length,
    });
  } catch (error) {
    console.error('List all packages error:', error);
    throw error;
  }
}
