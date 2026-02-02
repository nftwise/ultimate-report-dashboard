import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Check actual GBP data in database - what's really there
 */
export async function GET() {
  try {
    console.log('=== CHECKING ACTUAL GBP DATA ===')

    // Get EVERYTHING to see the full picture
    const { data: allData, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, gbp_calls, google_ads_conversions, total_leads, client_id')
      .order('date', { ascending: false })
      .limit(100)

    if (error) throw error

    console.log(`Total records fetched (last 100): ${allData?.length || 0}`)

    // Analyze what we got
    const stats = {
      total: allData?.length || 0,
      withGBP: 0,
      withAds: 0,
      withLeads: 0,
      gbpSampleRecords: [] as any[],
      dateSamples: [] as string[],
      gbpTotal: 0,
      adsTotal: 0,
      leadsTotal: 0
    }

    allData?.forEach((record: any) => {
      if (record.gbp_calls && record.gbp_calls > 0) {
        stats.withGBP++
        stats.gbpTotal += record.gbp_calls
        if (stats.gbpSampleRecords.length < 5) {
          stats.gbpSampleRecords.push({
            date: record.date,
            gbp_calls: record.gbp_calls,
            client_id: record.client_id
          })
        }
      }
      if (record.google_ads_conversions && record.google_ads_conversions > 0) {
        stats.withAds++
        stats.adsTotal += record.google_ads_conversions
      }
      if (record.total_leads && record.total_leads > 0) {
        stats.withLeads++
        stats.leadsTotal += record.total_leads
      }
      if (!stats.dateSamples.includes(record.date)) {
        stats.dateSamples.push(record.date)
      }
    })

    console.log('📊 Data Analysis:')
    console.log(`  Total records: ${stats.total}`)
    console.log(`  Records with GBP: ${stats.withGBP} (${((stats.withGBP / stats.total) * 100).toFixed(2)}%)`)
    console.log(`  Records with Ads: ${stats.withAds} (${((stats.withAds / stats.total) * 100).toFixed(2)}%)`)
    console.log(`  Records with Leads: ${stats.withLeads} (${((stats.withLeads / stats.total) * 100).toFixed(2)}%)`)
    console.log(`  Total GBP calls: ${stats.gbpTotal}`)
    console.log(`  Total Ads conversions: ${stats.adsTotal}`)
    console.log(`  Total Leads: ${stats.leadsTotal}`)
    console.log(`  Unique dates (in sample): ${stats.dateSamples.length}`)
    console.log(`  Date range: ${stats.dateSamples[stats.dateSamples.length - 1] || 'N/A'} to ${stats.dateSamples[0] || 'N/A'}`)
    console.log(`  GBP sample records: ${JSON.stringify(stats.gbpSampleRecords, null, 2)}`)

    // Test a specific date range
    console.log('\n🧪 Testing current date range logic:')
    const end = new Date()
    end.setDate(end.getDate() - 1)
    const start = new Date(end)
    start.setDate(start.getDate() - 30)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    console.log(`  Testing range: ${startStr} to ${endStr}`)

    const { data: rangeData } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('gbp_calls, google_ads_conversions, total_leads, date')
      .gte('date', startStr)
      .lte('date', endStr)

    const rangeStats = {
      records: rangeData?.length || 0,
      gbp: 0,
      ads: 0,
      leads: 0
    }

    rangeData?.forEach((r: any) => {
      rangeStats.gbp += r.gbp_calls || 0
      rangeStats.ads += r.google_ads_conversions || 0
      rangeStats.leads += r.total_leads || 0
    })

    console.log(`  Records in range: ${rangeStats.records}`)
    console.log(`  GBP total: ${rangeStats.gbp}`)
    console.log(`  Ads total: ${rangeStats.ads}`)
    console.log(`  Leads total: ${rangeStats.leads}`)

    return NextResponse.json({
      success: true,
      stats,
      testRange: {
        startStr,
        endStr,
        ...rangeStats
      }
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
