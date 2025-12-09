const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

/**
 * Reset all agent performance metrics to zero
 */
async function resetAgentMetrics() {
  try {
    let updatedCount = 0;
    let lastEvaluatedKey = undefined;
    
    console.log('\n👤 Scanning RealtorAgents table...');
    
    do {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: 'RealtorAgents',
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': 'profile'
        },
        ExclusiveStartKey: lastEvaluatedKey
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        for (const agent of scanResult.Items) {
          // Reset performance metrics to zero
          await ddb.send(new UpdateCommand({
            TableName: 'RealtorAgents',
            Key: {
              agentId: agent.agentId,
              SK: 'profile'
            },
            UpdateExpression: 'SET performanceMetrics.totalSpent = :zero, performanceMetrics.leadsOwned = :zero, performanceMetrics.conversionRate = :zero, updatedAt = :now',
            ExpressionAttributeValues: {
              ':zero': 0,
              ':now': new Date().toISOString()
            }
          }));
          
          updatedCount++;
          console.log(`✅ Reset metrics for agent: ${agent.name || agent.email}`);
        }
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n📈 Successfully reset metrics for ${updatedCount} agents!`);
    
  } catch (error) {
    console.error('❌ Error resetting agent metrics:', error);
    throw error;
  }
}

/**
 * Clear all transactions from the RealtorTransactions table
 */
async function clearAllTransactions() {
  try {
    let deletedCount = 0;
    let lastEvaluatedKey = undefined;
    
    console.log('\n📜 Scanning RealtorTransactions table...');
    
    do {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: 'RealtorTransactions',
        ExclusiveStartKey: lastEvaluatedKey
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        for (const item of scanResult.Items) {
          await ddb.send(new DeleteCommand({
            TableName: 'RealtorTransactions',
            Key: {
              transactionId: item.transactionId,
              timestamp: item.timestamp
            }
          }));
          
          deletedCount++;
          console.log(`✅ Deleted transaction: ${item.transactionId} ($${item.amount/100})`);
        }
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n💳 Successfully deleted ${deletedCount} transactions!`);
    
  } catch (error) {
    console.error('❌ Error clearing transactions:', error);
    throw error;
  }
}

/**
 * Clear all leads from the RealtorLeads table
 * WARNING: This will delete ALL leads in the database (available, claimed, locked, etc.)!
 */
async function clearAllLeads() {
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('This includes:');
  console.log('  - Available leads in marketplace');
  console.log('  - Purchased/claimed leads');
  console.log('  - Locked leads');
  console.log('  - Assigned leads');
  console.log('  - Bulk packages');
  console.log('  - Transaction history');
  console.log('  - Purchase records\n');
  console.log('Starting in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    let deletedCount = 0;
    let deletedByStatus = {
      available: 0,
      claimed: 0,
      locked: 0,
      assigned: 0,
      bulk: 0,
      other: 0
    };
    let lastEvaluatedKey = undefined;
    
    console.log('📊 Scanning RealtorLeads table...');
    
    do {
      // Scan the table
      const scanResult = await ddb.send(new ScanCommand({
        TableName: 'RealtorLeads',
        ExclusiveStartKey: lastEvaluatedKey
      }));
      
      // Delete each item
      if (scanResult.Items && scanResult.Items.length > 0) {
        for (const item of scanResult.Items) {
          await ddb.send(new DeleteCommand({
            TableName: 'RealtorLeads',
            Key: {
              leadId: item.leadId,
              timestamp: item.timestamp
            }
          }));
          
          deletedCount++;
          
          // Track by status
          const status = item.status || 'other';
          if (deletedByStatus[status] !== undefined) {
            deletedByStatus[status]++;
          } else {
            deletedByStatus.other++;
          }
          
          const statusLabel = item.status ? `[${item.status.toUpperCase()}]` : '[UNKNOWN]';
          console.log(`✅ Deleted ${statusLabel}: ${item.leadId} (${item.contact?.name || 'Unknown'})`);
        }
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n� Successfully deleted ${deletedCount} total leads!`);
    console.log('\nBreakdown by status:');
    console.log(`  Available (marketplace): ${deletedByStatus.available}`);
    console.log(`  Claimed (purchased): ${deletedByStatus.claimed}`);
    console.log(`  Locked (in checkout): ${deletedByStatus.locked}`);
    console.log(`  Assigned (auto-assigned): ${deletedByStatus.assigned}`);
    console.log(`  Bulk packages: ${deletedByStatus.bulk}`);
    console.log(`  Other: ${deletedByStatus.other}`);
    
    // Also clear all transactions
    await clearAllTransactions();
    
    // Reset agent performance metrics
    await resetAgentMetrics();
    
    console.log('\n✨ COMPLETE! All data cleared:');
    console.log('  ✅ Marketplace is empty');
    console.log('  ✅ Purchase history cleared');
    console.log('  ✅ Transaction records deleted');
    console.log('  ✅ Dashboard stats reset to 0');
    console.log('  ✅ Agent performance metrics reset');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

/**
 * Clear only demo/fake leads (optional: can filter by specific criteria)
 * This is a safer option if you want to keep real production leads
 */
async function clearDemoLeadsOnly() {
  console.log('Clearing demo leads only...');
  console.log('This will delete leads with demo email domains (@email.com)');
  console.log('Starting in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    let deletedCount = 0;
    let lastEvaluatedKey = undefined;
    
    console.log('Scanning for demo leads...');
    
    do {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: 'RealtorLeads',
        ExclusiveStartKey: lastEvaluatedKey
      }));
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        for (const item of scanResult.Items) {
          // Check if this is a demo lead (email ends with @email.com)
          const isDemo = item.contact?.email?.endsWith('@email.com');
          
          if (isDemo) {
            await ddb.send(new DeleteCommand({
              TableName: 'RealtorLeads',
              Key: {
                leadId: item.leadId,
                timestamp: item.timestamp
              }
            }));
            
            deletedCount++;
            console.log(`✅ Deleted demo lead: ${item.leadId} (${item.contact?.name})`);
          }
        }
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n🎉 Successfully deleted ${deletedCount} demo leads!`);
    
  } catch (error) {
    console.error('❌ Error clearing demo data:', error);
    throw error;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--demo-only')) {
    console.log('Mode: Delete demo leads only\n');
    await clearDemoLeadsOnly();
  } else if (args.includes('--all')) {
    console.log('Mode: Delete ALL leads\n');
    await clearAllLeads();
  } else {
    console.log('Usage:');
    console.log('  node backend/clear-demo-data.js --demo-only  # Delete only demo leads (@email.com)');
    console.log('  node backend/clear-demo-data.js --all        # Delete ALL leads (⚠️  DANGEROUS)');
    console.log('\nNo mode specified. Exiting...');
    process.exit(0);
  }
}

main().catch(console.error);
