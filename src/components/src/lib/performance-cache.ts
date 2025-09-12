// Enhanced caching layer for better performance
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class PerformanceCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  private generateKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);
    
    return `${endpoint}:${JSON.stringify(sortedParams)}`;
  }

  set(key: string, data: any, customTTL?: number): void {
    const ttl = customTTL || this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    // Clean up expired entries periodically
    this.cleanup();
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  generateApiKey(endpoint: string, params: Record<string, any>): string {
    return this.generateKey(endpoint, params);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  // Get cache statistics
  getStats(): { size: number; hitRate: string } {
    return {
      size: this.size(),
      hitRate: '0%', // Could implement hit rate tracking
    };
  }
}

// Create singleton instance
export const performanceCache = new PerformanceCache();

// Enhanced API wrapper with caching and error handling
export async function cachedApiCall<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  options: {
    ttl?: number;
    fallbackData?: T;
    timeout?: number;
  } = {}
): Promise<T> {
  const { ttl = 5 * 60 * 1000, fallbackData, timeout = 30000 } = options;

  // Check cache first
  const cached = performanceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Add timeout to API call
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`API call timeout after ${timeout}ms`)), timeout);
    });

    const result = await Promise.race([apiCall(), timeoutPromise]);
    
    // Cache successful result
    performanceCache.set(cacheKey, result, ttl);
    return result;
  } catch (error) {
    console.error(`API call failed for ${cacheKey}:`, error);
    
    // Return fallback data if available
    if (fallbackData !== undefined) {
      console.log(`Returning fallback data for ${cacheKey}`);
      return fallbackData;
    }
    
    throw error;
  }
}

// Parallel API call utility
export async function parallelApiCalls<T extends Record<string, any>>(
  calls: Record<string, () => Promise<any>>,
  options: {
    timeout?: number;
    continueOnError?: boolean;
  } = {}
): Promise<T> {
  const { timeout = 30000, continueOnError = true } = options;
  const results = {} as T;
  
  const promises = Object.entries(calls).map(async ([key, apiCall]) => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${key} timeout after ${timeout}ms`)), timeout);
      });
      
      const result = await Promise.race([apiCall(), timeoutPromise]);
      return { key, result, error: null };
    } catch (error) {
      console.error(`Parallel API call failed for ${key}:`, error);
      if (continueOnError) {
        return { key, result: null, error };
      } else {
        throw error;
      }
    }
  });

  const responses = await Promise.allSettled(promises);
  
  responses.forEach((response) => {
    if (response.status === 'fulfilled' && response.value) {
      const { key, result } = response.value;
      results[key as keyof T] = result;
    }
  });

  return results;
}