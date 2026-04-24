/**
 * Email Service — Nodemailer / SMTP (replaces AWS SES)
 * Works with IBM Cloud Email Delivery, SendGrid SMTP, or any SMTP provider.
 * Same public interface; handlers require zero changes.
 */

/**
 * Email Service — IBM Cloud Email Delivery via SendGrid API
 * Uses @sendgrid/mail (IBM Cloud Email Delivery Service is SendGrid-backed).
 * Same public interface; handlers require zero changes.
 */

import sgMail from '@sendgrid/mail';

const FROM_EMAIL    = process.env.FROM_EMAIL    || 'noreply@jesfandiari.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@jesfandiari.com';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface EmailParams {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export class EmailService {
  // Object-params overload
  static async sendEmail(params: EmailParams): Promise<void>;
  // Positional overload used by older callers: sendEmail(to, subject, body)
  static async sendEmail(to: string, subject: string, body: string): Promise<void>;

  static async sendEmail(
    paramsOrTo: EmailParams | string,
    subject?: string,
    body?: string
  ): Promise<void> {
    let to: string | string[];
    let sub: string;
    let html: string;
    let text: string | undefined;
    let replyTo: string | undefined;

    if (typeof paramsOrTo === 'string') {
      to   = paramsOrTo;
      sub  = subject!;
      html = `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`;
      text = body;
    } else {
      to      = paramsOrTo.to;
      sub     = paramsOrTo.subject;
      html    = paramsOrTo.htmlBody;
      text    = paramsOrTo.textBody;
      replyTo = paramsOrTo.replyTo;
    }

    try {
      const recipients = Array.isArray(to) ? to : [to];
      await sgMail.send({
        from:    FROM_EMAIL,
        to:      recipients,
        subject: sub,
        html,
        text,
        replyTo: replyTo || SUPPORT_EMAIL,
      });
      console.log('Email sent:', { to, subject: sub });
    } catch (err) {
      console.error('Email send failed:', err);
      throw new Error(`Email sending failed: ${(err as any).message}`);
    }
  }

  static async sendWelcomeEmail(
    to: string,
    name: string,
    _unused: string
  ): Promise<void> {
    const dashUrl = process.env.FRONTEND_URL || 'https://jesfandiari.com';
    await EmailService.sendEmail({
      to,
      subject: 'Welcome to Joseph Esfandiari RE — Account Approved',
      htmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#C9A84C">Welcome, ${name}!</h2>
          <p>Your agent account has been approved. You now have access to the Lead Marketplace.</p>
          <p><a href="${dashUrl}/dashboard" style="color:#C9A84C">Go to Dashboard →</a></p>
          <p style="color:#6B7280;font-size:0.85rem">Joseph Esfandiari Real Estate · Atlanta, Georgia</p>
        </div>
      `,
      textBody: `Welcome ${name}! Your account has been approved. Visit ${dashUrl}/dashboard`,
    });
  }

  static async sendLeadPurchaseConfirmation(
    to: string,
    agentName: string,
    leadDetails: any
  ): Promise<void> {
    const dashUrl = process.env.FRONTEND_URL || 'https://jesfandiari.com';
    await EmailService.sendEmail({
      to,
      subject: 'Lead Purchase Confirmed',
      htmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#C9A84C">Lead Purchase Confirmed</h2>
          <p>Hi ${agentName}, your lead has been secured:</p>
          <ul>
            <li><strong>Contact:</strong> ${leadDetails.contact?.name}</li>
            <li><strong>Type:</strong> ${leadDetails.leadType}</li>
            <li><strong>Score:</strong> ${leadDetails.score}/10</li>
            <li><strong>Location:</strong> ${leadDetails.location?.city}, ${leadDetails.location?.state}</li>
          </ul>
          <p><a href="${dashUrl}/dashboard" style="color:#C9A84C">View in Dashboard →</a></p>
        </div>
      `,
    });
  }

  static async sendHighScoreLeadAlert(to: string[], leadDetails: any): Promise<void> {
    const marketUrl = process.env.FRONTEND_URL || 'https://jesfandiari.com';
    await EmailService.sendEmail({
      to,
      subject: `High-Score Lead Available — Score ${leadDetails.score}/10`,
      htmlBody: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#C9A84C">High-Score Lead Alert</h2>
          <p>A new lead scoring <strong>${leadDetails.score}/10</strong> is on the marketplace.</p>
          <ul>
            <li><strong>Type:</strong> ${leadDetails.leadType}</li>
            <li><strong>Location:</strong> ${leadDetails.location?.city}, ${leadDetails.location?.state}</li>
            <li><strong>Price:</strong> $${leadDetails.price}</li>
          </ul>
          <p><a href="${marketUrl}/marketplace" style="color:#C9A84C">Claim this lead →</a></p>
        </div>
      `,
    });
  }

  static async sendWelcomeSMS(_phone: string, _name: string): Promise<void> {
    // SMS handled by SMSService — no-op here for backward compat
  }
}
