// Slow Query Monitor - Tracks database query performance

const slowQueries = [];
const SLOW_QUERY_THRESHOLD = 100; // ms
const MAX_STORED_QUERIES = 100;

/**
 * Create a query monitor wrapper
 */
export const createQueryMonitor = (queryFn) => {
  return async (text, params) => {
    const start = Date.now();
    
    try {
      const result = await queryFn(text, params);
      const duration = Date.now() - start;
      
      if (duration > SLOW_QUERY_THRESHOLD) {
        const entry = {
          timestamp: new Date().toISOString(),
          duration,
          query: text.substring(0, 200),
          paramCount: params?.length || 0
        };
        
        slowQueries.unshift(entry);
        if (slowQueries.length > MAX_STORED_QUERIES) {
          slowQueries.pop();
        }
        
        console.warn(`⚠️ [SLOW QUERY] ${duration}ms: ${text.substring(0, 100)}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ [QUERY ERROR] ${duration}ms: ${error.message}`);
      throw error;
    }
  };
};

/**
 * Get slow query statistics
 */
export const getSlowQueryStats = () => {
  if (slowQueries.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      maxDuration: 0,
      queries: []
    };
  }

  const durations = slowQueries.map(q => q.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);

  return {
    count: slowQueries.length,
    avgDuration: Math.round(avgDuration),
    maxDuration,
    queries: slowQueries.slice(0, 10) // Return last 10
  };
};
