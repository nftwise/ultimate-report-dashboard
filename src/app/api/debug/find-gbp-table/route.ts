import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Search all tables for GBP data - find which table has it
 */
export async function GET() {
  try {
    const results: any = {}

    console.log('=== SEARCHING FOR GBP DATA IN ALL TABLES ===')

    // Check client_metrics_summary
    console.log('\n1. Checking client_metrics_summary...')
    const { count: metricsCount, data: metricsSample } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('gbp_calls', { count: 'exact' })
      .gt('gbp_calls', 0)
      .limit(5)

    results.client_metrics_summary = {
      recordsWithGbp: metricsCount || 0,
      samples: metricsSample
    }
    console.log(`  Records with gbp_calls > 0: ${metricsCount}`)

    // Check if there's a different metrics table
    console.log('\n2. Checking metrics table (if exists)...')
    try {
      const { count: metricsAltCount, data: metricsAltSample } = await supabaseAdmin
        .from('metrics')
        .select('gbp_calls', { count: 'exact' })
        .gt('gbp_calls', 0)
        .limit(5)

      results.metrics = {
        recordsWithGbp: metricsAltCount || 0,
        samples: metricsAltSample
      }
      console.log(`  Records with gbp_calls > 0: ${metricsAltCount}`)
    } catch (e) {
      console.log('  Table does not exist')
    }

    // Check if there's a daily_metrics table
    console.log('\n3. Checking daily_metrics table (if exists)...')
    try {
      const { count: dailyCount, data: dailySample } = await supabaseAdmin
        .from('daily_metrics')
        .select('gbp_calls', { count: 'exact' })
        .gt('gbp_calls', 0)
        .limit(5)

      results.daily_metrics = {
        recordsWithGbp: dailyCount || 0,
        samples: dailySample
      }
      console.log(`  Records with gbp_calls > 0: ${dailyCount}`)
    } catch (e) {
      console.log('  Table does not exist')
    }

    // Check client_metrics (without summary)
    console.log('\n4. Checking client_metrics table (if exists)...')
    try {
      const { count: clientMetricsCount, data: clientMetricsSample } = await supabaseAdmin
        .from('client_metrics')
        .select('gbp_calls', { count: 'exact' })
        .gt('gbp_calls', 0)
        .limit(5)

      results.client_metrics = {
        recordsWithGbp: clientMetricsCount || 0,
        samples: clientMetricsSample
      }
      console.log(`  Records with gbp_calls > 0: ${clientMetricsCount}`)
    } catch (e) {
      console.log('  Table does not exist')
    }

    // List all columns in client_metrics_summary
    console.log('\n5. Checking all columns in client_metrics_summary...')
    const { data: allData } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .limit(1)

    const columns = allData?.[0] ? Object.keys(allData[0]) : []
    results.client_metrics_summary_columns = columns
    console.log('  Columns:', columns)

    // Check for GBP-like columns
    const gbpColumns = columns.filter((c: string) =>
      c.toLowerCase().includes('gbp') || c.toLowerCase().includes('call')
    )
    console.log('  GBP/Call related columns:', gbpColumns)

    return NextResponse.json({
      success: true,
      results,
      gbpColumns
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
