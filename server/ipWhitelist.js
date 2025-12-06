import dotenv from 'dotenv';

dotenv.config();

// Parse IP whitelist from environment
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST 
  ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

const IP_WHITELIST_ENABLED = process.env.IP_WHITELIST_ENABLED === 'true';

/**
 * IP whitelist middleware for admin routes
 * Restricts access to specified IP addresses
 */
export function ipWhitelistMiddleware(req, res, next) {
  // Skip if whitelist is disabled or empty
  if (!IP_WHITELIST_ENABLED || ADMIN_IP_WHITELIST.length === 0) {
    return next();
  }

  // Get client IP (handle proxies)
  const clientIp = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  // Normalize IPv6 localhost to IPv4
  const normalizedIp = clientIp === '::1' ? '127.0.0.1' : clientIp;

  // Check if IP is whitelisted
  const isWhitelisted = ADMIN_IP_WHITELIST.some(whitelistedIp => {
    // Exact match
    if (normalizedIp === whitelistedIp) return true;
    
    // CIDR range support (basic)
    if (whitelistedIp.includes('/')) {
      // Simplified CIDR check - for production use a library like 'ip-range-check'
      const [range, bits] = whitelistedIp.split('/');
      if (normalizedIp.startsWith(range.split('.').slice(0, Math.floor(parseInt(bits) / 8)).join('.'))) {
        return true;
      }
    }
    
    return false;
  });

  if (!isWhitelisted) {
    console.warn(`⚠️  IP ${normalizedIp} blocked by whitelist`);
    return res.status(403).json({ 
      message: 'Access denied - IP not whitelisted',
      ip: normalizedIp 
    });
  }

  next();
}

/**
 * Enhanced rate limiter with IP-based throttling
 */
export function enhancedRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip
  } = options;

  const requests = new Map();

  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.resetTime > windowMs) {
        requests.delete(key);
      }
    }
  }, 60000);

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = requests.get(key);

    if (!record || now - record.resetTime > windowMs) {
      record = {
        count: 0,
        resetTime: now
      };
      requests.set(key, record);
    }

    record.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime + windowMs).toISOString());

    if (record.count > max) {
      return res.status(429).json({
        message,
        retryAfter: Math.ceil((record.resetTime + windowMs - now) / 1000)
      });
    }

    if (!skipSuccessfulRequests) {
      next();
    } else {
      // Track response to potentially skip successful requests
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        if (res.statusCode < 400) {
          record.count--;
        }
        return originalJson(data);
      };
      next();
    }
  };
}

export default {
  ipWhitelistMiddleware,
  enhancedRateLimit
};
