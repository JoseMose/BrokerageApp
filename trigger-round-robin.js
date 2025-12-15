const { DynamoDBClient } = require('./backend/node_modules/@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('./backend/node_modules/@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

async function triggerRoundRobinAssignment() {
  console.log('🔄 Manually triggering round-robin assignment...\n');
  
  // Get pending assignment leads
  const buyerLeads = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'pending_assignment#buyer'
    }
  }));
  
  const sellerLeads = await ddb.send(new QueryCommand({
    TableName: 'RealtorLeads',
    IndexName: 'StatusTypeIndex',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'pending_assignment#seller'
    }
  }));
  
  const pendingLeads = [...(buyerLeads.Items || []), ...(sellerLeads.Items || [])];
  
  // Filter to only new demo leads (scores 5-7, created today)
  const demoLeads = pendingLeads.filter(lead => 
    lead.score >= 5 && lead.score <= 7 && 
    lead.createdAt.startsWith('2025-12-14')
  );
  
  console.log(`Found ${demoLeads.length} demo leads to assign:\n`);
  
  // Get the test agent
  const agent = await ddb.send(new QueryCommand({
    TableName: 'RealtorAgents',
    KeyConditionExpression: 'agentId = :agentId AND SK = :sk',
    ExpressionAttributeValues: {
      ':agentId': 'e448b458-6021-7040-7c8a-08ca63e72483',
      ':sk': 'profile'
    }
  }));
  
  if (!agent.Items || agent.Items.length === 0) {
    console.log('❌ No agent found');
    console.log('   Please create an agent profile first');
    return;
  }
  
  const testAgent = agent.Items[0];
  const now = new Date().toISOString();
  
  // Assign each lead to the test agent
  for (const lead of demoLeads) {
    // Update lead status
    await ddb.send(new UpdateCommand({
      TableName: 'RealtorLeads',
      Key: {
        leadId: lead.leadId,
        timestamp: lead.timestamp
      },
      UpdateExpression: 'SET #status = :status, assignedTo = :agentId, assignedAt = :now, GSI1PK = :gsi1pk',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'assigned',
        ':agentId': testAgent.agentId,
        ':now': now,
        ':gsi1pk': `assigned#${testAgent.agentId}`
      }
    }));
    
    console.log(`✅ Assigned: ${lead.contact.name} (Score ${lead.score}) → ${testAgent.email}`);
  }
  
  // Update agent's round-robin metadata
  const currentCount = testAgent.roundRobin?.assignedLeadCount || 0;
  const roundRobinData = {
    assignedLeadCount: currentCount + demoLeads.length,
    lastAssignedAt: now,
    maxCapacity: testAgent.roundRobin?.maxCapacity || 10,
    isOnline: testAgent.roundRobin?.isOnline ?? true
  };
  
  await ddb.send(new UpdateCommand({
    TableName: 'RealtorAgents',
    Key: {
      agentId: testAgent.agentId,
      SK: 'profile'
    },
    UpdateExpression: 'SET roundRobin = :roundRobin',
    ExpressionAttributeValues: {
      ':roundRobin': roundRobinData
    }
  }));
  
  console.log(`\n✅ Assignment complete!`);
  console.log(`   Assigned ${demoLeads.length} leads to ${testAgent.email}`);
  console.log(`   Agent now has ${currentCount + demoLeads.length} assigned leads`);
  console.log(`\n💡 Check your "Assigned Leads" section in the dashboard!`);
}

triggerRoundRobinAssignment().catch(console.error);
