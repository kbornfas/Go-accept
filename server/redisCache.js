import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;
let isConnected = false;

// Initialize Redis connection
export async function initRedis() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('⚠️  Redis not configured - caching disabled');
    return null;
  }

  try {
    const config = process.env.REDIS_URL 
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        };

    redisClient = new Redis(config);

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
      isConnected = false;
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
      isConnected = false;
    });

    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    return null;
  }
}

// Close Redis connection
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis connection closed gracefully');
  }
}

// Cache get with JSON parsing
export async function cacheGet(key) {
  if (!redisClient || !isConnected) return null;
  
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

// Cache set with JSON stringification and TTL
export async function cacheSet(key, value, ttlSeconds = 300) {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
    return false;
  }
}

// Cache delete
export async function cacheDel(key) {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
}

// Cache multiple keys with pattern
export async function cacheDelPattern(pattern) {
  if (!redisClient || !isConnected) return false;
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error);
    return false;
  }
}

// Middleware to cache responses
export function cacheMiddleware(keyGenerator, ttl = 300) {
  return async (req, res, next) => {
    if (!redisClient || !isConnected) {
      return next();
    }

    const key = typeof keyGenerator === 'function' 
      ? keyGenerator(req) 
      : keyGenerator;

    try {
      const cached = await cacheGet(key);
      if (cached) {
        console.log(`Cache hit: ${key}`);
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache response
      res.json = (data) => {
        cacheSet(key, data, ttl).catch(err => 
          console.error('Cache set error:', err)
        );
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

// Invalidate wallet cache
export async function invalidateWalletCache() {
  await cacheDelPattern('wallet:*');
}

// Invalidate escrow cache
export async function invalidateEscrowCache(escrowId = '*') {
  await cacheDelPattern(`escrow:${escrowId}`);
  await cacheDelPattern('escrows:*');
}

export default {
  initRedis,
  closeRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  cacheMiddleware,
  invalidateWalletCache,
  invalidateEscrowCache
};
