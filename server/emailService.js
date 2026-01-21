// Email Service - Placeholder module for email notifications
// These functions are called by the main server but can be safely stubbed
// when email configuration is not available

import nodemailer from 'nodemailer';

let transporter = null;

// Initialize email transporter if credentials are available
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  console.log('✅ Email service configured');
} else {
  console.warn('⚠️  Email credentials not configured. Email notifications disabled.');
}

const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    console.log(`📧 [MOCK] Email to ${to}: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

export const sendEscrowCreatedEmail = async ({ clientEmail, amount, currency, platform, paymentLink, escrowId }) => {
  const subject = `Escrow Created - ${amount} ${currency}`;
  const html = `
    <h2>Escrow Created Successfully</h2>
    <p>A new escrow has been created on ${platform}.</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${currency}</li>
      <li><strong>Escrow ID:</strong> ${escrowId}</li>
      <li><strong>Payment Link:</strong> <a href="${paymentLink}">${paymentLink}</a></li>
    </ul>
    <p>Share the payment link with your buyer to complete the transaction.</p>
  `;
  return sendEmail(clientEmail, subject, html);
};

export const sendPaymentReceivedEmail = async ({ clientEmail, amount, currency, platform, escrowId }) => {
  const subject = `Payment Received - ${amount} ${currency}`;
  const html = `
    <h2>Payment Received</h2>
    <p>Payment has been received for your escrow on ${platform}.</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${currency}</li>
      <li><strong>Escrow ID:</strong> ${escrowId}</li>
    </ul>
    <p>The funds are now held in escrow pending release.</p>
  `;
  return sendEmail(clientEmail, subject, html);
};

export const sendFundsReleasedEmail = async ({ clientEmail, amount, currency, platform, escrowId }) => {
  const subject = `Funds Released - ${amount} ${currency}`;
  const html = `
    <h2>Funds Released</h2>
    <p>The escrowed funds have been released on ${platform}.</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${currency}</li>
      <li><strong>Escrow ID:</strong> ${escrowId}</li>
    </ul>
    <p>The transaction is now complete.</p>
  `;
  return sendEmail(clientEmail, subject, html);
};

export const sendEscrowCancelledEmail = async ({ clientEmail, amount, currency, platform, escrowId, reason }) => {
  const subject = `Escrow Cancelled - ${amount} ${currency}`;
  const html = `
    <h2>Escrow Cancelled</h2>
    <p>The escrow has been cancelled on ${platform}.</p>
    <ul>
      <li><strong>Amount:</strong> ${amount} ${currency}</li>
      <li><strong>Escrow ID:</strong> ${escrowId}</li>
      ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
    </ul>
    <p>If funds were held, they have been refunded.</p>
  `;
  return sendEmail(clientEmail, subject, html);
};
