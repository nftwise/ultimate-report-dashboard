import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('daysBack') || '365')

    // Calculate date range
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateFromStr = dateFrom.toISOString().split('T')[0]

    // Fetch all metrics for the date range
    const { data: metrics, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('date, total_leads, form_fills, gbp_calls, google_ads_conversions')
      .gte('date', dateFromStr)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching metrics:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Aggregate by date
    const aggregatedByDate: { [key: string]: any } = {}
    ;(metrics || []).forEach((metric: any) => {
      const dateStr = metric.date
      if (!aggregatedByDate[dateStr]) {
        aggregatedByDate[dateStr] = {
          date: dateStr,
          total_leads: 0,
          seo_forms: 0,
          gbp_calls: 0,
          ads_conversions: 0
        }
      }
      aggregatedByDate[dateStr].total_leads += metric.total_leads || 0
      aggregatedByDate[dateStr].seo_forms += metric.form_fills || 0
      aggregatedByDate[dateStr].gbp_calls += metric.gbp_calls || 0
      aggregatedByDate[dateStr].ads_conversions += metric.google_ads_conversions || 0
    })

    // Convert to array and aggregate by month
    const dailyData = Object.values(aggregatedByDate).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Group by month
    const monthlyData: { [key: string]: any } = {}
    dailyData.forEach((day: any) => {
      const date = new Date(day.date)
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total_leads: 0,
          seo_forms: 0,
          gbp_calls: 0,
          ads_conversions: 0
        }
      }
      monthlyData[monthKey].total_leads += day.total_leads
      monthlyData[monthKey].seo_forms += day.seo_forms
      monthlyData[monthKey].gbp_calls += day.gbp_calls
      monthlyData[monthKey].ads_conversions += day.ads_conversions
    })

    const monthlyMetrics = Object.values(monthlyData)

    // Calculate summary stats
    const totalLeads = monthlyMetrics.reduce((sum, m: any) => sum + m.total_leads, 0)
    const totalSeo = monthlyMetrics.reduce((sum, m: any) => sum + m.seo_forms, 0)
    const totalGbp = monthlyMetrics.reduce((sum, m: any) => sum + m.gbp_calls, 0)
    const totalAds = monthlyMetrics.reduce((sum, m: any) => sum + m.ads_conversions, 0)

    return NextResponse.json({
      success: true,
      daysBack,
      summary: {
        totalLeads,
        totalSeo,
        totalGbp,
        totalAds
      },
      dailyData,
      monthlyData: monthlyMetrics
    })
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
