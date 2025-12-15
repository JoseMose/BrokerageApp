const { DynamoDBClient } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('./backend/node_modules/@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

async function testQueries() {
  console.log('🔍 Testing lead queries...\n');
  
  // Test 1: Query marketplace leads (scores 8-10)
  console.log('1️⃣  Marketplace Leads (status=available, scores 8-10):');
  const marketplaceBuyers = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'available#buyer'
    }
  }));
  
  const marketplaceSellers = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'available#seller'
    }
  }));
  
  const marketplaceLeads = [...(marketplaceBuyers.Items || []), ...(marketplaceSellers.Items || [])];
  marketplaceLeads.forEach(lead => {
    console.log(`   ✅ ${lead.contact.name} - ${lead.leadType} - Score: ${lead.score} - $${lead.price}`);
  });
  console.log(`   Total: ${marketplaceLeads.length} leads\n`);
  
  // Test 2: Query round-robin leads (scores 5-7)
  console.log('2️⃣  Round-Robin Leads (status=pending_assignment, scores 5-7):');
  const roundRobinBuyers = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'pending_assignment#buyer'
    }
  }));
  
  const roundRobinSellers = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'pending_assignment#seller'
    }
  }));
  
  const roundRobinLeads = [...(roundRobinBuyers.Items || []), ...(roundRobinSellers.Items || [])];
  roundRobinLeads.forEach(lead => {
    console.log(`   ✅ ${lead.contact.name} - ${lead.leadType} - Score: ${lead.score} - $${lead.price}`);
  });
  console.log(`   Total: ${roundRobinLeads.length} leads\n`);
  
  console.log('✅ Query test complete!');
  console.log('\n📝 Summary:');
  console.log(`   - Marketplace leads (8-10): ${marketplaceLeads.length} leads`);
  console.log(`   - Round-robin leads (5-7): ${roundRobinLeads.length} leads`);
  console.log('\n💡 Next steps:');
  console.log('   - Make sure you\'re logged in to the frontend');
  console.log('   - Check that your agent profile has preferences set (lead types, radius, etc.)');
  console.log('   - Verify your agent location is within radius of these leads (California)');
}

testQueries().catch(console.error);
