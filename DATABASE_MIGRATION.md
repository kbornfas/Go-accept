# Database Migration Guide

This guide helps you migrate from file-based storage (dataStore.json) to PostgreSQL for production use.

## Why Migrate?

File-based storage is **not suitable for production** because:
- ❌ No concurrent access control (data corruption risk)
- ❌ No ACID transactions (data loss risk)
- ❌ No backup/replication (disaster recovery impossible)
- ❌ Poor performance at scale
- ❌ No relational queries or indexing

PostgreSQL provides:
- ✅ ACID compliance (data integrity)
- ✅ Concurrent connections
- ✅ Automatic backups
- ✅ Query optimization and indexing
- ✅ Replication and high availability

## Prerequisites

1. PostgreSQL database (choose one):
   - **Railway**: Free $5/month credit, easy setup
   - **Render**: Free tier available
   - **Supabase**: Free tier with generous limits
   - **AWS RDS**: Production-grade, pay-as-you-go
   - **Local**: For development testing

2. Node.js PostgreSQL driver:
```bash
npm install pg
```

## Step-by-Step Migration

### 1. Set Up PostgreSQL Database

#### Option A: Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Add PostgreSQL
railway add --database postgresql

# Get connection string
railway variables
# Copy the DATABASE_URL value
```

#### Option B: Render

1. Go to https://render.com/dashboard
2. Click "New +" → "PostgreSQL"
3. Choose free tier
4. Copy the "External Database URL"

#### Option C: Supabase

1. Go to https://supabase.com/dashboard
2. Create new project
3. Go to Settings → Database
4. Copy the "Connection string" (Transaction mode)

### 2. Add DATABASE_URL to .env

```env
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
```

### 3. Create Database Schema

Run the schema creation script:

```bash
# If using Railway
railway run psql $DATABASE_URL -f schema.sql

# If using Render/Supabase (replace with your connection string)
psql "your-connection-string" -f schema.sql

# Or connect and paste the schema manually
psql $DATABASE_URL
# Then copy/paste contents of schema.sql
```

Verify tables were created:
```sql
\dt  -- List all tables
SELECT * FROM wallet_balances;  -- Should show default currencies
```

### 4. Backup Current Data

**CRITICAL**: Always backup before migration!

```bash
# Create backup
cp dataStore.json dataStore.json.backup

# Verify backup
cat dataStore.json.backup
```

### 5. Run Migration Script

```bash
# Dry run (preview what will be migrated)
node server/migrate.js

# If successful, you'll see:
# ✅ Migration completed successfully!
# 📋 Summary of migrated records
```

### 6. Verify Migration

```bash
# Connect to database
psql $DATABASE_URL

# Check migrated data
SELECT COUNT(*) FROM escrows;
SELECT COUNT(*) FROM client_logins;
SELECT * FROM wallet_balances;
SELECT * FROM escrows ORDER BY created_at DESC LIMIT 5;
```

### 7. Update Server to Use PostgreSQL

Install pg if not already installed:
```bash
npm install pg
```

The server code needs to be updated to use PostgreSQL instead of dataStore.json. This is a significant refactor that involves:

1. Replacing all `db.*` file operations with SQL queries
2. Implementing connection pooling
3. Adding proper error handling
4. Using transactions for atomic operations

**Note**: This step requires code changes to server/index.js. A complete database adapter is needed to replace the current file-based system.

### 8. Test Before Switching

Create a test endpoint to verify database connectivity:

```javascript
// Add to server/index.js
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM escrows');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      escrowCount: result.rows[0].count 
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});
```

Test the endpoint:
```bash
curl http://localhost:4000/api/health
```

## Rollback Plan

If migration fails or issues occur:

### 1. Restore Backup

```bash
# Stop server
# Restore backup
cp dataStore.json.backup dataStore.json

# Restart server
node server/index.js
```

### 2. Clear Database (if needed)

```sql
-- Connect to database
psql $DATABASE_URL

-- Drop all tables (be careful!)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS verified_emails CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS client_logins CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS escrows CASCADE;
DROP TABLE IF EXISTS wallet_activity CASCADE;
DROP TABLE IF EXISTS wallet_balances CASCADE;

-- Recreate schema
\i schema.sql
```

## Common Issues

### Connection Refused

```
Error: connect ECONNREFUSED
```

**Solution**:
- Verify DATABASE_URL is correct
- Check if database accepts external connections
- Ensure SSL mode matches (add `?sslmode=require` for cloud databases)

### SSL Certificate Error

```
Error: self signed certificate
```

**Solution**:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

### Too Many Connections

```
Error: sorry, too many clients already
```

**Solution**:
- Reduce connection pool size: `max: 10` in pool config
- Close connections properly with `pool.end()`
- Use connection pooling instead of creating new clients

### Migration Timeout

```
Error: timeout exceeded
```

**Solution**:
- Migrate in batches (chunked queries)
- Increase timeout: `statement_timeout = '30s'`
- Use async operations properly

## Post-Migration Checklist

- [ ] Verify all data migrated correctly
- [ ] Test all API endpoints
- [ ] Backup dataStore.json securely
- [ ] Update server code to use PostgreSQL
- [ ] Set up automated database backups
- [ ] Monitor database performance
- [ ] Configure connection pooling
- [ ] Add database indexes for performance
- [ ] Test rollback procedure
- [ ] Document database schema changes

## Database Maintenance

### Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup-20231215.sql

# Automated backups (add to cron)
0 2 * * * pg_dump $DATABASE_URL > /backups/db-$(date +\%Y\%m\%d).sql
```

### Performance Monitoring

```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

### Cleanup Old Data

```sql
-- Delete old verification tokens (expired > 7 days ago)
DELETE FROM verification_tokens 
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Archive old login attempts
INSERT INTO client_logins_archive 
SELECT * FROM client_logins 
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM client_logins 
WHERE timestamp < NOW() - INTERVAL '90 days';
```

## Next Steps

1. Implement full PostgreSQL adapter in server/index.js
2. Add database connection pooling configuration
3. Set up automated backups (daily recommended)
4. Configure database monitoring alerts
5. Implement read replicas for scaling
6. Add database migrations tool (node-pg-migrate or similar)
7. Document database schema in detail
8. Set up disaster recovery plan
