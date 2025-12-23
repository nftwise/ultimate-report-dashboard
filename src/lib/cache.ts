// Simple in-memory cache for API responses

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL: number;

  constructor(defaultTTL = 300000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    this.cache.set(key, item);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);

    if (!item) {
      return false;
    }

    if (Date.now() - item.timestamp > item.ttl) {
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
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  googleAds: (timeRange: { startDate: string; endDate: string }) =>
    `gads_${timeRange.startDate}_${timeRange.endDate}`,
  googleAnalytics: (timeRange: { startDate: string; endDate: string }) =>
    `ga_${timeRange.startDate}_${timeRange.endDate}`,
  callRail: (timeRange: { startDate: string; endDate: string }) =>
    `cr_${timeRange.startDate}_${timeRange.endDate}`,
  callsByDay: (timeRange: { startDate: string; endDate: string }) =>
    `cr_day_${timeRange.startDate}_${timeRange.endDate}`,
  callsBySource: (timeRange: { startDate: string; endDate: string }) =>
    `cr_src_${timeRange.startDate}_${timeRange.endDate}`,
  searchConsole: (timeRange: { startDate: string; endDate: string }) =>
    `gsc_${timeRange.startDate}_${timeRange.endDate}`,
  gbp: (timeRange: { startDate: string; endDate: string }) =>
    `gbp_${timeRange.startDate}_${timeRange.endDate}`,
};

// Wrapper function for caching async operations
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<{ data: T; cached: boolean }> {
  // Check if data exists in cache
  const cachedData = cache.get<T>(key);
  if (cachedData !== null) {
    return { data: cachedData, cached: true };
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in cache
  cache.set(key, data, ttl);

  return { data, cached: false };
}

export default cache;
