import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Real GBP check - Does the data actually exist?
 */
export async function GET() {
  try {
    // Count total records
    const { count: totalCount } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })

    // Count GBP records
    const { count: gbpCount } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .gt('gbp_calls', 0)

    // Get samples with GBP
    const { data: gbpSamples } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls, client_id, google_ads_conversions, total_leads')
      .gt('gbp_calls', 0)
      .limit(10)

    // Get date range of database
    const { data: latest } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    const { data: earliest } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)

    console.log('=== GBP REALITY CHECK ===')
    console.log(`Total records: ${totalCount}`)
    console.log(`Records with GBP > 0: ${gbpCount}`)
    console.log(`Percentage: ${gbpCount && totalCount ? ((gbpCount / totalCount) * 100).toFixed(2) : 0}%`)
    console.log(`Database date range: ${earliest?.[0]?.date || 'N/A'} to ${latest?.[0]?.date || 'N/A'}`)
    console.log(`GBP samples (first 10):`)
    console.log(JSON.stringify(gbpSamples, null, 2))

    return NextResponse.json({
      totalRecords: totalCount,
      gbpRecords: gbpCount,
      percentage: gbpCount && totalCount ? ((gbpCount / totalCount) * 100).toFixed(2) : 0,
      databaseDateRange: {
        earliest: earliest?.[0]?.date,
        latest: latest?.[0]?.date
      },
      gbpSamples: gbpSamples || []
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
