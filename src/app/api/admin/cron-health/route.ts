import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/cron-health
 * Check if all cron jobs are running and data is up to date.
 *
 * Status logic:
 *   OK      = data updated within last 2 days
 *   WARNING = data is 3-5 days old
 *   ERROR   = data is 6+ days old OR no data found
 */
export async function GET() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Run all checks in parallel
  const [ga4, ads, gsc, gbp, summary] = await Promise.all([
    checkTable('ga4_sessions',                'date', 'GA4'),
    checkTable('ads_campaign_metrics',        'date', 'Google Ads'),
    checkTable('gsc_queries',                 'date', 'GSC'),
    checkTable('gbp_location_daily_metrics',  'date', 'GBP'),
    checkTable('client_metrics_summary',      'date', 'Rollup'),
  ]);

  const sources = [ga4, ads, gsc, gbp, summary];
  const hasError   = sources.some(s => s.status === 'ERROR');
  const hasWarning = sources.some(s => s.status === 'WARNING');

  const overallStatus = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK';

  return NextResponse.json({
    overall: overallStatus,
    checkedAt: new Date().toISOString(),
    today: todayStr,
    sources,
    summary: {
      ok:      sources.filter(s => s.status === 'OK').length,
      warning: sources.filter(s => s.status === 'WARNING').length,
      error:   sources.filter(s => s.status === 'ERROR').length,
    },
  });
}

async function checkTable(
  table: string,
  dateColumn: string,
  label: string
): Promise<{
  label: string;
  table: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  lastDate: string | null;
  daysAgo: number | null;
  message: string;
}> {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select(dateColumn)
      .order(dateColumn, { ascending: false })
      .limit(1);

    const data = rows?.[0] ?? null;

    if (error || !data) {
      return {
        label,
        table,
        status: 'ERROR',
        lastDate: null,
        daysAgo: null,
        message: 'No data found in table',
      };
    }

    const lastDate = (data as any)[dateColumn] as string;
    const daysAgo = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    let status: 'OK' | 'WARNING' | 'ERROR';
    let message: string;

    if (daysAgo <= 2) {
      status = 'OK';
      message = daysAgo === 0 ? 'Updated today' : daysAgo === 1 ? 'Updated yesterday' : `Updated ${daysAgo} days ago`;
    } else if (daysAgo <= 5) {
      status = 'WARNING';
      message = `Last update was ${daysAgo} days ago — cron may have missed a run`;
    } else {
      status = 'ERROR';
      message = `Last update was ${daysAgo} days ago — cron is likely broken`;
    }

    return { label, table, status, lastDate, daysAgo, message };
  } catch (err: any) {
    return {
      label,
      table,
      status: 'ERROR',
      lastDate: null,
      daysAgo: null,
      message: `Query failed: ${err.message}`,
    };
  }
}
