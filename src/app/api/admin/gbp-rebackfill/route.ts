import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGBPRangePerDay, transformGBPMetrics } from '@/lib/gbp-fetch-utils';

export const dynamic = 'force-dynamic'

export const maxDuration = 300;

/**
 * GET /api/admin/gbp-rebackfill?start=YYYY-MM-DD&end=YYYY-MM-DD&slug=client-slug
 * Re-fetch GBP data using accurate range query for historical months.
 * Uses fetchGBPRangePerDay (not single-day) to avoid data suppression.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get('start');
  const end   = request.nextUrl.searchParams.get('end');
  const slug  = request.nextUrl.searchParams.get('slug');

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 });

  const startTime = Date.now();

  // Load locations (optionally filtered by slug)
  let locQuery = supabaseAdmin
    .from('gbp_locations')
    .select('id, client_id, gbp_location_id, location_name')
    .eq('is_active', true);

  if (slug) {
    const { data: client } = await supabaseAdmin.from('clients').select('id').eq('slug', slug).single();
    if (!client) return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 });
    locQuery = locQuery.eq('client_id', client.id);
  }

  const { data: locs } = await locQuery;
  if (!locs?.length) return NextResponse.json({ error: 'No locations found' }, { status: 404 });

  let totalRows = 0;
  const errors: string[] = [];

  // Process 3 locations at a time
  for (let i = 0; i < locs.length; i += 3) {
    const batch = locs.slice(i, i + 3);
    await Promise.all(batch.map(async (loc) => {
      try {
        const perDay = await fetchGBPRangePerDay(loc.gbp_location_id, start, end);
        const rows = [];
        for (const [date, metrics] of perDay) {
          rows.push({ ...transformGBPMetrics(metrics, loc.id, loc.client_id, date), fetch_status: 'success' });
        }
        if (rows.length > 0) {
          const { error } = await supabaseAdmin
            .from('gbp_location_daily_metrics')
            .upsert(rows, { onConflict: 'location_id,date', ignoreDuplicates: false });
          if (error) errors.push(`${loc.location_name}: ${error.message}`);
          else totalRows += rows.length;
        }
      } catch (e: any) {
        errors.push(`${loc.location_name}: ${e.message}`);
      }
    }));
  }

  // Trigger rollup for affected date range
  const d = new Date(start + 'T12:00:00Z');
  const endD = new Date(end + 'T12:00:00Z');
  while (d <= endD) {
    const dateStr = d.toISOString().split('T')[0];
    fetch(`${request.nextUrl.origin}/api/admin/run-rollup?date=${dateStr}`).catch(() => {});
    d.setDate(d.getDate() + 1);
  }

  return NextResponse.json({
    success: true,
    locations: locs.length,
    range: { start, end },
    totalRows,
    errors: errors.length ? errors : undefined,
    duration: Date.now() - startTime,
  });
}
