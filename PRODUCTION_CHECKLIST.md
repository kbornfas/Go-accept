# Production Readiness Checklist

Use this checklist before deploying to production. Check off each item as you complete it.

## ✅ Security Hardening (ALL COMPLETED)

- [x] **Strong JWT Secret** - 128+ character cryptographic secret generated
- [x] **Password Security** - Default passwords documented for change (admin123, client123)
- [x] **HTTP Security Headers** - Helmet middleware configured (XSS, clickjacking, MIME sniffing protection)
- [x] **Rate Limiting** - Auth: 5/15min, API: 100/min
- [x] **CORS Whitelist** - Restricted to ALLOWED_ORIGINS env var
- [x] **Input Validation** - Express-validator on all POST/PATCH endpoints
- [x] **Password Hashing** - Bcrypt (10 salt rounds) for client login passwords
- [x] **Request Logging** - Morgan combined format
- [x] **Environment Validation** - Startup checks for required vars
- [x] **Error Monitoring** - Sentry integration (configure DSN in production)
- [x] **2FA Implementation** - TOTP with speakeasy and QR codes
- [x] **Email Verification** - JWT-based verification system with nodemailer

## 🔧 Configuration Required

### Critical (Must Complete Before Production)

- [ ] **Change Default Passwords**
  ```env
  ADMIN_PASSWORD=<generate-strong-password>
  CLIENT_PASSWORD=<generate-strong-password>
  ```
  Use password manager to generate 16+ character passwords with mixed case, numbers, symbols.

- [ ] **Configure Production Origins**
  ```env
  ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
  ```
  Add all production frontend URLs (no trailing slashes).

- [ ] **Verify JWT Secret**
  ```bash
  # Should be 128+ characters
  node -e "console.log(process.env.JWT_SECRET.length)"
  # Expected: 128 or higher
  ```

### Important (Strongly Recommended)

- [ ] **Set Up Sentry**
  1. Create account at https://sentry.io
  2. Create new Node.js project
  3. Copy DSN to .env:
     ```env
     SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
     ```

- [ ] **Configure Email Service**
  
  **Option A: Gmail (Development)**
  ```env
  EMAIL_HOST=smtp.gmail.com
  EMAIL_PORT=587
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASSWORD=your-16-char-app-password
  EMAIL_FROM=noreply@yourdomain.com
  ```
  Setup: https://myaccount.google.com/apppasswords
  
  **Option B: SendGrid (Production)**
  ```env
  EMAIL_HOST=smtp.sendgrid.net
  EMAIL_PORT=587
  EMAIL_USER=apikey
  EMAIL_PASSWORD=SG.xxxxxxxxxxxxx
  EMAIL_FROM=noreply@yourdomain.com
  ```
  Get API key: https://app.sendgrid.com/settings/api_keys

- [ ] **Migrate to PostgreSQL**
  1. Choose database provider (Railway, Render, Supabase)
  2. Add DATABASE_URL to .env
  3. Run: `psql $DATABASE_URL -f schema.sql`
  4. Backup: `cp dataStore.json dataStore.json.backup`
  5. Migrate: `node server/migrate.js`
  
  See: `DATABASE_MIGRATION.md` for full guide

### Optional (Nice to Have)

- [ ] **Custom Domain**
  - Purchase domain from Namecheap, Google Domains, etc.
  - Configure DNS records (A/CNAME)
  - Update ALLOWED_ORIGINS and FRONTEND_URL

- [ ] **SSL Certificate**
  - Automatic with Vercel, Railway, Render
  - Or use Let's Encrypt (Certbot)

- [ ] **CDN Configuration**
  - Cloudflare for DDoS protection
  - Or use platform's built-in CDN

## 🚀 Deployment Steps

### 1. Pre-Deployment Verification

```bash
# Test all endpoints locally
npm run dev  # Terminal 1
node server/index.js  # Terminal 2

# Check for errors
curl http://localhost:4000/api/wallet
# Expected: 401 Unauthorized (auth required)

# Test login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","password":"admin123"}'
# Expected: 200 with JWT token

# Verify no security warnings in console
# Should see: ✅ checkmarks for configured features
```

### 2. Choose Deployment Platform

**Option A: Vercel (Frontend + Serverless)**
```bash
npm install -g vercel
vercel login
vercel
# Follow prompts, add env vars in dashboard
```

**Option B: Railway (Backend + Database)**
```bash
npm install -g @railway/cli
railway login
railway init
railway add --database postgresql
railway up
railway variables set JWT_SECRET="..." ADMIN_PASSWORD="..." ...
```

**Option C: Render (Full Stack)**
1. Connect GitHub repo at https://render.com
2. Create Web Service (Node environment)
3. Add environment variables in dashboard
4. Deploy

See `DEPLOYMENT.md` for detailed platform-specific instructions.

### 3. Post-Deployment Verification

```bash
# Replace with your production URL
PROD_URL=https://your-api.vercel.app

# Test health
curl $PROD_URL/api/wallet
# Expected: 401 (shows server is running)

# Test login with NEW password
curl -X POST $PROD_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","password":"your-new-password"}'
# Expected: 200 with token

# Test CORS (from frontend domain)
# Open browser console on your frontend domain
fetch('https://your-api.com/api/wallet')
  .then(r => r.json())
  .then(console.log)
# Should NOT see CORS error

# Test rate limiting
for i in {1..10}; do
  curl -X POST $PROD_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"role":"admin","password":"wrong"}'
done
# Expected: After 5 attempts, should get 429 Too Many Requests

# Test Sentry (if configured)
# Trigger an error and check Sentry dashboard for report
```

## 📊 Monitoring Setup

### 1. Set Up Alerts

- [ ] Sentry email alerts for errors
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Database connection alerts
- [ ] High rate limit violations

### 2. Configure Logging

- [ ] Centralized logging (Logtail, Papertrail)
- [ ] Log rotation and archival
- [ ] Performance metrics (New Relic, DataDog)

### 3. Backup Strategy

- [ ] Daily database backups (automated)
- [ ] Configuration backups (.env securely stored)
- [ ] Code repository backup (GitHub)
- [ ] Document recovery procedures

## 🔒 Security Best Practices

### Regular Maintenance

- [ ] **Rotate JWT Secret** (every 90 days)
  ```bash
  # Generate new secret
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  # Update in production
  # Note: Will invalidate all existing tokens
  ```

- [ ] **Update Dependencies** (monthly)
  ```bash
  npm audit
  npm audit fix
  npm update
  cd server && npm audit && npm audit fix && npm update
  ```

- [ ] **Review Logs** (weekly)
  - Check for suspicious login attempts
  - Monitor rate limit violations
  - Review Sentry error patterns

- [ ] **Security Patches** (as needed)
  - Subscribe to security advisories
  - Apply critical patches immediately

### Access Control

- [ ] **Limit Admin Access**
  - Don't share admin password
  - Consider separate admin accounts
  - Enable 2FA for admin accounts

- [ ] **API Key Management**
  - Rotate SendGrid/email API keys quarterly
  - Use separate keys for dev/staging/production
  - Never commit keys to git

- [ ] **Database Security**
  - Use strong database password
  - Restrict database access by IP
  - Enable SSL for database connections
  - Regular backups with encryption

## 📝 Documentation

- [ ] **Environment Variables**
  - Document all required vars
  - Provide example values
  - Note which are secret

- [ ] **API Documentation**
  - Document all endpoints
  - Provide curl examples
  - List authentication requirements

- [ ] **Runbook**
  - Document deployment process
  - List common issues and solutions
  - Create rollback procedures

- [ ] **Team Training**
  - Train team on admin panel
  - Document support procedures
  - Create escalation path

## 🧪 Testing Checklist

### Functional Tests

- [ ] Admin login with new password
- [ ] Client dashboard access
- [ ] Create escrow (with sufficient funds)
- [ ] Mark escrow as paid
- [ ] Release escrow funds
- [ ] Wallet deposit
- [ ] Notification system
- [ ] Client login tracking
- [ ] 2FA setup and verification
- [ ] Email verification flow

### Security Tests

- [ ] Rate limiting (login attempts)
- [ ] CORS restrictions (unauthorized domain)
- [ ] JWT expiration (after 8 hours)
- [ ] Invalid token rejection
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection (via SameSite cookies)

### Performance Tests

- [ ] API response times (<200ms)
- [ ] Database query optimization
- [ ] Concurrent user handling
- [ ] Memory leak testing
- [ ] Load testing (ApacheBench, k6)

## 📈 Success Metrics

Define and track:

- [ ] Uptime target: 99.9%
- [ ] API response time: <200ms p95
- [ ] Error rate: <0.1%
- [ ] Failed login rate: <5%
- [ ] Email delivery rate: >95%

## 🚨 Incident Response

### Prepare for Issues

- [ ] **Rollback Plan**
  ```bash
  # Document previous stable version
  # Keep deployment history
  # Test rollback procedure
  ```

- [ ] **Emergency Contacts**
  - List on-call engineers
  - Document escalation procedures
  - Maintain 24/7 availability

- [ ] **Communication Plan**
  - Set up status page (status.io)
  - Prepare incident templates
  - Define customer notification process

## ✅ Final Verification

Before going live:

```bash
# Run through this checklist
grep -E "^\- \[ \]" PRODUCTION_CHECKLIST.md

# Should see only optional items unchecked
# Critical and Important sections should be 100% complete

# Test production environment end-to-end
# 1. Open frontend
# 2. Login as admin
# 3. Create escrow
# 4. Check logs for errors
# 5. Verify Sentry captures test error
# 6. Confirm email sent (if configured)
```

## 🎉 Go Live!

Once all critical items are checked:

1. ✅ Announce to team
2. ✅ Monitor closely for 24 hours
3. ✅ Document any issues
4. ✅ Celebrate launch! 🚀

---

## 📞 Support

If you encounter issues:

1. Check `DEPLOYMENT.md` for detailed guides
2. Review `DATABASE_MIGRATION.md` for database issues
3. Check Sentry dashboard for errors
4. Review server logs for warnings
5. Test locally to isolate issue

## 🔄 Post-Launch Tasks

Week 1:
- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Optimize slow queries
- [ ] Fine-tune rate limits

Month 1:
- [ ] Analyze usage patterns
- [ ] Plan feature improvements
- [ ] Review security logs
- [ ] Update documentation

Ongoing:
- [ ] Monthly dependency updates
- [ ] Quarterly security reviews
- [ ] Regular backup testing
- [ ] Performance optimization

---

**Remember**: Security is not a one-time task. Continuous monitoring and updates are essential for maintaining a secure production system.
