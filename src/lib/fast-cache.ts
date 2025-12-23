/**
 * Fast In-Memory Cache Layer
 *
 * Uses LRU cache in memory for instant access (< 1ms)
 * Falls back to Supabase cache for persistence across restarts
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  warmingInProgress?: boolean;  // True if cache is being refreshed in background
}

class FastCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 500; // Max entries in memory
  private hits = 0;
  private misses = 0;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Enforce max size (simple LRU: delete oldest)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now(),
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  // Invalidate by pattern (e.g., 'dashboard-*' or '*-clientId-*')
  invalidatePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }

  /**
   * Get cache entry metadata (for pre-warming checks)
   */
  getEntry(key: string): CacheEntry<any> | null {
    return this.cache.get(key) || null;
  }

  /**
   * Check if cache is stale (past 80% of TTL) and needs pre-warming
   */
  needsWarming(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;  // No cache = needs warming

    // If already warming, don't trigger again
    if (entry.warmingInProgress) return false;

    const now = Date.now();
    const ttl = entry.expiresAt - entry.createdAt;
    const elapsed = now - entry.createdAt;

    // Warm when 80% of TTL has passed
    return elapsed > ttl * 0.8;
  }

  /**
   * Mark cache as warming (to prevent duplicate refreshes)
   */
  setWarming(key: string, warming: boolean): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.warmingInProgress = warming;
    }
  }

  /**
   * Get all cache keys matching a pattern
   */
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return keys.filter(key => regex.test(key));
  }
}

// Singleton instance
export const fastCache = new FastCache();

/**
 * Get data with fast cache + optional Supabase fallback
 */
export async function getFast<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number; // seconds
    skipMemoryCache?: boolean;
  } = {}
): Promise<T> {
  const { ttl = 300, skipMemoryCache = false } = options; // Default 5 min

  // 1. Check in-memory cache first (instant)
  if (!skipMemoryCache) {
    const cached = fastCache.get<T>(key);
    if (cached !== null) {
      console.log(`⚡ [FastCache HIT] ${key}`);
      return cached;
    }
  }

  // 2. Fetch fresh data
  console.log(`🔄 [FastCache MISS] ${key} - Fetching...`);
  const startTime = Date.now();

  try {
    const data = await fetcher();
    const duration = Date.now() - startTime;
    console.log(`✅ [FastCache] Fetched in ${duration}ms`);

    // 3. Store in memory cache
    fastCache.set(key, data, ttl);

    return data;
  } catch (error) {
    console.error(`❌ [FastCache] Fetch failed for ${key}:`, error);
    throw error;
  }
}

/**
 * Parallel fetch with fast cache
 */
export async function getParallelFast<T extends Record<string, any>>(
  requests: Record<string, {
    key: string;
    fetcher: () => Promise<any>;
    ttl?: number;
    fallback?: any;
  }>,
  options: {
    timeout?: number; // ms
  } = {}
): Promise<T> {
  const { timeout = 10000 } = options; // Default 10s timeout
  const results = {} as T;

  const promises = Object.entries(requests).map(async ([name, config]) => {
    const { key, fetcher, ttl = 300, fallback } = config;

    try {
      // Check cache first
      const cached = fastCache.get(key);
      if (cached !== null) {
        console.log(`⚡ [Parallel] ${name} - Cache hit`);
        return { name, data: cached, fromCache: true };
      }

      // Fetch with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
      });

      const data = await Promise.race([fetcher(), timeoutPromise]);

      // Store in cache
      fastCache.set(key, data, ttl);

      return { name, data, fromCache: false };
    } catch (error: any) {
      console.warn(`⚠️ [Parallel] ${name} failed:`, error.message);

      if (fallback !== undefined) {
        return { name, data: fallback, fromCache: false, error: true };
      }

      return { name, data: null, fromCache: false, error: true };
    }
  });

  const responses = await Promise.allSettled(promises);

  responses.forEach((response) => {
    if (response.status === 'fulfilled' && response.value) {
      const { name, data } = response.value;
      results[name as keyof T] = data;
    }
  });

  return results;
}

/**
 * Preload common data into cache
 */
export function preloadCache(entries: Array<{ key: string; data: any; ttl: number }>) {
  entries.forEach(({ key, data, ttl }) => {
    fastCache.set(key, data, ttl);
  });
  console.log(`📦 [FastCache] Preloaded ${entries.length} entries`);
}
