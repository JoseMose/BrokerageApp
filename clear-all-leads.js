#!/usr/bin/env node

/**
 * Clear All Leads Script
 * Removes all leads from the RealtorLeads table
 * Use this to prepare for production launch
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'RealtorLeads';

async function clearAllLeads() {
  console.log('🔍 Scanning for all leads in RealtorLeads table...');
  
  try {
    // Scan all items
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
    }));

    const items = scanResult.Items || [];
    
    if (items.length === 0) {
      console.log('✅ No leads found. Table is already empty.');
      return;
    }

    console.log(`📊 Found ${items.length} leads to delete:`);
    items.forEach(item => {
      console.log(`   - ${item.leadId} (${item.status}) - ${item.leadType} - Score: ${item.score}`);
    });

    // Batch delete in chunks of 25 (DynamoDB limit)
    const chunks = [];
    for (let i = 0; i < items.length; i += 25) {
      chunks.push(items.slice(i, i + 25));
    }

    console.log(`\n🗑️  Deleting ${items.length} leads in ${chunks.length} batch(es)...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const deleteRequests = chunk.map(item => ({
        DeleteRequest: {
          Key: {
            leadId: item.leadId,
            SK: item.SK,
          },
        },
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: deleteRequests,
        },
      }));

      console.log(`   ✓ Batch ${i + 1}/${chunks.length} deleted (${chunk.length} items)`);
    }

    console.log(`\n✅ Successfully deleted all ${items.length} leads!`);
    console.log('📋 System is now ready for production with a clean leads table.');

  } catch (error) {
    console.error('❌ Error clearing leads:', error.message);
    process.exit(1);
  }
}

// Run the script
clearAllLeads();
