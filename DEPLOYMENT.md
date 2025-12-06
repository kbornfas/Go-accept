# Deployment Guide

This guide covers deploying the P2P Payment Coordinator to production with HTTPS/SSL.

## Prerequisites

Before deploying, ensure you have:

1. ✅ Strong JWT_SECRET (128+ characters)
2. ✅ Changed default ADMIN_PASSWORD and CLIENT_PASSWORD
3. ✅ Configured ALLOWED_ORIGINS for your production domain
4. ⚠️ Set up Sentry DSN for error monitoring (optional but recommended)
5. ⚠️ Configured email credentials for verification (optional)
6. ⚠️ Migrated to a real database (PostgreSQL/MongoDB recommended)

## Deployment Options

### Option 1: Vercel (Recommended for Frontend + Serverless API)

**Pros:** Free tier, automatic HTTPS, global CDN, easy setup
**Cons:** Serverless functions have execution limits (10s max on free tier)

#### Steps:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add all variables from `.env` file
   - **Important:** Add your production domain to `ALLOWED_ORIGINS`

5. Configure custom domain (optional):
   - Add domain in Vercel dashboard
   - Update DNS records as instructed
   - SSL certificate is automatically provisioned

### Option 2: Railway (Recommended for Backend + Database)

**Pros:** Free $5/month credit, PostgreSQL hosting, long-running processes, automatic HTTPS
**Cons:** Requires credit card for verification

#### Steps:

1. Create Railway account at https://railway.app

2. Install Railway CLI:
```bash
npm install -g @railway/cli
```

3. Login:
```bash
railway login
```

4. Initialize project:
```bash
railway init
```

5. Add PostgreSQL database:
```bash
railway add --database postgresql
```

6. Deploy:
```bash
railway up
```

7. Set environment variables:
```bash
railway variables set JWT_SECRET="your-secret"
railway variables set ADMIN_PASSWORD="your-password"
railway variables set CLIENT_PASSWORD="your-password"
railway variables set ALLOWED_ORIGINS="https://yourdomain.com"
railway variables set SENTRY_DSN="your-sentry-dsn"
railway variables set EMAIL_HOST="smtp.gmail.com"
railway variables set EMAIL_USER="your-email@gmail.com"
railway variables set EMAIL_PASSWORD="your-app-password"
```

8. Get your production URL:
```bash
railway domain
```

### Option 3: Render

**Pros:** Free tier available, automatic HTTPS, PostgreSQL hosting
**Cons:** Slower cold starts on free tier

#### Steps:

1. Create account at https://render.com

2. Create new Web Service:
   - Connect your GitHub repository
   - Choose "Node" environment
   - Build Command: `npm install && npm run build`
   - Start Command: `node server/index.js`

3. Add environment variables in Render dashboard

4. Create PostgreSQL database:
   - Add new PostgreSQL instance
   - Copy connection string to `DATABASE_URL` env var

5. Deploy and get your `.onrender.com` URL

## Post-Deployment Checklist

### 1. Update CORS Origins

Update `.env` with your production URL:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2. Test Production Endpoints

```bash
# Test health check
curl https://your-api-url.com/api/wallet

# Test login
curl -X POST https://your-api-url.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","password":"your-password"}'
```

### 3. Configure Sentry

1. Create account at https://sentry.io
2. Create new project (Node.js)
3. Copy DSN and add to environment variables:
```env
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

### 4. Setup Email Service

**Option A: Gmail (Development/Small Scale)**
1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
3. Add to environment:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM=noreply@yourdomain.com
```

**Option B: SendGrid (Production)**
1. Create account at https://sendgrid.com
2. Create API key in Settings > API Keys
3. Add to environment:
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### 5. Database Migration (Critical for Production)

The current file-based storage (`dataStore.json`) is not suitable for production. Migrate to PostgreSQL or MongoDB:

#### PostgreSQL (Recommended):

```bash
# Install PostgreSQL client
npm install pg

# Update server/index.js to use PostgreSQL
# Replace all fs.readJSON/writeJSON operations with SQL queries
```

Example schema:
```sql
CREATE TABLE wallet (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3),
  balance DECIMAL(18, 8),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escrows (
  id VARCHAR(255) PRIMARY KEY,
  platform VARCHAR(50),
  amount DECIMAL(18, 8),
  currency VARCHAR(3),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE client_logins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255),
  password_hash VARCHAR(255),
  two_factor_code VARCHAR(10),
  platform VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### 6. Enable HTTPS Redirect

Most platforms handle this automatically, but verify:
- All HTTP requests redirect to HTTPS
- Secure cookies enabled
- HSTS headers set (helmet handles this)

### 7. Monitor Production

1. Check Sentry dashboard for errors
2. Monitor server logs for warnings
3. Set up uptime monitoring (UptimeRobot, Pingdom)
4. Configure alerts for high error rates

## Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Rotate JWT_SECRET regularly** - Every 90 days recommended
3. **Enable 2FA for admin accounts** - Use `/api/auth/2fa/setup`
4. **Monitor rate limit violations** - Check logs for suspicious activity
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Backup database regularly** - Set up automated backups
7. **Use secrets management** - Consider AWS Secrets Manager or HashiCorp Vault

## Troubleshooting

### CORS Errors
- Verify `ALLOWED_ORIGINS` includes your frontend domain
- Check browser console for exact origin being blocked
- Ensure protocol (http/https) matches exactly

### Email Not Sending
- Test SMTP credentials manually
- Check email service dashboard for errors
- Verify firewall allows port 587/465
- Check spam folder for verification emails

### Rate Limiting Issues
- Increase limits in `server/index.js` if legitimate traffic
- Monitor for DDoS attacks
- Consider implementing IP whitelisting

### Database Connection Issues
- Verify `DATABASE_URL` environment variable
- Check database firewall/security groups
- Ensure connection pooling is configured
- Monitor active connections

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions)
2. Implement database backups
3. Add performance monitoring (New Relic, DataDog)
4. Configure CDN for static assets
5. Implement rate limiting per user (not just IP)
6. Add audit logging for sensitive operations
7. Set up staging environment for testing

## Support

For issues or questions:
- Check server logs first
- Review Sentry error reports
- Test endpoints with curl/Postman
- Verify all environment variables are set correctly
