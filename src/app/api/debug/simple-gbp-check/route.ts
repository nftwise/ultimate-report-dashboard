import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Ultra-simple check: Does GBP data exist at all?
 */
export async function GET() {
  try {
    // Just count records with GBP > 0
    const { count, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .gt('gbp_calls', 0)

    if (error) throw error

    // Get a few samples if they exist
    const { data: samples } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls, client_id')
      .gt('gbp_calls', 0)
      .limit(5)

    // Get date range of ALL records
    const { data: allRecords } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    const { data: earliestRecords } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)

    const latestDate = allRecords?.[0]?.date || 'No data'
    const earliestDate = earliestRecords?.[0]?.date || 'No data'

    const answer = {
      gbpRecordsExist: (count || 0) > 0,
      gbpRecordCount: count || 0,
      gbpSamples: samples || [],
      databaseDateRange: {
        earliest: earliestDate,
        latest: latestDate
      },
      message:
        (count || 0) > 0
          ? `✅ GBP data EXISTS: ${count} records found`
          : '❌ NO GBP data in database'
    }

    console.log(JSON.stringify(answer, null, 2))
    return NextResponse.json(answer)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
