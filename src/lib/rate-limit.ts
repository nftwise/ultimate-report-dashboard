/**
 * Simple in-memory rate limiting
 *
 * KISS approach: No Redis/Upstash dependency needed
 * Good for single-instance deployments (Vercel serverless)
 *
 * For multi-instance: Upgrade to Upstash Redis later
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// In-memory storage (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export type RateLimitConfig = {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Identifier for the rate limit (e.g., IP address, user ID, API key)
   */
  identifier: string;
};

export type RateLimitResult = {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests made in current window
   */
  count: number;

  /**
   * Maximum requests allowed
   */
  limit: number;

  /**
   * Time remaining until reset (in seconds)
   */
  remaining: number;

  /**
   * Timestamp when the limit resets
   */
  resetAt: Date;
};

/**
 * Check rate limit for a given identifier
 *
 * @example
 * ```ts
 * const result = rateLimit({
 *   identifier: request.headers.get('x-forwarded-for') || 'unknown',
 *   maxRequests: 100,
 *   windowMs: 60 * 1000, // 1 minute
 * });
 *
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': '0',
 *         'X-RateLimit-Reset': result.resetAt.toISOString(),
 *       },
 *     }
 *   );
 * }
 * ```
 */
export function rateLimit(config: RateLimitConfig): RateLimitResult {
  const { identifier, maxRequests, windowMs } = config;
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or window expired - create new window
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      allowed: true,
      count: 1,
      limit: maxRequests,
      remaining: Math.floor(windowMs / 1000),
      resetAt: new Date(newEntry.resetAt),
    };
  }

  // Window still active
  const allowed = entry.count < maxRequests;

  if (allowed) {
    entry.count++;
  }

  return {
    allowed,
    count: entry.count,
    limit: maxRequests,
    remaining: Math.floor((entry.resetAt - now) / 1000),
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /**
   * Strict rate limit for admin endpoints
   * 10 requests per minute
   */
  admin: (identifier: string) =>
    rateLimit({
      identifier: `admin:${identifier}`,
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    }),

  /**
   * Moderate rate limit for API endpoints
   * 100 requests per minute
   */
  api: (identifier: string) =>
    rateLimit({
      identifier: `api:${identifier}`,
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
    }),

  /**
   * Lenient rate limit for dashboard
   * 300 requests per minute
   */
  dashboard: (identifier: string) =>
    rateLimit({
      identifier: `dashboard:${identifier}`,
      maxRequests: 300,
      windowMs: 60 * 1000, // 1 minute
    }),

  /**
   * Very strict rate limit for authentication
   * 5 attempts per 5 minutes
   */
  auth: (identifier: string) =>
    rateLimit({
      identifier: `auth:${identifier}`,
      maxRequests: 5,
      windowMs: 5 * 60 * 1000, // 5 minutes
    }),
};

/**
 * Helper to get client IP address from request
 */
export function getClientIp(request: Request): string {
  // Try multiple headers in order of preference
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'fastly-client-ip', // Fastly
    'x-vercel-forwarded-for', // Vercel
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can be comma-separated
      return value.split(',')[0].trim();
    }
  }

  return 'unknown';
}
