const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const premiumLeads = [
  {
    leadType: 'buyer',
    score: 9,
    contact: { name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '555-0101' },
    location: { address: '123 Oak Street', city: 'Atlanta', state: 'GA', zip: '30301', lat: 33.7490, lng: -84.3880 },
    aiReason: 'Pre-approved for $500K mortgage, looking to buy within 30 days. Highly motivated first-time buyer.',
    responses: { budget: '450000-550000', timeline: '30 days', preApproved: true }
  },
  {
    leadType: 'seller',
    score: 10,
    contact: { name: 'Michael Chen', email: 'mchen@email.com', phone: '555-0102' },
    location: { address: '456 Pine Avenue', city: 'Atlanta', state: 'GA', zip: '30302', lat: 33.7550, lng: -84.3900 },
    aiReason: 'Luxury home seller, property valued at $850K. Ready to list immediately with professional staging.',
    responses: { propertyValue: '850000', condition: 'excellent', timeline: 'immediate' }
  },
  {
    leadType: 'buyer',
    score: 8,
    contact: { name: 'Emily Rodriguez', email: 'e.rodriguez@email.com', phone: '555-0103' },
    location: { address: '789 Maple Drive', city: 'Atlanta', state: 'GA', zip: '30303', lat: 33.7600, lng: -84.3950 },
    aiReason: 'Young professional relocating for work. Pre-qualified and needs to close within 60 days.',
    responses: { budget: '350000-400000', timeline: '60 days', preApproved: true }
  },
  {
    leadType: 'seller',
    score: 9,
    contact: { name: 'David Thompson', email: 'd.thompson@email.com', phone: '555-0104' },
    location: { address: '321 Birch Lane', city: 'Atlanta', state: 'GA', zip: '30304', lat: 33.7650, lng: -84.4000 },
    aiReason: 'Inherited property, needs quick sale. Well-maintained 3BR/2BA in desirable neighborhood.',
    responses: { propertyValue: '425000', condition: 'good', timeline: '30-60 days' }
  },
  {
    leadType: 'buyer',
    score: 10,
    contact: { name: 'Jennifer Martinez', email: 'j.martinez@email.com', phone: '555-0105' },
    location: { address: '654 Cedar Court', city: 'Atlanta', state: 'GA', zip: '30305', lat: 33.7700, lng: -84.4100 },
    aiReason: 'Cash buyer looking for investment property. Ready to make offers immediately on multiple properties.',
    responses: { budget: '500000+', timeline: 'immediate', preApproved: true, cashBuyer: true }
  }
];

const bulkLeads = [
  {
    leadType: 'buyer',
    score: 3,
    contact: { name: 'John Smith', email: 'j.smith@email.com', phone: '555-0201' },
    location: { address: '100 Main St', city: 'Atlanta', state: 'GA', zip: '30306', lat: 33.7750, lng: -84.4150 },
    aiReason: 'Early stage buyer, just starting to explore options. No pre-approval yet.',
    responses: { budget: 'not sure', timeline: '6+ months', preApproved: false }
  },
  {
    leadType: 'seller',
    score: 2,
    contact: { name: 'Mary Williams', email: 'm.williams@email.com', phone: '555-0202' },
    location: { address: '200 Second Ave', city: 'Atlanta', state: 'GA', zip: '30307', lat: 33.7800, lng: -84.4200 },
    aiReason: 'Considering selling in the future. No immediate plans or timeline.',
    responses: { timeline: '1+ year', condition: 'fair' }
  },
  {
    leadType: 'buyer',
    score: 4,
    contact: { name: 'Robert Brown', email: 'r.brown@email.com', phone: '555-0203' },
    location: { address: '300 Third Blvd', city: 'Atlanta', state: 'GA', zip: '30308', lat: 33.7850, lng: -84.4250 },
    aiReason: 'First-time buyer with limited budget. Needs financial guidance and education.',
    responses: { budget: '200000-250000', timeline: '3-6 months', preApproved: false }
  },
  {
    leadType: 'seller',
    score: 3,
    contact: { name: 'Lisa Davis', email: 'l.davis@email.com', phone: '555-0204' },
    location: { address: '400 Fourth St', city: 'Atlanta', state: 'GA', zip: '30309', lat: 33.7900, lng: -84.4300 },
    aiReason: 'Property needs significant repairs before listing. Exploring options.',
    responses: { condition: 'needs work', timeline: '6+ months' }
  },
  {
    leadType: 'buyer',
    score: 2,
    contact: { name: 'James Wilson', email: 'j.wilson@email.com', phone: '555-0205' },
    location: { address: '500 Fifth Ave', city: 'Atlanta', state: 'GA', zip: '30310', lat: 33.7950, lng: -84.4350 },
    aiReason: 'Casually browsing, no specific timeline or budget defined.',
    responses: { timeline: 'just looking' }
  }
];

async function createPremiumLeads() {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  
  console.log('Creating premium marketplace leads...');
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
    
    console.log(`✅ Created premium lead: ${lead.contact.name} (Score: ${lead.score}, $${price})`);
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
  
  console.log('\nCreating bulk package record...');
  
  const regularPrice = bulkLeads.length * 80; // $80 per lead regular price
  const totalPrice = 50;
  const discount = regularPrice - totalPrice;
  const discountPercent = Math.round((discount / regularPrice) * 100);
  
  await ddb.send(new PutCommand({
    TableName: 'RealtorLeads',
    Item: {
      leadId: `package#${packageId}`,
      timestamp: now,
      leadType: 'bulk-package',
      status: 'available',
      packageId,
      leadCount: bulkLeads.length,
      leadIds,
      totalPrice,
      pricePerLead: 10,
      regularPrice,
      discount,
      discountPercent,
      averageScore: 2.8,
      scoreRange: { min: 2, max: 4 },
      createdAt: now,
      expiresAt,
      description: 'Starter package - 5 early-stage leads for nurturing',
      GSI1PK: 'available#bulk-package',
      GSI1SK: `price#50`
    }
  }));
  
  console.log(`✅ Created bulk package: ${bulkLeads.length} leads for $${totalPrice} (${discountPercent}% off)`);
}

async function main() {
  try {
    await createPremiumLeads();
    await createBulkPackage();
    console.log('\n🎉 All demo data created successfully!');
    console.log('\nMarketplace: 5 premium leads (scores 8-10)');
    console.log('Bulk Leads: 1 package with 5 leads (scores 2-4) for $50');
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
}

main();
