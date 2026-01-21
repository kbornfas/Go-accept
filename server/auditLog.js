// Audit Log - Placeholder module for logging security events

/**
 * Log authentication events (login, logout, failed attempts)
 */
export const logAuthEvent = async (req, action, role, userId, success, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    role,
    userId,
    success,
    ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    details
  };
  console.log(`🔐 [AUDIT] Auth: ${action} - ${role} - ${success ? 'SUCCESS' : 'FAILED'}`);
  return logEntry;
};

/**
 * Log escrow-related events (create, update, release, refund)
 */
export const logEscrowEvent = async (req, action, escrowId, userId, role, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    escrowId,
    userId,
    role,
    ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    details
  };
  console.log(`📋 [AUDIT] Escrow: ${action} - ${escrowId}`);
  return logEntry;
};

/**
 * Log wallet-related events (deposit, transfer, withdrawal)
 */
export const logWalletEvent = async (req, action, userId, role, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    role,
    ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    details
  };
  console.log(`💰 [AUDIT] Wallet: ${action} - ${details.amount || ''} ${details.currency || ''}`);
  return logEntry;
};

/**
 * Log password-related events (change, reset)
 */
export const logPasswordEvent = async (req, action, email, role, success, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    email,
    role,
    success,
    ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    details
  };
  console.log(`🔑 [AUDIT] Password: ${action} - ${email} - ${success ? 'SUCCESS' : 'FAILED'}`);
  return logEntry;
};
