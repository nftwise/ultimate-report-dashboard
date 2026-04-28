/**
 * Input validation utilities
 *
 * Simple, dependency-free validation for API routes
 * Prevents injection attacks and validates data types
 */

/**
 * Validate date string (YYYY-MM-DD format)
 */
export function isValidDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: unknown): uuid is string {
  if (typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate client slug (alphanumeric + hyphens only)
 */
export function isValidSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false;

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length > 0 && slug.length <= 100;
}

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate period type
 */
export function isValidPeriod(period: unknown): period is 'daily' | 'weekly' | 'monthly' | 'custom' {
  return period === 'daily' || period === 'weekly' || period === 'monthly' || period === 'custom';
}

/**
 * Validate positive integer
 */
export function isPositiveInteger(num: unknown): num is number {
  return typeof num === 'number' && Number.isInteger(num) && num > 0;
}

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';

  return str
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .slice(0, 1000); // Limit length
}

/**
 * Validate date range
 */
export function isValidDateRange(startDate: unknown, endDate: unknown): boolean {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // End date must be after or equal to start date
  if (end < start) return false;

  // Range must be reasonable (max 2 years)
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 730; // 2 years
}

/**
 * Validate API request parameters
 */
export type ValidationResult =
  | { valid: true; data: any }
  | { valid: false; error: string };

export function validateApiParams(
  params: Record<string, unknown>,
  schema: Record<string, 'date' | 'uuid' | 'slug' | 'email' | 'period' | 'string' | 'number'>
): ValidationResult {
  for (const [key, type] of Object.entries(schema)) {
    const value = params[key];

    switch (type) {
      case 'date':
        if (!isValidDate(value)) {
          return { valid: false, error: `${key} must be a valid date (YYYY-MM-DD)` };
        }
        break;

      case 'uuid':
        if (!isValidUUID(value)) {
          return { valid: false, error: `${key} must be a valid UUID` };
        }
        break;

      case 'slug':
        if (!isValidSlug(value)) {
          return { valid: false, error: `${key} must be a valid slug (lowercase, alphanumeric, hyphens)` };
        }
        break;

      case 'email':
        if (!isValidEmail(value)) {
          return { valid: false, error: `${key} must be a valid email` };
        }
        break;

      case 'period':
        if (!isValidPeriod(value)) {
          return { valid: false, error: `${key} must be one of: daily, weekly, monthly, custom` };
        }
        break;

      case 'string':
        if (typeof value !== 'string' || value.trim().length === 0) {
          return { valid: false, error: `${key} must be a non-empty string` };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: `${key} must be a valid number` };
        }
        break;
    }
  }

  return { valid: true, data: params };
}

/**
 * Rate limit check helper (returns true if request should be allowed)
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
  storage: Map<string, { count: number; resetAt: number }>
): boolean {
  const now = Date.now();
  const entry = storage.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    storage.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}
