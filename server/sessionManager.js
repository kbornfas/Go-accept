// Session Manager - Handle user sessions

const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Session middleware - validates and attaches session to request
 */
export const sessionMiddleware = (req, res, next) => {
  // Sessions are handled via JWT in this app
  // This middleware is a placeholder for future session-based auth
  next();
};

/**
 * Create a new session
 */
export const createSession = (userId, role, token) => {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  sessions.set(sessionId, {
    userId,
    role,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL).toISOString(),
    lastActive: new Date().toISOString()
  });

  // Clean up expired sessions periodically
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (new Date(session.expiresAt).getTime() < now) {
        sessions.delete(id);
      }
    }
  }

  return sessionId;
};

/**
 * Invalidate all sessions for a user
 */
export const invalidateAllUserSessions = (userId) => {
  let count = 0;
  
  for (const [sessionId, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(sessionId);
      count++;
    }
  }
  
  console.log(`🔒 Invalidated ${count} sessions for user ${userId}`);
  return count;
};

/**
 * Get all active sessions (admin only)
 */
export const getAllActiveSessions = () => {
  const now = Date.now();
  const activeSessions = [];
  
  for (const [sessionId, session] of sessions) {
    if (new Date(session.expiresAt).getTime() > now) {
      activeSessions.push({
        sessionId: sessionId.substring(0, 8) + '...',
        userId: session.userId,
        role: session.role,
        createdAt: session.createdAt,
        lastActive: session.lastActive
      });
    }
  }
  
  return activeSessions;
};
