import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface SMSParams {
  phoneNumber: string;
  message: string;
  senderID?: string;
}

/**
 * SMS Service
 * Handles SMS notifications using AWS SNS
 */
export class SMSService {
  /**
   * Send SMS message
   */
  static async sendSMS(params: SMSParams): Promise<void> {
    const { phoneNumber, message, senderID } = params;

    // Format phone number to E.164 format (+1XXXXXXXXXX)
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const command = new PublishCommand({
      PhoneNumber: formattedPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: senderID || 'RealtorLead',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Use Transactional for important messages
        },
      },
    });

    try {
      await snsClient.send(command);
      console.log('SMS sent successfully:', { phone: formattedPhone });
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  /**
   * Send urgent lead alert (for high-score leads)
   */
  static async sendUrgentLeadAlert(
    agentPhone: string,
    agentName: string,
    lead: {
      name: string;
      score: number;
      leadType: string;
      location: string;
    }
  ): Promise<void> {
    const message = `🔥 URGENT LEAD ALERT!\n\nHi ${agentName}, you've been assigned a high-priority ${lead.leadType} lead!\n\nLead: ${lead.name}\nScore: ${lead.score}/10\nLocation: ${lead.location}\n\nLog in to view full details: https://app.realtorleads.com/my-leads`;

    await this.sendSMS({
      phoneNumber: agentPhone,
      message,
      senderID: 'RealtorLead',
    });
  }

  /**
   * Send lead purchase confirmation SMS
   */
  static async sendPurchaseConfirmationSMS(
    agentPhone: string,
    agentName: string,
    leadName: string
  ): Promise<void> {
    const message = `✅ Purchase confirmed!\n\nHi ${agentName}, your lead purchase for ${leadName} is complete. Contact info is now available in your dashboard.\n\nView: https://app.realtorleads.com/my-leads`;

    await this.sendSMS({
      phoneNumber: agentPhone,
      message,
      senderID: 'RealtorLead',
    });
  }

  /**
   * Send new lead assignment SMS
   */
  static async sendLeadAssignmentSMS(
    agentPhone: string,
    agentName: string,
    lead: {
      name: string;
      score: number;
      leadType: string;
    }
  ): Promise<void> {
    const message = `🎯 New Lead Assigned!\n\n${agentName}, you have a new ${lead.leadType} lead: ${lead.name} (Score: ${lead.score}/10)\n\nView details: https://app.realtorleads.com/my-leads`;

    await this.sendSMS({
      phoneNumber: agentPhone,
      message,
      senderID: 'RealtorLead',
    });
  }

  /**
   * Send welcome SMS to new agent
   */
  static async sendWelcomeSMS(agentPhone: string, agentName: string): Promise<void> {
    const message = `🎉 Welcome to Realtor Lead Generation, ${agentName}!\n\nYour account is ready. Complete your profile to start receiving leads: https://app.realtorleads.com/profile\n\nQuestions? Reply to this message or email support@realtorleads.com`;

    await this.sendSMS({
      phoneNumber: agentPhone,
      message,
      senderID: 'RealtorLead',
    });
  }

  /**
   * Send feedback request SMS
   */
  static async sendFeedbackRequestSMS(
    agentPhone: string,
    agentName: string,
    leadName: string,
    leadId: string
  ): Promise<void> {
    const message = `⭐ How was your lead?\n\n${agentName}, please rate your experience with ${leadName}. Your feedback helps improve our platform!\n\nRate now: https://app.realtorleads.com/my-leads?rate=${leadId}`;

    await this.sendSMS({
      phoneNumber: agentPhone,
      message,
      senderID: 'RealtorLead',
    });
  }

  /**
   * Format phone number to E.164 format
   * Supports: (555) 123-4567, 555-123-4567, 5551234567, +15551234567
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If already starts with country code, return with +
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // If 10 digits, add US country code +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If already has +, return as is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Otherwise, throw error
    throw new Error(`Invalid phone number format: ${phone}`);
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    try {
      this.formatPhoneNumber(phone);
      return true;
    } catch {
      return false;
    }
  }
}
