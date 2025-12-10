const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

// Demo data arrays - currently empty
// To add demo leads, populate these arrays and run: node backend/create-demo-data.js
const premiumLeads = [];

// 173 bulk leads with scores 4 or below
const bulkLeads = [
  // Score 1 leads (43 leads)
  ...Array.from({ length: 43 }, (_, i) => ({
    leadType: 'seller',
    score: 1,
    aiReason: 'Initial interest, limited engagement',
    contact: { name: `Low Interest ${i + 1}`, email: `low${i + 1}@example.com`, phone: `555-010${String(i).padStart(2, '0')}` },
    location: { city: 'Various', state: 'CA', zip: `9000${i % 10}` },
    responses: { timeline: 'exploring', propertyType: 'single-family', budget: 'under-300k' }
  })),
  
  // Score 2 leads (44 leads)
  ...Array.from({ length: 44 }, (_, i) => ({
    leadType: 'buyer',
    score: 2,
    aiReason: 'Early stage inquiry, needs nurturing',
    contact: { name: `Potential Buyer ${i + 1}`, email: `buyer${i + 1}@example.com`, phone: `555-020${String(i).padStart(2, '0')}` },
    location: { city: 'San Diego', state: 'CA', zip: `9200${i % 10}` },
    responses: { timeline: 'next-year', propertyType: 'condo', budget: '300k-500k' }
  })),
  
  // Score 3 leads (43 leads)
  ...Array.from({ length: 43 }, (_, i) => ({
    leadType: 'seller',
    score: 3,
    aiReason: 'Some engagement, requires follow-up',
    contact: { name: `Future Seller ${i + 1}`, email: `seller${i + 1}@example.com`, phone: `555-030${String(i).padStart(2, '0')}` },
    location: { city: 'Los Angeles', state: 'CA', zip: `9000${i % 10}` },
    responses: { timeline: '6-months', propertyType: 'townhouse', budget: '500k-750k' }
  })),
  
  // Score 4 leads (43 leads)
  ...Array.from({ length: 43 }, (_, i) => ({
    leadType: 'buyer',
    score: 4,
    aiReason: 'Moderate interest, worth pursuing',
    contact: { name: `Active Looker ${i + 1}`, email: `looker${i + 1}@example.com`, phone: `555-040${String(i).padStart(2, '0')}` },
    location: { city: 'San Francisco', state: 'CA', zip: `9410${i % 10}` },
    responses: { timeline: '3-months', propertyType: 'single-family', budget: '750k-1m' }
  }))
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
    
    leadIds.push(leadId);
    console.log(`✅ Created bulk lead: ${lead.contact.name} (Score: ${lead.score})`);
  }
  
  console.log('\nCreating bulk package record...');
  
  const regularPrice = bulkLeads.length * 20; // $20 per lead regular price
  const totalPrice = bulkLeads.length * 2; // $2 per lead for 100+ leads
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
      pricePerLead: 2,
      regularPrice,
      discount,
      discountPercent,
      averageScore: 2.5,
      scoreRange: { min: 1, max: 4 },
      createdAt: now,
      expiresAt,
      description: 'Massive bulk package - 173 early-stage leads for nurturing at incredible value',
      GSI1PK: 'available#bulk-package',
      GSI1SK: `price#${totalPrice}`
    }
  }));
  
  console.log(`✅ Created bulk package: ${bulkLeads.length} leads for $${totalPrice} (${discountPercent}% off)`);
}

async function main() {
  try {
    await createPremiumLeads();
    await createBulkPackage();
    console.log('\n🎉 All demo data created successfully!');
    console.log(`\nBulk Leads: 1 package with ${bulkLeads.length} leads (scores 1-4) for $${bulkLeads.length * 2} ($2/lead)`);
  } catch (error) {
    console.error('Error creating demo data:', error);
  }
}

main();
