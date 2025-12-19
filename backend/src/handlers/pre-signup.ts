/**
 * Cognito Pre-Signup Trigger
 * Auto-confirms users from trusted email domains
 */

// Trusted domains that don't require email verification
const TRUSTED_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'zoho.com',
];

export const handler = async (event: any) => {
  console.log('Pre-signup trigger:', JSON.stringify(event, null, 2));

  try {
    const { userAttributes } = event.request;
    const email = userAttributes.email?.toLowerCase() || '';
    
    // Extract domain from email
    const emailDomain = email.split('@')[1];
    
    // Auto-confirm if from trusted domain
    if (TRUSTED_DOMAINS.includes(emailDomain)) {
      console.log(`✅ Auto-confirming user from trusted domain: ${emailDomain}`);
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
    } else {
      console.log(`⚠️  User from ${emailDomain} will require email verification`);
    }

    return event;
  } catch (error) {
    console.error('❌ Pre-signup error:', error);
    // Don't block signup on error
    return event;
  }
};
