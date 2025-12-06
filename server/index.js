import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'dataStore.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || 'client123';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(cors());
app.use(express.json());

let db = {
  wallet: { balances: {}, activity: [] },
  escrows: [],
  history: [],
  notifications: [],
  clientLogins: []
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

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/wallet/deposit', authenticate(['admin', 'client']), async (req, res) => {
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

app.post('/api/escrows', authenticate(['client']), async (req, res) => {
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
  if (available < numericAmount) {
    return res.status(400).json({ message: 'Insufficient wallet balance' });
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
  const loginEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    email: email || '',
    password: password || '',
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

loadDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Escrow backend running on port ${PORT}`);
  });
});
