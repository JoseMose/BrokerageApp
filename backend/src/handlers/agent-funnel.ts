import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent } from '../utils/types';

const config = getConfig();
const FUNNEL_TABLE = config.AGENT_FUNNEL_TABLE_NAME;
const MASTER_TABLE = config.MASTER_LEADS_TABLE_NAME;

/**
 * Subscription gate — return true when the agent has an active subscription.
 * Wire to Stripe or your billing system when ready.
 */
async function hasActiveSubscription(_agentId: string): Promise<boolean> {
  return true;
}

export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Agent funnel request:', event.httpMethod, event.path);

    const agentId = RequestValidator.getUserId(event);
    const httpMethod = event.httpMethod;

    // GET /funnel — agent's funnel entries
    if (httpMethod === 'GET') {
      return await getAgentFunnel(agentId);
    }

    // POST /funnel — copy a master lead into this agent's funnel
    if (httpMethod === 'POST') {
      return await addToFunnel(agentId, event);
    }

    // PUT /funnel/{id} — update stage / notes on an entry
    if (httpMethod === 'PUT') {
      const id = event.pathParameters?.id;
      if (!id) return ResponseBuilder.error('Entry ID required', 400);
      return await updateFunnelEntry(agentId, id, event);
    }

    // DELETE /funnel/{id} — remove entry from funnel
    if (httpMethod === 'DELETE') {
      const id = event.pathParameters?.id;
      if (!id) return ResponseBuilder.error('Entry ID required', 400);
      return await removeFunnelEntry(agentId, id);
    }

    return ResponseBuilder.error('Invalid method', 405);
  } catch (error: any) {
    console.error('Agent funnel error:', error);
    return ResponseBuilder.serverError('Failed to process funnel request', error);
  }
};

async function getAgentFunnel(agentId: string) {
  const entries = await DynamoDBService.queryItems(
    FUNNEL_TABLE,
    'agentId = :agentId',
    { ':agentId': agentId }
  );
  // Sort by addedAt descending
  entries.sort((a: any, b: any) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  return ResponseBuilder.success({ entries });
}

async function addToFunnel(agentId: string, event: APIGatewayEvent) {
  const body = RequestValidator.parseBody<{ masterId: string }>(event);
  const { masterId } = body;

  if (!masterId) return ResponseBuilder.error('masterId is required', 400);

  // Subscription gate
  const subscribed = await hasActiveSubscription(agentId);
  if (!subscribed) {
    return ResponseBuilder.error('An active subscription is required to add leads to your funnel', 403);
  }

  // Duplicate check — query the MasterIdIndex GSI
  const existing = await DynamoDBService.queryItems(
    FUNNEL_TABLE,
    'masterId = :masterId AND agentId = :agentId',
    { ':masterId': masterId, ':agentId': agentId },
    'MasterIdIndex'
  );

  if (existing.length > 0) {
    return ResponseBuilder.error('This lead is already in your funnel', 409);
  }

  // Fetch and validate the master lead
  const masterLead = await DynamoDBService.getItem(MASTER_TABLE, { id: masterId });
  if (!masterLead) return ResponseBuilder.notFound('Master lead not found');

  if (masterLead.status !== 'active') {
    return ResponseBuilder.error('This lead is no longer available', 410);
  }

  const now = new Date().toISOString();
  const entry = {
    agentId,
    id: `funnel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    masterId,
    ownerName: masterLead.ownerName,
    propertyAddress: masterLead.propertyAddress,
    leadType: masterLead.leadType,
    phone: masterLead.phone || '',
    email: masterLead.email || '',
    stage: 'new_lead',
    notes: '',
    lastContactDate: null,
    addedAt: now,
    updatedAt: now,
  };

  await DynamoDBService.putItem(FUNNEL_TABLE, entry);
  return ResponseBuilder.success({ entry }, 201);
}

async function updateFunnelEntry(agentId: string, id: string, event: APIGatewayEvent) {
  const body = RequestValidator.parseBody<any>(event);
  const existing = await DynamoDBService.getItem(FUNNEL_TABLE, { agentId, id });
  if (!existing) return ResponseBuilder.notFound('Funnel entry not found');

  const updated = {
    ...existing,
    stage: body.stage ?? existing.stage,
    notes: body.notes ?? existing.notes,
    lastContactDate: body.lastContactDate !== undefined ? body.lastContactDate : existing.lastContactDate,
    updatedAt: new Date().toISOString(),
  };

  await DynamoDBService.putItem(FUNNEL_TABLE, updated);
  return ResponseBuilder.success({ entry: updated });
}

async function removeFunnelEntry(agentId: string, id: string) {
  const existing = await DynamoDBService.getItem(FUNNEL_TABLE, { agentId, id });
  if (!existing) return ResponseBuilder.notFound('Funnel entry not found');

  await DynamoDBService.deleteItem(FUNNEL_TABLE, { agentId, id });
  return ResponseBuilder.success({ message: 'Lead removed from funnel' });
}
