/**
 * GBP Performance API Fetch Utilities
 *
 * ⚠️  CRITICAL: Use DATE RANGES, not individual days!
 *
 * Why: When fetching a single day vs a date range:
 * - Single day: Returns incomplete data (API consolidation lag)
 * - Date range: Returns complete aggregated data
 *
 * Example:
 * ❌ Bad:  Jan 5-5 (single day) → 2 calls
 * ✅ Good: Jan 1-31 (full month) → 48 calls (all data consolidated)
 */

import { GBPTokenManager } from './gbp-token-manager';

const METRICS = [
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];

const TIMEOUT_MS = 20000;

interface GBPMetrics {
  WEBSITE_CLICKS: number;
  BUSINESS_DIRECTION_REQUESTS: number;
  CALL_CLICKS: number;
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: number;
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: number;
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: number;
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: number;
  [key: string]: number;
}

/**
 * Fetch GBP metrics for a location across a DATE RANGE
 *
 * @param locationId Raw location ID (auto-normalizes to "locations/XXX" format)
 * @param startDate "2026-02-01"
 * @param endDate "2026-02-28"
 * @returns Aggregated metrics for the entire range
 *
 * Example:
 * const metrics = await fetchGBPRange('1234567890', '2026-02-01', '2026-02-28');
 * console.log(metrics.CALL_CLICKS); // 33
 */
export async function fetchGBPRange(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<GBPMetrics> {
  let accessToken: string | null = null;
  try {
    accessToken = await GBPTokenManager.getAccessToken();
  } catch (err: any) {
    console.error(`[GBP] Failed to get access token: ${err.message}`);
    throw new Error(`GBP auth failed: ${err.message}`);
  }

  if (!accessToken) {
    throw new Error('No GBP OAuth token available - check system_settings.gbp_agency_master');
  }

  // Normalize location ID
  let normalizedId = locationId;
  if (normalizedId.includes('/locations/')) {
    normalizedId = `locations/${normalizedId.split('/locations/')[1]}`;
  } else if (!normalizedId.startsWith('locations/')) {
    normalizedId = `locations/${normalizedId}`;
  }

  // Parse dates
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  const results: GBPMetrics = {} as GBPMetrics;

  // Initialize all metrics to 0
  for (const metric of METRICS) results[metric] = 0;

  // Fetch all metrics in parallel (with timeout per metric)
  await Promise.all(
    METRICS.map(async (metric) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const url = new URL(
          `https://businessprofileperformance.googleapis.com/v1/${normalizedId}:getDailyMetricsTimeSeries`
        );
        url.searchParams.set('dailyMetric', metric);
        url.searchParams.set('dailyRange.start_date.year', String(startYear));
        url.searchParams.set('dailyRange.start_date.month', String(startMonth));
        url.searchParams.set('dailyRange.start_date.day', String(startDay));
        url.searchParams.set('dailyRange.end_date.year', String(endYear));
        url.searchParams.set('dailyRange.end_date.month', String(endMonth));
        url.searchParams.set('dailyRange.end_date.day', String(endDay));

        const response = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[GBP] ${metric} failed: HTTP ${response.status}`);
          return;
        }

        const data = await response.json();
        const value = (data.timeSeries?.datedValues || [])
          .reduce((sum: number, d: any) => sum + (parseInt(d.value || '0') || 0), 0);

        results[metric] = value;
      } catch (err: any) {
        const errorMsg = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
        console.warn(`[GBP] ${metric} (${startDate}/${endDate}) error: ${errorMsg}`);
        results[metric] = 0;
      }
    })
  );

  return results;
}

/**
 * Fetch GBP metrics for a single day (for daily cron)
 * Still uses date range but with same start/end date
 *
 * @param locationId Raw location ID
 * @param date "2026-02-01"
 * @returns Metrics for that single day
 */
export async function fetchGBPDay(locationId: string, date: string): Promise<GBPMetrics> {
  return fetchGBPRange(locationId, date, date);
}

/**
 * Transform GBP metrics to database schema
 *
 * Example:
 * const row = transformGBPMetrics(metrics, locationId, clientId, date);
 * // { phone_calls: 33, views: 1200, ... }
 */
export function transformGBPMetrics(
  metrics: GBPMetrics,
  locationId: string,
  clientId: string,
  date: string
) {
  return {
    location_id: locationId,
    client_id: clientId,
    date,
    // Profile views = all impressions combined
    views:
      metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS +
      metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS +
      metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH +
      metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
    // Actions total
    actions: metrics.WEBSITE_CLICKS + metrics.BUSINESS_DIRECTION_REQUESTS + metrics.CALL_CLICKS,
    direction_requests: metrics.BUSINESS_DIRECTION_REQUESTS,
    phone_calls: metrics.CALL_CLICKS,
    website_clicks: metrics.WEBSITE_CLICKS,
  };
}
