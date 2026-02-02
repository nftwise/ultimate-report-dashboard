import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Direct check: What's in Supabase for GBP?
 */
export async function GET() {
  try {
    // 1. Check if ANY GBP data exists
    const { count: totalGbpCount } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .gt('gbp_calls', 0)

    // 2. Get sample records WITH GBP
    const { data: gbpRecords } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('id, date, client_id, gbp_calls')
      .gt('gbp_calls', 0)
      .limit(20)

    // 3. Get ALL records to see total count
    const { count: totalRecords } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })

    // 4. Get date range
    const { data: dateRange } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    const latest = dateRange?.[0]?.date

    console.log('=== SUPABASE GBP CHECK ===')
    console.log(`Total records in DB: ${totalRecords}`)
    console.log(`Records with GBP > 0: ${totalGbpCount}`)
    console.log(`Latest date in DB: ${latest}`)
    console.log(`Sample GBP records (max 20):`)
    gbpRecords?.forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. Date: ${r.date}, Client: ${r.client_id}, GBP: ${r.gbp_calls}`)
    })

    return NextResponse.json({
      status: 'success',
      totalRecords,
      gbpRecordsCount: totalGbpCount || 0,
      latestDate: latest,
      gbpPercentage: totalRecords ? (((totalGbpCount || 0) / totalRecords) * 100).toFixed(2) : 0,
      gbpSamples: gbpRecords || [],
      message:
        (totalGbpCount || 0) > 0
          ? `✅ GBP data found: ${totalGbpCount} records`
          : '❌ NO GBP data in Supabase (all gbp_calls are 0 or null)'
    })
  } catch (error: any) {
    console.error('Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
