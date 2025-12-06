import crypto from 'crypto';

// In-memory session store (use Redis in production)
const sessions = new Map();

// Cleanup old sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > 24 * 60 * 60 * 1000) { // 24 hours
      sessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

/**
 * Create new session
 */
export function createSession(userId, role, metadata = {}) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  
  const session = {
    sessionId,
    userId,
    role,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ipAddress: metadata.ip || null,
    userAgent: metadata.userAgent || null,
    active: true
  };

  sessions.set(sessionId, session);

  // Store session ID for user
  const userSessions = getUserSessions(userId);
  userSessions.push(sessionId);
  
  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Update session activity
 */
export function updateSessionActivity(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

/**
 * Get all sessions for a user
 */
export function getUserSessions(userId) {
  return Array.from(sessions.values())
    .filter(s => s.userId === userId && s.active);
}

/**
 * Invalidate specific session
 */
export function invalidateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.active = false;
  }
  sessions.delete(sessionId);
}

/**
 * Invalidate all sessions for a user (logout all devices)
 */
export function invalidateAllUserSessions(userId) {
  const userSessions = getUserSessions(userId);
  userSessions.forEach(session => {
    invalidateSession(session.sessionId);
  });
  return userSessions.length;
}

/**
 * Get active sessions count
 */
export function getActiveSessionsCount() {
  return sessions.size;
}

/**
 * Get all active sessions (admin view)
 */
export function getAllActiveSessions() {
  return Array.from(sessions.values())
    .filter(s => s.active)
    .map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      role: s.role,
      createdAt: new Date(s.createdAt).toISOString(),
      lastActivity: new Date(s.lastActivity).toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent
    }));
}

/**
 * Session middleware
 */
export function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  
  if (sessionId) {
    const session = getSession(sessionId);
    if (session && session.active) {
      req.session = session;
      updateSessionActivity(sessionId);
    }
  }
  
  next();
}

export default {
  createSession,
  getSession,
  updateSessionActivity,
  getUserSessions,
  invalidateSession,
  invalidateAllUserSessions,
  getActiveSessionsCount,
  getAllActiveSessions,
  sessionMiddleware
};
