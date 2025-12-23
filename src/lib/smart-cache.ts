/**
 * Smart API Cache System
 *
 * Caches API responses with intelligent TTL based on date ranges
 * - Historical data: Long cache (7 days)
 * - Current data: Short cache (1 hour)
 * - Recent data: Medium cache (3 hours)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CacheOptions {
  source?: string; // 'google_ads', 'google_analytics', 'gbp', etc.
  clientId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  forceFresh?: boolean; // Skip cache and force API call
}

/**
 * Calculate smart TTL based on date range
 */
function getSmartTTL(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) {
    // Default: 1 hour for non-date-range queries
    return 3600;
  }

  const now = new Date();
  const end = new Date(endDate);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Check if end date is in the past (historical data)
  if (end < yesterday) {
    // Historical data doesn't change - cache for 7 days
    console.log(`[Cache] Historical data detected - TTL: 7 days`);
    return 7 * 24 * 3600;
  }

  // Check if end date includes today
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (end >= today) {
    // Data includes today - short cache as data is still changing
    console.log(`[Cache] Current data detected - TTL: 1 hour`);
    return 3600; // 1 hour
  }

  // Recent historical data (yesterday to a week ago)
  console.log(`[Cache] Recent data detected - TTL: 3 hours`);
  return 3 * 3600; // 3 hours
}

/**
 * Get cached data or fetch fresh data
 */
export async function getCachedOrFetch<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T & { _cacheInfo?: { hit: boolean; age?: number; expiresIn?: number } }> {

  const { source, clientId, dateRange, forceFresh = false } = options;

  // If force fresh, skip cache
  if (forceFresh) {
    console.log(`[Cache] Force fresh requested for ${cacheKey}`);
    const freshData = await fetchFunction();
    return freshData as any;
  }

  try {
    // 1. Try to get from cache
    const { data: cached, error } = await supabase
      .from('api_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (!error && cached && new Date(cached.expires_at) > new Date()) {
      // Cache hit!
      const cacheAge = Math.floor((Date.now() - new Date(cached.created_at).getTime()) / 1000);
      const expiresIn = Math.floor((new Date(cached.expires_at).getTime() - Date.now()) / 1000);

      console.log(`✅ [Cache HIT] ${cacheKey} - Age: ${cacheAge}s, Expires in: ${expiresIn}s`);

      // Update access stats
      await supabase
        .from('api_cache')
        .update({
          hit_count: (cached.hit_count || 0) + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('cache_key', cacheKey);

      // Return cached data directly - don't spread arrays as it converts them to objects
      return cached.data as any;
    }

    // Cache miss or expired
    console.log(`❌ [Cache MISS] ${cacheKey} - Fetching from API...`);

  } catch (cacheError) {
    console.error(`[Cache] Error checking cache:`, cacheError);
    // Continue to fetch fresh data
  }

  // 2. Fetch fresh data
  const startTime = Date.now();
  let freshData: T;

  try {
    freshData = await fetchFunction();
    const fetchDuration = Date.now() - startTime;
    console.log(`[Cache] API fetch completed in ${fetchDuration}ms`);
  } catch (fetchError) {
    console.error(`[Cache] Error fetching data:`, fetchError);
    throw fetchError;
  }

  // 3. Calculate TTL
  const ttl = getSmartTTL(dateRange?.startDate, dateRange?.endDate);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  // 4. Store in cache
  try {
    await supabase
      .from('api_cache')
      .upsert({
        cache_key: cacheKey,
        data: freshData as any,
        source,
        client_id: clientId,
        expires_at: expiresAt.toISOString(),
        ttl_seconds: ttl,
        hit_count: 0,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      });

    console.log(`💾 [Cache STORED] ${cacheKey} - TTL: ${ttl}s (${Math.round(ttl / 3600)}h)`);
  } catch (storeError) {
    console.error(`[Cache] Error storing cache:`, storeError);
    // Continue anyway - fresh data was fetched successfully
  }

  // Return fresh data directly - don't spread arrays as it converts them to objects
  return freshData as any;
}

/**
 * Invalidate cache for a specific key or pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .delete()
      .like('cache_key', pattern)
      .select('cache_key');

    if (error) throw error;

    const count = data?.length || 0;
    console.log(`🗑️  [Cache] Invalidated ${count} cache entries matching: ${pattern}`);
    return count;
  } catch (error) {
    console.error(`[Cache] Error invalidating cache:`, error);
    return 0;
  }
}

/**
 * Clear all expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('cache_key');

    if (error) throw error;

    const count = data?.length || 0;
    console.log(`🧹 [Cache] Cleaned up ${count} expired cache entries`);
    return count;
  } catch (error) {
    console.error(`[Cache] Error cleaning cache:`, error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    // Total cache entries
    const { count: totalEntries } = await supabase
      .from('api_cache')
      .select('*', { count: 'exact', head: true });

    // Expired entries
    const { count: expiredEntries } = await supabase
      .from('api_cache')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString());

    // By source
    const { data: bySource } = await supabase
      .from('api_cache')
      .select('source')
      .not('source', 'is', null);

    const sourceCount: Record<string, number> = {};
    bySource?.forEach((row: any) => {
      sourceCount[row.source] = (sourceCount[row.source] || 0) + 1;
    });

    // Most hit entries
    const { data: topHits } = await supabase
      .from('api_cache')
      .select('cache_key, hit_count, source')
      .order('hit_count', { ascending: false })
      .limit(10);

    return {
      totalEntries: totalEntries || 0,
      activeEntries: (totalEntries || 0) - (expiredEntries || 0),
      expiredEntries: expiredEntries || 0,
      bySource: sourceCount,
      topHits: topHits || []
    };
  } catch (error) {
    console.error(`[Cache] Error getting stats:`, error);
    return null;
  }
}

/**
 * Generate cache key for common patterns
 */
export function generateCacheKey(
  source: string,
  clientId: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('-');

  return `${source}-${clientId}-${sortedParams}`;
}
