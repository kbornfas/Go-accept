// Redis Cache - Placeholder module (works without Redis)
// Falls back to in-memory cache when Redis is not available

let redisClient = null;
const memoryCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds default

/**
 * Initialize Redis connection (optional)
 */
export const initRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => console.error('Redis error:', err));
      await redisClient.connect();
      console.log('✅ Redis cache connected');
      return true;
    } catch (error) {
      console.warn('⚠️  Redis not available, using memory cache:', error.message);
      return false;
    }
  }
  console.log('ℹ️  REDIS_URL not configured, using memory cache');
  return false;
};

/**
 * Close Redis connection
 */
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('✅ Redis connection closed');
  }
};

/**
 * Get cached value
 */
const getCache = async (key) => {
  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error.message);
    }
  }
  
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.value;
  }
  memoryCache.delete(key);
  return null;
};

/**
 * Set cached value
 */
const setCache = async (key, value, ttlSeconds = 60) => {
  if (redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return;
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
  }
  
  memoryCache.set(key, {
    value,
    expires: Date.now() + (ttlSeconds * 1000)
  });
};

/**
 * Delete cached value
 */
const delCache = async (key) => {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis del error:', error.message);
    }
  }
  memoryCache.delete(key);
};

/**
 * Cache middleware factory
 */
export const cacheMiddleware = (keyOrFn, ttlSeconds = 60) => {
  return async (req, res, next) => {
    const key = typeof keyOrFn === 'function' ? keyOrFn(req) : keyOrFn;
    
    const cached = await getCache(key);
    if (cached) {
      return res.json(cached);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to cache response
    res.json = async (data) => {
      await setCache(key, data, ttlSeconds);
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Invalidate wallet cache
 */
export const invalidateWalletCache = async () => {
  await delCache('wallet:admin');
  await delCache('wallet:client');
};

/**
 * Invalidate escrow cache
 */
export const invalidateEscrowCache = async (escrowId) => {
  await delCache('escrows:all');
  if (escrowId) {
    await delCache(`escrow:${escrowId}`);
  }
};
