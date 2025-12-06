import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email transporter configuration
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  const config = {
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  // Detect email service provider
  if (process.env.EMAIL_HOST) {
    // Custom SMTP
    config.host = process.env.EMAIL_HOST;
    config.port = parseInt(process.env.EMAIL_PORT || '587');
    config.secure = process.env.EMAIL_SECURE === 'true';
  } else if (process.env.EMAIL_USER.includes('@gmail.com')) {
    // Gmail
    config.service = 'gmail';
  } else if (process.env.EMAIL_USER.includes('sendgrid')) {
    // SendGrid
    config.host = 'smtp.sendgrid.net';
    config.port = 587;
    config.secure = false;
  }

  transporter = nodemailer.createTransport(config);
  console.log('✅ Email service initialized');
} else {
  console.warn('⚠️  Email credentials not configured');
}

/**
 * Send escrow created notification
 */
export async function sendEscrowCreatedEmail(escrowData) {
  if (!transporter) {
    console.warn('Email transporter not configured, skipping email');
    return { sent: false, reason: 'transporter_not_configured' };
  }

  const { clientEmail, amount, currency, platform, paymentLink, escrowId } = escrowData;

  if (!clientEmail) {
    return { sent: false, reason: 'no_recipient_email' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Escrow Created - ${amount} ${currency} on ${platform}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .escrow-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .payment-link { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Escrow Created Successfully</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment escrow is now active</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your escrow has been successfully created and is ready for payment.</p>
              
              <div class="escrow-details">
                <h3 style="margin-top: 0; color: #667eea;">Escrow Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Escrow ID:</span>
                  <span class="detail-value">${escrowId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount:</span>
                  <span class="detail-value">${amount} ${currency}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Platform:</span>
                  <span class="detail-value">${platform}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value" style="color: #f59e0b;">Pending Payment</span>
                </div>
              </div>

              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Share the payment link with your buyer</li>
                <li>Buyer completes authentication and payment</li>
                <li>You'll receive notification when payment is received</li>
                <li>Release funds when transaction is complete</li>
              </ol>

              <div style="text-align: center;">
                <a href="${paymentLink}" class="payment-link">View Payment Link</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                <strong>Security Note:</strong> This escrow is protected by our secure payment system. 
                Funds will only be released upon your approval.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} P2P Payment Coordinator. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Escrow created email sent to ${clientEmail}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send escrow created email:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Send payment received notification
 */
export async function sendPaymentReceivedEmail(escrowData) {
  if (!transporter) return { sent: false, reason: 'transporter_not_configured' };

  const { clientEmail, amount, currency, platform, escrowId, buyerEmail } = escrowData;

  if (!clientEmail) return { sent: false, reason: 'no_recipient_email' };

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `✅ Payment Received - ${amount} ${currency}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .escrow-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .action-button { background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
            .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">💰 Payment Received!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Funds are now held in escrow</p>
            </div>
            <div class="content">
              <p>Great news!</p>
              <p>Payment has been received and verified for your escrow. The funds are now securely held pending your approval.</p>
              
              <div class="escrow-details">
                <h3 style="margin-top: 0; color: #10b981;">Payment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Escrow ID:</span>
                  <span class="detail-value">${escrowId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount Paid:</span>
                  <span class="detail-value" style="color: #10b981; font-weight: bold;">${amount} ${currency}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Platform:</span>
                  <span class="detail-value">${platform}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Buyer:</span>
                  <span class="detail-value">${buyerEmail || 'Authenticated'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value" style="color: #10b981;">✅ Paid - Awaiting Release</span>
                </div>
              </div>

              <div class="warning-box">
                <strong>⚠️ Important:</strong> Please verify the transaction is complete before releasing funds. 
                Once released, funds cannot be recovered.
              </div>

              <p><strong>What's Next:</strong></p>
              <ol>
                <li>Verify you've received the goods/services/payment</li>
                <li>Log in to your dashboard</li>
                <li>Click "Release Funds" to complete the transaction</li>
              </ol>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/client" class="action-button">Go to Dashboard</a>
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
              <p>© ${new Date().getFullYear()} P2P Payment Coordinator. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Payment received email sent to ${clientEmail}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send payment received email:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Send funds released notification
 */
export async function sendFundsReleasedEmail(escrowData) {
  if (!transporter) return { sent: false, reason: 'transporter_not_configured' };

  const { clientEmail, amount, currency, platform, escrowId } = escrowData;

  if (!clientEmail) return { sent: false, reason: 'no_recipient_email' };

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `✅ Funds Released - ${amount} ${currency}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 20px 0; font-weight: bold; }
            .escrow-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎉 Transaction Complete!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Funds have been successfully released</p>
            </div>
            <div class="content">
              <div style="text-align: center;">
                <span class="success-badge">✅ COMPLETED</span>
              </div>
              
              <p>Your escrow transaction has been completed successfully!</p>
              
              <div class="escrow-details">
                <h3 style="margin-top: 0; color: #3b82f6;">Final Summary</h3>
                <p><strong>Escrow ID:</strong> ${escrowId}</p>
                <p><strong>Amount:</strong> ${amount} ${currency}</p>
                <p><strong>Platform:</strong> ${platform}</p>
                <p><strong>Status:</strong> <span style="color: #10b981;">Released</span></p>
              </div>

              <p>The funds have been released and the transaction is now complete. Thank you for using our escrow service!</p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                If you have any questions about this transaction, please contact our support team.
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
              <p>© ${new Date().getFullYear()} P2P Payment Coordinator. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Funds released email sent to ${clientEmail}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send funds released email:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Send escrow cancelled notification
 */
export async function sendEscrowCancelledEmail(escrowData) {
  if (!transporter) return { sent: false, reason: 'transporter_not_configured' };

  const { clientEmail, amount, currency, platform, escrowId, reason } = escrowData;

  if (!clientEmail) return { sent: false, reason: 'no_recipient_email' };

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Escrow Cancelled - ${amount} ${currency}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .escrow-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Escrow Cancelled</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Transaction has been cancelled</p>
            </div>
            <div class="content">
              <p>This is to inform you that your escrow has been cancelled.</p>
              
              <div class="escrow-details">
                <p><strong>Escrow ID:</strong> ${escrowId}</p>
                <p><strong>Amount:</strong> ${amount} ${currency}</p>
                <p><strong>Platform:</strong> ${platform}</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              </div>

              <p>If you have any questions about this cancellation, please contact our support team.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
              <p>© ${new Date().getFullYear()} P2P Payment Coordinator. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Escrow cancelled email sent to ${clientEmail}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send escrow cancelled email:', error);
    return { sent: false, error: error.message };
  }
}

export default {
  sendEscrowCreatedEmail,
  sendPaymentReceivedEmail,
  sendFundsReleasedEmail,
  sendEscrowCancelledEmail,
};
