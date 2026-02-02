import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to find actual date range of GBP data
 */
export async function GET() {
  try {
    // Simple query: get all records and filter client-side
    const { data: allRecords, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls')

    if (error) throw error

    // Analyze
    const withGBP = allRecords?.filter((r: any) => (r.gbp_calls || 0) > 0) || []
    const dates = withGBP.map((r: any) => r.date).sort()

    const earliestWithGBP = dates[0] || null
    const latestWithGBP = dates[dates.length - 1] || null

    return NextResponse.json({
      analysis: {
        totalRecords: allRecords?.length || 0,
        recordsWithGBP: withGBP.length,
        percentWithGBP: allRecords && allRecords.length > 0 ? ((withGBP.length / allRecords.length) * 100).toFixed(2) : '0',
        earliestGBPDate: earliestWithGBP,
        latestGBPDate: latestWithGBP,
        dateRangeSpan: earliestWithGBP && latestWithGBP ? `${earliestWithGBP} to ${latestWithGBP}` : 'No GBP data'
      }
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
