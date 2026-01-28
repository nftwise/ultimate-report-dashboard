import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const months = parseInt(request.nextUrl.searchParams.get('months') || '6')

    // Calculate date range
    const now = new Date()
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - months, 1)
    const dateFromStr = dateFrom.toISOString().split('T')[0]
    const dateToStr = now.toISOString().split('T')[0]

    // Fetch metrics for the date range
    const { data: metrics, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, form_fills, google_ads_conversions, gbp_calls')
      .gte('date', dateFromStr)
      .lte('date', dateToStr)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching monthly trend:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Group by month and aggregate
    const monthlyData: { [key: string]: number } = {}
    const monthOrder: string[] = []

    const metricsArray = Array.isArray(metrics) ? metrics : []
    metricsArray.forEach((metric: any) => {
      const date = new Date(metric.date)
      const monthKey = date.toISOString().split('T')[0].substring(0, 7) // YYYY-MM

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0
        monthOrder.push(monthKey)
      }

      // Count form fills as leads
      monthlyData[monthKey] += metric.form_fills || 0
    })

    // Generate chart data
    const monthLabels: { [key: string]: string } = {
      '01': 'Jan',
      '02': 'Feb',
      '03': 'Mar',
      '04': 'Apr',
      '05': 'May',
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Aug',
      '09': 'Sep',
      '10': 'Oct',
      '11': 'Nov',
      '12': 'Dec'
    }

    const chartData = monthOrder.map(monthKey => {
      const [year, month] = monthKey.split('-')
      const label = monthLabels[month] || month
      return {
        month: label,
        value: monthlyData[monthKey]
      }
    })

    // Calculate summary stats
    const values = Object.values(monthlyData)
    const highest = Math.max(...values, 0)
    const lowest = values.length > 0 ? Math.min(...values) : 0
    const average = values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (values.length >= 2) {
      const lastValue = values[values.length - 1]
      const prevValue = values[values.length - 2]
      if (lastValue > prevValue) trend = 'up'
      else if (lastValue < prevValue) trend = 'down'
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      summary: {
        highest,
        lowest,
        average,
        trend
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
