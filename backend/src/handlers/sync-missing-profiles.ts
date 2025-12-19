/**
 * Admin utility to sync Cognito users with missing DynamoDB profiles
 * Can be run manually or scheduled to catch edge cases
 */

import { CognitoIdentityProviderClient, ListUsersCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBService } from '../utils/dynamodb';
import { getConfig, Agent } from '../utils/types';

const config = getConfig();
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event: any) => {
  console.log('🔄 Starting profile sync...');
  
  try {
    // Get all confirmed Cognito users
    const listCommand = new ListUsersCommand({
      UserPoolId: config.USER_POOL_ID,
      Filter: 'cognito:user_status = "CONFIRMED"',
    });
    
    const cognitoUsers = await cognitoClient.send(listCommand);
    console.log(`Found ${cognitoUsers.Users?.length || 0} confirmed users`);
    
    const missingProfiles = [];
    
    // Check each user for a profile
    for (const user of cognitoUsers.Users || []) {
      const username = user.Username!;
      
      // Check if profile exists
      try {
        const profile = await DynamoDBService.getItem(
          config.AGENTS_TABLE_NAME,
          { agentId: username, SK: 'profile' }
        );
        
        if (!profile) {
          console.log(`❌ Missing profile for: ${username}`);
          missingProfiles.push(user);
          
          // Get full user details
          const getUserCommand = new AdminGetUserCommand({
            UserPoolId: config.USER_POOL_ID,
            Username: username,
          });
          
          const userData = await cognitoClient.send(getUserCommand);
          
          // Extract attributes
          const attrs = userData.UserAttributes?.reduce((acc, attr) => {
            acc[attr.Name] = attr.Value;
            return acc;
          }, {} as any) || {};
          
          // Create missing profile
          const timestamp = new Date().toISOString();
          const agent: Partial<Agent> = {
            agentId: username,
            SK: 'profile',
            email: attrs.email || '',
            name: attrs.name || '',
            phone: attrs.phone_number?.replace(/\D/g, '') || '',
            licenseId: attrs['custom:licenseId'] || '',
            licenseState: attrs['custom:licenseState'] || '',
            brokerage: attrs['custom:brokerage'] || '',
            location: {
              lat: 0,
              lng: 0,
              address: '',
              city: '',
              state: attrs['custom:licenseState'] || '',
              zip: '',
            },
            radius: 50,
            preferences: {
              leadTypes: ['buyer', 'seller'],
              minScore: 5,
              maxPrice: 200,
              propertyTypes: ['residential'],
              priceRange: {
                min: 0,
                max: 10000000,
              },
            },
            performanceMetrics: {
              leadsOwned: 0,
              leadsConverted: 0,
              conversionRate: 0,
              totalSpent: 0,
            },
            roundRobin: {
              lastAssignedAt: undefined,
              assignedLeadCount: 0,
              maxCapacity: 10,
              isOnline: false,
            },
            status: 'active',
            verificationStatus: 'pending',
            verificationRequestedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          
          await DynamoDBService.putItem(config.AGENTS_TABLE_NAME, agent);
          console.log(`✅ Created profile for: ${attrs.email}`);
        }
      } catch (error) {
        console.error(`Error checking ${username}:`, error);
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Profile sync complete',
        totalUsers: cognitoUsers.Users?.length || 0,
        missingProfiles: missingProfiles.length,
        fixed: missingProfiles.length,
      }),
    };
  } catch (error) {
    console.error('❌ Sync error:', error);
    throw error;
  }
};
