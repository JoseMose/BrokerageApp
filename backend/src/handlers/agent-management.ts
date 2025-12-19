import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent, AgentProfileUpdateRequest, Agent } from '../utils/types';
import { EmailService } from '../utils/email-service';
import { SMSService } from '../utils/sms-service';

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

    // Allow profile creation (POST) without verification check
    // Check verification status for all other operations
    if (httpMethod !== 'POST' || path.includes('/activity') || path.includes('/pass-lead')) {
      const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
        agentId,
        SK: 'profile',
      });

      if (!agent) {
        // Agent profile doesn't exist yet - allow GET to return proper error
        if (httpMethod !== 'GET') {
          return ResponseBuilder.error('Please complete your profile setup first', 403);
        }
      } else if (agent.verificationStatus === 'pending') {
        return ResponseBuilder.error(
          'Your account is pending verification. You will receive an email once approved.',
          403
        );
      } else if (agent.verificationStatus === 'denied') {
        return ResponseBuilder.error(
          'Your verification request was denied. Please contact support for more information.',
          403
        );
      }
    }

    // POST /agents/leads/{leadId}/activity - Log activity for a lead
    if (httpMethod === 'POST' && path.includes('/agents/leads/') && path.includes('/activity')) {
      const leadId = event.pathParameters?.leadId;
      if (!leadId) {
        return ResponseBuilder.error('Lead ID required', 400);
      }
      return await logLeadActivity(agentId, leadId, event);
    }

    // PUT /agents/leads/{leadId} - Update lead funnel stage or full lead data
    if (httpMethod === 'PUT' && path.includes('/agents/leads/')) {
      const leadId = event.pathParameters?.leadId;
      if (!leadId) {
        return ResponseBuilder.error('Lead ID required', 400);
      }
      const body = RequestValidator.parseBody(event);
      // If only funnelStage, update stage. Otherwise, update full lead
      if (body.funnelStage && Object.keys(body).length === 1) {
        return await updateLeadFunnelStage(agentId, leadId, event);
      } else {
        return await updateFullLead(agentId, leadId, event);
      }
    }

    // DELETE /agents/leads/{leadId} - Delete a lead
    if (httpMethod === 'DELETE' && path.includes('/agents/leads/')) {
      const leadId = event.pathParameters?.leadId;
      if (!leadId) {
        return ResponseBuilder.error('Lead ID required', 400);
      }
      return await deleteLead(agentId, leadId);
    }

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

    // POST /agents/create-lead - Create own lead
    if (httpMethod === 'POST' && path.includes('/create-lead')) {
      return await createOwnLead(agentId, event);
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

    // PUT /agents/status - Update online/offline status
    if (httpMethod === 'PUT' && path.includes('/status')) {
      return await updateAgentStatus(agentId, event);
    }

    // PUT /agents/capacity - Update max capacity
    if (httpMethod === 'PUT' && path.includes('/capacity')) {
      return await updateAgentCapacity(agentId, event);
    }

    // GET /agents/assignments - Get assignment history
    if (httpMethod === 'GET' && path.includes('/assignments')) {
      return await getAssignmentHistory(agentId);
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

    // Get ALL leads owned by this agent (claimed, purchased, or created)
    // Query by assignedAgent (no SK needed for leads table)
    const allLeads = await DynamoDBService.scanItems(
      config.LEADS_TABLE_NAME,
      'assignedAgent = :agentId',
      {
        ':agentId': agentId,
      }
    );

    console.log(`Found ${allLeads.length} total leads for agent ${agentId}`);

    // Get transactions for these leads (if they exist)
    const transactions = await DynamoDBService.queryItems(
      config.TRANSACTIONS_TABLE_NAME,
      'agentId = :agentId',
      {
        ':agentId': agentId,
      },
      'AgentTransactionsIndex'
    );

    const transactionMap = new Map();
    transactions.forEach((tx: any) => {
      if (tx.leadId) {
        transactionMap.set(tx.leadId, tx);
      }
      if (tx.leadIds && Array.isArray(tx.leadIds)) {
        tx.leadIds.forEach((lid: string) => {
          transactionMap.set(lid, { ...tx, leadId: lid });
        });
      }
    });

    // Build leads with their transaction details (if they have one)
    const leadsWithDetails = allLeads.map((lead: any) => ({
      transaction: transactionMap.get(lead.leadId) || {
        leadId: lead.leadId,
        agentId: agentId,
        amount: lead.price || 0,
        status: 'completed',
        createdAt: lead.claimedAt || lead.createdAt,
        source: lead.source || 'unknown',
      },
      lead: lead,
    }));

    console.log(`Returning ${leadsWithDetails.length} leads with details for agent ${agentId}`);

    return ResponseBuilder.success({
      profile: agent,
      purchasedLeads: leadsWithDetails,
      stats: {
        totalPurchased: leadsWithDetails.length,
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
      licenseState: body.licenseState,
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
      licenseState: body.licenseState?.toUpperCase(),
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
      roundRobin: {
        lastAssignedAt: undefined,
        assignedLeadCount: 0,
        maxCapacity: 10, // Default max capacity
        isOnline: true, // Online by default
      },
      status: 'active',
      verificationStatus: 'pending',
      verificationRequestedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await DynamoDBService.putItem(config.AGENTS_TABLE_NAME, agent);

    console.log('Agent profile created:', agentId);

    // Don't send welcome email/SMS yet - wait for approval
    // Email/SMS will be sent after admin approves the account

    return ResponseBuilder.success(
      {
        profile: agent,
        message: 'Profile submitted successfully. Your account is pending verification and will be reviewed by an administrator.',
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
      if (body.radius < 5 || body.radius > 1000) {
        return ResponseBuilder.error('Radius must be between 5 and 1000 miles');
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
      '#status = :active AND #sk = :profile',
      { ':active': 'active', ':profile': 'profile' },
      { '#status': 'status', '#sk': 'SK' }
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

/**
 * Update lead funnel stage
 */
async function updateLeadFunnelStage(agentId: string, leadId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<{ funnelStage: string }>(event);
    
    if (!body.funnelStage) {
      return ResponseBuilder.error('funnelStage is required', 400);
    }

    // Valid funnel stages
    const validStages = [
      'new_match',
      'first_outreach',
      'connected',
      'qualified',
      'appointment_set',
      'active_client',
      'under_contract',
      'closed',
      'nurture'
    ];

    if (!validStages.includes(body.funnelStage)) {
      return ResponseBuilder.error('Invalid funnel stage', 400);
    }

    // Get the lead
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      { ':leadId': leadId }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0];

    // Verify the lead belongs to this agent
    if (lead.claimedBy !== agentId && lead.assignedTo !== agentId && lead.assignedAgent !== agentId) {
      return ResponseBuilder.forbidden('You do not have permission to update this lead');
    }

    // Update the lead's funnel stage
    const timestamp = new Date().toISOString();
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId: lead.leadId, timestamp: lead.timestamp },
      'SET funnelStage = :stage, updatedAt = :now',
      {
        ':stage': body.funnelStage,
        ':now': timestamp
      }
    );

    console.log(`Lead ${leadId} funnel stage updated to ${body.funnelStage} by agent ${agentId}`);

    return ResponseBuilder.success({
      message: 'Lead funnel stage updated successfully',
      leadId,
      funnelStage: body.funnelStage
    });
  } catch (error) {
    console.error('Update lead funnel stage error:', error);
    throw error;
  }
}

/**
 * Update full lead data (all fields)
 */
async function updateFullLead(agentId: string, leadId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody(event);

    // Get the lead
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      { ':leadId': leadId }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0];

    // Verify the lead belongs to this agent
    if (lead.claimedBy !== agentId && lead.assignedTo !== agentId && lead.assignedAgent !== agentId) {
      return ResponseBuilder.forbidden('You do not have permission to update this lead');
    }

    // Build the update expression dynamically
    const updateParts: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    // Fields that can be updated
    const updatableFields = [
      'firstName', 'lastName', 'email', 'phone',
      'propertyAddress', 'city', 'state', 'zipCode',
      'leadType', 'buyingTimeframe', 'priceRange',
      'prequalified', 'currentlyOwnHome', 'workingWithAgent',
      'additionalInfo', 'funnelStage'
    ];

    let fieldCount = 0;
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateParts.push(`#field${fieldCount} = :val${fieldCount}`);
        expressionAttributeNames[`#field${fieldCount}`] = field;
        expressionAttributeValues[`:val${fieldCount}`] = body[field];
        fieldCount++;
      }
    }

    if (updateParts.length === 0) {
      return ResponseBuilder.error('No valid fields to update', 400);
    }

    // Add updatedAt timestamp
    updateParts.push('updatedAt = :now');
    expressionAttributeValues[':now'] = new Date().toISOString();

    const updateExpression = 'SET ' + updateParts.join(', ');

    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId: lead.leadId, timestamp: lead.timestamp },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    console.log(`Lead ${leadId} updated by agent ${agentId}`);

    return ResponseBuilder.success({
      message: 'Lead updated successfully',
      leadId
    });
  } catch (error) {
    console.error('Update full lead error:', error);
    throw error;
  }
}

/**
 * Delete a lead
 */
async function deleteLead(agentId: string, leadId: string) {
  try {
    // Get the lead
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      { ':leadId': leadId }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0];

    // Verify the lead belongs to this agent
    if (lead.claimedBy !== agentId && lead.assignedTo !== agentId && lead.assignedAgent !== agentId) {
      return ResponseBuilder.forbidden('You do not have permission to delete this lead');
    }

    // Delete the lead
    await DynamoDBService.deleteItem(
      config.LEADS_TABLE_NAME,
      { leadId: lead.leadId, timestamp: lead.timestamp }
    );

    console.log(`Lead ${leadId} deleted by agent ${agentId}`);

    return ResponseBuilder.success({
      message: 'Lead deleted successfully',
      leadId
    });
  } catch (error: any) {
    console.error('Delete lead error:', error);
    if (error.message?.includes('permission')) {
      return ResponseBuilder.forbidden('You do not have permission to delete this lead');
    }
    return ResponseBuilder.serverError('Failed to delete lead', error);
  }
}

/**
 * Log activity for a lead
 */
async function logLeadActivity(agentId: string, leadId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<{
      id: number;
      type: string;
      notes: string;
      timestamp: string;
    }>(event);

    if (!body.type || !body.notes || !body.timestamp) {
      return ResponseBuilder.error('Activity type, notes, and timestamp are required', 400);
    }

    // Valid activity types
    const validTypes = ['call', 'text', 'email', 'appointment'];
    if (!validTypes.includes(body.type)) {
      return ResponseBuilder.error('Invalid activity type', 400);
    }

    // Get the lead
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      { ':leadId': leadId }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0];

    // Verify the lead belongs to this agent
    if (lead.claimedBy !== agentId && lead.assignedTo !== agentId) {
      return ResponseBuilder.forbidden('You do not have permission to update this lead');
    }

    // Get existing activities or initialize empty array
    const existingActivities = lead.activities || [];
    
    // Add new activity
    const newActivity = {
      id: body.id || Date.now(),
      type: body.type,
      notes: body.notes,
      timestamp: body.timestamp,
      loggedBy: agentId
    };
    
    const updatedActivities = [...existingActivities, newActivity];

    // Update the lead with new activity
    const timestamp = new Date().toISOString();
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId: lead.leadId, timestamp: lead.timestamp },
      'SET activities = :activities, lastActivityAt = :now, updatedAt = :now',
      {
        ':activities': updatedActivities,
        ':now': timestamp
      }
    );

    console.log(`Activity logged for lead ${leadId} by agent ${agentId}: ${body.type}`);

    return ResponseBuilder.success({
      message: 'Activity logged successfully',
      leadId,
      activity: newActivity
    });
  } catch (error) {
    console.error('Log lead activity error:', error);
    throw error;
  }
}

/**
 * Update agent online/offline status
 */
async function updateAgentStatus(agentId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<any>(event);

    RequestValidator.validateRequired({
      isOnline: body.isOnline,
    });

    if (typeof body.isOnline !== 'boolean') {
      return ResponseBuilder.error('isOnline must be a boolean', 400);
    }

    // Update agent status
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId, SK: 'profile' },
      'SET roundRobin.isOnline = :isOnline, updatedAt = :now',
      {
        ':isOnline': body.isOnline,
        ':now': new Date().toISOString(),
      }
    );

    console.log(`Agent ${agentId} status updated to: ${body.isOnline ? 'online' : 'offline'}`);

    return ResponseBuilder.success({
      message: `Agent status updated to ${body.isOnline ? 'online' : 'offline'}`,
      isOnline: body.isOnline,
    });
  } catch (error) {
    console.error('Update agent status error:', error);
    throw error;
  }
}

/**
 * Update agent max capacity
 */
async function updateAgentCapacity(agentId: string, event: APIGatewayEvent) {
  try {
    const body = RequestValidator.parseBody<any>(event);

    RequestValidator.validateRequired({
      maxCapacity: body.maxCapacity,
    });

    const capacity = parseInt(body.maxCapacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 100) {
      return ResponseBuilder.error('maxCapacity must be between 1 and 100', 400);
    }

    // Update agent capacity
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId, SK: 'profile' },
      'SET roundRobin.maxCapacity = :maxCapacity, updatedAt = :now',
      {
        ':maxCapacity': capacity,
        ':now': new Date().toISOString(),
      }
    );

    console.log(`Agent ${agentId} max capacity updated to: ${capacity}`);

    return ResponseBuilder.success({
      message: `Max capacity updated to ${capacity}`,
      maxCapacity: capacity,
    });
  } catch (error) {
    console.error('Update agent capacity error:', error);
    throw error;
  }
}

/**
 * Create own lead - allows agents to manually add leads they acquired
 */
async function createOwnLead(agentId: string, event: APIGatewayEvent) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { contact, leadType, location, budget, notes, questionnaire } = body;

    // Validate required fields
    if (!contact?.name || !contact?.email || !contact?.phone) {
      return ResponseBuilder.error('Name, email, and phone are required', 400);
    }

    if (!leadType || !['buyer', 'seller'].includes(leadType)) {
      return ResponseBuilder.error('Valid lead type (buyer/seller) is required', 400);
    }

    // Get agent profile to verify they're verified
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.error('Agent profile not found', 404);
    }

    // Generate lead ID
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Extract budget from questionnaire if provided
    const leadBudget = questionnaire?.budget || budget || '';

    // Create lead object
    const lead = {
      leadId,
      timestamp: now, // Required for primary key
      leadType,
      status: 'claimed', // Directly claimed by the agent
      funnelStage: 'new_match', // Start at first funnel stage
      assignedAgent: agentId,
      claimedAt: now,
      createdAt: now,
      updatedAt: now,
      source: 'agent_manual',
      score: 5, // Default score for manually created leads
      price: 0, // No cost for self-generated leads
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
      location: location || {},
      responses: {
        budget: leadBudget,
      },
      notes: notes || '',
      activities: [],
    };

    console.log(`Creating lead for agent ${agentId}:`, JSON.stringify(lead, null, 2));

    // Save lead to DynamoDB
    await DynamoDBService.putItem(config.LEADS_TABLE_NAME, lead);

    console.log(`Successfully saved lead ${leadId} to DynamoDB`);

    // Update agent's performance metrics
    try {
      await DynamoDBService.updateItem(
        config.AGENTS_TABLE_NAME,
        { agentId, SK: 'profile' },
        'ADD performanceMetrics.selfGeneratedLeads :one',
        { ':one': 1 }
      );
      console.log(`Updated agent ${agentId} performance metrics`);
    } catch (updateError) {
      console.error('Error updating agent metrics:', updateError);
      // Don't fail the whole operation if metrics update fails
    }

    console.log(`Agent ${agentId} created own lead: ${leadId}`);

    return ResponseBuilder.success({
      message: 'Lead created successfully',
      lead: {
        leadId,
        leadType,
        status: lead.status,
        funnelStage: lead.funnelStage,
        contact: lead.contact,
        location: lead.location,
        createdAt: lead.createdAt,
      },
    });
  } catch (error) {
    console.error('Create own lead error:', error);
    throw error;
  }
}

/**
 * Get assignment history for an agent
 */
async function getAssignmentHistory(agentId: string) {
  try {
    // Query all assignment records for this agent
    const assignments = await DynamoDBService.queryItems(
      config.AGENTS_TABLE_NAME,
      'agentId = :agentId AND begins_with(SK, :skPrefix)',
      {
        ':agentId': agentId,
        ':skPrefix': 'assignment#',
      }
    );

    // Sort by assigned date (most recent first)
    const sortedAssignments = assignments.sort((a: any, b: any) => 
      b.assignedAt.localeCompare(a.assignedAt)
    );

    // Get lead details for each assignment
    const enrichedAssignments = await Promise.all(
      sortedAssignments.map(async (assignment: any) => {
        const leads = await DynamoDBService.queryItems(
          config.LEADS_TABLE_NAME,
          'leadId = :leadId',
          {
            ':leadId': assignment.leadId,
          }
        );

        const lead = leads.length > 0 ? leads[0] : null;

        return {
          assignmentId: assignment.assignmentId,
          leadId: assignment.leadId,
          assignedAt: assignment.assignedAt,
          assignmentType: assignment.assignmentType,
          status: assignment.status,
          totalMatches: assignment.totalMatches,
          leadInfo: lead ? {
            leadType: lead.leadType,
            score: lead.score,
            price: lead.price,
            location: lead.location,
            currentStatus: lead.status,
            funnelStage: lead.funnelStage,
          } : null,
        };
      })
    );

    console.log(`Retrieved ${enrichedAssignments.length} assignments for agent ${agentId}`);

    return ResponseBuilder.success({
      assignments: enrichedAssignments,
      total: enrichedAssignments.length,
    });
  } catch (error) {
    console.error('Get assignment history error:', error);
    throw error;
  }
}
