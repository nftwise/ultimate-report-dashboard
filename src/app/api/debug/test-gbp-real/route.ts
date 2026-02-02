import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test endpoint to check actual GBP data range
 */
export async function GET() {
  try {
    // Get all records with GBP data
    const { data: allRecords, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls, client_id')
      .gt('gbp_calls', 0)
      .order('date', { ascending: true })

    if (error) throw error

    const records = allRecords || []
    const dates = records.map((r: any) => r.date).sort()
    const uniqueDates = [...new Set(dates)]

    // Group by date
    const byDate: { [key: string]: number } = {}
    records.forEach((r: any) => {
      if (!byDate[r.date]) byDate[r.date] = 0
      byDate[r.date]++
    })

    // Count by month
    const byMonth: { [key: string]: number } = {}
    records.forEach((r: any) => {
      const month = r.date?.substring(0, 7) // YYYY-MM
      if (!byMonth[month]) byMonth[month] = 0
      byMonth[month]++
    })

    return NextResponse.json({
      totalRecords: records.length,
      uniqueDates: uniqueDates.length,
      earliest: dates[0] || null,
      latest: dates[dates.length - 1] || null,
      byMonth: byMonth,
      sampleRecords: records.slice(0, 5),
      allDates: uniqueDates
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
