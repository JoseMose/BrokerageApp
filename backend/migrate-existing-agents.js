/**
 * Migration Script: Add verification status to existing agents
 * Run this ONCE after deploying the verification feature
 */

const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const TABLE_NAME = 'RealtorAgents';

async function migrateAgents() {
  console.log('🔄 Starting agent migration...');
  
  try {
    // Scan all agents
    const scanResult = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: marshall({
          ':sk': 'profile',
        }),
      })
    );

    const agents = scanResult.Items.map((item) => unmarshall(item));
    console.log(`Found ${agents.length} agents to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const agent of agents) {
      // Skip if already has verificationStatus
      if (agent.verificationStatus) {
        console.log(`✓ Skipping ${agent.name} - already has verificationStatus: ${agent.verificationStatus}`);
        skipped++;
        continue;
      }

      // Update agent with approved status (assume existing agents are already verified)
      const timestamp = new Date().toISOString();
      
      await dynamodb.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: marshall({
            agentId: agent.agentId,
            SK: 'profile',
          }),
          UpdateExpression: 'SET verificationStatus = :status, verificationRequestedAt = :requestedAt, verificationReviewedAt = :reviewedAt, verificationReviewedBy = :reviewedBy, updatedAt = :updatedAt',
          ExpressionAttributeValues: marshall({
            ':status': 'approved',
            ':requestedAt': agent.createdAt || timestamp,
            ':reviewedAt': timestamp,
            ':reviewedBy': 'MIGRATION_SCRIPT',
            ':updatedAt': timestamp,
          }),
        })
      );

      console.log(`✅ Updated ${agent.name} (${agent.email}) - set to 'approved'`);
      updated++;
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Updated: ${updated} agents`);
    console.log(`   Skipped: ${skipped} agents`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateAgents()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
