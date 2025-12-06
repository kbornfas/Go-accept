# Sentry Error Monitoring Setup Guide

## Task #3: Configure Sentry DSN

### What is Sentry?

Sentry is an error monitoring platform that:
- ✅ Captures all JavaScript errors in production
- ✅ Captures backend Node.js errors
- ✅ Provides stack traces and context
- ✅ Tracks error frequency and affected users
- ✅ Sends alerts via email/Slack when errors spike
- ✅ Performance monitoring (optional)

**Current Status:** Code is already integrated, just needs DSN configuration.

## Quick Setup (5 minutes)

### Step 1: Create Sentry Account

1. Visit https://sentry.io
2. Sign up with GitHub (free tier: 5,000 errors/month, unlimited projects)
3. Select "Node.js" when prompted

### Step 2: Create Project

1. Dashboard → Create Project
2. **Platform:** Node.js (for backend)
3. **Project Name:** go-accept-backend
4. **Team:** Your team name
5. Click "Create Project"

### Step 3: Get DSN

After creating project:
```
You'll see a screen showing your DSN:
https://abc123def456@o123456.ingest.sentry.io/789012
```

**Copy this DSN** - you'll need it next.

### Step 4: Update .env

Add to your `.env` file:
```env
SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/789012
```

### Step 5: Restart Server

```bash
# Stop current server
# Ctrl+C or:
Get-Process -Name node | Stop-Process

# Start server
node server/index.js
```

You should see:
```
✅ Sentry error monitoring initialized
Escrow backend running on port 4000
```

### Step 6: Test Sentry

```bash
# Trigger a test error
Invoke-RestMethod -Uri 'http://localhost:4000/api/test-error' -Method Get
```

Go to Sentry dashboard → Issues → You should see the test error!

## Platform-Specific Setup

### Railway Deployment

```bash
# Set environment variable
railway variables set SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/789012

# Restart
railway restart

# Check logs
railway logs
# Should see: ✅ Sentry error monitoring initialized
```

### Render Deployment

1. Dashboard → Your Service → Environment
2. Add Variable:
   - Key: `SENTRY_DSN`
   - Value: `https://abc123def456@o123456.ingest.sentry.io/789012`
3. Click "Save Changes" (auto-restarts)

### Vercel Serverless

```bash
# Add to environment variables
vercel env add SENTRY_DSN

# Paste your DSN when prompted
# Deploy
vercel --prod
```

## Frontend Sentry Setup (Optional but Recommended)

### Step 1: Create Frontend Project

1. Sentry Dashboard → Create Project
2. **Platform:** React
3. **Project Name:** go-accept-frontend
4. Get frontend DSN (different from backend!)

### Step 2: Install Sentry

```bash
npm install @sentry/react
```

### Step 3: Initialize in App

Update `src/main.jsx`:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import './index.css';

// Initialize Sentry
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://frontend-dsn@o123456.ingest.sentry.io/789013",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 4: Add Error Boundary

```javascript
import { ErrorBoundary } from '@sentry/react';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      {/* Your app components */}
    </ErrorBoundary>
  );
}

function ErrorFallback() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>We've been notified and are working on a fix.</p>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  );
}
```

## What Sentry Captures

### Backend Errors (Already Configured)

✅ **Uncaught Exceptions**
```javascript
throw new Error('Something broke!');
// Sentry captures automatically
```

✅ **Unhandled Promise Rejections**
```javascript
Promise.reject('Database connection failed');
// Sentry captures automatically
```

✅ **Express Route Errors**
```javascript
app.get('/api/users', (req, res) => {
  throw new Error('User not found');
  // Sentry error handler captures
});
```

✅ **Manual Captures**
```javascript
try {
  // risky operation
} catch (error) {
  Sentry.captureException(error);
  res.status(500).json({ message: 'Error occurred' });
}
```

### What Gets Sent to Sentry

- **Error message and stack trace**
- **Request URL and method**
- **User IP address** (anonymized if configured)
- **Request headers** (excluding sensitive data)
- **Environment** (production/staging/development)
- **Server context** (Node version, OS)
- **Custom tags** (you can add these)

## Advanced Configuration

### Performance Monitoring

Already enabled! Set sample rate in `server/index.js`:

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0, // 100% of transactions (reduce in high traffic)
  profilesSampleRate: 1.0, // 100% profiling (already optional on Windows)
});
```

**Recommended for production:**
```javascript
tracesSampleRate: 0.1, // 10% of requests (reduces Sentry quota usage)
```

### Custom Tags and Context

Add custom data to errors:

```javascript
// Tag errors by user role
Sentry.setTag('user_role', req.user.role);

// Add user context
Sentry.setUser({
  id: req.user.id,
  email: req.user.email,
  role: req.user.role
});

// Add extra context
Sentry.setContext('escrow', {
  id: escrow.id,
  status: escrow.status,
  amount: escrow.amount
});
```

### Filter Sensitive Data

Update `server/index.js`:

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    
    // Remove sensitive query params
    if (event.request?.query_string) {
      event.request.query_string = event.request.query_string
        .replace(/password=[^&]*/gi, 'password=REDACTED');
    }
    
    return event;
  },
});
```

## Alerts and Notifications

### Email Alerts (Free)

1. Sentry Dashboard → Settings → Alerts
2. Create New Alert Rule
3. **Trigger:** "When an issue is first seen"
4. **Action:** "Send email to team"
5. Save

### Slack Integration

1. Sentry Dashboard → Settings → Integrations
2. Search "Slack" → Install
3. Authorize Sentry in Slack
4. Configure alerts:
   - New issues
   - Issue frequency increases
   - Issues marked as regression

### Discord Integration

1. Create Discord webhook:
   - Server Settings → Integrations → Webhooks → New Webhook
   - Copy webhook URL
2. Sentry → Settings → Integrations → Webhooks
3. Add webhook URL
4. Configure event triggers

### Custom Webhook (Advanced)

```javascript
// In Sentry Dashboard → Settings → Webhooks
// Add: https://your-api.com/webhooks/sentry

// Handle in your backend:
app.post('/webhooks/sentry', (req, res) => {
  const { action, data } = req.body;
  
  if (action === 'issue.created') {
    // Send custom notification
    sendCustomAlert(data.issue);
  }
  
  res.json({ received: true });
});
```

## Monitoring Dashboard

### Key Metrics to Watch

1. **Issues Tab**
   - New errors
   - Regression errors (previously fixed)
   - High-frequency errors

2. **Performance Tab**
   - Slowest transactions
   - Database query times
   - API endpoint response times

3. **Releases Tab**
   - Error rate by release version
   - Track if new deploy increased errors

### Create Dashboards

1. Sentry → Dashboards → Create Dashboard
2. Add widgets:
   - Error frequency over time
   - Errors by endpoint
   - Errors by user role
   - Performance by transaction

## Troubleshooting

### Sentry not capturing errors

**Problem:** No errors showing in Sentry dashboard

**Solutions:**
1. Verify DSN is correct:
   ```bash
   echo $SENTRY_DSN
   # Should match Sentry project DSN
   ```

2. Check server logs:
   ```bash
   railway logs
   # Should see: ✅ Sentry error monitoring initialized
   ```

3. Trigger test error:
   ```javascript
   // Add to server/index.js temporarily
   app.get('/api/test-error', (req, res) => {
     throw new Error('Test Sentry error');
   });
   ```

4. Check Sentry project is active:
   - Dashboard → Project Settings → Check project isn't archived

### Profiling not working

**Problem:** "Sentry profiling not available on this platform"

**This is expected on Windows!** Profiling uses native modules that don't support Windows yet.

**Solution:** Profiling will work automatically when deployed to Linux servers (Railway/Render).

### Too many errors

**Problem:** Hitting Sentry quota limit (5,000 errors/month on free tier)

**Solutions:**
1. Filter out common errors:
   ```javascript
   Sentry.init({
     beforeSend(event) {
       // Ignore known issues
       if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
         return null; // Don't send to Sentry
       }
       return event;
     },
   });
   ```

2. Reduce sample rate:
   ```javascript
   tracesSampleRate: 0.1, // Only 10% of requests
   ```

3. Upgrade to paid plan:
   - Team: $29/month (50,000 errors)
   - Business: $99/month (500,000 errors)

### Performance monitoring not showing

**Problem:** Performance tab empty

**Solutions:**
1. Ensure tracesSampleRate > 0
2. Wait a few minutes for data to process
3. Generate some traffic to your API
4. Check Performance tab → Transactions

## Environment-Specific DSNs

Use different DSNs for different environments:

### .env.production
```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
SENTRY_ENVIRONMENT=production
```

### .env.staging
```env
SENTRY_DSN=https://def456@o123456.ingest.sentry.io/789013
SENTRY_ENVIRONMENT=staging
```

### .env.development
```env
SENTRY_DSN=
# Leave empty - don't send development errors to Sentry
```

Update `server/index.js`:
```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
});
```

## Best Practices

### ✅ Do's

1. **Set up alerts for new errors**
2. **Review errors daily**
3. **Mark resolved errors as "Resolved"**
4. **Add context to errors** (user ID, escrow ID)
5. **Use Releases** to track error rates per deploy
6. **Filter sensitive data** (passwords, tokens)
7. **Create separate projects** for frontend and backend

### ❌ Don'ts

1. **Don't ignore errors** - fix them!
2. **Don't send development errors** to Sentry
3. **Don't send sensitive data** (passwords, credit cards)
4. **Don't hit quota limits** - filter common errors
5. **Don't use same DSN** for all environments

## Releases and Source Maps

Track which version caused errors:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Configure
export SENTRY_AUTH_TOKEN=your-token
export SENTRY_ORG=your-org
export SENTRY_PROJECT=go-accept-backend

# Create release
sentry-cli releases new $VERSION
sentry-cli releases set-commits $VERSION --auto
sentry-cli releases finalize $VERSION

# In deployment
railway variables set SENTRY_RELEASE=$VERSION
```

## Integration with CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Notify Sentry of deployment
  run: |
    curl https://sentry.io/api/0/organizations/$SENTRY_ORG/releases/ \
      -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "version": "${{ github.sha }}",
        "projects": ["go-accept-backend"]
      }'
```

## Cost Estimation

| Plan | Errors/Month | Price | Best For |
|------|--------------|-------|----------|
| Developer | 5,000 | Free | Side projects, < 1,000 users |
| Team | 50,000 | $29/mo | Startups, < 10,000 users |
| Business | 500,000 | $99/mo | Scale-ups, < 100,000 users |
| Enterprise | Unlimited | Custom | Large companies |

**Tip:** Start with free tier, upgrade when you hit 80% of quota.

## Checklist

- [ ] Sentry account created
- [ ] Backend project created
- [ ] DSN copied
- [ ] SENTRY_DSN added to .env
- [ ] Server restarted
- [ ] Confirmed in logs: "✅ Sentry error monitoring initialized"
- [ ] Test error sent and visible in dashboard
- [ ] Email alerts configured
- [ ] Slack integration set up (optional)
- [ ] Frontend Sentry configured (optional)
- [ ] Error boundary added to React app (optional)
- [ ] Sensitive data filtering configured
- [ ] Environment set (production/staging)

## Next Steps

After configuring Sentry:

1. Configure email credentials (Task #4)
2. Set up monitoring alerts (Task #40)
3. Review errors daily
4. Fix high-frequency issues
5. Track error rates per release
