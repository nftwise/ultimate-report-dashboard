import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Detailed analysis of GBP data distribution
 */
export async function GET() {
  try {
    // Get ALL records to understand full date range
    const { data: allRecords, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls, client_id')
      .order('date', { ascending: true })

    if (error) throw error

    // Analyze distribution
    const totalRecords = allRecords?.length || 0
    const gbpRecords = allRecords?.filter((r: any) => (r.gbp_calls || 0) > 0) || []

    // Get unique dates with GBP data
    const gbpDates = new Set(gbpRecords.map((r: any) => r.date))
    const dates = Array.from(gbpDates).sort()

    // Count by month
    const byMonth: { [key: string]: number } = {}
    gbpRecords.forEach((r: any) => {
      const month = r.date?.substring(0, 7) // YYYY-MM
      if (!byMonth[month]) byMonth[month] = 0
      byMonth[month]++
    })

    // Get overall database date range
    const dbDates = (allRecords || []).map((r: any) => r.date).sort()
    const dbEarliest = dbDates[0]
    const dbLatest = dbDates[dbDates.length - 1]

    // Get sample records with GBP data
    const gbpByClient: { [key: string]: number } = {}
    gbpRecords.forEach((r: any) => {
      if (!gbpByClient[r.client_id]) gbpByClient[r.client_id] = 0
      gbpByClient[r.client_id] += r.gbp_calls || 0
    })

    const topClients = Object.entries(gbpByClient)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10)
      .map(([clientId, total]) => ({ clientId, total }))

    return NextResponse.json({
      database: {
        totalRecords,
        dateRange: {
          earliest: dbEarliest,
          latest: dbLatest
        }
      },
      gbpAnalysis: {
        recordsWithGBP: gbpRecords.length,
        percentWithGBP: ((gbpRecords.length / totalRecords) * 100).toFixed(2),
        uniqueDatesWithGBP: dates.length,
        dateRange: {
          earliest: dates[0] || null,
          latest: dates[dates.length - 1] || null
        },
        byMonth: byMonth,
        topClientsWithGBP: topClients
      }
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
