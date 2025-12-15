import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@realtorleads.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@realtorleads.com';

interface EmailParams {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

interface TemplatedEmailParams {
  to: string | string[];
  templateName: string;
  templateData: Record<string, any>;
  replyTo?: string;
}

/**
 * Email Service
 * Handles all email communications using AWS SES
 */
export class EmailService {
  /**
   * Send a basic email
   */
  static async sendEmail(params: EmailParams): Promise<void> {
    const { to, subject, htmlBody, textBody, replyTo } = params;

    const recipients = Array.isArray(to) ? to : [to];

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: textBody
            ? {
                Data: textBody,
                Charset: 'UTF-8',
              }
            : undefined,
        },
      },
      ReplyToAddresses: replyTo ? [replyTo] : [SUPPORT_EMAIL],
    });

    try {
      await sesClient.send(command);
      console.log('Email sent successfully:', { to: recipients, subject });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  /**
   * Send templated email (if using SES templates)
   */
  static async sendTemplatedEmail(params: TemplatedEmailParams): Promise<void> {
    const { to, templateName, templateData, replyTo } = params;

    const recipients = Array.isArray(to) ? to : [to];

    const command = new SendTemplatedEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Template: templateName,
      TemplateData: JSON.stringify(templateData),
      ReplyToAddresses: replyTo ? [replyTo] : [SUPPORT_EMAIL],
    });

    try {
      await sesClient.send(command);
      console.log('Templated email sent successfully:', { to: recipients, template: templateName });
    } catch (error) {
      console.error('Failed to send templated email:', error);
      throw new Error(`Templated email sending failed: ${error.message}`);
    }
  }

  /**
   * Send lead submission confirmation to client
   */
  static async sendLeadConfirmation(clientEmail: string, clientName: string, leadType: string): Promise<void> {
    const subject = '🎉 Thank you for your interest!';
    const htmlBody = this.getLeadConfirmationTemplate(clientName, leadType);
    const textBody = `Hi ${clientName},\n\nThank you for submitting your information! We've received your ${leadType} inquiry and our top-rated real estate agents are reviewing your details now.\n\nWhat happens next:\n1. Our AI matches you with the best agents in your area\n2. A qualified agent will reach out within 24 hours\n3. They'll help you achieve your real estate goals\n\nIf you have any questions, feel free to reply to this email.\n\nBest regards,\nRealtor Lead Generation Team`;

    await this.sendEmail({
      to: clientEmail,
      subject,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send new lead assignment notification to agent
   */
  static async sendLeadAssignment(
    agentEmail: string,
    agentName: string,
    lead: {
      name: string;
      email: string;
      phone: string;
      leadType: string;
      score: number;
      location: string;
      timeline: string;
    }
  ): Promise<void> {
    const subject = `🎯 New Lead Assigned: ${lead.name} (Score: ${lead.score}/10)`;
    const htmlBody = this.getLeadAssignmentTemplate(agentName, lead);
    const textBody = `Hi ${agentName},\n\nYou've been assigned a new ${lead.leadType} lead!\n\nLead Details:\n- Name: ${lead.name}\n- Email: ${lead.email}\n- Phone: ${lead.phone}\n- Score: ${lead.score}/10\n- Location: ${lead.location}\n- Timeline: ${lead.timeline}\n\nLog in to your dashboard to view full details and contact information.\n\nBest regards,\nRealtor Lead Generation Platform`;

    await this.sendEmail({
      to: agentEmail,
      subject,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send lead purchase confirmation to agent
   */
  static async sendPurchaseConfirmation(
    agentEmail: string,
    agentName: string,
    lead: {
      name: string;
      email: string;
      phone: string;
      leadType: string;
      score: number;
      price: number;
      transactionId: string;
    }
  ): Promise<void> {
    const subject = `✅ Purchase Confirmed: ${lead.name}`;
    const htmlBody = this.getPurchaseConfirmationTemplate(agentName, lead);
    const textBody = `Hi ${agentName},\n\nYour lead purchase has been confirmed!\n\nLead Details:\n- Name: ${lead.name}\n- Email: ${lead.email}\n- Phone: ${lead.phone}\n- Type: ${lead.leadType}\n- Score: ${lead.score}/10\n- Price: $${lead.price}\n- Transaction ID: ${lead.transactionId}\n\nContact information is now available in your dashboard. We recommend reaching out within the first 24 hours for the best response rate.\n\nBest regards,\nRealtor Lead Generation Platform`;

    await this.sendEmail({
      to: agentEmail,
      subject,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send welcome email to new agent
   */
  static async sendWelcomeEmail(agentEmail: string, agentName: string, temporaryPassword?: string): Promise<void> {
    const subject = '🎉 Welcome to Realtor Lead Generation Platform!';
    const htmlBody = this.getWelcomeTemplate(agentName, temporaryPassword);
    const textBody = `Hi ${agentName},\n\nWelcome to Realtor Lead Generation Platform! We're excited to help you grow your real estate business.\n\nGetting Started:\n1. Complete your profile with license and brokerage information\n2. Set your lead preferences (buyer/seller, score threshold, price range)\n3. Browse the marketplace for available leads\n4. Use the funnel to track your leads through the sales cycle\n\n${temporaryPassword ? `Your temporary password: ${temporaryPassword}\nPlease change this after your first login.\n\n` : ''}Visit: https://app.realtorleads.com\n\nNeed help? Reply to this email or contact support@realtorleads.com\n\nBest regards,\nRealtor Lead Generation Team`;

    await this.sendEmail({
      to: agentEmail,
      subject,
      htmlBody,
      textBody,
    });
  }

  /**
   * Send feedback request email
   */
  static async sendFeedbackRequest(agentEmail: string, agentName: string, leadName: string, leadId: string): Promise<void> {
    const subject = `How was your experience with ${leadName}?`;
    const htmlBody = this.getFeedbackRequestTemplate(agentName, leadName, leadId);

    await this.sendEmail({
      to: agentEmail,
      subject,
      htmlBody,
    });
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  private static getLeadConfirmationTemplate(clientName: string, leadType: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">🎉 Thank You!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${clientName},</p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for submitting your information! We've received your <strong>${leadType}</strong> inquiry and our top-rated real estate agents are reviewing your details now.
              </p>
              
              <div style="background-color: #f0f7ff; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px 0; color: #0B1D38; font-size: 18px;">What happens next:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #4B5563;">
                  <li style="margin-bottom: 10px;">Our AI matches you with the best agents in your area</li>
                  <li style="margin-bottom: 10px;">A qualified agent will reach out within 24 hours</li>
                  <li>They'll help you achieve your real estate goals</li>
                </ol>
              </div>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 20px 0;">
                Our agents are experienced professionals who know your local market inside and out. They're eager to help you find your dream home or sell your property for the best price.
              </p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 20px 0;">
                If you have any questions in the meantime, feel free to reply to this email.
              </p>
              
              <p style="font-size: 16px; color: #4B5563; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>Realtor Lead Generation Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0;">
                © 2025 Realtor Lead Generation Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private static getLeadAssignmentTemplate(agentName: string, lead: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Assigned</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">🎯 New Lead Assigned!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${agentName},</p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
                Great news! You've been automatically assigned a new <strong>${lead.leadType}</strong> lead that matches your preferences.
              </p>
              
              <!-- Lead Details Card -->
              <div style="background-color: #f0f7ff; border: 2px solid #667eea; padding: 25px; margin: 30px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 20px;">Lead Details</h3>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #6B7280; font-size: 14px; width: 40%;">Name:</td>
                    <td style="color: #0B1D38; font-size: 16px; font-weight: 600;">${lead.name}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Email:</td>
                    <td style="color: #0B1D38; font-size: 16px;">${lead.email}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Phone:</td>
                    <td style="color: #0B1D38; font-size: 16px;">${lead.phone}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">AI Score:</td>
                    <td style="color: #10b981; font-size: 18px; font-weight: bold;">${lead.score}/10</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Location:</td>
                    <td style="color: #0B1D38; font-size: 16px;">${lead.location}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Timeline:</td>
                    <td style="color: #0B1D38; font-size: 16px;">${lead.timeline}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>💡 Pro Tip:</strong> Reach out within 24 hours for the best response rate!
                </p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://app.realtorleads.com/my-leads" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      View Full Lead Details →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #4B5563; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>Realtor Lead Generation Platform</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0 0 10px 0;">
                © 2025 Realtor Lead Generation Platform. All rights reserved.
              </p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                <a href="https://app.realtorleads.com/profile" style="color: #667eea; text-decoration: none;">Update Preferences</a> | 
                <a href="https://app.realtorleads.com/settings" style="color: #667eea; text-decoration: none;">Go Offline</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private static getPurchaseConfirmationTemplate(agentName: string, lead: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">✅ Purchase Confirmed!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${agentName},</p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
                Your lead purchase has been successfully processed! The full contact information is now available in your dashboard.
              </p>
              
              <!-- Lead Details -->
              <div style="background-color: #f0f7ff; border: 2px solid #667eea; padding: 25px; margin: 30px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 20px;">Lead Information</h3>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #6B7280; font-size: 14px; width: 35%;">Name:</td>
                    <td style="color: #0B1D38; font-size: 16px; font-weight: 600;">${lead.name}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Email:</td>
                    <td style="color: #667eea; font-size: 16px;"><a href="mailto:${lead.email}" style="color: #667eea; text-decoration: none;">${lead.email}</a></td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Phone:</td>
                    <td style="color: #667eea; font-size: 16px;"><a href="tel:${lead.phone}" style="color: #667eea; text-decoration: none;">${lead.phone}</a></td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Type:</td>
                    <td style="color: #0B1D38; font-size: 16px;">${lead.leadType === 'buyer' ? '🏠 Buyer' : '💰 Seller'}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">AI Score:</td>
                    <td style="color: #10b981; font-size: 18px; font-weight: bold;">${lead.score}/10</td>
                  </tr>
                </table>
              </div>
              
              <!-- Transaction Details -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h4 style="margin: 0 0 15px 0; color: #0B1D38; font-size: 16px;">Transaction Details</h4>
                <table width="100%" cellpadding="6" cellspacing="0">
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Amount Paid:</td>
                    <td style="color: #0B1D38; font-size: 16px; font-weight: 600; text-align: right;">$${lead.price.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 14px;">Transaction ID:</td>
                    <td style="color: #6B7280; font-size: 14px; text-align: right;">${lead.transactionId}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">
                  <strong>🚀 Best Practices:</strong> Agents who contact leads within the first 24 hours see 3x higher conversion rates!
                </p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://app.realtorleads.com/my-leads" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      View in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #4B5563; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>Realtor Lead Generation Platform</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0 0 10px 0;">
                © 2025 Realtor Lead Generation Platform. All rights reserved.
              </p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                Questions? <a href="mailto:support@realtorleads.com" style="color: #667eea; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private static getWelcomeTemplate(agentName: string, temporaryPassword?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 36px;">🎉 Welcome!</h1>
              <p style="color: #ffffff; margin: 0; font-size: 18px; opacity: 0.95;">Let's grow your real estate business together</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${agentName},</p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
                Welcome to <strong>Realtor Lead Generation Platform</strong>! We're thrilled to have you on board. Our platform connects you with high-quality, pre-qualified leads matched to your specific preferences.
              </p>
              
              ${
                temporaryPassword
                  ? `
              <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">🔐 Your Login Credentials</h4>
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code>
                </p>
                <p style="margin: 10px 0 0 0; color: #92400e; font-size: 13px;">
                  Please change this password after your first login for security.
                </p>
              </div>
              `
                  : ''
              }
              
              <!-- Getting Started -->
              <div style="background-color: #f0f7ff; border-left: 4px solid #667eea; padding: 25px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 20px;">🚀 Getting Started</h3>
                <ol style="margin: 0; padding-left: 20px; color: #4B5563; line-height: 1.8;">
                  <li style="margin-bottom: 12px;"><strong>Complete Your Profile</strong> - Add your license, brokerage, and photo</li>
                  <li style="margin-bottom: 12px;"><strong>Set Your Preferences</strong> - Choose lead types, score threshold, and service area</li>
                  <li style="margin-bottom: 12px;"><strong>Browse the Marketplace</strong> - Find leads that match your criteria</li>
                  <li style="margin-bottom: 12px;"><strong>Track Your Pipeline</strong> - Use the funnel to manage your leads</li>
                </ol>
              </div>
              
              <!-- Features -->
              <h3 style="color: #0B1D38; font-size: 20px; margin: 30px 0 20px 0;">✨ Platform Features</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #667eea; font-size: 18px; margin-right: 10px;">🤖</span>
                    <strong style="color: #0B1D38;">AI-Powered Matching</strong>
                    <p style="color: #6B7280; font-size: 14px; margin: 5px 0 0 0;">Leads scored 1-10 and matched to your preferences</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #10b981; font-size: 18px; margin-right: 10px;">📊</span>
                    <strong style="color: #0B1D38;">Sales Funnel</strong>
                    <p style="color: #6B7280; font-size: 14px; margin: 5px 0 0 0;">Track leads from first contact to closed deal</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #f59e0b; font-size: 18px; margin-right: 10px;">💰</span>
                    <strong style="color: #0B1D38;">Flexible Pricing</strong>
                    <p style="color: #6B7280; font-size: 14px; margin: 5px 0 0 0;">Pay-per-lead or bulk packages with discounts</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #ec4899; font-size: 18px; margin-right: 10px;">⭐</span>
                    <strong style="color: #0B1D38;">Lead Feedback</strong>
                    <p style="color: #6B7280; font-size: 14px; margin: 5px 0 0 0;">Rate lead quality to help improve our AI</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://app.realtorleads.com" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      Get Started Now →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 20px 0;">
                Need help getting started? Our support team is here for you. Just reply to this email or visit our <a href="https://support.realtorleads.com" style="color: #667eea; text-decoration: none;">Help Center</a>.
              </p>
              
              <p style="font-size: 16px; color: #4B5563; margin: 30px 0 0 0;">
                Here's to your success!<br>
                <strong>The Realtor Lead Generation Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0 0 10px 0;">
                © 2025 Realtor Lead Generation Platform. All rights reserved.
              </p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                <a href="https://app.realtorleads.com/help" style="color: #667eea; text-decoration: none; margin: 0 10px;">Help Center</a> |
                <a href="https://app.realtorleads.com/terms" style="color: #667eea; text-decoration: none; margin: 0 10px;">Terms</a> |
                <a href="https://app.realtorleads.com/privacy" style="color: #667eea; text-decoration: none; margin: 0 10px;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private static getFeedbackRequestTemplate(agentName: string, leadName: string, leadId: string): string {
    const feedbackUrl = `https://app.realtorleads.com/my-leads?rate=${leadId}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">⭐ How was your lead?</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${agentName},</p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                We'd love to hear about your experience with <strong>${leadName}</strong>. Your feedback helps us improve our lead quality and AI matching.
              </p>
              
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 30px 0;">
                It only takes 2 minutes!
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${feedbackUrl}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);">
                      ⭐ Rate This Lead
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                Your feedback is confidential and helps improve the platform for everyone.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0;">
                © 2025 Realtor Lead Generation Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
