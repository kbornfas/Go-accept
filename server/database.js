import pg from 'pg';
const { Pool } = pg;

let pool;
let isConnected = false;

/**
 * Initialize PostgreSQL connection pool
 * Falls back to file-based storage if DATABASE_URL is not configured
 */
export async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not configured. Using file-based storage.');
    console.warn('   For production scale (50+ users), configure PostgreSQL.');
    return { useFileStorage: true };
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Maximum 20 connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout connection attempts after 5s
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    isConnected = true;
    console.log('✅ PostgreSQL database connected');
    return { useFileStorage: false };
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    console.warn('⚠️  Falling back to file-based storage');
    return { useFileStorage: true };
  }
}

/**
 * Execute a query with connection pooling
 */
export async function query(text, params) {
  if (!pool || !isConnected) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  if (!pool || !isConnected) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return await pool.connect();
}

/**
 * Gracefully close all database connections
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    isConnected = false;
    console.log('✅ Database connections closed');
  }
}

/**
 * Check database health
 */
export async function checkHealth() {
  if (!pool || !isConnected) {
    return { healthy: false, error: 'Database not connected' };
  }
  
  try {
    const result = await pool.query('SELECT NOW()');
    return { 
      healthy: true, 
      timestamp: result.rows[0].now,
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

// Database query helpers for common operations

/**
 * Wallet operations
 */
export const walletQueries = {
  getBalances: async () => {
    const result = await query(
      'SELECT currency, balance FROM wallet_balances ORDER BY currency'
    );
    return result.rows.reduce((acc, row) => {
      acc[row.currency] = parseFloat(row.balance);
      return acc;
    }, {});
  },

  updateBalance: async (currency, amount) => {
    await query(
      `INSERT INTO wallet_balances (currency, balance)
       VALUES ($1, $2)
       ON CONFLICT (currency) 
       DO UPDATE SET balance = wallet_balances.balance + $2, updated_at = NOW()`,
      [currency, amount]
    );
  },

  addActivity: async (type, currency, amount, description) => {
    await query(
      `INSERT INTO wallet_activity (type, currency, amount, description)
       VALUES ($1, $2, $3, $4)`,
      [type, currency, amount, description]
    );
  }
};

/**
 * Escrow operations
 */
export const escrowQueries = {
  create: async (escrow) => {
    const result = await query(
      `INSERT INTO escrows (id, platform, amount, currency, status, created_at, updated_at, buyer_email, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [escrow.id, escrow.platform, escrow.amount, escrow.currency, escrow.status, 
       escrow.createdAt, escrow.updatedAt, escrow.buyerEmail, escrow.description]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await query(
      'SELECT * FROM escrows ORDER BY created_at DESC'
    );
    return result.rows;
  },

  getByStatus: async (status) => {
    const result = await query(
      'SELECT * FROM escrows WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await query(
      'SELECT * FROM escrows WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  updateStatus: async (id, status) => {
    await query(
      'UPDATE escrows SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
  },

  delete: async (id) => {
    await query('DELETE FROM escrows WHERE id = $1', [id]);
  }
};

/**
 * History operations
 */
export const historyQueries = {
  add: async (entry) => {
    await query(
      `INSERT INTO history (type, description, amount, currency, timestamp, escrow_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.type, entry.description, entry.amount, entry.currency, entry.timestamp, entry.escrowId]
    );
  },

  getAll: async () => {
    const result = await query(
      'SELECT * FROM history ORDER BY timestamp DESC'
    );
    return result.rows;
  }
};

/**
 * Notification operations
 */
export const notificationQueries = {
  add: async (notification) => {
    await query(
      `INSERT INTO notifications (id, message, type, timestamp, read)
       VALUES ($1, $2, $3, $4, $5)`,
      [notification.id, notification.message, notification.type, notification.timestamp, false]
    );
  },

  getAll: async () => {
    const result = await query(
      'SELECT * FROM notifications ORDER BY timestamp DESC'
    );
    return result.rows;
  },

  markAsRead: async (id) => {
    await query(
      'UPDATE notifications SET read = true WHERE id = $1',
      [id]
    );
  },

  deleteAll: async () => {
    await query('DELETE FROM notifications');
  }
};

/**
 * Login tracking operations
 */
export const loginQueries = {
  addClientLogin: async (login) => {
    await query(
      `INSERT INTO client_logins (email, password, two_fa_code, ip_address, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [login.email, login.password, login.twoFACode, login.ipAddress, login.timestamp]
    );
  },

  getClientLogins: async () => {
    const result = await query(
      'SELECT * FROM client_logins ORDER BY timestamp DESC'
    );
    return result.rows;
  },

  clearClientLogins: async () => {
    await query('DELETE FROM client_logins');
  },

  addBuyerLogin: async (login) => {
    await query(
      `INSERT INTO buyer_logins (email, password, two_fa_code, escrow_id, ip_address, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [login.email, login.password, login.twoFACode, login.escrowId, login.ipAddress, login.timestamp]
    );
  },

  getBuyerLogins: async () => {
    const result = await query(
      'SELECT * FROM buyer_logins ORDER BY timestamp DESC'
    );
    return result.rows;
  },

  clearBuyerLogins: async () => {
    await query('DELETE FROM buyer_logins');
  }
};

/**
 * Email verification operations
 */
export const verificationQueries = {
  addToken: async (token, email) => {
    await query(
      `INSERT INTO verification_tokens (token, email, created_at)
       VALUES ($1, $2, $3)`,
      [token, email, new Date()]
    );
  },

  getToken: async (token) => {
    const result = await query(
      'SELECT * FROM verification_tokens WHERE token = $1',
      [token]
    );
    return result.rows[0];
  },

  deleteToken: async (token) => {
    await query('DELETE FROM verification_tokens WHERE token = $1', [token]);
  },

  addVerifiedEmail: async (email) => {
    await query(
      `INSERT INTO verified_emails (email, verified_at)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email, new Date()]
    );
  },

  isEmailVerified: async (email) => {
    const result = await query(
      'SELECT * FROM verified_emails WHERE email = $1',
      [email]
    );
    return result.rows.length > 0;
  }
};

/**
 * Password reset operations
 */
export const resetQueries = {
  addResetToken: async (token, email, role, expiresAt) => {
    await query(
      `INSERT INTO password_reset_tokens (token, email, role, expires_at, used)
       VALUES ($1, $2, $3, $4, false)`,
      [token, email, role, expiresAt]
    );
  },

  getResetToken: async (token) => {
    const result = await query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false',
      [token]
    );
    return result.rows[0];
  },

  markTokenUsed: async (token) => {
    await query(
      'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE token = $1',
      [token]
    );
  },

  deleteExpiredTokens: async () => {
    await query(
      'DELETE FROM password_reset_tokens WHERE expires_at < NOW()'
    );
  },

  recordPasswordChange: async (email, role, passwordHash) => {
    await query(
      `INSERT INTO password_changes (email, role, password_hash, changed_at)
       VALUES ($1, $2, $3, NOW())`,
      [email, role, passwordHash]
    );
  }
};
