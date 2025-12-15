import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { getConfig, Agent } from '../utils/types';
import { EmailService } from '../utils/email-service';
import { SMSService } from '../utils/sms-service';

const config = getConfig();

/**
 * Lead Matching Handler with Round-Robin Distribution
 * Matches scored leads with agents and automatically assigns to next agent in queue
 * Invoked by Step Functions after AI scoring
 */
export const handler = async (event: any) => {
  try {
    console.log('Lead matching request:', JSON.stringify(event, null, 2));

    const { leadId, leadType, score, location, price } = event;

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
        assignedTo: null,
        message: 'No active agents available',
      };
    }

    // Filter agents by preferences and capacity
    const eligibleAgents = agents.filter((agent: Agent) => {
      // Check if agent is online
      if (agent.roundRobin && !agent.roundRobin.isOnline) {
        return false;
      }

      // Check capacity
      if (agent.roundRobin) {
        const currentCount = agent.roundRobin.assignedLeadCount || 0;
        const maxCapacity = agent.roundRobin.maxCapacity || 10;
        if (currentCount >= maxCapacity) {
          console.log(`Agent ${agent.agentId} at capacity: ${currentCount}/${maxCapacity}`);
          return false;
        }
      }

      // Check if agent accepts this lead type
      if (!agent.preferences.leadTypes.includes(leadType)) {
        return false;
      }

      // Check if lead score meets agent's minimum
      if (score < agent.preferences.minScore) {
        return false;
      }

      // Check if lead price is within agent's max price
      if (price > agent.preferences.maxPrice) {
        return false;
      }

      return true;
    });

    console.log(`${eligibleAgents.length} eligible agents found (after filtering by capacity and preferences)`);

    if (eligibleAgents.length === 0) {
      return {
        leadId,
        matchedAgents: [],
        assignedTo: null,
        message: 'No agents match lead criteria or all agents at capacity',
      };
    }

    // Calculate distance and filter by radius
    const agentsWithinRadius = await LocationService.getAgentsWithinRadius(
      { lat: location.lat, lng: location.lng },
      eligibleAgents
    );

    console.log(`${agentsWithinRadius.length} agents within radius`);

    if (agentsWithinRadius.length === 0) {
      return {
        leadId,
        matchedAgents: [],
        assignedTo: null,
        message: 'No agents within service radius',
      };
    }

    // Sort by distance (closest first)
    const matchedAgents = agentsWithinRadius.map(({ agent, distance }) => ({
      agentId: agent.agentId,
      agentName: agent.name,
      distance: Math.round(distance * 10) / 10,
      email: agent.email,
      lastAssignedAt: agent.roundRobin?.lastAssignedAt || null,
    }));

    // Store matched agents count in lead metadata
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId, timestamp: leadId },
      'SET matchedAgentCount = :count',
      {
        ':count': matchedAgents.length,
      }
    );

    // ROUND-ROBIN ASSIGNMENT: Select next agent in queue
    const selectedAgent = selectNextAgent(agentsWithinRadius.map(a => a.agent));

    if (selectedAgent) {
      // Assign lead to selected agent with full lead details for notifications
      await assignLeadToAgent(leadId, selectedAgent, matchedAgents.length, {
        leadType,
        score,
        location,
        price,
      });
      
      console.log(`Lead ${leadId} automatically assigned to agent ${selectedAgent.agentId}`);

      return {
        leadId,
        matchedAgents,
        assignedTo: {
          agentId: selectedAgent.agentId,
          agentName: selectedAgent.name,
          email: selectedAgent.email,
        },
        message: `Lead automatically assigned to ${selectedAgent.name}`,
      };
    }

    // Fallback: No agent selected (shouldn't happen if eligibleAgents > 0)
    console.log(`Lead ${leadId} matched with ${matchedAgents.length} agents (no automatic assignment)`);

    return {
      leadId,
      matchedAgents,
      assignedTo: null,
      message: `Lead matched with ${matchedAgents.length} agents`,
    };
  } catch (error: any) {
    console.error('Lead matching error:', error);
    throw error;
  }
};

/**
 * Select next agent using round-robin algorithm
 * Prioritizes agents who haven't been assigned recently
 */
function selectNextAgent(agents: Agent[]): Agent | null {
  if (agents.length === 0) return null;

  // Sort by lastAssignedAt (oldest first, null values first)
  const sortedAgents = agents.sort((a, b) => {
    const aTime = a.roundRobin?.lastAssignedAt || '1970-01-01';
    const bTime = b.roundRobin?.lastAssignedAt || '1970-01-01';
    return aTime.localeCompare(bTime);
  });

  return sortedAgents[0];
}

/**
 * Assign lead to agent and update all related records
 */
async function assignLeadToAgent(
  leadId: string,
  agent: Agent,
  totalMatches: number,
  leadDetails: {
    leadType: string;
    score: number;
    location: any;
    price: number;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const assignmentId = uuidv4();

  try {
    // 1. Update lead status to 'assigned'
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId, timestamp: leadId },
      'SET #status = :status, assignedTo = :agentId, assignedAt = :timestamp, GSI1PK = :gsi1pk',
      {
        ':status': 'assigned',
        ':agentId': agent.agentId,
        ':timestamp': timestamp,
        ':gsi1pk': `assigned#${agent.agentId}`,
      },
      {
        '#status': 'status',
      }
    );

    // 2. Update agent round-robin metadata
    const currentCount = agent.roundRobin?.assignedLeadCount || 0;
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId: agent.agentId, SK: 'profile' },
      'SET roundRobin.lastAssignedAt = :timestamp, roundRobin.assignedLeadCount = :count',
      {
        ':timestamp': timestamp,
        ':count': currentCount + 1,
      }
    );

    // 3. Create assignment history record
    await DynamoDBService.putItem(config.AGENTS_TABLE_NAME, {
      agentId: agent.agentId,
      SK: `assignment#${assignmentId}`,
      assignmentId,
      leadId,
      assignedAt: timestamp,
      assignmentType: 'round-robin',
      totalMatches,
      status: 'assigned',
    });

    console.log(
      `Assignment complete: Lead ${leadId} → Agent ${agent.agentId} (${agent.name})`
    );

    // Send notifications to agent (async, don't block assignment)
    const leadInfo = {
      leadId,
      leadType: leadDetails.leadType,
      score: leadDetails.score,
      city: leadDetails.location?.city || 'Unknown',
      state: leadDetails.location?.state || '',
      price: leadDetails.price,
    };

    // Send email notification
    EmailService.sendLeadAssignment(agent.email, agent.name, leadInfo).catch((err) => {
      console.error('Failed to send assignment email:', err);
    });

    // Send SMS notification for urgent leads (score 9-10)
    if (leadDetails.score >= 9 && agent.phone) {
      SMSService.sendUrgentLeadAlert(agent.phone, agent.name, leadInfo).catch((err) => {
        console.error('Failed to send urgent lead SMS:', err);
      });
    } else if (agent.phone) {
      // Send regular assignment SMS for lower-priority leads
      SMSService.sendLeadAssignmentSMS(agent.phone, agent.name, leadInfo).catch((err) => {
        console.error('Failed to send assignment SMS:', err);
      });
    }
  } catch (error) {
    console.error('Failed to assign lead to agent:', error);
    throw error;
  }
}
