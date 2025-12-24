const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const LEADS_TABLE = 'RealtorLeads';

async function deleteAllLeads() {
  try {
    console.log('Scanning for all leads...');
    
    // Scan the table to get all leads
    const scanResult = await ddb.send(new ScanCommand({
      TableName: LEADS_TABLE
    }));
    
    const leads = scanResult.Items || [];
    console.log(`Found ${leads.length} leads to delete`);
    
    if (leads.length === 0) {
      console.log('No leads to delete');
      return;
    }
    
    // Delete each lead
    let deletedCount = 0;
    for (const lead of leads) {
      try {
        await ddb.send(new DeleteCommand({
          TableName: LEADS_TABLE,
          Key: {
            leadId: lead.leadId,
            SK: lead.SK
          }
        }));
        deletedCount++;
        console.log(`Deleted lead ${deletedCount}/${leads.length}: ${lead.leadId} (${lead.contact?.name || 'Unknown'})`);
      } catch (error) {
        console.error(`Failed to delete lead ${lead.leadId}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully deleted ${deletedCount} out of ${leads.length} leads`);
    console.log('Admin dashboard will now show 0 leads');
    
  } catch (error) {
    console.error('Error deleting leads:', error);
    throw error;
  }
}

deleteAllLeads()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
