import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { ResponseBuilder, RequestValidator, isExpired } from '../utils/helpers';
import { getConfig, APIGatewayEvent, MarketplaceQueryParams, Agent, Lead } from '../utils/types';

const config = getConfig();

/**
 * Marketplace Handler
 * Handles viewing available leads, filtering, and lead details
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Marketplace request:', event);

    const agentId = RequestValidator.getUserId(event);
    const httpMethod = event.httpMethod;

    // Get agent profile
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.error('Agent profile not found. Please complete your profile first.', 404);
    }

    if (agent.status !== 'active') {
      return ResponseBuilder.forbidden('Your account is not active. Please contact support.');
    }

    // GET /marketplace - List available leads
    if (httpMethod === 'GET' && !event.pathParameters?.leadId) {
      return await listAvailableLeads(agent, event.queryStringParameters);
    }

    // GET /marketplace/{leadId} - Get lead details
    if (httpMethod === 'GET' && event.pathParameters?.leadId) {
      return await getLeadDetails(agent, event.pathParameters.leadId);
    }

    return ResponseBuilder.error('Invalid request', 400);
  } catch (error: any) {
    console.error('Marketplace error:', error);
    return ResponseBuilder.serverError('Failed to process marketplace request', error);
  }
};

/**
 * List available leads for an agent
 */
async function listAvailableLeads(agent: Agent, queryParams: any) {
  try {
    const params: MarketplaceQueryParams = {
      leadType: queryParams?.leadType,
      minScore: queryParams?.minScore ? parseInt(queryParams.minScore) : undefined,
      maxScore: queryParams?.maxScore ? parseInt(queryParams.maxScore) : undefined,
      maxPrice: queryParams?.maxPrice ? parseInt(queryParams.maxPrice) : undefined,
      radius: queryParams?.radius ? parseInt(queryParams.radius) : agent.radius,
    };

    // Query available leads by type (or both if not specified)
    const leadTypes = params.leadType ? [params.leadType] : ['buyer', 'seller'];
    
    let allLeads: Lead[] = [];

    for (const leadType of leadTypes) {
      // Check if agent accepts this lead type
      if (!agent.preferences.leadTypes.includes(leadType as 'buyer' | 'seller')) {
        continue;
      }

      const leads = await DynamoDBService.queryItems(
        config.LEADS_TABLE_NAME,
        'GSI1PK = :pk',
        {
          ':pk': `available#${leadType}`,
        },
        'StatusTypeIndex'
      );

      allLeads = allLeads.concat(leads);
    }

    // Filter expired leads
    allLeads = allLeads.filter((lead: Lead) => !isExpired(lead.expiresAt));

    // Apply score filters
    if (params.minScore !== undefined) {
      allLeads = allLeads.filter((lead: Lead) => lead.score >= params.minScore!);
    }

    if (params.maxScore !== undefined) {
      allLeads = allLeads.filter((lead: Lead) => lead.score <= params.maxScore!);
    }

    // Apply agent's minimum score preference
    // Note: Standard leads (5-7) that couldn't be auto-assigned are shown regardless of minScore
    // to ensure they're still available as fallback
    allLeads = allLeads.filter((lead: Lead) => {
      // Always show standard leads (5-7) as fallback when they're in marketplace
      if (lead.score >= 5 && lead.score <= 7) {
        return true;
      }
      // For other leads, apply minScore filter
      return lead.score >= agent.preferences.minScore;
    });

    // Apply price filters
    if (params.maxPrice !== undefined) {
      allLeads = allLeads.filter((lead: Lead) => lead.price <= params.maxPrice!);
    }

    // Apply agent's max price preference
    allLeads = allLeads.filter((lead: Lead) => lead.price <= agent.preferences.maxPrice);

    // Calculate distance and filter by radius
    const leadsWithDistance = await Promise.all(
      allLeads.map(async (lead: Lead) => {
        try {
          const distance = await LocationService.calculateDistance(
            { lat: agent.location.lat, lng: agent.location.lng },
            { lat: lead.location.lat, lng: lead.location.lng }
          );
          return { lead, distance };
        } catch (error) {
          // If distance calculation fails (e.g., rate limits), return a default distance
          console.warn(`Distance calculation failed for lead ${lead.leadId}:`, error);
          return { lead, distance: 999 }; // Use a high distance to sort to end
        }
      })
    );

    // Filter by radius (skip filtering if all distances are default due to errors)
    const hasValidDistances = leadsWithDistance.some(({ distance }) => distance < 999);
    console.log(`Total leads after filtering: ${leadsWithDistance.length}, Valid distances: ${hasValidDistances}`);
    
    const leadsWithinRadius = hasValidDistances
      ? leadsWithDistance
          .filter(({ distance }) => distance <= (params.radius || agent.radius))
          .sort((a, b) => b.lead.score - a.lead.score || a.distance - b.distance)
      : leadsWithDistance.sort((a, b) => b.lead.score - a.lead.score); // Sort by score only if no valid distances

    console.log(`Leads within radius: ${leadsWithinRadius.length}, Agent radius: ${agent.radius || params.radius}`);

    // Format response (hide sensitive contact info until purchased)
    const formattedLeads = leadsWithinRadius.map(({ lead, distance }) => ({
      leadId: lead.leadId,
      leadType: lead.leadType,
      score: lead.score,
      price: lead.price,
      aiReason: lead.aiReason,
      location: {
        city: lead.location.city,
        state: lead.location.state,
        zip: lead.location.zip,
        // Hide exact address until purchased
      },
      distance: Math.round(distance * 10) / 10,
      createdAt: lead.createdAt,
      expiresAt: lead.expiresAt,
      responsePreview: {
        // Show preview of responses without full details
        questionCount: Object.keys(lead.responses).length,
        hasTimeline: !!lead.responses.timeline,
        hasBudget: !!lead.responses.budget || !!lead.responses.priceRange,
      },
    }));

    console.log(`Returning ${formattedLeads.length} leads to agent ${agent.agentId}`);

    return ResponseBuilder.success({
      leads: formattedLeads,
      total: formattedLeads.length,
      filters: params,
      agentRadius: params.radius || agent.radius,
    });
  } catch (error) {
    console.error('List leads error:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific lead
 */
async function getLeadDetails(agent: Agent, leadId: string) {
  try {
    // Get lead by ID
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      {
        ':leadId': leadId,
      }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0] as Lead;

    // Check if lead is available
    if (lead.status !== 'available') {
      return ResponseBuilder.error('Lead is no longer available', 410);
    }

    // Check if expired
    if (isExpired(lead.expiresAt)) {
      return ResponseBuilder.error('Lead has expired', 410);
    }

    // Check if lead type matches agent preferences
    if (!agent.preferences.leadTypes.includes(lead.leadType)) {
      return ResponseBuilder.forbidden('This lead type does not match your preferences');
    }

    // Check distance
    let distance: number;
    try {
      distance = await LocationService.calculateDistance(
        { lat: agent.location.lat, lng: agent.location.lng },
        { lat: lead.location.lat, lng: lead.location.lng }
      );
    } catch (error) {
      console.warn(`Distance calculation failed for lead ${leadId}:`, error);
      // If distance calculation fails, skip distance check
      distance = 0;
    }

    if (distance > 0 && distance > agent.radius) {
      return ResponseBuilder.forbidden('Lead is outside your service radius');
    }

    // Return lead details (still hiding exact contact until purchase)
    return ResponseBuilder.success({
      leadId: lead.leadId,
      leadType: lead.leadType,
      score: lead.score,
      price: lead.price,
      aiReason: lead.aiReason,
      location: {
        city: lead.location.city,
        state: lead.location.state,
        zip: lead.location.zip,
      },
      distance: Math.round(distance * 10) / 10,
      responses: lead.responses, // Show full questionnaire responses
      createdAt: lead.createdAt,
      expiresAt: lead.expiresAt,
      contact: {
        // Partial contact info
        nameInitial: lead.contact.name.charAt(0),
        emailDomain: lead.contact.email.split('@')[1],
        phoneArea: lead.contact.phone.substring(0, 3),
      },
    });
  } catch (error) {
    console.error('Get lead details error:', error);
    throw error;
  }
}
