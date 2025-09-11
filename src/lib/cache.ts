import { createCacheKey } from './utils';

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

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache(parseInt(process.env.CACHE_TTL || '300000'));

// Cache wrapper function
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<{ data: T; cached: boolean }> {
  const cachedData = cache.get<T>(key);
  
  if (cachedData) {
    return { data: cachedData, cached: true };
  }
  
  const data = await fetchFn();
  cache.set(key, data, ttl);
  
  return { data, cached: false };
}

// Cache key generators
export const cacheKeys = {
  googleAnalytics: (timeRange: any) => createCacheKey('ga', timeRange),
  googleAds: (timeRange: any) => createCacheKey('gads', timeRange),
  callRail: (timeRange: any) => createCacheKey('cr', timeRange),
  dashboard: (timeRange: any, filters: any) => createCacheKey('dashboard', { timeRange, filters }),
  trafficSources: (timeRange: any) => createCacheKey('ga_traffic', timeRange),
  phoneCallConversions: (timeRange: any) => createCacheKey('gads_phone', timeRange),
  callsByDay: (timeRange: any) => createCacheKey('cr_by_day', timeRange),
  callsBySource: (timeRange: any) => createCacheKey('cr_by_source', timeRange),
};

// Auto cleanup every 10 minutes
setInterval(() => {
  cache.cleanup();
}, 600000);