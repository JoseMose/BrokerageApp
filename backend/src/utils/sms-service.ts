/**
 * SMS Service — IBM Event Notifications (replaces Twilio / AWS SNS)
 * Uses @ibm-cloud/event-notifications-node-admin-sdk for transactional SMS.
 * Same public interface; handlers require zero changes.
 */

import EventNotificationsV1 = require('@ibm-cloud/event-notifications-node-admin-sdk/event-notifications/v1');
import { IamAuthenticator } from 'ibm-cloud-sdk-core';
import { v4 as uuidv4 } from 'uuid';

const INSTANCE_GUID = process.env.IBM_EN_INSTANCE_GUID || '';
const SOURCE_ID     = process.env.IBM_EN_SOURCE_ID     || '';
const REGION        = process.env.IBM_EN_REGION        || 'us-south';

function getClient(): EventNotificationsV1 {
  return EventNotificationsV1.newInstance({
    authenticator: new IamAuthenticator({ apikey: process.env.IBM_EN_API_KEY || '' }),
    serviceUrl:    `https://${REGION}.event-notifications.cloud.ibm.com/event-notifications`,
  });
}

interface SMSParams {
  phoneNumber: string;
  message: string;
  senderID?: string;
}

export class SMSService {
  static async sendSMS(params: SMSParams): Promise<void> {
    const { phoneNumber, message } = params;

    if (!INSTANCE_GUID || !SOURCE_ID) {
      console.warn('IBM Event Notifications not configured — skipping SMS to', phoneNumber);
      return;
    }

    const to = SMSService.formatPhoneNumber(phoneNumber);

    try {
      await getClient().sendNotifications({
        instanceId: INSTANCE_GUID,
        body: {
          specversion:       '1.0',
          id:                uuidv4(),
          source:            SOURCE_ID,
          ibmensourceid:     SOURCE_ID,
          type:              'com.jesfandiari.realtorapp.sms',
          time:              new Date().toISOString(),
          ibmenseverity:     'MEDIUM',
          ibmendefaultshort: message,
          ibmendefaultlong:  message,
          ibmensmstext:      message,
          ibmensmsto:        to,
        },
      });
      console.log('SMS notification sent to:', to);
    } catch (err) {
      console.error('SMS send failed:', err);
      throw new Error(`SMS failed: ${(err as any).message}`);
    }
  }

  static async sendWelcomeSMS(phone: string, name: string): Promise<void> {
    await SMSService.sendSMS({
      phoneNumber: phone,
      message:     `Hi ${name}! Your Joseph Esfandiari RE agent account has been approved. Log in to access leads: ${process.env.FRONTEND_URL || 'https://jesfandiari.com'}/dashboard`,
    });
  }

  static async sendLeadAlertSMS(phones: string[], leadDetails: any): Promise<void> {
    const message = `New lead (${leadDetails.score}/10) in ${leadDetails.location?.city}, ${leadDetails.location?.state}. Claim it: ${process.env.FRONTEND_URL || 'https://jesfandiari.com'}/marketplace`;
    await Promise.allSettled(phones.map((p) => SMSService.sendSMS({ phoneNumber: p, message })));
  }

  private static formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  }
}
