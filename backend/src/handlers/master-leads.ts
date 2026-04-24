import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator } from '../utils/helpers';
import { getConfig, APIGatewayEvent } from '../utils/types';

const config = getConfig();
const TABLE = config.MASTER_LEADS_TABLE_NAME;

const SEED_LEADS = [
  {
    id: 'ml-001',
    ownerName: 'Robert Chambers',
    propertyAddress: '842 Roswell Rd NE, Marietta, GA 30062',
    leadType: 'expired',
    phone: '(770) 555-0182',
    email: 'rchambers@email.com',
    notes: 'Listed 94 days, expired March 31. Motivated seller — mentioned divorce. Open to cash offers.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 'ml-002',
    ownerName: 'Patricia Nguyen',
    propertyAddress: '1780 Briarcliff Rd NE, Atlanta, GA 30306',
    leadType: 'expired',
    phone: '(404) 555-0519',
    email: 'pnguyen@outlook.com',
    notes: 'Price reduced twice before expiring. 60-day DOM. Neighbor says she relocated to Charlotte.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-09T08:00:00.000Z',
  },
  {
    id: 'ml-003',
    ownerName: 'Linda Forsythe',
    propertyAddress: '319 Candler Park Dr NE, Atlanta, GA 30307',
    leadType: 'fsbo',
    phone: '(404) 555-0294',
    email: 'lforsythe@gmail.com',
    notes: 'Listing herself. Unrealistic at $495K. Comparable sales are $440–460K.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-03T14:00:00.000Z',
  },
  {
    id: 'ml-004',
    ownerName: 'Derek Hollis',
    propertyAddress: '4210 Peachtree Rd NE, Brookhaven, GA 30319',
    leadType: 'fsbo',
    phone: '(770) 555-0638',
    email: '',
    notes: 'Sign in yard since Feb. 3/2 split-level. Priced at $379K — reasonable. Wife wants to move fast.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-05T10:30:00.000Z',
  },
  {
    id: 'ml-005',
    ownerName: 'Marcus Webb',
    propertyAddress: '5520 Stone Mountain Hwy, Stone Mountain, GA 30083',
    leadType: 'pre_foreclosure',
    phone: '(678) 555-0371',
    email: '',
    notes: 'NOD filed Feb 14. 3/2 SFR, ~$285K ARV. Likely needs quick close. Left voicemail.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-08T11:30:00.000Z',
  },
  {
    id: 'ml-006',
    ownerName: 'Sheryl Tompkins',
    propertyAddress: '2765 Duluth Hwy, Duluth, GA 30097',
    leadType: 'pre_foreclosure',
    phone: '(770) 555-0917',
    email: 'stompkins@gmail.com',
    notes: 'NOD filed Jan 28. 4/2 ranch. About $60K in equity. Already spoke with bank about options.',
    status: 'active',
    addedBy: 'admin',
    createdAt: '2026-04-10T08:00:00.000Z',
  },
];

export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Master leads request:', event.httpMethod, event.path);

    const httpMethod = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET /master-leads — all agents can browse active leads
    if (httpMethod === 'GET') {
      // Admin-only: seed action
      if (queryParams.action === 'seed') {
        if (!RequestValidator.isAdmin(event)) {
          return ResponseBuilder.forbidden('Admin access required');
        }
        return await seedLeads();
      }
      return await getAllMasterLeads();
    }

    // All write operations are admin-only
    if (!RequestValidator.isAdmin(event)) {
      return ResponseBuilder.forbidden('Admin access required');
    }

    // POST /master-leads — create
    if (httpMethod === 'POST') {
      return await createMasterLead(event);
    }

    // PUT /master-leads/{id} — update
    if (httpMethod === 'PUT') {
      const id = event.pathParameters?.id;
      if (!id) return ResponseBuilder.error('Lead ID required', 400);
      return await updateMasterLead(id, event);
    }

    // DELETE /master-leads/{id} — archive
    if (httpMethod === 'DELETE') {
      const id = event.pathParameters?.id;
      if (!id) return ResponseBuilder.error('Lead ID required', 400);
      return await archiveMasterLead(id);
    }

    return ResponseBuilder.error('Invalid method', 405);
  } catch (error: any) {
    console.error('Master leads error:', error);
    return ResponseBuilder.serverError('Failed to process master leads request', error);
  }
};

async function getAllMasterLeads() {
  const leads = await DynamoDBService.scanItems(
    TABLE,
    '#status = :active',
    { ':active': 'active' },
    { '#status': 'status' }
  );
  // Sort by createdAt descending
  leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return ResponseBuilder.success({ leads });
}

async function createMasterLead(event: APIGatewayEvent) {
  const body = RequestValidator.parseBody<any>(event);
  const adminId = RequestValidator.getUserId(event);

  if (!body.ownerName || !body.propertyAddress || !body.leadType) {
    return ResponseBuilder.error('ownerName, propertyAddress, and leadType are required', 400);
  }

  const now = new Date().toISOString();
  const lead = {
    id: body.id || `ml-${Date.now()}`,
    ownerName: body.ownerName,
    propertyAddress: body.propertyAddress,
    leadType: body.leadType,
    phone: body.phone || '',
    email: body.email || '',
    notes: body.notes || '',
    status: 'active',
    addedBy: adminId,
    createdAt: now,
    updatedAt: now,
  };

  await DynamoDBService.putItem(TABLE, lead);
  return ResponseBuilder.success({ lead }, 201);
}

async function updateMasterLead(id: string, event: APIGatewayEvent) {
  const body = RequestValidator.parseBody<any>(event);
  const existing = await DynamoDBService.getItem(TABLE, { id });
  if (!existing) return ResponseBuilder.notFound('Lead not found');

  const updated = {
    ...existing,
    ownerName: body.ownerName ?? existing.ownerName,
    propertyAddress: body.propertyAddress ?? existing.propertyAddress,
    leadType: body.leadType ?? existing.leadType,
    phone: body.phone ?? existing.phone,
    email: body.email ?? existing.email,
    notes: body.notes ?? existing.notes,
    status: body.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  await DynamoDBService.putItem(TABLE, updated);
  return ResponseBuilder.success({ lead: updated });
}

async function archiveMasterLead(id: string) {
  const existing = await DynamoDBService.getItem(TABLE, { id });
  if (!existing) return ResponseBuilder.notFound('Lead not found');

  await DynamoDBService.updateItem(
    TABLE,
    { id },
    'SET #status = :archived, updatedAt = :now',
    { ':archived': 'archived', ':now': new Date().toISOString() },
    { '#status': 'status' }
  );
  return ResponseBuilder.success({ message: 'Lead archived' });
}

async function seedLeads() {
  const existing = await DynamoDBService.scanItems(TABLE);
  if (existing.length > 0) {
    return ResponseBuilder.success({ message: `Table already has ${existing.length} leads — seed skipped.`, leads: existing });
  }

  for (const lead of SEED_LEADS) {
    await DynamoDBService.putItem(TABLE, lead);
  }

  return ResponseBuilder.success({ message: `Seeded ${SEED_LEADS.length} master leads.`, leads: SEED_LEADS });
}
