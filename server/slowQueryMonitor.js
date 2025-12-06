import * as Sentry from '@sentry/node';

const slowQueries = [];
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100');
const MAX_STORED_QUERIES = 1000;

/**
 * Middleware to monitor slow database queries
 */
export function createQueryMonitor(originalQuery) {
  return async function monitoredQuery(text, params) {
    const start = Date.now();
    
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;

      if (duration > SLOW_QUERY_THRESHOLD) {
        const slowQuery = {
          query: text,
          params: params ? params.map(p => typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p) : [],
          duration,
          timestamp: new Date().toISOString()
        };

        console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));

        // Store in memory
        slowQueries.push(slowQuery);
        if (slowQueries.length > MAX_STORED_QUERIES) {
          slowQueries.shift();
        }

        // Report to Sentry if available
        if (process.env.SENTRY_DSN) {
          Sentry.captureMessage('Slow database query detected', {
            level: 'warning',
            extra: {
              query: text,
              duration,
              threshold: SLOW_QUERY_THRESHOLD
            }
          });
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Query error (${duration}ms):`, error.message);
      throw error;
    }
  };
}

/**
 * Get slow query statistics
 */
export function getSlowQueryStats() {
  if (slowQueries.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      maxDuration: 0,
      queries: []
    };
  }

  const durations = slowQueries.map(q => q.duration);
  const total = durations.reduce((sum, d) => sum + d, 0);

  return {
    count: slowQueries.length,
    avgDuration: Math.round(total / slowQueries.length),
    maxDuration: Math.max(...durations),
    threshold: SLOW_QUERY_THRESHOLD,
    queries: slowQueries.slice(-50) // Last 50 slow queries
  };
}

/**
 * Clear slow query history
 */
export function clearSlowQueryHistory() {
  slowQueries.length = 0;
}

export default {
  createQueryMonitor,
  getSlowQueryStats,
  clearSlowQueryHistory
};
