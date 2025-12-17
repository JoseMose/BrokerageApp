#!/usr/bin/env node

/**
 * Manually create agent profile for user who signed up before Lambda trigger was fixed
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const agentId = '2498b4a8-9061-7078-76f1-ee8be21f0c41';
const email = 'hediehbahmani80@gmail.com';
const name = 'Hedi Bahmani';
const phone = '+14703342018';
const licenseId = '415844';

async function createAgentProfile() {
  const timestamp = new Date().toISOString();
  
  const agentProfile = {
    agentId,
    SK: 'profile',
    email,
    name,
    phone,
    licenseId,
    licenseState: 'GA', // Default, they can update
    brokerage: '', // They need to fill this in
    status: 'active',
    verificationStatus: 'pending',
    verificationRequestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    location: {
      city: '',
      state: 'GA',
      zip: ''
    },
    preferences: {
      leadTypes: ['buyer', 'seller'],
      minScore: 5,
      maxPrice: 100,
      propertyTypes: ['single-family', 'condo', 'townhouse'],
      clientPriceRange: {
        min: 100000,
        max: 1000000
      }
    },
    radius: 25,
    roundRobin: {
      isOnline: true,
      maxCapacity: 10,
      assignedLeadsCount: 0,
      lastAssignedAt: null
    },
    performanceMetrics: {
      totalLeadsPurchased: 0,
      totalSpent: 0,
      averageLeadScore: 0,
      conversionRate: 0
    },
    assignedLeadsCount: 0
  };

  try {
    await docClient.send(new PutCommand({
      TableName: 'RealtorAgents',
      Item: agentProfile
    }));
    
    console.log('✅ Agent profile created successfully!');
    console.log('');
    console.log('Agent Details:');
    console.log('  Name:', name);
    console.log('  Email:', email);
    console.log('  License ID:', licenseId);
    console.log('  Status: Active');
    console.log('  Verification: Pending');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Agent should appear in admin verification tab');
    console.log('  2. Admin can approve their account');
    console.log('  3. Agent can complete their profile');
  } catch (error) {
    console.error('❌ Error creating agent profile:', error);
  }
}

createAgentProfile();
