import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/verify-rls
 * Probes whether RLS is correctly blocking anon reads on sensitive tables.
 *
 * Returns one entry per probed table with:
 *   - rowsReturned: number of rows the anon key can read (should be 0 if RLS works)
 *   - rlsEnforced: true if anon read returned 0 rows or an explicit RLS error
 *
 * Auth: requires admin/team session (handled by /api/admin middleware).
 */
const SENSITIVE_TABLES = [
  'clients',
  'service_configs',
  'client_metrics_summary',
  'gbp_location_daily_metrics',
  'ga4_sessions',
  'ads_campaign_metrics',
  'manual_form_fills',
  'users',
] as const;

export async function GET(_request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { success: false, error: 'Supabase env vars missing' },
      { status: 500 }
    );
  }

  // Anonymous client — no auth header. If RLS is working, every query should
  // return 0 rows (or a permission error).
  const anon = createClient(supabaseUrl, anonKey);

  const results = await Promise.all(
    SENSITIVE_TABLES.map(async (table) => {
      // Cross-check that the table actually has rows (so 0 from anon means
      // RLS, not "table is empty"). Use service_role for this check.
      const { count: totalCount } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      const { data, error } = await anon.from(table).select('*').limit(1);
      const rowsReturned = data?.length ?? 0;
      const rlsEnforced = rowsReturned === 0;

      return {
        table,
        totalRows: totalCount ?? 0,
        anonReturnedRows: rowsReturned,
        anonError: error?.message ?? null,
        rlsEnforced,
        // Only meaningful if the table has data — otherwise we can't tell
        verdict:
          (totalCount ?? 0) === 0
            ? 'EMPTY_TABLE_CANNOT_VERIFY'
            : rlsEnforced
              ? 'OK'
              : 'LEAK_DETECTED',
      };
    })
  );

  const anyLeak = results.some((r) => r.verdict === 'LEAK_DETECTED');

  return NextResponse.json({
    success: true,
    overall: anyLeak ? 'LEAK_DETECTED' : 'OK',
    message: anyLeak
      ? 'Anon key can read at least one sensitive table. Run migrations/002_rls_policies.sql in Supabase.'
      : 'Anon key is correctly blocked from sensitive tables.',
    results,
  });
}
