# Production Domain Configuration Guide

## Task #2: Update ALLOWED_ORIGINS

### What is ALLOWED_ORIGINS?

ALLOWED_ORIGINS controls which domains can make API requests to your backend. This is a critical CORS (Cross-Origin Resource Sharing) security feature that prevents unauthorized websites from accessing your API.

### Current Configuration

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5174
```

This only allows requests from local development. **Production domains will be blocked!**

## Deployment Scenarios

### Scenario 1: Separate Frontend & Backend (Most Common)

**Example:**
- Frontend: `https://go-accept.vercel.app`
- Backend: `https://go-accept-api.railway.app`

**Update .env:**
```env
ALLOWED_ORIGINS=https://go-accept.vercel.app,http://localhost:5173,http://localhost:3000
```

**Update frontend API URL** (`src/services/escrowApi.js`):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://go-accept-api.railway.app/api';
```

**Add to frontend .env:**
```env
VITE_API_URL=https://go-accept-api.railway.app/api
```

### Scenario 2: Same Domain (Frontend + Backend)

**Example:**
- Full Stack: `https://go-accept.com`
- Backend serves frontend + API

**Update .env:**
```env
ALLOWED_ORIGINS=https://go-accept.com,http://localhost:5173
```

### Scenario 3: Custom Domain

**Example:**
- Frontend: `https://www.myapp.com`
- Backend: `https://api.myapp.com`

**Update .env:**
```env
ALLOWED_ORIGINS=https://www.myapp.com,https://myapp.com,http://localhost:5173
```

**Note:** Include both `www` and non-`www` versions!

### Scenario 4: Multiple Environments

**Example:**
- Production: `https://go-accept.com`
- Staging: `https://staging.go-accept.com`
- Development: `http://localhost:5173`

**Update .env:**
```env
ALLOWED_ORIGINS=https://go-accept.com,https://staging.go-accept.com,http://localhost:5173,http://localhost:3000
```

## Platform-Specific Instructions

### Vercel (Frontend) + Railway (Backend)

1. **Deploy Frontend to Vercel**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Deploy
   vercel
   
   # Note the production URL (e.g., go-accept.vercel.app)
   ```

2. **Deploy Backend to Railway**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway up
   
   # Note the backend URL (e.g., go-accept-api.railway.app)
   ```

3. **Update Backend ALLOWED_ORIGINS**
   ```bash
   # In Railway dashboard or CLI
   railway variables set ALLOWED_ORIGINS=https://go-accept.vercel.app,http://localhost:5173
   ```

4. **Update Frontend API URL**
   ```bash
   # In Vercel dashboard or vercel.json
   # Add environment variable:
   VITE_API_URL=https://go-accept-api.railway.app/api
   ```

### Render (Full Stack)

1. **Deploy to Render**
   - Dashboard → New → Web Service
   - Connect GitHub repo
   - Build command: `npm install && npm run build`
   - Start command: `node server/index.js`

2. **Get Your Domain**
   - Note the URL (e.g., `go-accept.onrender.com`)

3. **Update Environment Variables**
   ```env
   ALLOWED_ORIGINS=https://go-accept.onrender.com,http://localhost:5173
   ```

### Netlify (Frontend) + Railway (Backend)

1. **Deploy Frontend to Netlify**
   ```bash
   # Build frontend
   npm run build
   
   # Deploy to Netlify
   netlify deploy --prod
   
   # Note URL (e.g., go-accept.netlify.app)
   ```

2. **Update Railway Backend**
   ```bash
   railway variables set ALLOWED_ORIGINS=https://go-accept.netlify.app,http://localhost:5173
   ```

3. **Update Frontend Environment**
   - Netlify Dashboard → Site settings → Environment variables
   - Add: `VITE_API_URL=https://go-accept-api.railway.app/api`

## Custom Domain Setup

### Step 1: Purchase Domain
- Namecheap: ~$10/year
- Google Domains: ~$12/year
- Cloudflare: ~$10/year (includes free SSL)

### Step 2: Configure DNS

**For Frontend (Vercel/Netlify):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com (or Netlify equivalent)

Type: A
Name: @
Value: 76.76.21.21 (Vercel IP)
```

**For Backend (Railway):**
```
Type: CNAME
Name: api
Value: your-app.railway.app
```

### Step 3: Update ALLOWED_ORIGINS
```env
ALLOWED_ORIGINS=https://www.myapp.com,https://myapp.com,https://api.myapp.com,http://localhost:5173
```

### Step 4: Update SSL (Automatic)
- Vercel: Automatic SSL with Let's Encrypt
- Railway: Automatic SSL
- Netlify: Automatic SSL

Wait 24-48 hours for DNS propagation.

## Security Best Practices

### ✅ Do's

1. **Use HTTPS only in production**
   ```env
   ALLOWED_ORIGINS=https://myapp.com
   ```

2. **Include development URLs**
   ```env
   ALLOWED_ORIGINS=https://myapp.com,http://localhost:5173
   ```

3. **No trailing slashes**
   ```env
   ✅ https://myapp.com
   ❌ https://myapp.com/
   ```

4. **Include all subdomains you use**
   ```env
   ALLOWED_ORIGINS=https://www.myapp.com,https://myapp.com,https://app.myapp.com
   ```

### ❌ Don'ts

1. **Never use wildcards in production**
   ```env
   ❌ ALLOWED_ORIGINS=*
   ❌ ALLOWED_ORIGINS=https://*.myapp.com
   ```

2. **Don't mix HTTP and HTTPS for same domain**
   ```env
   ❌ ALLOWED_ORIGINS=http://myapp.com,https://myapp.com
   # Choose one (HTTPS for production)
   ```

3. **Don't expose development URLs in production**
   ```env
   # Production .env:
   ✅ ALLOWED_ORIGINS=https://myapp.com
   
   # Development .env:
   ✅ ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

## Testing CORS Configuration

### Test 1: Browser Console
```javascript
// Open your production frontend
// Open browser console (F12)
fetch('https://your-api.railway.app/api/wallet', {
  headers: { 'Authorization': 'Bearer your-token' }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)

// Should NOT see CORS error
// If you see "blocked by CORS policy", ALLOWED_ORIGINS is wrong
```

### Test 2: cURL
```bash
# Test CORS preflight
curl -X OPTIONS https://your-api.railway.app/api/wallet \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should see:
# Access-Control-Allow-Origin: https://your-frontend.vercel.app
```

### Test 3: Online Tool
- Visit: https://www.test-cors.org
- URL: Your API endpoint
- Origin: Your frontend domain
- Should show "✅ CORS is enabled"

## Troubleshooting

### Error: "blocked by CORS policy"

**Cause:** Frontend domain not in ALLOWED_ORIGINS

**Fix:**
```bash
# Check current ALLOWED_ORIGINS
echo $ALLOWED_ORIGINS

# Add your domain
railway variables set ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:5173

# Restart backend
railway restart
```

### Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** Backend not responding with CORS headers

**Fix:**
1. Verify ALLOWED_ORIGINS is set
2. Check backend logs: `railway logs`
3. Ensure domain matches EXACTLY (no trailing slash)

### Error: "Credentials flag is 'true'"

**Cause:** Frontend sending credentials, but CORS not configured

**Already Fixed:** Backend has `credentials: true` in CORS config

### Multiple domains not working

**Cause:** Format issue in ALLOWED_ORIGINS

**Fix:**
```env
# Correct format (comma-separated, no spaces)
✅ ALLOWED_ORIGINS=https://app1.com,https://app2.com,http://localhost:5173

# Wrong format
❌ ALLOWED_ORIGINS=https://app1.com, https://app2.com (spaces)
❌ ALLOWED_ORIGINS="https://app1.com,https://app2.com" (quotes in Railway)
```

## Environment-Specific Configurations

### .env.production
```env
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
DATABASE_URL=postgresql://...
SENTRY_DSN=https://...
NODE_ENV=production
```

### .env.staging
```env
ALLOWED_ORIGINS=https://staging.myapp.com,http://localhost:5173
DATABASE_URL=postgresql://...
NODE_ENV=staging
```

### .env.development
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5174
DATABASE_URL=
NODE_ENV=development
```

## Quick Reference

| Platform | Frontend URL | Backend URL | ALLOWED_ORIGINS |
|----------|-------------|-------------|-----------------|
| Vercel + Railway | vercel.app | railway.app | https://yourapp.vercel.app |
| Render Full Stack | onrender.com | onrender.com | https://yourapp.onrender.com |
| Netlify + Railway | netlify.app | railway.app | https://yourapp.netlify.app |
| Custom Domain | myapp.com | api.myapp.com | https://myapp.com,https://www.myapp.com |

## Checklist

Before deploying:

- [ ] Frontend deployed and URL noted
- [ ] Backend deployed and URL noted
- [ ] ALLOWED_ORIGINS updated with frontend URL
- [ ] Frontend VITE_API_URL updated with backend URL
- [ ] Both domains use HTTPS (except localhost)
- [ ] No trailing slashes in URLs
- [ ] Tested with browser console (no CORS errors)
- [ ] Tested with cURL (Access-Control-Allow-Origin header present)
- [ ] Custom domain DNS configured (if applicable)
- [ ] SSL certificates active (automatic on all platforms)

## Next Steps

After configuring ALLOWED_ORIGINS:

1. Test your deployment thoroughly
2. Configure Sentry DSN (Task #3)
3. Configure Email credentials (Task #4)
4. Set up automated backups (Task #5)
5. Monitor CORS errors in Sentry
