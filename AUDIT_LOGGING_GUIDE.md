# Audit Logging Implementation Guide

## Overview
Comprehensive audit logging tracks all sensitive operations for security, compliance, and troubleshooting. All events are stored in PostgreSQL with automatic 90-day retention.

## Features Implemented

### Logged Events

#### 1. Authentication Events
- **Login Success** - Successful admin/client login
- **Login Failed** - Invalid credentials, missing fields
- **Password Reset** - Password change via reset flow
- **2FA Verification** - Two-factor authentication attempts

#### 2. Escrow Operations
- **Escrow Created** - New escrow created by client
- **Escrow Approved** - Buyer payment verified
- **Escrow Released** - Funds released to seller
- **Escrow Refunded** - Funds returned to client wallet
- **Escrow Cancelled** - Escrow cancelled
- **Escrow Disputed** - Dispute raised

#### 3. Wallet Operations
- **Wallet Deposit** - Funds added to wallet
- **Wallet Transfer** - Funds transferred out
- **Wallet Withdrawal** - Withdrawal processed

#### 4. Password Operations
- **Password Reset Success** - Password changed successfully
- **Password Reset Failed** - Invalid token or expired

### Captured Data

Each audit log entry includes:
```javascript
{
  id: 123,                                    // Auto-increment ID
  user_id: null,                              // User ID (if applicable)
  action: 'login_success',                    // Action performed
  resource_type: 'auth',                      // Resource type
  resource_id: null,                          // Resource ID (escrow ID, etc.)
  details: {                                  // JSON details
    success: true,
    userEmail: 'admin@example.com',
    userRole: 'admin',
    method: 'POST',
    path: '/api/auth/login',
    timestamp: '2024-01-15T10:30:00.000Z'
  },
  ip_address: '192.168.1.100',                // User IP
  user_agent: 'Mozilla/5.0...',               // Browser/client
  created_at: '2024-01-15T10:30:00.000Z'      // Log timestamp
}
```

## Database Schema

### Table: `audit_log`
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

## API Functions

### File: `server/auditLog.js`

#### Core Logging Function
```javascript
import { logAuditEvent } from './auditLog.js';

await logAuditEvent({
  action: 'escrow_created',           // Required: action name
  resourceType: 'escrow',             // Resource type
  resourceId: 'ESC123',               // Resource identifier
  userId: null,                       // User ID (optional)
  userEmail: 'seller@example.com',    // User email
  userRole: 'client',                 // User role
  details: {                          // Additional context
    platform: 'Paxful',
    amount: 100,
    currency: 'USD'
  },
  ipAddress: '192.168.1.100',         // User IP
  userAgent: 'Mozilla/5.0...',        // User agent
  success: true                       // Operation success
});
```

#### Helper Functions

**Authentication Logging:**
```javascript
import { logAuthEvent } from './auditLog.js';

// Log login attempt
await logAuthEvent(
  req,                          // Express request object
  'login_success',              // Action
  'admin',                      // User role
  'admin@example.com',          // User email
  true,                         // Success
  { method: 'password' }        // Additional details
);
```

**Escrow Logging:**
```javascript
import { logEscrowEvent } from './auditLog.js';

await logEscrowEvent(
  req,                          // Express request
  'escrow_created',             // Action
  'ESC123',                     // Escrow ID
  'seller@example.com',         // User email
  'client',                     // User role
  {                             // Details
    platform: 'Paxful',
    amount: 100,
    currency: 'USD'
  }
);
```

**Wallet Logging:**
```javascript
import { logWalletEvent } from './auditLog.js';

await logWalletEvent(
  req,
  'wallet_deposit',
  'admin@example.com',
  'admin',
  {
    amount: 1000,
    currency: 'USD',
    source: 'manual',
    newBalance: 5000
  }
);
```

**Password Change Logging:**
```javascript
import { logPasswordEvent } from './auditLog.js';

await logPasswordEvent(
  req,
  'password_reset_success',
  'user@example.com',
  'client',
  true  // Success
);
```

## Integration Points

### 1. Authentication (server/index.js)
```javascript
// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  // ... authentication logic ...
  
  if (!password) {
    await logAuthEvent(req, 'login_failed', role, null, false, 
      { reason: 'missing_credentials' });
    return res.status(400).json({ message: 'Password required' });
  }
  
  if (password !== expectedPassword) {
    await logAuthEvent(req, 'login_failed', role, null, false, 
      { reason: 'invalid_password' });
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  await logAuthEvent(req, 'login_success', role, role, true);
  // ... return token ...
});
```

### 2. Escrow Operations
```javascript
// Create escrow
app.post('/api/escrows', async (req, res) => {
  // ... create escrow ...
  
  await logEscrowEvent(req, 'escrow_created', escrowId, 
    req.user.role, 'client', {
      platform,
      amount,
      currency,
      paymentMethods
    });
  
  // ... return response ...
});

// Update escrow status
app.patch('/api/escrows/:id', async (req, res) => {
  // ... update status ...
  
  await logEscrowEvent(req, `escrow_${status}`, escrowId,
    req.user.role, 'admin', {
      oldStatus,
      newStatus: status,
      amount,
      currency,
      platform,
      note
    });
});
```

### 3. Wallet Operations
```javascript
// Wallet deposit
app.post('/api/wallet/deposit', async (req, res) => {
  // ... process deposit ...
  
  await logWalletEvent(req, 'wallet_deposit', 
    req.user.role, req.user.role, {
      amount,
      currency,
      source,
      newBalance: db.wallet.balances[currency]
    });
});

// Wallet transfer
app.post('/api/wallet/transfer', async (req, res) => {
  // ... process transfer ...
  
  await logWalletEvent(req, 'wallet_transfer',
    req.user.role, req.user.role, {
      amount,
      currency,
      destination,
      memo,
      newBalance: db.wallet.balances[currency]
    });
});
```

### 4. Password Changes
```javascript
// Password reset
app.post('/api/auth/reset-password', async (req, res) => {
  // ... reset password ...
  
  await logPasswordEvent(req, 'password_reset_success',
    decoded.email, decoded.role, true);
});
```

## Query Functions

### Get User's Audit Logs
```javascript
import { getUserAuditLogs } from './auditLog.js';

const logs = await getUserAuditLogs('user@example.com', 100);
// Returns last 100 logs for user
```

### Get Resource Audit Logs
```javascript
import { getResourceAuditLogs } from './auditLog.js';

const logs = await getResourceAuditLogs('escrow', 'ESC123', 50);
// Returns last 50 logs for specific escrow
```

### Get Recent Audit Logs (Admin)
```javascript
import { getRecentAuditLogs } from './auditLog.js';

const logs = await getRecentAuditLogs(1000);
// Returns last 1000 logs (all users)
```

### Get Audit Statistics
```javascript
import { getAuditStats } from './auditLog.js';

const stats = await getAuditStats(30);
// Returns action counts and unique users for last 30 days
// Example output:
// [
//   { action: 'login_success', count: 150, unique_users: 25 },
//   { action: 'escrow_created', count: 45, unique_users: 12 },
//   { action: 'wallet_deposit', count: 30, unique_users: 8 }
// ]
```

## Data Retention

### Automatic Cleanup (90 days)
```javascript
import { cleanupOldAuditLogs } from './auditLog.js';

// Run as cron job or scheduled task
const deletedCount = await cleanupOldAuditLogs();
console.log(`Deleted ${deletedCount} old audit logs`);
```

### Cron Job Setup (Node-cron)
```javascript
import cron from 'node-cron';
import { cleanupOldAuditLogs } from './auditLog.js';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running audit log cleanup...');
  await cleanupOldAuditLogs();
});
```

### Manual Retention Policy Adjustment
Edit `server/auditLog.js`:
```javascript
// Change retention from 90 days to 180 days
export async function cleanupOldAuditLogs() {
  const result = await query(
    `DELETE FROM audit_log 
     WHERE created_at < NOW() - INTERVAL '180 days'`,  // Changed
    []
  );
  return result.rowCount;
}
```

## Querying Audit Logs

### SQL Queries

**All login attempts (last 24 hours):**
```sql
SELECT * FROM audit_log
WHERE action LIKE 'login_%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Failed login attempts by IP:**
```sql
SELECT 
  ip_address,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM audit_log
WHERE action = 'login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;
```

**Escrow lifecycle for specific escrow:**
```sql
SELECT 
  action,
  details->>'userEmail' as user,
  details->>'newStatus' as status,
  created_at
FROM audit_log
WHERE resource_type = 'escrow'
  AND resource_id = 'ESC123'
ORDER BY created_at ASC;
```

**Wallet activity summary:**
```sql
SELECT 
  action,
  SUM((details->>'amount')::numeric) as total_amount,
  COUNT(*) as transactions
FROM audit_log
WHERE resource_type = 'wallet'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY action;
```

**Password reset attempts:**
```sql
SELECT 
  details->>'userEmail' as email,
  action,
  ip_address,
  created_at
FROM audit_log
WHERE action LIKE 'password_reset_%'
ORDER BY created_at DESC
LIMIT 50;
```

## Security Benefits

### 1. Intrusion Detection
Monitor failed login attempts from same IP:
```sql
SELECT ip_address, COUNT(*) 
FROM audit_log 
WHERE action = 'login_failed' 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address 
HAVING COUNT(*) > 10;
```

### 2. Compliance (GDPR, SOC 2, PCI DSS)
- Track all data access and modifications
- Prove who did what and when
- Demonstrate security controls
- Generate compliance reports

### 3. Fraud Detection
Monitor suspicious patterns:
- Multiple escrows from same IP in short time
- Large wallet transfers after recent login
- Password resets followed by large transactions

### 4. Dispute Resolution
Complete transaction history for arbitration:
```sql
SELECT * FROM audit_log
WHERE resource_id = 'ESC123'
ORDER BY created_at ASC;
```

### 5. Debugging & Support
Trace user actions to troubleshoot issues:
```sql
SELECT * FROM audit_log
WHERE details->>'userEmail' = 'problematic-user@example.com'
ORDER BY created_at DESC
LIMIT 100;
```

## Best Practices

### 1. What to Log
✅ **Always log:**
- Authentication (login, logout, password changes)
- Authorization failures
- Data modifications (create, update, delete)
- Financial transactions
- Administrative actions
- Security-relevant events

❌ **Never log:**
- Passwords (plain or hashed)
- Credit card numbers
- Personal identification numbers (PINs)
- Security tokens (JWTs)
- Encryption keys

### 2. Performance Considerations
- Audit logging is async (doesn't block responses)
- Indexes optimize common queries
- Batch inserts for high-volume logging (future)
- Regular cleanup maintains database size

### 3. Error Handling
Audit logging failures don't break the application:
```javascript
try {
  await logAuditEvent(...);
} catch (error) {
  console.error('Failed to log audit event:', error);
  // Continue with application flow
}
```

### 4. Data Privacy
- Store only necessary information
- Implement data retention policies
- Support GDPR right to erasure:
```sql
DELETE FROM audit_log 
WHERE details->>'userEmail' = 'user-to-delete@example.com';
```

## Admin Dashboard Integration

### Create Audit Log Viewer (Future Enhancement)
```javascript
// API endpoint
app.get('/api/admin/audit-logs', 
  authenticate(['admin']), 
  async (req, res) => {
    const { limit = 100, action, startDate, endDate } = req.query;
    
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    
    if (action) {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }
    
    if (startDate) {
      params.push(startDate);
      sql += ` AND created_at >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      sql += ` AND created_at <= $${params.length}`;
    }
    
    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    
    const result = await query(sql, params);
    res.json(result.rows);
  }
);
```

### React Component Example
```jsx
function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then(r => r.json())
      .then(setLogs);
  }, []);
  
  return (
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Action</th>
          <th>User</th>
          <th>IP Address</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{new Date(log.created_at).toLocaleString()}</td>
            <td>{log.action}</td>
            <td>{log.details.userEmail}</td>
            <td>{log.ip_address}</td>
            <td>{JSON.stringify(log.details, null, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Monitoring & Alerts

### Suspicious Activity Alerts
Monitor and alert on:
- More than 10 failed logins in 1 hour (potential brute force)
- Large wallet transfers (>$10,000)
- Password resets followed by large transactions within 1 hour
- Multiple escrows from same IP in short time

### Implementation Example (Future)
```javascript
import { getAuditStats } from './auditLog.js';

async function checkSuspiciousActivity() {
  // Check failed logins
  const failedLogins = await query(`
    SELECT ip_address, COUNT(*) as attempts
    FROM audit_log
    WHERE action = 'login_failed'
      AND created_at > NOW() - INTERVAL '1 hour'
    GROUP BY ip_address
    HAVING COUNT(*) > 10
  `);
  
  if (failedLogins.rows.length > 0) {
    // Send alert to admin
    console.error('⚠️  Suspicious login activity detected:', failedLogins.rows);
  }
}

// Run every 5 minutes
setInterval(checkSuspiciousActivity, 5 * 60 * 1000);
```

## Compliance Reports

### Generate Monthly Report
```javascript
async function generateMonthlyReport(year, month) {
  const stats = await query(`
    SELECT 
      action,
      COUNT(*) as count,
      COUNT(DISTINCT details->>'userEmail') as unique_users
    FROM audit_log
    WHERE EXTRACT(YEAR FROM created_at) = $1
      AND EXTRACT(MONTH FROM created_at) = $2
    GROUP BY action
    ORDER BY count DESC
  `, [year, month]);
  
  return {
    period: `${year}-${month}`,
    totalEvents: stats.rows.reduce((sum, row) => sum + row.count, 0),
    eventBreakdown: stats.rows,
    generatedAt: new Date().toISOString()
  };
}
```

## Testing

### Manual Testing
```bash
# Start server
npm start

# Test login logging
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","password":"wrong"}'

# Check audit logs
psql -d your_database -c "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;"
```

### Automated Testing (Jest)
```javascript
import { logAuditEvent, getUserAuditLogs } from './auditLog.js';

describe('Audit Logging', () => {
  test('logs authentication events', async () => {
    await logAuditEvent({
      action: 'login_success',
      userEmail: 'test@example.com',
      userRole: 'admin',
      details: {},
      ipAddress: '127.0.0.1',
      success: true
    });
    
    const logs = await getUserAuditLogs('test@example.com', 1);
    expect(logs[0].action).toBe('login_success');
  });
});
```

## Troubleshooting

### Logs Not Appearing
1. Check database connection
2. Verify audit_log table exists
3. Check console for error messages
4. Ensure async function is awaited

### Performance Issues
1. Verify indexes exist on audit_log
2. Implement batch logging for high volume
3. Increase retention cleanup frequency
4. Consider partitioning table by date

### Disk Space Growth
Run cleanup more frequently:
```javascript
// Clean up logs older than 30 days instead of 90
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '30 days';
```

## Production Checklist

- [ ] Database indexes created on audit_log table
- [ ] Retention policy configured (default: 90 days)
- [ ] Scheduled cleanup job configured (daily at 2 AM)
- [ ] All critical operations logged
- [ ] Sensitive data excluded from logs
- [ ] Admin audit log viewer implemented
- [ ] Monitoring alerts configured
- [ ] Backup strategy includes audit_log table
- [ ] Compliance requirements verified
- [ ] Data privacy policies documented

## Resources

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [GDPR Compliance Guide](https://gdpr.eu/)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Node.js Logging Best Practices](https://betterstack.com/community/guides/logging/nodejs/)

## Support

For audit logging issues:
1. Check database connectivity
2. Verify table schema matches documentation
3. Review server console logs
4. Check PostgreSQL logs for errors
5. Contact support with specific error messages
