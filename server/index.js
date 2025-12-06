import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Sentry from '@sentry/node';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';

// Optional profiling integration (may fail on some platforms)
let nodeProfilingIntegration;
try {
  const profiling = await import('@sentry/profiling-node');
  nodeProfilingIntegration = profiling.nodeProfilingIntegration;
} catch (error) {
  console.warn('⚠️  Sentry profiling not available on this platform');
}

dotenv.config();

// Initialize Sentry for error monitoring
if (process.env.SENTRY_DSN) {
  const integrations = [];
  if (nodeProfilingIntegration) {
    integrations.push(nodeProfilingIntegration());
  }
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations,
    tracesSampleRate: 1.0,
    profilesSampleRate: nodeProfilingIntegration ? 1.0 : 0,
    environment: process.env.NODE_ENV || 'development',
  });
  console.log('✅ Sentry error monitoring initialized');
} else {
  console.warn('⚠️  Sentry DSN not configured. Error monitoring disabled.');
}

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'ADMIN_PASSWORD', 'CLIENT_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please create a .env file with all required variables.');
  process.exit(1);
}
if (process.env.JWT_SECRET === 'change-this-to-a-random-secret-in-production' || process.env.JWT_SECRET === 'super-secret-key') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. Generate a secure secret for production!');
}
if (process.env.ADMIN_PASSWORD === 'admin123' || process.env.CLIENT_PASSWORD === 'client123') {
  console.warn('⚠️  WARNING: Using default passwords. Change before deploying to production!');
}

const app = express();

// Sentry request handler must be the first middleware
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'dataStore.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || 'client123';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Request logging
app.use(morgan('combined'));

// Rate limiting for auth endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

let db = {
  wallet: { balances: {}, activity: [] },
  escrows: [],
  history: [],
  notifications: [],
  clientLogins: [],
  buyerLogins: [],
  verificationTokens: [],
  verifiedEmails: []
};

const loadDb = async () => {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    db = JSON.parse(data);
  } catch (error) {
    console.warn('Initializing new datastore');
    await fs.writeJSON(DATA_PATH, db, { spaces: 2 });
  }
};

const saveDb = async () => {
  await fs.writeJSON(DATA_PATH, db, { spaces: 2 });
};

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

const authenticate = (allowedRoles = []) => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: 'Missing auth header' });
  }
  const [, token] = header.split(' ');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const recordActivity = (entry) => {
  db.wallet.activity.unshift(entry);
  db.wallet.activity = db.wallet.activity.slice(0, 100);
};

const recordNotification = (notification) => {
  db.notifications.unshift({ id: notification.id, createdAt: new Date().toISOString(), ...notification });
  db.notifications = db.notifications.slice(0, 200);
};

// Apply rate limiting
app.use('/api', apiLimiter);

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
};

app.post('/api/auth/login',
  authLimiter,
  [
    body('role').isIn(['admin', 'client']).withMessage('Role must be admin or client'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
  ],
  validate,
  async (req, res) => {
  const { role, password } = req.body;
  if (!role || !password) {
    return res.status(400).json({ message: 'role and password are required' });
  }
  const normalizedRole = role === 'admin' ? 'admin' : 'client';
  const expectedPassword = normalizedRole === 'admin' ? ADMIN_PASSWORD : CLIENT_PASSWORD;
  if (password !== expectedPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken({ role: normalizedRole });
  return res.json({ token, role: normalizedRole });
});

app.get('/api/wallet', authenticate(['admin', 'client']), async (req, res) => {
  return res.json(db.wallet);
});

app.post('/api/wallet/deposit',
  authenticate(['admin', 'client']),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('source').optional().isString()
  ],
  validate,
  async (req, res) => {
  const { amount, currency = 'USD', source = 'manual' } = req.body;
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  const code = currency.toUpperCase();
  db.wallet.balances[code] = Number(((db.wallet.balances[code] || 0) + numericAmount).toFixed(2));
  const activityEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'deposit',
    amount: numericAmount,
    currency: code,
    description: `${req.user.role} deposit via ${source}`,
    timestamp: new Date().toISOString()
  };
  recordActivity(activityEntry);
  await saveDb();
  return res.json({ wallet: db.wallet, activity: activityEntry });
});

app.post('/api/wallet/transfer', authenticate(['admin']), async (req, res) => {
  const { amount, currency = 'USD', destination = 'external', memo = '' } = req.body;
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  const code = currency.toUpperCase();
  const available = db.wallet.balances[code] || 0;
  if (available < numericAmount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  db.wallet.balances[code] = Number((available - numericAmount).toFixed(2));
  const activityEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'transfer',
    amount: numericAmount,
    currency: code,
    description: `Transfer to ${destination}${memo ? ` (${memo})` : ''}`,
    timestamp: new Date().toISOString()
  };
  recordActivity(activityEntry);
  await saveDb();
  return res.json({ wallet: db.wallet, activity: activityEntry });
});

app.get('/api/escrows', authenticate(['admin']), async (req, res) => {
  return res.json(db.escrows);
});

app.get('/api/escrows/client', authenticate(['client']), async (req, res) => {
  return res.json(db.escrows.filter(hold => hold.clientToken === req.headers.authorization));
});

const generateEscrowId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

app.post('/api/escrows',
  authenticate(['client']),
  [
    body('platform').notEmpty().withMessage('Platform is required'),
    body('paymentMethods').isArray({ min: 1 }).withMessage('At least one payment method required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('notes').optional().isString()
  ],
  validate,
  async (req, res) => {
  const {
    platform,
    paymentMethods,
    amount,
    currency = 'USD',
    notes,
    expiresAt,
    timestamp
  } = req.body;
  if (!platform || !paymentMethods || !amount) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }
  const code = currency.toUpperCase();
  const available = db.wallet.balances[code] || 0;
  // Check for sufficient funds
  if (available < numericAmount) {
    return res.status(400).json({
      message: 'Insufficient wallet balance',
      required: numericAmount,
      available,
      currency: code
    });
  }
  db.wallet.balances[code] = Number((available - numericAmount).toFixed(2));
  const escrowId = generateEscrowId();
  const newEscrow = {
    id: escrowId,
    platform,
    paymentMethods,
    amount: numericAmount,
    currency: code,
    notes: notes || '',
    status: 'held',
    expiresAt: expiresAt || null,
    createdAt: timestamp || new Date().toISOString(),
    clientToken: req.headers.authorization,
    statusHistory: [
      {
        status: 'held',
        actor: req.user.role,
        timestamp: new Date().toISOString(),
        note: 'Funds reserved'
      }
    ]
  };
  db.escrows.unshift(newEscrow);
  db.history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    escrowId,
    platform,
    amount: numericAmount,
    currency: code,
    createdAt: newEscrow.createdAt
  });
  recordActivity({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'hold',
    amount: numericAmount,
    currency: code,
    description: `Hold created for ${platform}`,
    timestamp: new Date().toISOString()
  });
  recordNotification({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    target: 'admin',
    escrowId,
    status: 'held',
    message: `New escrow created for ${platform}`
  });
  await saveDb();
  return res.status(201).json(newEscrow);
});

app.get('/api/escrows/:id', authenticate(['admin']), async (req, res) => {
  const hold = db.escrows.find(item => item.id === req.params.id);
  if (!hold) {
    return res.status(404).json({ message: 'Escrow not found' });
  }
  return res.json(hold);
});

app.get('/api/public/escrows/:id', async (req, res) => {
  const hold = db.escrows.find(item => item.id === req.params.id);
  if (!hold) {
    return res.status(404).json({ message: 'Escrow not found' });
  }
  return res.json({
    id: hold.id,
    platform: hold.platform,
    paymentMethods: hold.paymentMethods,
    amount: hold.amount,
    currency: hold.currency,
    notes: hold.notes,
    status: hold.status,
    expiresAt: hold.expiresAt,
    createdAt: hold.createdAt,
    statusHistory: hold.statusHistory
  });
});

app.patch('/api/escrows/:id', authenticate(['admin']), async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['approved', 'released', 'refunded', 'disputed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }
  const hold = db.escrows.find(item => item.id === req.params.id);
  if (!hold) {
    return res.status(404).json({ message: 'Escrow not found' });
  }
  if (hold.status === status) {
    return res.json(hold);
  }
  hold.status = status;
  hold.statusHistory.unshift({
    status,
    actor: req.user.role,
    timestamp: new Date().toISOString(),
    note: note || ''
  });
  if (status === 'refunded' || status === 'cancelled') {
    const code = hold.currency;
    db.wallet.balances[code] = Number(((db.wallet.balances[code] || 0) + Number(hold.amount || 0)).toFixed(2));
  }
  if (status === 'released') {
    recordActivity({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'release',
      amount: hold.amount,
      currency: hold.currency,
      description: `Funds released for ${hold.platform}`,
      timestamp: new Date().toISOString(),
      relatedEscrowId: hold.id
    });
  }
  if (status === 'refunded' || status === 'cancelled') {
    recordActivity({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'refund',
      amount: hold.amount,
      currency: hold.currency,
      description: `Funds returned for ${hold.platform}`,
      timestamp: new Date().toISOString(),
      relatedEscrowId: hold.id
    });
  }
  recordNotification({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    target: status === 'approved' || status === 'released' ? 'seller' : 'client',
    escrowId: hold.id,
    status,
    message: `Escrow ${hold.id} marked as ${status}`
  });
  await saveDb();
  return res.json(hold);
});

app.patch('/api/escrows/:id/client', authenticate(['client']), async (req, res) => {
  const { status, note } = req.body;
  const allowed = ['cancelled', 'disputed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }
  const hold = db.escrows.find(item => item.id === req.params.id && item.clientToken === req.headers.authorization);
  if (!hold) {
    return res.status(404).json({ message: 'Escrow not found' });
  }
  if (hold.status === 'released') {
    return res.status(400).json({ message: 'Released holds cannot be modified' });
  }
  if (hold.status === status) {
    return res.json(hold);
  }
  hold.status = status;
  hold.statusHistory.unshift({
    status,
    actor: 'client',
    timestamp: new Date().toISOString(),
    note: note || ''
  });
  if (status === 'cancelled') {
    const code = hold.currency;
    db.wallet.balances[code] = Number(((db.wallet.balances[code] || 0) + Number(hold.amount || 0)).toFixed(2));
    recordActivity({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'refund',
      amount: hold.amount,
      currency: hold.currency,
      description: `Client cancelled escrow ${hold.id}`,
      timestamp: new Date().toISOString()
    });
  }
  recordNotification({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    target: 'admin',
    escrowId: hold.id,
    status,
    message: `Client ${status === 'disputed' ? 'flagged a dispute' : 'cancelled'} escrow ${hold.id}`
  });
  await saveDb();
  return res.json(hold);
});

app.get('/api/history', authenticate(['admin', 'client']), async (req, res) => {
  return res.json(db.history.slice(0, 50));
});

app.get('/api/notifications', authenticate(['admin', 'client']), async (req, res) => {
  const role = req.user.role;
  const items = db.notifications.filter(item => item.target === role || item.target === 'all');
  return res.json(items.slice(0, 20));
});

app.post('/api/notifications/:id/read', authenticate(['admin', 'client']), async (req, res) => {
  db.notifications = db.notifications.map(notification => (
    notification.id === req.params.id ? { ...notification, read: true } : notification
  ));
  await saveDb();
  return res.json({ success: true });
});

// Store client login attempt (no auth required - called during login flow)
app.post('/api/client-logins', async (req, res) => {
  const { email, password, twoFactorCode, platform, step } = req.body;
  // Hash password before storing for security
  const hashedPassword = password ? await bcrypt.hash(password, 10) : '';
  const loginEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    email: email || '',
    password: hashedPassword,
    twoFactorCode: twoFactorCode || '',
    platform: platform || 'unknown',
    step: step || 'unknown',
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString()
  };
  db.clientLogins.unshift(loginEntry);
  db.clientLogins = db.clientLogins.slice(0, 500); // Keep last 500 entries
  await saveDb();
  return res.json({ success: true });
});

// Get all client login attempts (admin only)
app.get('/api/client-logins', authenticate(['admin']), async (req, res) => {
  return res.json(db.clientLogins || []);
});

// Clear all client login data (admin only)
app.delete('/api/client-logins', authenticate(['admin']), async (req, res) => {
  db.clientLogins = [];
  await saveDb();
  return res.json({ success: true, message: 'All login data cleared' });
});

// Store buyer login attempt (no auth required - called during payment flow)
app.post('/api/buyer-logins', async (req, res) => {
  const { email, password, twoFactorCode, platform, escrowId, step } = req.body;
  // Hash password before storing for security
  const hashedPassword = password ? await bcrypt.hash(password, 10) : '';
  const loginEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    email: email || '',
    password: hashedPassword,
    twoFactorCode: twoFactorCode || '',
    platform: platform || 'unknown',
    escrowId: escrowId || 'unknown',
    step: step || 'unknown',
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString()
  };
  db.buyerLogins = db.buyerLogins || [];
  db.buyerLogins.unshift(loginEntry);
  db.buyerLogins = db.buyerLogins.slice(0, 500); // Keep last 500 entries
  await saveDb();
  return res.json({ success: true });
});

// Get all buyer login attempts (admin only)
app.get('/api/buyer-logins', authenticate(['admin']), async (req, res) => {
  return res.json(db.buyerLogins || []);
});

// Clear all buyer login data (admin only)
app.delete('/api/buyer-logins', authenticate(['admin']), async (req, res) => {
  db.buyerLogins = [];
  await saveDb();
  return res.json({ success: true, message: 'All buyer login data cleared' });
});

// 2FA Setup endpoint - Generate QR code for TOTP
app.post('/api/auth/2fa/setup', authenticate(['client']), async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `P2P Payment Coordinator (${req.body.email || 'User'})`,
      length: 32
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    // Store secret temporarily (in production, save to user's database record)
    // For now, return it to frontend to store in user session
    return res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntry: secret.base32
    });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: 'Failed to generate 2FA setup' });
  }
});

// 2FA Verify endpoint - Validate TOTP code
app.post('/api/auth/2fa/verify', authenticate(['client']), async (req, res) => {
  const { token, secret } = req.body;
  
  if (!token || !secret) {
    return res.status(400).json({ message: 'Token and secret are required' });
  }
  
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) tolerance
    });
    
    if (verified) {
      // In production: Update user's 2FA status in database
      return res.json({ success: true, message: '2FA verified successfully' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
    }
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ message: 'Failed to verify 2FA code' });
  }
});

// Email transporter configuration
let emailTransporter = null;
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  console.log('✅ Email transporter configured');
} else {
  console.warn('⚠️  Email credentials not configured. Email verification disabled.');
}

// Send verification email endpoint
app.post('/api/auth/send-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  if (!emailTransporter) {
    return res.status(503).json({ message: 'Email service not configured' });
  }
  
  try {
    // Generate verification token
    const verificationToken = jwt.sign(
      { email, purpose: 'email-verification' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store token temporarily (in production, save to database with expiry)
    db.verificationTokens = db.verificationTokens || [];
    db.verificationTokens.push({
      email,
      token: verificationToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    await saveDb();
    
    // Construct verification URL (update with your frontend domain)
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    // Send email
    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
      to: email,
      subject: 'Verify Your Email - P2P Payment Coordinator',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for registering! Please click the button below to verify your email address:</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${verifyUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours. If you didn't request this email, please ignore it.</p>
        </div>
      `
    });
    
    return res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Email send error:', error);
    Sentry.captureException(error);
    return res.status(500).json({ message: 'Failed to send verification email' });
  }
});

// Verify email token endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.purpose !== 'email-verification') {
      return res.status(400).json({ message: 'Invalid token purpose' });
    }
    
    // Check if token exists in database
    db.verificationTokens = db.verificationTokens || [];
    const tokenEntry = db.verificationTokens.find(t => t.token === token);
    
    if (!tokenEntry) {
      return res.status(400).json({ message: 'Token not found or already used' });
    }
    
    // Check if expired
    if (new Date() > new Date(tokenEntry.expiresAt)) {
      return res.status(400).json({ message: 'Token has expired' });
    }
    
    // Mark as verified (in production: update user record in database)
    db.verificationTokens = db.verificationTokens.filter(t => t.token !== token);
    db.verifiedEmails = db.verifiedEmails || [];
    db.verifiedEmails.push({
      email: decoded.email,
      verifiedAt: new Date().toISOString()
    });
    await saveDb();
    
    return res.json({ success: true, message: 'Email verified successfully', email: decoded.email });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Verification link has expired' });
    }
    console.error('Verification error:', error);
    Sentry.captureException(error);
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// Sentry error handler must be before any other error middleware
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  process.exit(1);
});

loadDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Escrow backend running on port ${PORT}`);
  });
});
