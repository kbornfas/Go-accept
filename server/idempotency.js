import crypto from 'crypto';

// In-memory store for idempotency keys (use Redis in production)
const idempotencyStore = new Map();

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of idempotencyStore.entries()) {
    if (now - data.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Idempotency middleware
 * Prevents duplicate transaction processing on retry
 */
export function idempotencyMiddleware(req, res, next) {
  // Only apply to POST, PUT, PATCH, DELETE
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Get idempotency key from header
  const idempotencyKey = req.headers['idempotency-key'] || 
                         req.headers['x-idempotency-key'];

  if (!idempotencyKey) {
    // Optional: make it required for specific routes
    return next();
  }

  // Create composite key with user and path
  const compositeKey = `${req.user?.role || 'anon'}:${req.path}:${idempotencyKey}`;

  // Check if request was already processed
  const stored = idempotencyStore.get(compositeKey);

  if (stored) {
    console.log(`Idempotent request detected: ${compositeKey}`);
    // Return cached response
    return res.status(stored.statusCode).json(stored.body);
  }

  // Store original json method
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = 200;

  // Override status method
  res.status = function(code) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override json method to cache response
  res.json = function(body) {
    // Only cache successful responses (2xx)
    if (statusCode >= 200 && statusCode < 300) {
      idempotencyStore.set(compositeKey, {
        statusCode,
        body,
        timestamp: Date.now()
      });
      console.log(`Stored idempotent response: ${compositeKey}`);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Generate idempotency key for client use
 */
export function generateIdempotencyKey() {
  return crypto.randomBytes(16).toString('hex');
}

export default {
  idempotencyMiddleware,
  generateIdempotencyKey
};
