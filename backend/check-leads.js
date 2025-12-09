const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

async function checkLeads() {
  try {
    console.log('📊 Scanning RealtorLeads table...\n');
    
    const scanResult = await ddb.send(new ScanCommand({
      TableName: 'RealtorLeads'
    }));
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('❌ No leads found in the database.\n');
      return;
    }
    
    console.log(`✅ Found ${scanResult.Items.length} lead(s) in the database:\n`);
    
    scanResult.Items.forEach((lead, index) => {
      console.log(`--- Lead ${index + 1} ---`);
      console.log(`Lead ID: ${lead.leadId}`);
      console.log(`Status: ${lead.status}`);
      console.log(`Type: ${lead.leadType || 'N/A'}`);
      console.log(`Score: ${lead.score}/10`);
      console.log(`Price: $${lead.price / 100}`);
      console.log(`Contact: ${lead.contact?.name || 'N/A'}`);
      console.log(`Email: ${lead.contact?.email || 'N/A'}`);
      console.log(`Phone: ${lead.contact?.phone || 'N/A'}`);
      console.log(`Location: ${lead.location?.city || 'N/A'}, ${lead.location?.state || 'N/A'}`);
      console.log(`Created: ${lead.createdAt || 'N/A'}`);
      console.log(`Expires: ${lead.expiresAt || 'N/A'}`);
      console.log(`AI Reason: ${lead.aiReason || 'N/A'}`);
      console.log('');
    });
    
    // Summary by status
    const statusCounts = {};
    scanResult.Items.forEach(lead => {
      const status = lead.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('📈 Summary by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking leads:', error);
  }
}

checkLeads();
