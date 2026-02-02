import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test endpoint: Load ALL data and test random date ranges
 * Shows what date ranges have data and tests if fix works
 */
export async function GET() {
  try {
    console.log('=== COMPREHENSIVE DATA TEST ===')

    // Step 1: Get ALL records (no filters)
    const { data: allMetrics, error: allError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, client_id, gbp_calls, google_ads_conversions, total_leads, form_fills')
      .order('date', { ascending: true })

    if (allError) throw allError

    const totalRecords = allMetrics?.length || 0
    console.log(`\n📊 Total records in database: ${totalRecords}`)

    // Step 2: Analyze date distribution
    const dateMap: { [key: string]: { count: number; gbp: number; ads: number } } = {}
    const dateSet = new Set<string>()
    let totalGBP = 0
    let totalAds = 0

    allMetrics?.forEach((m: any) => {
      if (!dateMap[m.date]) {
        dateMap[m.date] = { count: 0, gbp: 0, ads: 0 }
      }
      dateMap[m.date].count++
      dateMap[m.date].gbp += m.gbp_calls || 0
      dateMap[m.date].ads += m.google_ads_conversions || 0
      dateSet.add(m.date)
      totalGBP += m.gbp_calls || 0
      totalAds += m.google_ads_conversions || 0
    })

    const sortedDates = Array.from(dateSet).sort()
    const earliestDate = sortedDates[0]
    const latestDate = sortedDates[sortedDates.length - 1]

    console.log(`\n📅 Date Range: ${earliestDate} to ${latestDate}`)
    console.log(`📊 Unique dates: ${sortedDates.length}`)
    console.log(`📈 Total GBP calls: ${totalGBP}`)
    console.log(`📈 Total Ads conversions: ${totalAds}`)

    // Step 3: Group by month
    const byMonth: { [key: string]: { count: number; gbp: number; ads: number } } = {}
    Object.entries(dateMap).forEach(([date, stats]) => {
      const month = date.substring(0, 7)
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, gbp: 0, ads: 0 }
      }
      byMonth[month].count += stats.count
      byMonth[month].gbp += stats.gbp
      byMonth[month].ads += stats.ads
    })

    console.log('\n📊 Data by month:')
    Object.entries(byMonth)
      .sort()
      .forEach(([month, stats]) => {
        console.log(`  ${month}: ${stats.count} records, GBP=${stats.gbp}, Ads=${stats.ads}`)
      })

    // Step 4: Test with random date ranges
    console.log('\n🧪 Testing random date ranges:')

    const testRanges = [
      {
        name: 'Yesterday to 30 days back (Current Fix)',
        start: new Date(),
        end: new Date(),
        daysBack: 30
      },
      {
        name: 'Random from history',
        start: new Date(parseInt(earliestDate.split('-')[0]), parseInt(earliestDate.split('-')[1]) - 1, parseInt(earliestDate.split('-')[2])),
        end: new Date(parseInt(latestDate.split('-')[0]), parseInt(latestDate.split('-')[1]) - 1, parseInt(latestDate.split('-')[2]))
      },
      {
        name: 'Earliest 7 days',
        start: new Date(parseInt(earliestDate.split('-')[0]), parseInt(earliestDate.split('-')[1]) - 1, parseInt(earliestDate.split('-')[2])),
        end: null
      }
    ]

    const testResults = []

    for (const range of testRanges) {
      let end = range.end || new Date()
      let start = range.start

      if (range.daysBack) {
        end = new Date()
        end.setDate(end.getDate() - 1)
        start = new Date(end)
        start.setDate(start.getDate() - range.daysBack)
      }

      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      const { data: rangeData } = await supabaseAdmin
        .from('client_metrics_summary')
        .select('gbp_calls, google_ads_conversions')
        .gte('date', startStr)
        .lte('date', endStr)

      const rangeGBP = rangeData?.reduce((sum, m: any) => sum + (m.gbp_calls || 0), 0) || 0
      const rangeAds = rangeData?.reduce((sum, m: any) => sum + (m.google_ads_conversions || 0), 0) || 0
      const recordCount = rangeData?.length || 0

      testResults.push({
        name: range.name,
        startStr,
        endStr,
        recordCount,
        gbpCalls: rangeGBP,
        adsConversions: rangeAds
      })

      console.log(
        `  ✅ ${range.name}\n     Range: ${startStr} to ${endStr}\n     Records: ${recordCount}, GBP: ${rangeGBP}, Ads: ${rangeAds}`
      )
    }

    // Step 5: Check specific date ranges from history
    console.log('\n🔍 Checking dates with GBP data:')
    const gbpDates = sortedDates.filter(date => (dateMap[date]?.gbp || 0) > 0)
    console.log(`   Dates with GBP: ${gbpDates.length}`)
    if (gbpDates.length > 0) {
      console.log(`   Range: ${gbpDates[0]} to ${gbpDates[gbpDates.length - 1]}`)
      console.log(`   Sample dates: ${gbpDates.slice(0, 5).join(', ')}${gbpDates.length > 5 ? '...' : ''}`)
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRecords,
        totalGBPCalls: totalGBP,
        totalAdsConversions: totalAds,
        dateRange: {
          earliest: earliestDate,
          latest: latestDate,
          uniqueDates: sortedDates.length
        },
        gbpDataDates: {
          count: gbpDates.length,
          range: gbpDates.length > 0 ? `${gbpDates[0]} to ${gbpDates[gbpDates.length - 1]}` : 'No GBP data'
        }
      },
      byMonth,
      testResults,
      allDatesSorted: sortedDates,
      datesWithGBP: gbpDates
    })
  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
