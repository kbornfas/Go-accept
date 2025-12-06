# Email Notifications Implementation Guide

## Overview
Automated email notifications for all escrow lifecycle events keep users informed throughout the transaction process.

## Features Implemented

### 1. Escrow Created Email
**Trigger:** When client creates a new escrow  
**Recipients:** Client (escrow creator)  
**Content:**
- Escrow ID and details
- Amount, currency, platform
- Payment link for buyer
- Next steps instructions
- Security notice

### 2. Payment Received Email
**Trigger:** When buyer completes payment (escrow status → "approved")  
**Recipients:** Client (seller)  
**Content:**
- Payment confirmation
- Escrow details with buyer info
- Warning to verify transaction before release
- "Release Funds" button/link
- Dashboard access link

### 3. Funds Released Email
**Trigger:** When admin releases funds (escrow status → "released")  
**Recipients:** Client (seller)  
**Content:**
- Transaction complete confirmation
- Final escrow summary
- Amount released
- Success badge

### 4. Escrow Cancelled Email
**Trigger:** When escrow is cancelled or refunded  
**Recipients:** Client (seller)  
**Content:**
- Cancellation notice
- Reason for cancellation
- Escrow details
- Support contact information

## Email Service Configuration

### Environment Variables
```bash
# Option 1: Gmail with App Password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Generated from Google Account settings
EMAIL_FROM=your-email@gmail.com

# Option 2: SendGrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.your-sendgrid-api-key
EMAIL_FROM=verified-sender@yourdomain.com

# Option 3: Custom SMTP
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=false  # true for port 465
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=https://yourdomain.com
```

## Email Service Architecture

### File: `server/emailService.js`
Centralized email service with template functions:

```javascript
// Send escrow created notification
await sendEscrowCreatedEmail({
  clientEmail: 'seller@example.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  paymentLink: 'https://yourapp.com/buyer-login?escrow=ESC123',
  escrowId: 'ESC123'
});

// Send payment received notification
await sendPaymentReceivedEmail({
  clientEmail: 'seller@example.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  escrowId: 'ESC123',
  buyerEmail: 'buyer@example.com'
});

// Send funds released notification
await sendFundsReleasedEmail({
  clientEmail: 'seller@example.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  escrowId: 'ESC123'
});

// Send cancellation notification
await sendEscrowCancelledEmail({
  clientEmail: 'seller@example.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  escrowId: 'ESC123',
  reason: 'Buyer did not complete payment'
});
```

## Integration Points

### 1. Escrow Creation (POST /api/escrows)
```javascript
// After escrow created in database
await sendEscrowCreatedEmail({
  clientEmail: req.user.email,
  amount: numericAmount,
  currency: code,
  platform,
  paymentLink: `${process.env.FRONTEND_URL}/buyer-login?escrow=${escrowId}`,
  escrowId
});
```

### 2. Escrow Status Updates (PATCH /api/escrows/:id)
```javascript
// When status changes to 'approved' (payment received)
if (status === 'approved') {
  await sendPaymentReceivedEmail({
    clientEmail,
    amount: hold.amount,
    currency: hold.currency,
    platform: hold.platform,
    escrowId: hold.id,
    buyerEmail: 'buyer@example.com'
  });
}

// When status changes to 'released' (funds released)
if (status === 'released') {
  await sendFundsReleasedEmail({
    clientEmail,
    amount: hold.amount,
    currency: hold.currency,
    platform: hold.platform,
    escrowId: hold.id
  });
}

// When status changes to 'cancelled' or 'refunded'
if (status === 'cancelled' || status === 'refunded') {
  await sendEscrowCancelledEmail({
    clientEmail,
    amount: hold.amount,
    currency: hold.currency,
    platform: hold.platform,
    escrowId: hold.id,
    reason: note || status
  });
}
```

## Email Templates

All emails use responsive HTML templates with:
- **Gradient headers** (purple for created, green for paid, blue for released, red for cancelled)
- **Clean layout** with centered content (max-width: 600px)
- **Escrow details boxes** with formatted data
- **Call-to-action buttons** (where applicable)
- **Security notices** and warnings
- **Footer** with copyright and automated message notice

### Design Principles
- Mobile-responsive layout
- Professional gradient color scheme
- Clear information hierarchy
- Prominent CTAs
- Security-focused messaging

## Error Handling

Email failures don't break the API:
```javascript
try {
  await sendEscrowCreatedEmail(...);
} catch (error) {
  console.error('Failed to send email:', error);
  // Continue with response, log error
}
```

Return values indicate success:
```javascript
{
  sent: true,
  messageId: '<unique-message-id>'
}
// OR
{
  sent: false,
  reason: 'transporter_not_configured',
  error: 'SMTP connection failed'
}
```

## Testing

### 1. Gmail Setup (Recommended for Development)
1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Use generated password in `EMAIL_PASSWORD`

### 2. Test Email Sending
```bash
# Start server with email credentials
EMAIL_USER=your-email@gmail.com EMAIL_PASSWORD=your-app-password npm start

# Create test escrow via API
curl -X POST http://localhost:4000/api/escrows \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "Paxful",
    "amount": 100,
    "currency": "USD",
    "paymentMethods": ["bank_transfer"]
  }'

# Check console logs for email send confirmation
# Check inbox for "Escrow Created" email
```

### 3. Test All Email Types
```javascript
// In server console or test file
import emailService from './server/emailService.js';

// Test escrow created
await emailService.sendEscrowCreatedEmail({
  clientEmail: 'your-test-email@gmail.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  paymentLink: 'http://localhost:5173/buyer-login?escrow=TEST123',
  escrowId: 'TEST123'
});

// Test payment received
await emailService.sendPaymentReceivedEmail({
  clientEmail: 'your-test-email@gmail.com',
  amount: 100,
  currency: 'USD',
  platform: 'Paxful',
  escrowId: 'TEST123',
  buyerEmail: 'buyer@example.com'
});
```

## SendGrid Setup (Production)

### 1. Create SendGrid Account
1. Sign up at https://sendgrid.com
2. Verify your sender email/domain
3. Create API key with "Mail Send" permissions

### 2. Configure Environment
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey  # Literal string "apikey"
EMAIL_PASSWORD=SG.your-sendgrid-api-key
EMAIL_FROM=verified@yourdomain.com  # Must be verified in SendGrid
```

### 3. Domain Verification (Recommended)
- Verify your domain in SendGrid dashboard
- Add SPF and DKIM DNS records
- Improves deliverability and sender reputation

## Monitoring

### Console Logs
```
✅ Email service initialized
✅ Escrow created email sent to seller@example.com: <message-id>
⚠️  Email credentials not configured
⚠️  Failed to send email: SMTP timeout
```

### Audit Logs
All email send attempts are logged to audit_log table:
```sql
SELECT * FROM audit_log 
WHERE action LIKE 'escrow_%' 
ORDER BY created_at DESC;
```

## Delivery Best Practices

### 1. Avoid Spam Filters
- Use verified sender domain
- Include plain text version (optional)
- Avoid spam trigger words ("FREE", "URGENT", "ACT NOW")
- Include unsubscribe link (for marketing emails only)

### 2. Transactional Email Compliance
- Clearly identify as transactional (not marketing)
- Include company/service name
- Provide support contact
- Include relevant transaction details

### 3. Rate Limiting
SendGrid free tier: 100 emails/day  
Gmail: ~500 emails/day with app password  

For higher volume, upgrade to SendGrid paid plan or use AWS SES.

## Troubleshooting

### Email Not Sending
1. Check environment variables are set
2. Verify SMTP credentials
3. Check console logs for error messages
4. Test SMTP connection with telnet
5. Verify firewall allows outbound port 587/465

### Gmail "Less Secure App" Error
Use App Passwords instead of account password:
https://support.google.com/accounts/answer/185833

### SendGrid Verification Required
Verify sender email in SendGrid dashboard before sending

### Emails Going to Spam
- Use verified domain
- Configure SPF/DKIM records
- Avoid spam trigger words
- Maintain good sender reputation

## Future Enhancements

### Phase 1 (Priority)
- [ ] Add plain text versions for better deliverability
- [ ] Store email send history in database
- [ ] Add email templates for buyer notifications
- [ ] Implement email preferences (opt-in/opt-out)

### Phase 2
- [ ] Add dispute notification emails
- [ ] Weekly summary emails for active escrows
- [ ] Email template customization in admin panel
- [ ] Multi-language email templates

### Phase 3
- [ ] SMS notifications (Twilio integration)
- [ ] Push notifications (FCM/APNS)
- [ ] Email analytics (open rates, click rates)
- [ ] A/B testing for email templates

## Security Considerations

1. **Never expose credentials:** Use environment variables
2. **Rate limiting:** Prevent email spam abuse
3. **Input validation:** Sanitize all email addresses
4. **Template injection:** Use parameterized templates (already implemented)
5. **Sensitive data:** Avoid including passwords or tokens in emails

## Production Checklist

- [ ] Email credentials configured in production environment
- [ ] `FRONTEND_URL` set to production domain
- [ ] Sender email verified (SendGrid) or domain authenticated
- [ ] SPF/DKIM records configured for custom domain
- [ ] Test all 4 email types in production
- [ ] Monitor email delivery logs
- [ ] Set up bounce/complaint handling (SendGrid webhooks)
- [ ] Configure email alerts for failures
- [ ] Document support email for user questions

## Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [SendGrid SMTP Setup](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Email Template Best Practices](https://www.campaignmonitor.com/resources/guides/email-design/)

## Support

For email-related issues:
1. Check server console logs
2. Verify environment variables
3. Test SMTP connection
4. Review audit logs
5. Contact your email provider support
