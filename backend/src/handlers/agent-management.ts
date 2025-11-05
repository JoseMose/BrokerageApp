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
