const { DynamoDBClient } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('./backend/node_modules/@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('./backend/node_modules/uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

// Demo data arrays
// Scores 8-10 = Marketplace leads (premium, high-intent)
// Scores 5-7 = Round-robin auto-assignment (good quality, automated distribution)
const premiumLeads = [
  {
    leadType: 'buyer',
    score: 10,
    aiReason: 'Pre-approved buyer with $800K budget, urgently seeking home in excellent school district. Timeline: 30 days.',
    contact: {
      name: 'Michael Chen',
      email: 'michael.chen@email.com',
      phone: '555-0101'
    },
    location: {
      address: 'Beverly Hills, CA',
      lat: 34.0736,
      lng: -118.4004
    },
    responses: {
      timeline: 'Within 30 days',
      budget: '$750,000 - $850,000',
      preApproved: 'Yes',
      propertyType: 'Single Family Home',
      bedrooms: '4+',
      mustHaves: 'Top-rated schools, move-in ready'
    }
  },
  {
    leadType: 'seller',
    score: 9,
    aiReason: 'Seller with $1.2M home, motivated to list within 2 weeks. Property recently renovated, great condition.',
    contact: {
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '555-0102'
    },
    location: {
      address: 'Santa Monica, CA',
      lat: 34.0195,
      lng: -118.4912
    },
    responses: {
      timeline: 'Within 2 weeks',
      propertyValue: '$1,200,000',
      propertyType: 'Single Family Home',
      condition: 'Recently renovated',
      reason: 'Relocation for job'
    }
  },
  {
    leadType: 'buyer',
    score: 8,
    aiReason: 'Qualified buyer with steady income, looking for investment property. Budget $500K, flexible timeline.',
    contact: {
      name: 'David Martinez',
      email: 'dmartinez@email.com',
      phone: '555-0103'
    },
    location: {
      address: 'Pasadena, CA',
      lat: 34.1478,
      lng: -118.1445
    },
    responses: {
      timeline: 'Within 3-6 months',
      budget: '$450,000 - $550,000',
      preApproved: 'In progress',
      propertyType: 'Condo or Townhouse',
      bedrooms: '2-3',
      mustHaves: 'Good rental potential, low HOA fees'
    }
  },
  {
    leadType: 'seller',
    score: 8,
    aiReason: 'Seller ready to list $650K property, good location, needs cosmetic updates. Realistic about pricing.',
    contact: {
      name: 'Jennifer Wu',
      email: 'jwu@email.com',
      phone: '555-0104'
    },
    location: {
      address: 'Glendale, CA',
      lat: 34.1425,
      lng: -118.2551
    },
    responses: {
      timeline: 'Within 1 month',
      propertyValue: '$650,000',
      propertyType: 'Single Family Home',
      condition: 'Needs some updates',
      reason: 'Downsizing'
    }
  }
];

// Round-robin leads (scores 5-7) - these will be auto-assigned to agents
const roundRobinLeads = [
  {
    leadType: 'buyer',
    score: 7,
    aiReason: 'Motivated buyer with clear preferences, needs financing guidance. Good follow-up potential.',
    contact: {
      name: 'Robert Thompson',
      email: 'rthompson@email.com',
      phone: '555-0201'
    },
    location: {
      address: 'Burbank, CA',
      lat: 34.1808,
      lng: -118.3090
    },
    responses: {
      timeline: 'Within 3 months',
      budget: '$400,000 - $500,000',
      preApproved: 'Not yet',
      propertyType: 'Condo',
      bedrooms: '2',
      mustHaves: 'Near public transit, modern kitchen'
    }
  },
  {
    leadType: 'seller',
    score: 6,
    aiReason: 'Seller exploring options, property in decent condition. May need education on market conditions.',
    contact: {
      name: 'Lisa Anderson',
      email: 'landerson@email.com',
      phone: '555-0202'
    },
    location: {
      address: 'Torrance, CA',
      lat: 33.8358,
      lng: -118.3406
    },
    responses: {
      timeline: 'Within 6 months',
      propertyValue: '$550,000',
      propertyType: 'Townhouse',
      condition: 'Good condition',
      reason: 'Upgrading to larger home'
    }
  },
  {
    leadType: 'buyer',
    score: 6,
    aiReason: 'First-time buyer with savings, needs pre-approval. Shows genuine interest but requires hand-holding.',
    contact: {
      name: 'Emily Rodriguez',
      email: 'erodriguez@email.com',
      phone: '555-0203'
    },
    location: {
      address: 'Long Beach, CA',
      lat: 33.7701,
      lng: -118.1937
    },
    responses: {
      timeline: 'Within 6-9 months',
      budget: '$350,000 - $450,000',
      preApproved: 'Not yet',
      propertyType: 'Condo or Townhouse',
      bedrooms: '2',
      mustHaves: 'First-time buyer programs, parking'
    }
  },
  {
    leadType: 'buyer',
    score: 5,
    aiReason: 'Buyer with moderate interest, broad search criteria. Requires nurturing and market education.',
    contact: {
      name: 'James Wilson',
      email: 'jwilson@email.com',
      phone: '555-0204'
    },
    location: {
      address: 'Anaheim, CA',
      lat: 33.8366,
      lng: -117.9143
    },
    responses: {
      timeline: 'Within 9-12 months',
      budget: '$300,000 - $450,000',
      preApproved: 'Not yet',
      propertyType: 'Any',
      bedrooms: '2-3',
      mustHaves: 'Affordable, safe neighborhood'
    }
  }
];

const bulkLeads = [];

async function createPremiumLeads() {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  
  console.log('Creating premium marketplace leads (scores 8-10)...');
  for (const lead of premiumLeads) {
    const leadId = uuidv4();
    const price = lead.score * 10;
    
    await ddb.send(new PutCommand({
      TableName: 'RealtorLeads',
      Item: {
        leadId,
        timestamp: now,
        leadType: lead.leadType,
        status: 'available',
        score: lead.score,
        price,
        aiReason: lead.aiReason,
        contact: lead.contact,
        location: lead.location,
        responses: lead.responses,
        createdAt: now,
        expiresAt,
        GSI1PK: `available#${lead.leadType}`,
        GSI1SK: `score#${lead.score}`
      }
    }));
    
    console.log(`✅ Created marketplace lead: ${lead.contact.name} (Score: ${lead.score}, $${price})`);
  }
}

async function createRoundRobinLeads() {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  
  console.log('\nCreating round-robin leads (scores 5-7)...');
  for (const lead of roundRobinLeads) {
    const leadId = uuidv4();
    const price = lead.score * 10;
    
    await ddb.send(new PutCommand({
      TableName: 'RealtorLeads',
      Item: {
        leadId,
        timestamp: now,
        leadType: lead.leadType,
        status: 'pending_assignment',
        score: lead.score,
        price,
        aiReason: lead.aiReason,
        contact: lead.contact,
        location: lead.location,
        responses: lead.responses,
        createdAt: now,
        expiresAt,
        GSI1PK: `pending_assignment#${lead.leadType}`,
        GSI1SK: `score#${lead.score}`
      }
    }));
    
    console.log(`✅ Created round-robin lead: ${lead.contact.name} (Score: ${lead.score}, $${price})`);
  }
}

async function createBulkPackage() {
  const now = new Date().toISOString();
  const packageId = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  
  console.log('\nCreating bulk leads...');
  const leadIds = [];
  
  for (const lead of bulkLeads) {
    const leadId = uuidv4();
    const price = lead.score * 10;
    
    await ddb.send(new PutCommand({
      TableName: 'RealtorLeads',
      Item: {
        leadId,
        timestamp: now,
        leadType: lead.leadType,
        status: 'bulk',
        score: lead.score,
        price,
        aiReason: lead.aiReason,
        contact: lead.contact,
        location: lead.location,
        responses: lead.responses,
        createdAt: now,
        expiresAt,
        bulkPackageId: packageId,
        GSI1PK: `bulk#${packageId}`,
        GSI1SK: `score#${lead.score}`
      }
    }));
    
    leadIds.push(leadId);
    console.log(`✅ Created bulk lead: ${lead.contact.name} (Score: ${lead.score})`);
  }
  
  console.log('\nCreating bulk package...');
  await ddb.send(new PutCommand({
    TableName: 'RealtorBulkPackages',
    Item: {
      packageId,
      timestamp: now,
      status: 'available',
      leadCount: bulkLeads.length,
      leadIds,
      totalPrice: 50, // $10/lead for 5 leads
      pricePerLead: 10,
      leadTypes: ['buyer', 'seller'],
      averageScore: 2.8,
      scoreRange: { min: 2, max: 4 },
      createdAt: now,
      createdBy: 'admin',
      expiresAt,
      description: 'Starter package - 5 early-stage leads for nurturing',
      GSI1PK: 'available#bulk',
      GSI1SK: `price#50`
    }
  }));
  
  console.log(`✅ Created bulk package: ${bulkLeads.length} leads for $50`);
}

async function main() {
  try {
    await createPremiumLeads();
    await createRoundRobinLeads();
    if (bulkLeads.length > 0) {
      await createBulkPackage();
    }
    console.log('\n🎉 All demo data created successfully!');
    console.log('\n📊 Summary:');
    console.log(`  Marketplace: ${premiumLeads.length} premium leads (scores 8-10)`);
    console.log(`  Round-Robin: ${roundRobinLeads.length} leads for auto-assignment (scores 5-7)`);
    console.log(`  Bulk Package: ${bulkLeads.length > 0 ? '1 package' : 'None'}`);
    console.log('\n💡 Next Steps:');
    console.log('  - Marketplace leads are available for purchase');
    console.log('  - Round-robin leads will be auto-assigned to online agents with capacity');
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
}

main();
