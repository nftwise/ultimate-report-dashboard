import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/data-range
 * Check what date range has data in client_metrics_summary
 */
export async function GET() {
  try {
    // Get min and max dates from client_metrics_summary
    const { data: minDate, error: minError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .single();

    const { data: maxDate, error: maxError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Count total records
    const { count } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true });

    // Get distinct dates count
    const { data: distinctDates } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(30);

    // Get sample of recent data
    const { data: recentSample } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, client_id, total_leads, google_ads_conversions, gbp_calls')
      .order('date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      dataRange: {
        earliest: minDate?.date || 'No data',
        latest: maxDate?.date || 'No data',
        totalRecords: count || 0,
        recentDates: [...new Set(distinctDates?.map(d => d.date) || [])],
      },
      recentSample,
      errors: {
        min: minError?.message,
        max: maxError?.message,
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
