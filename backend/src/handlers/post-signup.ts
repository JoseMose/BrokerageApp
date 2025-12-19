import { DynamoDBService } from '../utils/dynamodb';
import { getConfig, Agent } from '../utils/types';

const config = getConfig();

/**
 * Cognito Post-Confirmation Trigger
 * Automatically creates agent profile after successful signup
 */
export const handler = async (event: any) => {
  console.log('Post-confirmation trigger:', JSON.stringify(event, null, 2));

  try {
    const { userAttributes, userName } = event.request;
    
    // Handle both PostConfirmation_ConfirmSignUp and PostConfirmation_ConfirmForgotPassword
    // Skip only password recovery
    if (event.triggerSource === 'PostConfirmation_ConfirmForgotPassword') {
      console.log('Skipping profile creation for password recovery');
      return event;
    }
    
    // Check if profile already exists (in case trigger runs multiple times)
    const existingProfile = await DynamoDBService.getItem(
      config.AGENTS_TABLE_NAME,
      { agentId: userName, SK: 'profile' }
    );
    
    if (existingProfile) {
      console.log('✅ Profile already exists for:', userAttributes.email);
      return event;
    }

    const timestamp = new Date().toISOString();
    
    // Extract attributes from Cognito
    const name = userAttributes.name || '';
    const email = userAttributes.email || '';
    const phone = userAttributes.phone_number || '';
    const licenseId = userAttributes['custom:licenseId'] || '';
    const licenseState = userAttributes['custom:licenseState'] || '';
    const brokerage = userAttributes['custom:brokerage'] || '';

    // Create minimal agent profile with pending status
    const agent: Partial<Agent> = {
      agentId: userName, // Cognito user ID
      SK: 'profile',
      email,
      name,
      licenseId,
      licenseState,
      brokerage,
      phone: phone.replace(/\D/g, ''), // Remove non-digits
      // Placeholder location - they'll need to update this
      location: {
        lat: 0,
        lng: 0,
        address: '',
        city: '',
        state: licenseState,
        zip: '',
      },
      radius: 50, // Default 50 miles
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
        isOnline: false, // Offline until approved
      },
      status: 'active',
      verificationStatus: 'pending',
      verificationRequestedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Create the agent profile in DynamoDB
    await DynamoDBService.putItem(config.AGENTS_TABLE_NAME, agent);

    console.log('✅ Agent profile created for:', email);

    return event;
  } catch (error) {
    console.error('❌ Post-confirmation error:', error);
    // Don't fail the signup - just log the error
    return event;
  }
};
