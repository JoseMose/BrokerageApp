const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

// Demo data arrays - currently empty
// To add demo leads, populate these arrays and run: node backend/create-demo-data.js
const premiumLeads = [];

const bulkLeads = [];

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
