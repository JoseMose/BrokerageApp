import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { getConfig, Agent } from '../utils/types';

const config = getConfig();

/**
 * Lead Matching Handler
 * Matches scored leads with agents based on radius and preferences
 * Invoked by Step Functions after AI scoring
 */
export const handler = async (event: any) => {
  try {
    console.log('Lead matching request:', JSON.stringify(event, null, 2));

    const { leadId, leadType, score, location } = event;

    // Get all active agents
    const agents = await DynamoDBService.scanItems(
      config.AGENTS_TABLE_NAME,
      '#status = :status AND SK = :sk',
      {
        ':status': 'active',
        ':sk': 'profile',
      },
      {
        '#status': 'status',
      }
    );

    if (agents.length === 0) {
      console.log('No active agents found');
      return {
        leadId,
        matchedAgents: [],
        message: 'No active agents available',
      };
    }

    // Filter agents by preferences
    const eligibleAgents = agents.filter((agent: Agent) => {
      // Check if agent accepts this lead type
      if (!agent.preferences.leadTypes.includes(leadType)) {
        return false;
      }

      // Check if lead score meets agent's minimum
      if (score < agent.preferences.minScore) {
        return false;
      }

      // Check if lead price is within agent's max price
      const leadPrice = score * config.PRICE_PER_POINT;
      if (leadPrice > agent.preferences.maxPrice) {
        return false;
      }

      return true;
    });

    console.log(`${eligibleAgents.length} eligible agents found`);

    if (eligibleAgents.length === 0) {
      return {
        leadId,
        matchedAgents: [],
        message: 'No agents match lead criteria',
      };
    }

    // Calculate distance and filter by radius
    const agentsWithinRadius = await LocationService.getAgentsWithinRadius(
      { lat: location.lat, lng: location.lng },
      eligibleAgents
    );

    console.log(`${agentsWithinRadius.length} agents within radius`);

    // Sort by distance (closest first)
    const matchedAgents = agentsWithinRadius.map(({ agent, distance }) => ({
      agentId: agent.agentId,
      agentName: agent.name,
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      email: agent.email,
    }));

    // Store matched agents in lead metadata (optional - for analytics)
    if (matchedAgents.length > 0) {
      await DynamoDBService.updateItem(
        config.LEADS_TABLE_NAME,
        { leadId, timestamp: leadId },
        'SET matchedAgentCount = :count',
        {
          ':count': matchedAgents.length,
        }
      );
    }

    console.log(`Lead ${leadId} matched with ${matchedAgents.length} agents`);

    return {
      leadId,
      matchedAgents,
      message: `Lead matched with ${matchedAgents.length} agents`,
    };
  } catch (error: any) {
    console.error('Lead matching error:', error);
    throw error;
  }
};
