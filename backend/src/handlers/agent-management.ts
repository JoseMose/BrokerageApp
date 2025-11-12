import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent, AgentProfileUpdateRequest, Agent } from '../utils/types';

const config = getConfig();

/**
 * Agent Management Handler
 * Handles agent profile creation, updates, and retrieval
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Agent management request:', event.httpMethod, event.path);

    const agentId = RequestValidator.getUserId(event);
    const httpMethod = event.httpMethod;
    const path = event.path;

    // GET /agents/assigned-leads - Get assigned leads
    if (httpMethod === 'GET' && path.includes('/assigned-leads')) {
      return await getAssignedLeads(agentId);
    }

    // POST /agents/pass-lead/{leadId} - Pass lead to next agent
    if (httpMethod === 'POST' && path.includes('/pass-lead/')) {
      const leadId = event.pathParameters?.leadId;
      if (!leadId) {
        return ResponseBuilder.error('Lead ID required', 400);
      }
      return await passLeadToNext(agentId, leadId);
    }

    // GET /agents - Get agent profile
    if (httpMethod === 'GET') {
      return await getAgentProfile(agentId);
    }

    // POST /agents - Create agent profile (first-time setup)
    if (httpMethod === 'POST') {
      return await createAgentProfile(agentId, event);
    }

    // PUT /agents - Update agent profile
    if (httpMethod === 'PUT') {
      return await updateAgentProfile(agentId, event);
    }

    return ResponseBuilder.error('Invalid request method', 405);
  } catch (error: any) {
    console.error('Agent management error:', error);
    return ResponseBuilder.serverError('Failed to process agent request', error);
  }
};

/**
 * Get agent profile
 */
async function getAgentProfile(agentId: string) {
  try {
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.notFound('Agent profile not found. Please complete your profile setup.');
    }

    // Get agent's purchased leads
    const transactions = await DynamoDBService.queryItems(
      config.TRANSACTIONS_TABLE_NAME,
      'agentId = :agentId',
      {
        ':agentId': agentId,
      },
      'AgentTransactionsIndex'
    );

    const purchasedLeads = transactions.filter(
      (tx: any) => tx.status === 'completed'
    );

    // Get full lead details for purchased leads
    const leadsWithDetails = await Promise.all(
      purchasedLeads.slice(0, 20).map(async (tx: any) => {
        const leads = await DynamoDBService.queryItems(
          config.LEADS_TABLE_NAME,
          'leadId = :leadId',
          {
            ':leadId': tx.leadId,
          }
        );

        return {
          transaction: tx,
          lead: leads[0] || null,
        };
      })
    );

    return ResponseBuilder.success({
      profile: agent,
      purchasedLeads: leadsWithDetails,
      stats: {
        totalPurchased: purchasedLeads.length,
        totalSpent: agent.performanceMetrics?.totalSpent || 0,
        conversionRate: agent.performanceMetrics?.conversionRate || 0,
      },
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    throw error;
  }
}

/**
 * Get agent's assigned leads (auto-assigned via round-robin)
 */
async function getAssignedLeads(agentId: string) {
  try {
    // Scan for leads assigned to this agent
    // TODO: Add GSI on assignedTo for better performance
    const leads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      'assignedTo = :agentId AND #status = :status',
      {
        ':agentId': agentId,
        ':status': 'assigned',
      },
      {
        '#status': 'status',
      }
    );

    // Filter out expired leads and format response
    const now = Math.floor(Date.now() / 1000);
    const activeLeads = leads
      .filter((lead: any) => {
        // Check if not expired
        if (lead.expiresAt && lead.expiresAt < now) {
          return false;
        }
        // Check if not already claimed
        if (lead.claimedBy) {
          return false;
        }
        return true;
      })
      .map((lead: any) => ({
        leadId: lead.leadId,
        leadType: lead.leadType,
        score: lead.score,
        price: lead.price,
        aiReason: lead.aiReason,
        contact: {
          name: lead.contact?.name, // Show name for assigned leads
        },
        location: {
          city: lead.location.city,
          state: lead.location.state,
          zip: lead.location.zip,
        },
        assignedAt: lead.assignedAt,
        createdAt: lead.createdAt,
        expiresAt: lead.expiresAt,
        responses: lead.responses,
      }));

    return ResponseBuilder.success({
      leads: activeLeads,
      total: activeLeads.length,
    });
  } catch (error) {
    console.error('Get assigned leads error:', error);
    throw error;
  }
}

/**
 * Create new agent profile
 */
async function createAgentProfile(agentId: string, event: APIGatewayEvent) {
  try {
    const email = RequestValidator.getUserEmail(event);
    const body = RequestValidator.parseBody<AgentProfileUpdateRequest>(event);

    // Check if profile already exists
    const existingAgent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (existingAgent) {
      return ResponseBuilder.error('Agent profile already exists. Use PUT to update.', 409);
    }

    // Validate required fields
    RequestValidator.validateRequired({
      name: body.name,
      licenseId: body.licenseId,
      brokerage: body.brokerage,
      phone: body.phone,
      'location.address': body.location?.address,
      'location.city': body.location?.city,
      'location.state': body.location?.state,
      'location.zip': body.location?.zip,
    });

    // Validate formats
    if (!RequestValidator.validatePhone(body.phone!)) {
      return ResponseBuilder.error('Invalid phone number format');
    }

    if (!RequestValidator.validateZipCode(body.location!.zip)) {
      return ResponseBuilder.error('Invalid zip code format');
    }

    // Geocode agent location
    const coordinates = await LocationService.geocodeAddress(
      body.location!.address,
      body.location!.city,
      body.location!.state,
      body.location!.zip
    );

    // Create agent profile
    const timestamp = new Date().toISOString();

    const agent: Agent = {
      agentId,
      SK: 'profile',
      email,
      name: body.name!,
      licenseId: body.licenseId!,
      brokerage: body.brokerage!,
      phone: body.phone!.replace(/\D/g, ''),
      location: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: body.location!.address,
        city: body.location!.city,
        state: body.location!.state.toUpperCase(),
        zip: body.location!.zip,
      },
      radius: body.radius || config.DEFAULT_RADIUS_MILES,
      preferences: {
        leadTypes: body.preferences?.leadTypes || ['buyer', 'seller'],
        minScore: body.preferences?.minScore || 5,
        maxPrice: body.preferences?.maxPrice || 200,
        propertyTypes: body.preferences?.propertyTypes || ['residential'],
        priceRange: body.preferences?.priceRange || { min: 0, max: 10000000 },
      },
      performanceMetrics: {
        leadsOwned: 0,
        leadsConverted: 0,
        conversionRate: 0,
        totalSpent: 0,
      },
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await DynamoDBService.putItem(config.AGENTS_TABLE_NAME, agent);

    console.log('Agent profile created:', agentId);

    return ResponseBuilder.success(
      {
        profile: agent,
        message: 'Agent profile created successfully',
      },
      201
    );
  } catch (error) {
    console.error('Create agent profile error:', error);
    throw error;
  }
}

/**
 * Update agent profile
 */
async function updateAgentProfile(agentId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<AgentProfileUpdateRequest>(event);

    // Get existing profile
    const existingAgent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!existingAgent) {
      return ResponseBuilder.notFound('Agent profile not found. Use POST to create.');
    }

    // Build update expression
    const updateParts: string[] = [];
    const expressionValues: any = {};
    const expressionNames: any = {};

    if (body.name) {
      updateParts.push('#name = :name');
      expressionValues[':name'] = body.name;
      expressionNames['#name'] = 'name';
    }

    if (body.phone) {
      if (!RequestValidator.validatePhone(body.phone)) {
        return ResponseBuilder.error('Invalid phone number format');
      }
      updateParts.push('phone = :phone');
      expressionValues[':phone'] = body.phone.replace(/\D/g, '');
    }

    if (body.licenseId) {
      updateParts.push('licenseId = :licenseId');
      expressionValues[':licenseId'] = body.licenseId;
    }

    if (body.brokerage) {
      updateParts.push('brokerage = :brokerage');
      expressionValues[':brokerage'] = body.brokerage;
    }

    if (body.radius !== undefined) {
      if (body.radius < 5 || body.radius > 40) {
        return ResponseBuilder.error('Radius must be between 5 and 40 miles');
      }
      updateParts.push('radius = :radius');
      expressionValues[':radius'] = body.radius;
    }

    // Handle location update
    if (body.location) {
      if (!RequestValidator.validateZipCode(body.location.zip)) {
        return ResponseBuilder.error('Invalid zip code format');
      }

      const coordinates = await LocationService.geocodeAddress(
        body.location.address,
        body.location.city,
        body.location.state,
        body.location.zip
      );

      updateParts.push('#location = :location');
      expressionValues[':location'] = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: body.location.address,
        city: body.location.city,
        state: body.location.state.toUpperCase(),
        zip: body.location.zip,
      };
      expressionNames['#location'] = 'location';
    }

    // Handle preferences update
    if (body.preferences) {
      const currentPrefs = existingAgent.preferences || {};
      const updatedPrefs = { ...currentPrefs, ...body.preferences };

      updateParts.push('preferences = :preferences');
      expressionValues[':preferences'] = updatedPrefs;
    }

    // Add updated timestamp
    updateParts.push('updatedAt = :updatedAt');
    expressionValues[':updatedAt'] = new Date().toISOString();

    if (updateParts.length === 1) {
      // Only updatedAt
      return ResponseBuilder.error('No fields to update', 400);
    }

    // Update agent profile
    const updatedAgent = await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId, SK: 'profile' },
      `SET ${updateParts.join(', ')}`,
      expressionValues,
      Object.keys(expressionNames).length > 0 ? expressionNames : undefined
    );

    console.log('Agent profile updated:', agentId);

    return ResponseBuilder.success({
      profile: updatedAgent,
      message: 'Agent profile updated successfully',
    });
  } catch (error) {
    console.error('Update agent profile error:', error);
    throw error;
  }
}

/**
 * Pass an assigned lead to the next agent in round-robin
 */
async function passLeadToNext(currentAgentId: string, leadId: string) {
  try {
    // Get the lead
    const leads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId AND #status = :assigned',
      { ':leadId': leadId, ':assigned': 'assigned' },
      { '#status': 'status' }
    );

    if (!leads || leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found or not assigned');
    }

    const lead = leads[0];

    // Verify this lead is assigned to the current agent
    if (lead.assignedTo !== currentAgentId) {
      return ResponseBuilder.forbidden('You can only pass leads assigned to you');
    }

    // Get all active agents (same logic as round-robin)
    const allAgents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      '#status = :active AND SK = :profile',
      { ':active': 'active', ':profile': 'profile' },
      { '#status': 'status', 'SK': 'SK' }
    );

    if (!allAgents || allAgents.length === 0) {
      return ResponseBuilder.error('No active agents available', 400);
    }

    // Filter eligible agents (same criteria as original assignment)
    const eligibleAgents = allAgents.filter((agent: any) => {
      // Exclude current agent
      if (agent.agentId === currentAgentId) {
        return false;
      }

      // Check lead type preference
      if (!agent.preferences?.leadTypes?.includes(lead.leadType)) {
        return false;
      }

      // Check distance
      if (agent.location?.lat && agent.location?.lng && lead.location?.lat && lead.location?.lng) {
        const distance = calculateDistance(
          agent.location.lat,
          agent.location.lng,
          lead.location.lat,
          lead.location.lng
        );
        const maxRadius = agent.radius || 50;
        if (distance > maxRadius) {
          return false;
        }
      }

      return true;
    });

    if (eligibleAgents.length === 0) {
      // No other eligible agents - unassign and make available in marketplace
      await DynamoDBService.updateItem(
        config.LEADS_TABLE_NAME,
        { leadId: lead.leadId, timestamp: lead.timestamp },
        'SET #status = :available, assignedTo = :null, assignedAt = :null, GSI1PK = :gsi1pk',
        {
          ':available': 'available',
          ':null': null,
          ':gsi1pk': `available#${lead.leadType}`,
        },
        { '#status': 'status' }
      );

      return ResponseBuilder.success({
        message: 'No other eligible agents found. Lead moved to marketplace.',
        lead: { leadId: lead.leadId, status: 'available' },
      });
    }

    // Sort by lastAssignedAt (oldest first)
    eligibleAgents.sort((a: any, b: any) => {
      const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
      const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
      return aTime - bTime;
    });

    const nextAgent = eligibleAgents[0];
    const now = new Date().toISOString();

    // Update lead assignment
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId: lead.leadId, timestamp: lead.timestamp },
      'SET assignedTo = :agentId, assignedAt = :now, GSI1PK = :gsi1pk',
      {
        ':agentId': nextAgent.agentId,
        ':now': now,
        ':gsi1pk': `assigned#${lead.leadType}`,
      }
    );

    // Update next agent's lastAssignedAt
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId: nextAgent.agentId, SK: 'profile' },
      'SET lastAssignedAt = :now, assignedLeadsCount = if_not_exists(assignedLeadsCount, :zero) + :one',
      {
        ':now': now,
        ':zero': 0,
        ':one': 1,
      }
    );

    // Decrement current agent's assignedLeadsCount
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId: currentAgentId, SK: 'profile' },
      'SET assignedLeadsCount = if_not_exists(assignedLeadsCount, :one) - :one',
      { ':one': 1 }
    );

    console.log(`Lead ${leadId} passed from ${currentAgentId} to ${nextAgent.agentId}`);

    return ResponseBuilder.success({
      message: `Lead successfully passed to next agent`,
      lead: {
        leadId: lead.leadId,
        newAssignee: nextAgent.agentId,
        assignedAt: now,
      },
    });
  } catch (error) {
    console.error('Pass lead error:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
