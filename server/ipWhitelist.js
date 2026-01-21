// IP Whitelist - Security middleware for admin endpoints

// Default whitelist (empty = allow all)
const whitelist = process.env.ADMIN_IP_WHITELIST 
  ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

/**
 * IP Whitelist middleware for sensitive admin endpoints
 * If ADMIN_IP_WHITELIST is not set, allows all IPs
 */
export const ipWhitelistMiddleware = (req, res, next) => {
  if (whitelist.length === 0) {
    // No whitelist configured, allow all
    return next();
  }

  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const normalizedIp = clientIp.replace('::ffff:', ''); // Handle IPv4-mapped IPv6

  if (whitelist.includes(normalizedIp) || whitelist.includes('*')) {
    return next();
  }

  console.warn(`🚫 [SECURITY] Blocked IP ${normalizedIp} from admin endpoint`);
  return res.status(403).json({ 
    message: 'Access denied: IP not whitelisted',
    ip: normalizedIp 
  });
};

/**
 * Enhanced rate limiter with IP-based tracking
 */
export const enhancedRateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100,
    message = 'Too many requests, please try again later'
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Get or initialize request tracking for this IP
    let tracking = requests.get(clientIp);
    if (!tracking || now > tracking.windowEnd) {
      tracking = {
        count: 0,
        windowEnd: now + windowMs
      };
    }

    tracking.count++;
    requests.set(clientIp, tracking);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance per request
      for (const [ip, data] of requests) {
        if (now > data.windowEnd) {
          requests.delete(ip);
        }
      }
    }

    if (tracking.count > maxRequests) {
      console.warn(`🚫 [RATE LIMIT] IP ${clientIp} exceeded ${maxRequests} requests`);
      return res.status(429).json({ message });
    }

    next();
  };
};
