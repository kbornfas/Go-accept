// Idempotency Middleware - Prevents duplicate API requests

const idempotencyStore = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Idempotency middleware for mutation endpoints
 * Uses X-Idempotency-Key header to track and dedupe requests
 */
export const idempotencyMiddleware = (req, res, next) => {
  // Only apply to mutation methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['x-idempotency-key'];
  
  // If no key provided, proceed normally
  if (!idempotencyKey) {
    return next();
  }

  const fullKey = `${req.method}:${req.path}:${idempotencyKey}`;
  const cached = idempotencyStore.get(fullKey);

  // If we have a cached response, return it
  if (cached && Date.now() < cached.expires) {
    console.log(`♻️ [IDEMPOTENCY] Returning cached response for ${fullKey}`);
    return res.status(cached.status).json(cached.body);
  }

  // Store original json method to capture response
  const originalJson = res.json.bind(res);
  
  res.json = (body) => {
    // Cache the response
    idempotencyStore.set(fullKey, {
      status: res.statusCode,
      body,
      expires: Date.now() + IDEMPOTENCY_TTL
    });
    return originalJson(body);
  };

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance per request
    const now = Date.now();
    for (const [key, data] of idempotencyStore) {
      if (now > data.expires) {
        idempotencyStore.delete(key);
      }
    }
  }

  next();
};
