import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  toEmail: string;
  recipientName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  otpCode?: string;
}

@Injectable()
export class BrevoMailService {
  private readonly logger = new Logger(BrevoMailService.name);
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a 6-digit email verification OTP code via Brevo.
   */
  async sendVerificationEmail(
    toEmail: string,
    recipientName: string,
    otpCode: string,
  ): Promise<boolean> {
    const subject = `Your UUHealth Verification Code: ${otpCode}`;
    const htmlContent = this.buildVerificationEmailTemplate(
      recipientName,
      otpCode,
    );
    const textContent = `Hello ${recipientName || 'Member'},\n\nYour United Union Health verification code is: ${otpCode}\n\nThis code will expire in 15 minutes. If you did not create an account, please disregard this email.\n\nUnited Union Health`;

    return this.sendTransactionalEmail({
      toEmail,
      recipientName,
      subject,
      htmlContent,
      textContent,
      otpCode,
    });
  }

  /**
   * Send a 6-digit password reset OTP code via Brevo.
   */
  async sendPasswordResetEmail(
    toEmail: string,
    recipientName: string,
    otpCode: string,
  ): Promise<boolean> {
    const subject = `Reset Your UUHealth Password - Code: ${otpCode}`;
    const htmlContent = this.buildPasswordResetEmailTemplate(
      recipientName,
      otpCode,
    );
    const textContent = `Hello ${recipientName || 'Member'},\n\nWe received a request to reset your United Union Health password.\n\nYour 6-digit password reset code is: ${otpCode}\n\nThis code will expire in 60 minutes. If you did not request a password reset, your account is safe and you can ignore this message.\n\nUnited Union Health`;

    return this.sendTransactionalEmail({
      toEmail,
      recipientName,
      subject,
      htmlContent,
      textContent,
      otpCode,
    });
  }

  /**
   * Dispatch transactional email via Brevo REST API, Brevo SMTP Relay, or dev console fallback.
   */
  private async sendTransactionalEmail(
    options: SendEmailOptions,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY')?.trim();
    const senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL')?.trim() ||
      'no-reply@unitedunionhealth.com';
    const senderName =
      this.configService.get<string>('BREVO_SENDER_NAME')?.trim() ||
      'United Union Health';
    const smtpLogin =
      this.configService.get<string>('BREVO_SMTP_LOGIN')?.trim() || senderEmail;
    const isDev = this.configService.get<string>('NODE_ENV') !== 'production';

    // Development / Offline Fallback if API key is not configured
    if (!apiKey || apiKey === 'your-brevo-api-key-here' || apiKey.length < 10) {
      this.logger.warn(
        `[BrevoMailService] No valid BREVO_API_KEY configured. (DEV FALLBACK)\n` +
          `  >>> TO: ${options.toEmail}\n` +
          `  >>> OTP: ${options.otpCode || 'N/A'}\n` +
          `  >>> SUBJECT: ${options.subject}`,
      );
      return true;
    }

    // Branch 1: Key starts with xsmtpsib- -> Brevo SMTP Relay
    if (apiKey.startsWith('xsmtpsib-')) {
      return this.sendViaSmtpRelay(options, {
        apiKey,
        senderEmail,
        senderName,
        smtpLogin,
        isDev,
      });
    }

    // Branch 2: REST API v3 (standard xkeysib- keys or other API keys)
    return this.sendViaRestApi(options, {
      apiKey,
      senderEmail,
      senderName,
      isDev,
    });
  }

  /**
   * Send via Brevo SMTP Relay (smtp-relay.brevo.com:587) using xsmtpsib- key
   */
  private async sendViaSmtpRelay(
    options: SendEmailOptions,
    config: {
      apiKey: string;
      senderEmail: string;
      senderName: string;
      smtpLogin: string;
      isDev: boolean;
    },
  ): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: config.smtpLogin,
          pass: config.apiKey,
        },
      });

      const info = await transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: options.recipientName
          ? `"${options.recipientName}" <${options.toEmail}>`
          : options.toEmail,
        subject: options.subject,
        text: options.textContent,
        html: options.htmlContent,
      });

      this.logger.log(
        `[BrevoMailService] Successfully dispatched email via SMTP Relay to ${options.toEmail}. Message ID: ${info.messageId}`,
      );
      return true;
    } catch (smtpError: any) {
      this.logger.error(
        `[BrevoMailService] SMTP Relay error sending to ${options.toEmail}: ${smtpError.message}`,
      );
      this.logger.warn(
        `[BrevoMailService] 💡 Tip: If you generated an SMTP key ('xsmtpsib-...'), make sure BREVO_SMTP_LOGIN matches the exact login shown under Brevo Dashboard -> SMTP & API -> SMTP tab. Alternatively, generate a REST API key ('xkeysib-...') from the 'API Keys' tab.`,
      );

      if (config.isDev && options.otpCode) {
        this.logger.log(
          `[BrevoMailService] [DEV OTP BACKUP] Verification code for ${options.toEmail} is: ${options.otpCode}`,
        );
      }
      return false;
    }
  }

  /**
   * Send via Brevo REST API v3 (https://api.brevo.com/v3/smtp/email) using xkeysib- key
   */
  private async sendViaRestApi(
    options: SendEmailOptions,
    config: {
      apiKey: string;
      senderEmail: string;
      senderName: string;
      isDev: boolean;
    },
  ): Promise<boolean> {
    try {
      const payload = {
        sender: {
          name: config.senderName,
          email: config.senderEmail,
        },
        to: [
          {
            email: options.toEmail,
            name: options.recipientName || 'Member',
          },
        ],
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
      };

      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `[BrevoMailService] Brevo REST API error (${response.status}): ${errorBody}`,
        );

        if (response.status === 401) {
          this.logger.warn(
            `[BrevoMailService] 💡 401 Unauthorized: To use the REST API, generate an API key from Brevo Dashboard -> 'SMTP & API' -> 'API Keys' tab (key starts with 'xkeysib-...'). Keys starting with 'xsmtpsib-...' are SMTP relay passwords only.`,
          );
        }

        if (config.isDev && options.otpCode) {
          this.logger.log(
            `[BrevoMailService] [DEV OTP BACKUP] Verification code for ${options.toEmail} is: ${options.otpCode}`,
          );
        }
        return false;
      }

      const data = (await response.json()) as { messageId?: string };
      this.logger.log(
        `[BrevoMailService] Successfully sent email to ${options.toEmail} via REST API. Message ID: ${data.messageId}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `[BrevoMailService] Network exception sending email to ${options.toEmail}: ${error.message || error}`,
      );
      if (config.isDev && options.otpCode) {
        this.logger.log(
          `[BrevoMailService] [DEV OTP BACKUP] Verification code for ${options.toEmail} is: ${options.otpCode}`,
        );
      }
      return false;
    }
  }

  /**
   * Premium UUHealth Email Verification HTML Template
   */
  private buildVerificationEmailTemplate(
    name: string,
    otpCode: string,
  ): string {
    const greetingName = name ? ` ${name}` : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your UUHealth Account</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF6F7; margin: 0; padding: 24px; color: #1F1418; }
    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #ECE4E7; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }
    .header { background: #7A1838; padding: 28px 32px; text-align: center; }
    .header h1 { color: #FFFFFF; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 12px; margin: 6px 0 0 0; }
    .content { padding: 32px; }
    .content h2 { font-size: 18px; font-weight: 700; margin: 0 0 12px 0; color: #1F1418; }
    .content p { font-size: 14px; line-height: 1.5; color: #6B6066; margin: 0 0 20px 0; }
    .otp-box { background: #F6ECF0; border: 1px solid #EBD2DC; border-radius: 12px; padding: 18px 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #7A1838; margin: 0; }
    .otp-caption { font-size: 11px; color: #A69A9F; margin-top: 6px; }
    .notice { font-size: 12px; color: #A69A9F; line-height: 1.4; border-top: 1px solid #ECE4E7; padding-top: 20px; margin-top: 24px; }
    .footer { background: #FAF6F7; padding: 16px 32px; text-align: center; font-size: 11px; color: #A69A9F; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>UNITED UNION HEALTH</h1>
      <p>Continuous Clinical & Telemetry Portal</p>
    </div>
    <div class="content">
      <h2>Welcome${greetingName},</h2>
      <p>Thank you for creating an account with United Union Health. Please use the verification code below to confirm your email address and activate your account.</p>
      
      <div class="otp-box">
        <div class="otp-code">${otpCode}</div>
        <div class="otp-caption">VALID FOR 15 MINUTES</div>
      </div>
      
      <p>Enter this 6-digit code in the UUHealth mobile application to complete your email verification.</p>
      
      <div class="notice">
        <strong>Security Notice:</strong> If you did not create a United Union Health account, please disregard this email. Never share your verification code with anyone.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} United Union Health. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Premium UUHealth Password Reset HTML Template
   */
  private buildPasswordResetEmailTemplate(
    name: string,
    otpCode: string,
  ): string {
    const greetingName = name ? ` ${name}` : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your UUHealth Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF6F7; margin: 0; padding: 24px; color: #1F1418; }
    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #ECE4E7; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }
    .header { background: #7A1838; padding: 28px 32px; text-align: center; }
    .header h1 { color: #FFFFFF; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 12px; margin: 6px 0 0 0; }
    .content { padding: 32px; }
    .content h2 { font-size: 18px; font-weight: 700; margin: 0 0 12px 0; color: #1F1418; }
    .content p { font-size: 14px; line-height: 1.5; color: #6B6066; margin: 0 0 20px 0; }
    .otp-box { background: #F6ECF0; border: 1px solid #EBD2DC; border-radius: 12px; padding: 18px 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #7A1838; margin: 0; }
    .otp-caption { font-size: 11px; color: #A69A9F; margin-top: 6px; }
    .notice { font-size: 12px; color: #A69A9F; line-height: 1.4; border-top: 1px solid #ECE4E7; padding-top: 20px; margin-top: 24px; }
    .footer { background: #FAF6F7; padding: 16px 32px; text-align: center; font-size: 11px; color: #A69A9F; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>UNITED UNION HEALTH</h1>
      <p>Account Security & Recovery</p>
    </div>
    <div class="content">
      <h2>Hello${greetingName},</h2>
      <p>We received a request to reset your United Union Health password. Please use the 6-digit recovery code below to choose a new password.</p>
      
      <div class="otp-box">
        <div class="otp-code">${otpCode}</div>
        <div class="otp-caption">VALID FOR 60 MINUTES</div>
      </div>
      
      <p>Enter this code in your mobile application along with your new password to restore access to your account.</p>
      
      <div class="notice">
        <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your existing password will remain unchanged and your account is secure.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} United Union Health. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
