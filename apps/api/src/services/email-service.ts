import sgMail, { MailDataRequired } from '@sendgrid/mail';

// Initialize SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  customArgs?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private readonly defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@trivioq.com';
  }

  /**
   * Send a single email
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent.');
      return { success: false, error: 'SendGrid API key not configured' };
    }

    const mail: MailDataRequired = {
      to: options.to,
      from: options.from || this.defaultFrom,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      customArgs: options.customArgs,
    };

    try {
      const [response] = await sgMail.send(mail);
      return {
        success: response.statusCode === 202,
        messageId: response.headers?.['x-message-id'] as string | undefined,
      };
    } catch (error: any) {
      console.error('SendGrid error:', error);

      // Handle specific SendGrid error codes
      if (error.response?.body) {
        console.error('SendGrid error body:', error.response.body);
      }

      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  /**
   * Send emails to multiple recipients
   */
  async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const email of emails) {
      const result = await this.send(email);
      results.push(result);
    }

    return results;
  }

  /**
   * Send a templated email with variable substitution
   */
  async sendTemplate(
    to: string | string[],
    template: { subject: string; html: string; text?: string },
    variables: Record<string, string>
  ): Promise<EmailResult> {
    // Substitute variables in subject and html
    let subject = template.subject;
    let html = template.html;
    let text = template.text;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(placeholder, value);
      html = html.replace(placeholder, value);
      if (text) text = text.replace(placeholder, value);
    });

    return this.send({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Send a notification email
   */
  async sendNotification(
    to: string,
    userName: string,
    title: string,
    body: string,
    customArgs?: Record<string, string>
  ): Promise<EmailResult> {
    const html = this.renderNotificationEmail(userName, title, body);
    const text = this.renderNotificationText(userName, title, body);

    return this.send({
      to,
      subject: title,
      html,
      text,
      customArgs: {
        type: 'notification',
        ...customArgs,
      },
    });
  }

  /**
   * Send a welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Welcome to TrivioQ! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Welcome to TrivioQ - your daily trivia companion! Get ready to challenge yourself with fun and engaging questions delivered right to your device.</p>
              <p>Here's what you can expect:</p>
              <ul>
                <li>📱 Daily trivia drops tailored to your interests</li>
                <li>🏆 Compete on leaderboards with friends</li>
                <li>🎁 Earn points and unlock rewards</li>
                <li>📚 Learn something new every day</li>
              </ul>
              <a href="https://trivioq.com/dashboard" class="button">Start Playing</a>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TrivioQ. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to,
      subject: 'Welcome to TrivioQ! 🎉',
      html,
      text: `Hi ${userName},\n\nWelcome to TrivioQ! Get ready for daily trivia drops, leaderboard competitions, and more.\n\nStart playing at: https://trivioq.com/dashboard`,
    });
  }

  /**
   * Send subscription expiration reminder
   */
  async sendSubscriptionReminder(
    to: string,
    userName: string,
    tier: string,
    expiryDate: string,
    daysRemaining: number
  ): Promise<EmailResult> {
    const urgencyColor = daysRemaining <= 1 ? '#dc3545' : '#ffc107';
    const urgencyText = daysRemaining <= 1 ? 'Last Chance!' : 'Expiring Soon';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${urgencyColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${urgencyText}</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">Your ${tier} subscription is expiring</p>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Your <strong>${tier}</strong> subscription will expire on <strong>${expiryDate}</strong>.</p>
              <p>Don't lose access to your Premium benefits:</p>
              <ul>
                <li>✨ Unlimited trivia drops</li>
                <li>📊 Detailed statistics</li>
                <li>🏆 Priority leaderboard placement</li>
                <li>🎁 Exclusive rewards</li>
              </ul>
              <p style="text-align: center; margin: 30px 0;">
                <strong style="font-size: 24px; color: ${urgencyColor};">
                  ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining
                </strong>
              </p>
              <div style="text-align: center;">
                <a href="https://trivioq.com/subscription" class="button">Renew Now</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TrivioQ. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to,
      subject: `${urgencyText} - Your ${tier} subscription expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
      html,
    });
  }

  /**
   * Render notification email HTML
   */
  private renderNotificationEmail(userName: string, title: string, body: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; }
            .notification-badge { display: inline-block; background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-bottom: 15px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .preferences-link { color: #667eea; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">TrivioQ</h1>
            </div>
            <div class="content">
              <span class="notification-badge">Notification</span>
              <h2 style="margin-top: 0;">${title}</h2>
              <p>Hi ${userName},</p>
              <p>${body.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TrivioQ. All rights reserved.</p>
              <p>
                <a href="https://trivioq.com/settings/notifications" class="preferences-link">
                  Manage notification preferences
                </a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Render notification email plain text
   */
  private renderNotificationText(userName: string, title: string, body: string): string {
    return `TrivioQ Notification\n\nHi ${userName},\n\n${title}\n\n${body}\n\n---\n© ${new Date().getFullYear()} TrivioQ. All rights reserved.`;
  }
}

// Singleton instance
export const emailService = new EmailService();