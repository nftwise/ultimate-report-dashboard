/**
 * Timezone utilities for handling US-based business data
 *
 * Problem:
 * - Server in US (Vercel iad1)
 * - Developer in Vietnam (GMT+7)
 * - Business data is US-based (Google Analytics, Ads, etc.)
 *
 * Solution:
 * - All dates stored as YYYY-MM-DD in US timezone (Pacific or Eastern)
 * - Rollup runs at 2AM US time for previous US day
 * - Dashboard displays dates as-is (no timezone conversion)
 */

/**
 * US Timezone configuration
 * Most US businesses use Pacific (PT) or Eastern (ET)
 */
export const US_TIMEZONE = 'America/Los_Angeles'; // Pacific Time (default for tech companies)
// export const US_TIMEZONE = 'America/New_York'; // Eastern Time (alternative)

/**
 * Get current date in US timezone (YYYY-MM-DD)
 *
 * @example
 * // In Vietnam: 2026-01-08 14:00 (2PM)
 * // In US PT:    2026-01-07 23:00 (11PM)
 * // Returns: "2026-01-07"
 */
export function getUSDate(daysOffset = 0): string {
  const now = new Date();

  // Convert to US timezone
  const usDate = new Date(
    now.toLocaleString('en-US', { timeZone: US_TIMEZONE })
  );

  // Apply offset
  if (daysOffset !== 0) {
    usDate.setDate(usDate.getDate() + daysOffset);
  }

  // Return YYYY-MM-DD
  return usDate.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in US timezone
 *
 * This is what rollup should use for fetching data
 *
 * @example
 * // Cron runs at 2AM US time
 * // getUSYesterday() = yesterday in US timezone
 */
export function getUSYesterday(): string {
  return getUSDate(-1);
}

/**
 * Get today's date in US timezone
 */
export function getUSToday(): string {
  return getUSDate(0);
}

/**
 * Get date range for last N days in US timezone
 *
 * @example
 * // getUSDateRange(7) returns last 7 days
 * // { startDate: "2026-01-01", endDate: "2026-01-07" }
 */
export function getUSDateRange(days: number): {
  startDate: string;
  endDate: string;
} {
  const endDate = getUSToday();
  const startDate = getUSDate(-(days - 1));

  return { startDate, endDate };
}

/**
 * Check if it's currently a reasonable time to run rollup
 *
 * Rollup should run after midnight US time (2AM-6AM is ideal)
 * This ensures all analytics data is finalized
 */
export function isRollupTime(): boolean {
  const now = new Date();
  const usTime = new Date(
    now.toLocaleString('en-US', { timeZone: US_TIMEZONE })
  );

  const hour = usTime.getHours();

  // Between 2AM and 6AM US time
  return hour >= 2 && hour < 6;
}

/**
 * Get human-readable timezone info for debugging
 */
export function getTimezoneInfo(): {
  serverTime: string;
  usTime: string;
  usDate: string;
  usYesterday: string;
  isRollupTime: boolean;
} {
  const now = new Date();

  return {
    serverTime: now.toISOString(),
    usTime: now.toLocaleString('en-US', {
      timeZone: US_TIMEZONE,
      dateStyle: 'full',
      timeStyle: 'long',
    }),
    usDate: getUSToday(),
    usYesterday: getUSYesterday(),
    isRollupTime: isRollupTime(),
  };
}

/**
 * Format date for display (no timezone conversion)
 *
 * IMPORTANT: Parses YYYY-MM-DD directly without Date object to avoid timezone shifts
 * Database stores US dates as strings, display them as-is
 *
 * @example
 * formatUSDate("2026-01-07", "short") → "Jan 7, 2026"
 * formatUSDate("2026-01-07", "long") → "January 7, 2026"
 * formatUSDate("2026-01-07", "numeric") → "01/07/2026"
 * formatUSDate("2026-01-07", "chart") → "Jan 7"
 */
export function formatUSDate(
  dateStr: string,
  format: 'short' | 'long' | 'numeric' | 'chart' = 'short'
): string {
  if (!dateStr) return '';

  // Parse YYYY-MM-DD directly (no Date object to avoid timezone conversion)
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  if (format === 'numeric') {
    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }

  if (format === 'chart') {
    return `${monthNamesShort[month - 1]} ${day}`;
  }

  if (format === 'short') {
    return `${monthNamesShort[month - 1]} ${day}, ${year}`;
  }

  // 'long' format
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

/**
 * Validate that a date string is in US business hours context
 */
export function isUSBusinessDay(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  // Monday-Friday (1-5)
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

/**
 * Get last complete US business day
 *
 * Skips weekends - useful for "latest data" queries
 */
export function getLastUSBusinessDay(): string {
  let date = getUSDate(-1); // Yesterday
  let attempts = 0;

  // Go back until we find a business day
  while (!isUSBusinessDay(date) && attempts < 7) {
    date = getUSDate(-(attempts + 2));
    attempts++;
  }

  return date;
}
