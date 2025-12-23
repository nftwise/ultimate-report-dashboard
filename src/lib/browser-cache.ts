/**
 * Simple browser-side cache for API responses
 * Caches data for 5 minutes to reduce redundant API calls
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data or fetch fresh data
 */
export async function cachedFetch(
  key: string,
  fetchFn: () => Promise<any>,
  ttl: number = DEFAULT_TTL
): Promise<any> {
  const now = Date.now();
  const cached = cache.get(key);

  // Return cached data if not expired
  if (cached && cached.expiresAt > now) {
    console.log(`[Browser Cache] HIT: ${key}`);
    return cached.data;
  }

  // Fetch fresh data
  console.log(`[Browser Cache] MISS: ${key}`);
  const data = await fetchFn();

  // Store in cache
  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + ttl
  });

  return data;
}

/**
 * Clear all cache or specific key
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
  console.log(`[Browser Cache] Cleared: ${key || 'all'}`);
}

/**
 * Clear cache entries matching a pattern
 */
export function clearCachePattern(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
  console.log(`[Browser Cache] Cleared pattern: ${pattern}`);
}

/**
 * Generate cache key from parameters
 */
export function getCacheKey(endpoint: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}
