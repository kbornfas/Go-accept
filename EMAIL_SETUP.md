# Email Service Configuration Guide

## Task #4: Configure Email Service Credentials

### What Requires Email?

1. ✅ **Email Verification** (already coded)
   - Users verify their email before using features
   - Sends JWT token link to verify ownership

2. ✅ **2FA Setup** (optional, already coded)
   - Can send 2FA codes via email as backup

3. 🔄 **Password Reset** (Task #6, not yet coded)
   - Send reset link when user forgets password

4. 🔄 **Escrow Notifications** (Task #13, not yet coded)
   - Notify when escrow created/paid/released

**Current Status:** Email infrastructure is coded, just needs credentials.

## Quick Setup Options

### Option 1: Gmail (Easiest for Testing)

**Pros:**
- ✅ Free
- ✅ Works immediately
- ✅ 500 emails/day limit
- ✅ Perfect for development/small scale

**Cons:**
- ❌ Daily limit (500 emails)
- ❌ Can be flagged as spam
- ❌ Not recommended for production scale

#### Step-by-Step:

1. **Enable 2-Step Verification**
   - Visit https://myaccount.google.com/security
   - Click "2-Step Verification"
   - Follow setup instructions

2. **Generate App Password**
   - Visit https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Click "Generate"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

3. **Update .env**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcdefghijklmnop
   EMAIL_FROM=noreply@yourapp.com
   ```

4. **Restart Server**
   ```bash
   node server/index.js
   ```

   You should see:
   ```
   ✅ Email service configured
   ```

### Option 2: SendGrid (Best for Production)

**Pros:**
- ✅ 100 emails/day free (40,000/month with credit card)
- ✅ High deliverability
- ✅ Analytics dashboard
- ✅ Email validation
- ✅ Professional

**Cons:**
- ❌ Requires account creation
- ❌ Requires domain verification for high volume

#### Step-by-Step:

1. **Create SendGrid Account**
   - Visit https://signup.sendgrid.com
   - Sign up (free tier available)
   - Verify your email

2. **Create API Key**
   - Dashboard → Settings → API Keys
   - Click "Create API Key"
   - Name: "go-accept-production"
   - Permissions: "Full Access" (or "Mail Send" only)
   - Click "Create & View"
   - **Copy the API key** (shown only once!)

3. **Update .env**
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASSWORD=SG.abc123xyz456...
   EMAIL_FROM=noreply@yourapp.com
   ```

4. **Verify Sender Identity** (Required for Free Tier)
   - Settings → Sender Authentication
   - Verify Single Sender
   - Enter your email (e.g., admin@yourapp.com)
   - Check email and click verification link
   - Use this email as EMAIL_FROM

5. **Domain Authentication** (Optional, Better Deliverability)
   - Settings → Sender Authentication → Authenticate Your Domain
   - Enter your domain (e.g., yourapp.com)
   - Add DNS records shown by SendGrid
   - Wait for verification (24-48 hours)
   - Now emails from @yourapp.com won't be marked as spam

### Option 3: Mailgun

**Pros:**
- ✅ 5,000 emails/month free (3 months)
- ✅ Then $35/month for 50,000 emails
- ✅ Good deliverability
- ✅ Email validation API

**Cons:**
- ❌ Requires credit card even for free tier
- ❌ More complex setup than SendGrid

#### Step-by-Step:

1. **Create Mailgun Account**
   - Visit https://signup.mailgun.com
   - Sign up and verify email
   - Add credit card (won't charge during free period)

2. **Get SMTP Credentials**
   - Dashboard → Sending → Domain Settings
   - Copy "SMTP hostname" (e.g., smtp.mailgun.org)
   - Copy "Default SMTP Login" (e.g., postmaster@sandbox123.mailgun.org)
   - Click "Reset Password" to get SMTP password

3. **Update .env**
   ```env
   EMAIL_HOST=smtp.mailgun.org
   EMAIL_PORT=587
   EMAIL_USER=postmaster@sandbox123.mailgun.org
   EMAIL_PASSWORD=your-mailgun-password
   EMAIL_FROM=noreply@yourapp.com
   ```

4. **Add Custom Domain** (Optional)
   - Dashboard → Sending → Domains → Add New Domain
   - Enter your domain
   - Add DNS records
   - Wait for verification

### Option 4: AWS SES (For High Volume)

**Pros:**
- ✅ $0.10 per 1,000 emails (very cheap at scale)
- ✅ Extremely high deliverability
- ✅ 62,000 emails/month free (first 12 months)

**Cons:**
- ❌ Complex setup
- ❌ Requires AWS account
- ❌ Starts in "sandbox mode" (limited)

#### Quick Setup:

1. **Create AWS Account** (if you don't have one)
2. **Navigate to SES**
   - AWS Console → Simple Email Service
3. **Verify Email Identity**
   - Verified Identities → Create Identity
   - Email address → Your email
   - Check email and verify
4. **Get SMTP Credentials**
   - SMTP Settings → Create SMTP Credentials
   - Download credentials
5. **Update .env**
   ```env
   EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_USER=AKIAIOSFODNN7EXAMPLE
   EMAIL_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   EMAIL_FROM=verified@yourdomain.com
   ```
6. **Request Production Access**
   - SES → Account Dashboard → Request Production Access
   - Fill out form (usually approved in 24 hours)

## Email Templates (Already Configured)

The backend already has email sending configured. Here's what gets sent:

### Email Verification

```
Subject: Verify Your Email - Go-Accept

Hi there!

Please verify your email address by clicking the link below:

https://yourapp.com/verify?token=abc123...

This link expires in 24 hours.

Best regards,
The Go-Accept Team
```

### Future: Password Reset (Task #6)

```
Subject: Reset Your Password - Go-Accept

Hi there!

You requested to reset your password. Click the link below:

https://yourapp.com/reset-password?token=xyz789...

This link expires in 1 hour.

If you didn't request this, ignore this email.

Best regards,
The Go-Accept Team
```

### Future: Escrow Notifications (Task #13)

```
Subject: Payment Link Created - Go-Accept

Hi there!

Your payment link has been created:

Amount: $100.00 USD
Platform: PayPal
Status: Pending Payment

View details: https://yourapp.com/escrow/abc123

Best regards,
The Go-Accept Team
```

## Testing Email Configuration

### Test 1: Server Startup

```bash
node server/index.js
```

Should see:
```
✅ Email service configured
```

If you see:
```
⚠️  Email credentials not configured. Email verification disabled.
```

Then check your .env file.

### Test 2: Send Test Email

Add this endpoint temporarily to `server/index.js`:

```javascript
app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'your-email@gmail.com', // Replace with your email
      subject: 'Test Email from Go-Accept',
      text: 'If you received this, email is working!',
      html: '<h1>Success!</h1><p>Email configuration is working correctly.</p>'
    });
    res.json({ message: 'Test email sent! Check your inbox.' });
  } catch (error) {
    res.status(500).json({ message: 'Email failed', error: error.message });
  }
});
```

Test it:
```bash
Invoke-RestMethod -Uri 'http://localhost:4000/api/test-email' -Method Get
```

Check your email inbox (and spam folder!).

### Test 3: Verify Email Flow

1. Use the email verification endpoint:
   ```bash
   $body = @{email='test@example.com'} | ConvertTo-Json
   Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/send-verification' -Method Post -Body $body -ContentType 'application/json'
   ```

2. Check email for verification link
3. Click link or use token to verify

## Platform-Specific Configuration

### Railway

```bash
# Set all email variables
railway variables set EMAIL_HOST=smtp.gmail.com
railway variables set EMAIL_PORT=587
railway variables set EMAIL_USER=your-email@gmail.com
railway variables set EMAIL_PASSWORD=your-app-password
railway variables set EMAIL_FROM=noreply@yourapp.com

# Restart
railway restart
```

### Render

1. Dashboard → Your Service → Environment
2. Add variables:
   - `EMAIL_HOST`: smtp.gmail.com
   - `EMAIL_PORT`: 587
   - `EMAIL_USER`: your-email@gmail.com
   - `EMAIL_PASSWORD`: your-app-password
   - `EMAIL_FROM`: noreply@yourapp.com
3. Save (auto-restarts)

### Vercel Serverless

```bash
vercel env add EMAIL_HOST
vercel env add EMAIL_PORT
vercel env add EMAIL_USER
vercel env add EMAIL_PASSWORD
vercel env add EMAIL_FROM

vercel --prod
```

## Troubleshooting

### Error: "Authentication failed"

**Cause:** Wrong email or password

**Solutions:**
1. **Gmail:** Check you're using App Password, not account password
2. **SendGrid:** Verify API key is correct and hasn't expired
3. **Check for typos** in EMAIL_USER and EMAIL_PASSWORD

### Error: "Connection timeout"

**Cause:** Firewall or wrong host/port

**Solutions:**
1. Check EMAIL_HOST is correct (no https://)
2. Check EMAIL_PORT (usually 587 for TLS)
3. Try port 465 (SSL) or 25 (unencrypted)
4. Check firewall allows outbound SMTP

### Emails going to spam

**Cause:** Poor sender reputation

**Solutions:**
1. **Verify domain** (SPF, DKIM, DMARC records)
2. **Use professional email service** (SendGrid, not Gmail for production)
3. **Don't use "noreply@"** - use real email like "support@yourapp.com"
4. **Add unsubscribe link**
5. **Warm up your domain** (start with few emails, gradually increase)

### Error: "Daily sending limit exceeded"

**Cause:** Hit Gmail's 500 emails/day limit

**Solutions:**
1. **Use SendGrid or Mailgun** (higher limits)
2. **Implement rate limiting** on your email sending
3. **Queue emails** (Task #34 - Message Queue)

### Email not received

**Cause:** Various reasons

**Solutions:**
1. **Check spam folder**
2. **Verify EMAIL_FROM is verified** (SendGrid requirement)
3. **Check server logs** for email errors
4. **Test with different email provider** (Gmail, Outlook, Yahoo)
5. **Check email bounces** in SendGrid dashboard

## Email Best Practices

### ✅ Do's

1. **Use professional email service** (SendGrid for production)
2. **Verify your domain** (SPF, DKIM, DMARC)
3. **Use real sender address** (support@yourapp.com, not noreply@)
4. **Add unsubscribe links** (required by law for marketing emails)
5. **Test emails before deploying**
6. **Monitor bounce rates** (high bounces = spam folder)
7. **Use HTML and plain text** versions
8. **Keep emails short and clear**
9. **Use branded email templates**
10. **Log all sent emails** (for debugging)

### ❌ Don'ts

1. **Don't use personal Gmail** for production
2. **Don't send without domain verification** (will go to spam)
3. **Don't spam users** (max 1-2 emails per day)
4. **Don't buy email lists** (illegal in many countries)
5. **Don't ignore bounces** (clean your list regularly)
6. **Don't use ALL CAPS** in subject lines
7. **Don't include only images** (add text too)
8. **Don't forget to test** (always send test email first)

## DNS Records for Domain Authentication

To prevent emails going to spam, add these DNS records:

### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all
```

### DKIM Record
```
Type: CNAME
Name: s1._domainkey
Value: s1.domainkey.u123456.wl.sendgrid.net
```

### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourapp.com
```

**Note:** Values vary by provider. Get exact values from:
- SendGrid: Settings → Sender Authentication
- Mailgun: Sending → Domain Settings → DNS Records
- AWS SES: Verified Identities → DKIM

## Email Service Comparison

| Feature | Gmail | SendGrid | Mailgun | AWS SES |
|---------|-------|----------|---------|---------|
| **Free Tier** | 500/day | 100/day | 5,000/mo (3 mo) | 62,000/mo (12 mo) |
| **Cost After** | Free | $19.95/mo | $35/mo | $0.10/1000 |
| **Setup Time** | 5 min | 15 min | 20 min | 30 min |
| **Deliverability** | Medium | High | High | Highest |
| **Analytics** | No | Yes | Yes | Yes |
| **API** | No | Yes | Yes | Yes |
| **Best For** | Testing | Production | Production | Enterprise |

## Recommended Setup by Scale

| Users | Emails/Month | Recommended Service | Est. Cost |
|-------|--------------|---------------------|-----------|
| < 100 | < 1,000 | Gmail | Free |
| 100-1,000 | 1,000-10,000 | SendGrid Free | Free |
| 1,000-10,000 | 10,000-100,000 | SendGrid Essentials | $19.95/mo |
| 10,000-50,000 | 100,000-500,000 | SendGrid Pro | $89.95/mo |
| 50,000+ | 500,000+ | AWS SES | ~$50/mo |

## Environment-Specific Configuration

### .env.production
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.real-api-key-here
EMAIL_FROM=support@yourapp.com
```

### .env.development
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=dev-email@gmail.com
EMAIL_PASSWORD=app-password-here
EMAIL_FROM=dev@localhost
```

## Checklist

- [ ] Email service chosen (Gmail/SendGrid/Mailgun/SES)
- [ ] Account created and verified
- [ ] SMTP credentials obtained
- [ ] EMAIL_* variables added to .env
- [ ] Server restarted
- [ ] Confirmed in logs: "✅ Email service configured"
- [ ] Test email sent successfully
- [ ] Test email received (not in spam)
- [ ] Domain authentication configured (production only)
- [ ] DNS records added (SPF, DKIM, DMARC)
- [ ] Sender identity verified (SendGrid requirement)
- [ ] Unsubscribe link added to templates (for notifications)
- [ ] Email logging implemented (for debugging)

## Next Steps

After configuring email:

1. Test email verification flow end-to-end
2. Implement password reset (Task #6)
3. Implement escrow notifications (Task #13)
4. Set up email monitoring (bounce rate, open rate)
5. Create branded email templates
6. Add email queue for high volume (Task #34)
