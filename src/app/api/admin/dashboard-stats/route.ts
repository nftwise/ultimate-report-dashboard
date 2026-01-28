import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30')

    // Calculate date range
    const now = new Date()
    const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const dateFromStr = dateFrom.toISOString().split('T')[0]
    const dateToStr = now.toISOString().split('T')[0]

    // Get previous period for comparison
    const prevDateFrom = new Date(dateFrom.getTime() - days * 24 * 60 * 60 * 1000)
    const prevDateFromStr = prevDateFrom.toISOString().split('T')[0]

    // Current period metrics
    const { data: currentMetrics, error: currentError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .gte('date', dateFromStr)
      .lte('date', dateToStr)

    if (currentError) {
      console.error('Error fetching current metrics:', currentError)
      return NextResponse.json(
        { success: false, error: currentError.message },
        { status: 500 }
      )
    }

    // Previous period metrics
    const { data: prevMetrics, error: prevError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .gte('date', prevDateFromStr)
      .lt('date', dateFromStr)

    if (prevError) {
      console.error('Error fetching previous metrics:', prevError)
      return NextResponse.json(
        { success: false, error: prevError.message },
        { status: 500 }
      )
    }

    // Get total active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('is_active', true)

    if (clientError) {
      console.error('Error fetching clients:', clientError)
      return NextResponse.json(
        { success: false, error: clientError.message },
        { status: 500 }
      )
    }

    // Aggregate current period
    const currentStats = {
      totalLeads: 0,
      totalAdSpend: 0,
      totalConversions: 0,
      totalCalls: 0
    }

    const currentMetricsArray = Array.isArray(currentMetrics) ? currentMetrics : []
    currentMetricsArray.forEach((metric: any) => {
      currentStats.totalLeads += metric.form_fills || 0
      currentStats.totalConversions += metric.google_ads_conversions || 0
      currentStats.totalCalls += metric.gbp_calls || 0
      // Note: ad_spend might not be in this table, we'll calculate or default to 0
    })

    // Aggregate previous period
    const prevStats = {
      totalLeads: 0,
      totalAdSpend: 0,
      totalConversions: 0,
      totalCalls: 0
    }

    const prevMetricsArray = Array.isArray(prevMetrics) ? prevMetrics : []
    prevMetricsArray.forEach((metric: any) => {
      prevStats.totalLeads += metric.form_fills || 0
      prevStats.totalConversions += metric.google_ads_conversions || 0
      prevStats.totalCalls += metric.gbp_calls || 0
    })

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    const totalClients = clients?.length || 0

    const stats = {
      totalClients,
      activeClients: totalClients,
      totalLeads: currentStats.totalLeads,
      totalConversions: currentStats.totalConversions,
      totalAdSpend: 0, // Will need to add ad_spend column to client_metrics_summary
      totalCalls: currentStats.totalCalls,
      avgCPL: currentStats.totalConversions > 0
        ? Math.round((currentStats.totalAdSpend / currentStats.totalConversions) * 100) / 100
        : 0,
      changes: {
        clients: calculateChange(totalClients, totalClients), // No previous client count
        leads: calculateChange(currentStats.totalLeads, prevStats.totalLeads),
        conversions: calculateChange(currentStats.totalConversions, prevStats.totalConversions),
        calls: calculateChange(currentStats.totalCalls, prevStats.totalCalls),
        cpl: 0 // Will calculate when ad_spend is available
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({ success: true, data: stats })
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
