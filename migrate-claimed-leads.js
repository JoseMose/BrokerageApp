const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const LEADS_TABLE = 'RealtorLeads';

async function migrateClaimedLeads() {
  console.log('🔍 Scanning for claimed leads without assignedAgent field...\n');

  try {
    // Find all leads that have claimedBy but not assignedAgent
    const scanResult = await ddb.send(new ScanCommand({
      TableName: LEADS_TABLE,
      FilterExpression: 'attribute_exists(claimedBy) AND attribute_not_exists(assignedAgent)',
    }));

    const leadsToMigrate = scanResult.Items || [];
    console.log(`Found ${leadsToMigrate.length} leads to migrate\n`);

    if (leadsToMigrate.length === 0) {
      console.log('✅ No leads need migration!');
      return;
    }

    // Update each lead
    let successCount = 0;
    let errorCount = 0;

    for (const lead of leadsToMigrate) {
      try {
        console.log(`Migrating lead ${lead.leadId} (claimedBy: ${lead.claimedBy})...`);

        await ddb.send(new UpdateCommand({
          TableName: LEADS_TABLE,
          Key: {
            leadId: lead.leadId,
            timestamp: lead.timestamp,
          },
          UpdateExpression: 'SET assignedAgent = :agentId, funnelStage = if_not_exists(funnelStage, :stage)',
          ExpressionAttributeValues: {
            ':agentId': lead.claimedBy,
            ':stage': 'new_match',
          },
        }));

        console.log(`  ✅ Migrated successfully\n`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error migrating lead ${lead.leadId}:`, error.message, '\n');
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📝 Total: ${leadsToMigrate.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateClaimedLeads()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
