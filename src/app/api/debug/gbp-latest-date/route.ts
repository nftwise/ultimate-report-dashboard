import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Get the latest date with GBP data in the database
 * Returns the actual date range of GBP data
 */
export async function GET() {
  try {
    // Get only records that have GBP calls > 0
    const { data: gbpRecords, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .gt('gbp_calls', 0)
      .order('date', { ascending: false })
      .limit(1)

    if (error) throw error

    // Also get earliest GBP date
    const { data: earliestRecords, error: earliestError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date')
      .gt('gbp_calls', 0)
      .order('date', { ascending: true })
      .limit(1)

    if (earliestError) throw earliestError

    const latestGBPDate = gbpRecords?.[0]?.date || null
    const earliestGBPDate = earliestRecords?.[0]?.date || null

    // Get count of records with GBP data
    const { count } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*', { count: 'exact', head: true })
      .gt('gbp_calls', 0)

    return NextResponse.json({
      success: true,
      latestGBPDate,
      earliestGBPDate,
      recordsWithGBP: count || 0,
      message: latestGBPDate
        ? `GBP data available from ${earliestGBPDate} to ${latestGBPDate}`
        : 'No GBP data found'
    })
  } catch (error: any) {
    console.error('[gbp-latest-date] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
