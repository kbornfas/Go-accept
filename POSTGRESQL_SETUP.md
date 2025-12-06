# PostgreSQL Database Setup Guide

## Current Status
✅ Database layer implemented with hybrid support  
✅ Automatic fallback to file-based storage if DATABASE_URL not configured  
✅ Health check endpoint at `/health`  
✅ Graceful shutdown with database connection cleanup  
✅ Connection pooling (max 20 connections, 30s idle timeout)  
✅ Slow query logging (>100ms)  

## Quick Start Options

### Option 1: Railway (Recommended - Easiest)

1. **Sign up at Railway**
   - Visit https://railway.app
   - Sign up with GitHub (free $5 credit, no credit card required)

2. **Create PostgreSQL Database**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Create new project
   railway init
   
   # Add PostgreSQL
   railway add
   # Select: PostgreSQL
   ```

3. **Get Database URL**
   ```bash
   # Railway automatically sets DATABASE_URL
   railway variables
   # Copy the DATABASE_URL value
   ```

4. **Update .env**
   ```env
   DATABASE_URL=postgresql://postgres:password@host:5432/railway
   ```

5. **Run Schema**
   ```bash
   # Railway provides a direct psql connection
   railway connect postgres
   # Then paste the contents of schema.sql
   ```

### Option 2: Render

1. **Sign up at Render**
   - Visit https://render.com
   - Sign up (free tier available)

2. **Create PostgreSQL Database**
   - Dashboard → New → PostgreSQL
   - Name: go-accept-db
   - Database: go_accept
   - User: go_accept_user
   - Region: Choose closest
   - Plan: Free (limited) or Starter ($7/month)

3. **Get Connection String**
   - Copy "External Database URL"
   - Format: `postgresql://user:password@host:5432/database`

4. **Update .env**
   ```env
   DATABASE_URL=postgresql://go_accept_user:password@dpg-xxx.render.com:5432/go_accept
   ```

5. **Run Schema**
   ```bash
   # Use psql (install from https://www.postgresql.org/download/)
   psql "postgresql://user:password@host:5432/database" -f schema.sql
   ```

### Option 3: Supabase

1. **Sign up at Supabase**
   - Visit https://supabase.com
   - Sign up (2 free projects)

2. **Create Project**
   - Dashboard → New Project
   - Name: go-accept
   - Database Password: (save this!)
   - Region: Choose closest

3. **Get Database URL**
   - Settings → Database
   - Connection String → URI
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your actual password

4. **Update .env**
   ```env
   DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
   ```

5. **Run Schema**
   - Dashboard → SQL Editor
   - New Query → Paste contents of `schema.sql`
   - Run

### Option 4: Local PostgreSQL (Development)

1. **Install PostgreSQL**
   - Windows: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 16 installer
   - Remember your password!

2. **Create Database**
   ```bash
   # Open Command Prompt or PowerShell
   psql -U postgres
   
   # In psql prompt:
   CREATE DATABASE go_accept;
   \q
   ```

3. **Run Schema**
   ```bash
   psql -U postgres -d go_accept -f schema.sql
   ```

4. **Update .env**
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/go_accept
   ```

## Migration from File Storage

Once DATABASE_URL is configured, migrate your existing data:

### Step 1: Backup Current Data
```bash
# Copy your dataStore.json file
cp server/dataStore.json server/dataStore.backup.json
```

### Step 2: Run Migration Script
```bash
node server/migrate.js
```

The migration script will:
- ✅ Read data from `dataStore.json`
- ✅ Connect to PostgreSQL
- ✅ Insert all wallet balances and activity
- ✅ Insert all escrows
- ✅ Insert all history entries
- ✅ Insert all notifications
- ✅ Insert all login records (client and buyer)
- ✅ Insert all verification tokens
- ✅ Provide summary statistics

### Step 3: Restart Server
```bash
# Stop current server (Ctrl+C)
node server/index.js
```

You should see:
```
✅ PostgreSQL database connected
Escrow backend running on port 4000
Storage mode: PostgreSQL (production)
```

### Step 4: Verify Migration
```bash
# Test health endpoint
curl http://localhost:4000/health

# Should return:
{
  "status": "ok",
  "storageMode": "postgresql",
  "database": {
    "connected": true,
    "poolSize": 1,
    "idleConnections": 1
  }
}
```

### Step 5: Test Application
1. Login as admin
2. Check wallet balances
3. View existing escrows
4. Create a new escrow
5. Verify everything works

### Step 6: Keep Backup
```bash
# Keep dataStore.backup.json for 30 days
# Delete server/dataStore.json after verifying migration
```

## Database Performance Tips

### 1. Monitor Query Performance
The server automatically logs slow queries (>100ms):
```
⚠️  Slow query (250ms): SELECT * FROM escrows WHERE status = $1
```

### 2. Add Indexes (Already in schema.sql)
The schema includes indexes on:
- `escrows.status`
- `escrows.created_at`
- `history.timestamp`
- `history.escrow_id`
- `notifications.timestamp`
- `client_logins.timestamp`
- `buyer_logins.timestamp`

### 3. Connection Pool Monitoring
Check health endpoint to monitor connections:
```bash
curl http://localhost:4000/health
```

### 4. Database Maintenance
Run these queries periodically (monthly):

```sql
-- Analyze tables for better query planning
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Reindex for performance
REINDEX DATABASE go_accept;
```

## Troubleshooting

### Server won't connect to PostgreSQL

**Problem**: "Failed to connect to PostgreSQL"

**Solutions**:
1. Check DATABASE_URL format:
   ```
   postgresql://username:password@host:port/database
   ```
2. Verify database is running
3. Check firewall allows port 5432
4. Verify credentials are correct
5. Check if IP is whitelisted (Railway/Render/Supabase)

### Connection pool exhausted

**Problem**: "Connection pool exhausted"

**Solutions**:
1. Increase `max` in `database.js` (currently 20)
2. Check for connection leaks (ensure `client.release()` is called)
3. Monitor with health endpoint

### Slow queries

**Problem**: Many slow query warnings

**Solutions**:
1. Check if indexes exist: `\di` in psql
2. Run `ANALYZE;` to update statistics
3. Check query plans: `EXPLAIN ANALYZE SELECT ...`
4. Consider adding more specific indexes

### Migration fails

**Problem**: "Migration failed"

**Solutions**:
1. Check schema.sql was run first
2. Verify all tables exist: `\dt` in psql
3. Check user has INSERT permissions
4. Ensure DATABASE_URL is correct
5. Check dataStore.json is valid JSON

## Environment Variables

Add to `.env`:

```env
# PostgreSQL Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Leave empty to use file-based storage (development only)
# For Railway: Automatically set
# For Render: Get from dashboard
# For Supabase: Get from Settings → Database
# For Local: postgresql://postgres:password@localhost:5432/go_accept
```

## Production Checklist

Before going to production with PostgreSQL:

- [ ] DATABASE_URL configured with strong password
- [ ] Schema.sql executed successfully
- [ ] Migration completed (if migrating from file storage)
- [ ] Backup strategy in place (daily automated backups)
- [ ] Connection pool configured appropriately
- [ ] Indexes verified with `\di` in psql
- [ ] SSL enabled in production (automatic on Railway/Render/Supabase)
- [ ] Health endpoint monitored
- [ ] Database credentials stored securely (not in git)
- [ ] Test restoration from backup
- [ ] Monitor slow queries and optimize

## Backup & Recovery

### Automated Backups

**Railway**: Automatic daily backups (free)
**Render**: Automatic backups on paid plans ($7+/month)
**Supabase**: Daily backups (free tier: 7 days retention)

### Manual Backup
```bash
# Backup entire database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Backup specific table
pg_dump $DATABASE_URL -t escrows > escrows_backup.sql
```

### Restore from Backup
```bash
# Restore full database
psql $DATABASE_URL < backup_20251206.sql

# Restore specific table
psql $DATABASE_URL < escrows_backup.sql
```

## Monitoring

### Check Database Size
```sql
SELECT pg_size_pretty(pg_database_size('go_accept'));
```

### Check Table Sizes
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections
```sql
SELECT count(*) FROM pg_stat_activity;
```

### Check Slow Queries
```sql
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Next Steps

After PostgreSQL is set up:

1. **Configure automated backups** (Task #5 in todo list)
2. **Set up monitoring alerts** (Task #40 in todo list)
3. **Optimize slow queries** (Task #9 in todo list)
4. **Add connection pooling improvements** (Task #35 - already done!)
5. **Implement graceful shutdown** (Task #36 - already done!)

## Support

- Railway: https://discord.gg/railway
- Render: https://community.render.com
- Supabase: https://discord.supabase.com
- PostgreSQL: https://www.postgresql.org/support/
