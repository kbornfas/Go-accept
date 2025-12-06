import { query } from './database.js';

/**
 * Audit logging service for tracking sensitive operations
 * Logs to audit_log table in PostgreSQL
 */

/**
 * Log an audit event
 * @param {Object} eventData - Audit event data
 * @param {string} eventData.action - Action performed (e.g., 'login', 'create_escrow', 'release_funds')
 * @param {string} eventData.resourceType - Type of resource (e.g., 'escrow', 'wallet', 'user')
 * @param {string} eventData.resourceId - ID of the resource affected
 * @param {number|null} eventData.userId - User ID (if available)
 * @param {string} eventData.userEmail - User email
 * @param {string} eventData.userRole - User role ('admin', 'client')
 * @param {Object} eventData.details - Additional details as JSON
 * @param {string} eventData.ipAddress - IP address of the user
 * @param {string} eventData.userAgent - User agent string
 * @param {boolean} eventData.success - Whether the action was successful
 */
export async function logAuditEvent(eventData) {
  const {
    action,
    resourceType = null,
    resourceId = null,
    userId = null,
    userEmail = null,
    userRole = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    success = true,
  } = eventData;

  try {
    // Add metadata to details
    const enrichedDetails = {
      ...details,
      success,
      timestamp: new Date().toISOString(),
      userEmail,
      userRole,
    };

    // Only log to database if using PostgreSQL
    // Skip database logging when using file-based storage
    try {
      await query(
        `INSERT INTO audit_log 
         (user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          userId,
          action,
          resourceType,
          resourceId,
          JSON.stringify(enrichedDetails),
          ipAddress,
          userAgent,
        ]
      );
    } catch (dbError) {
      // Silently skip if database not available (file-based mode)
      if (!dbError.message.includes('Database not initialized')) {
        console.error('Audit log database error:', dbError.message);
      }
    }

    console.log(`📝 Audit log: ${action} by ${userEmail || 'unknown'} (${ipAddress})`);
  } catch (error) {
    // Don't throw - audit logging should not break the application
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(req, action, userRole, userEmail, success, details = {}) {
  await logAuditEvent({
    action,
    resourceType: 'auth',
    userEmail,
    userRole,
    details: {
      ...details,
      method: req.method,
      path: req.path,
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    success,
  });
}

/**
 * Log escrow operations
 */
export async function logEscrowEvent(req, action, escrowId, userEmail, userRole, details = {}) {
  await logAuditEvent({
    action,
    resourceType: 'escrow',
    resourceId: escrowId,
    userEmail,
    userRole,
    details,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    success: true,
  });
}

/**
 * Log wallet operations
 */
export async function logWalletEvent(req, action, userEmail, userRole, details = {}) {
  await logAuditEvent({
    action,
    resourceType: 'wallet',
    userEmail,
    userRole,
    details,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    success: true,
  });
}

/**
 * Log password changes
 */
export async function logPasswordEvent(req, action, userEmail, userRole, success) {
  await logAuditEvent({
    action,
    resourceType: 'password',
    userEmail,
    userRole,
    details: {
      method: 'password_reset',
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    success,
  });
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(userEmail, limit = 100) {
  try {
    const result = await query(
      `SELECT * FROM audit_log 
       WHERE details->>'userEmail' = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userEmail, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to get user audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(resourceType, resourceId, limit = 100) {
  try {
    const result = await query(
      `SELECT * FROM audit_log 
       WHERE resource_type = $1 AND resource_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [resourceType, resourceId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to get resource audit logs:', error);
    return [];
  }
}

/**
 * Get recent audit logs (admin view)
 */
export async function getRecentAuditLogs(limit = 1000) {
  try {
    const result = await query(
      `SELECT * FROM audit_log 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to get recent audit logs:', error);
    return [];
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(days = 30) {
  try {
    const result = await query(
      `SELECT 
         action,
         COUNT(*) as count,
         COUNT(DISTINCT details->>'userEmail') as unique_users
       FROM audit_log 
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY action
       ORDER BY count DESC`,
      []
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to get audit stats:', error);
    return [];
  }
}

/**
 * Clean up old audit logs (retention policy: 90 days)
 */
export async function cleanupOldAuditLogs() {
  try {
    const result = await query(
      `DELETE FROM audit_log 
       WHERE created_at < NOW() - INTERVAL '90 days'`,
      []
    );
    console.log(`🗑️  Cleaned up ${result.rowCount} old audit log entries`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to cleanup old audit logs:', error);
    return 0;
  }
}

export default {
  logAuditEvent,
  logAuthEvent,
  logEscrowEvent,
  logWalletEvent,
  logPasswordEvent,
  getUserAuditLogs,
  getResourceAuditLogs,
  getRecentAuditLogs,
  getAuditStats,
  cleanupOldAuditLogs,
};
