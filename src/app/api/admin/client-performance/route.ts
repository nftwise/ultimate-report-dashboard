import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'name'
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30')

    // Calculate date range
    const now = new Date()
    const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const dateFromStr = dateFrom.toISOString().split('T')[0]
    const dateToStr = now.toISOString().split('T')[0]

    // Get all active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        city,
        is_active,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gbp_location_id,
          gsc_site_url
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (clientError) {
      console.error('Error fetching clients:', clientError)
      return NextResponse.json(
        { success: false, error: clientError.message },
        { status: 500 }
      )
    }

    // Get metrics for all clients in the date range
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .gte('date', dateFromStr)
      .lte('date', dateToStr)

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError)
      return NextResponse.json(
        { success: false, error: metricsError.message },
        { status: 500 }
      )
    }

    // Aggregate metrics by client
    const clientMetricsMap: { [clientId: string]: any } = {}
    const metricsArray = Array.isArray(metrics) ? metrics : []

    metricsArray.forEach((metric: any) => {
      if (!clientMetricsMap[metric.client_id]) {
        clientMetricsMap[metric.client_id] = {
          leads: 0,
          conversions: 0,
          calls: 0,
          websiteClicks: 0,
          profileViews: 0,
          impressions: 0,
          healthScore: 0,
          count: 0,
          adSpend: 0
        }
      }

      clientMetricsMap[metric.client_id].leads += metric.form_fills || 0
      clientMetricsMap[metric.client_id].conversions += metric.google_ads_conversions || 0
      clientMetricsMap[metric.client_id].calls += metric.gbp_calls || 0
      clientMetricsMap[metric.client_id].websiteClicks += metric.gbp_website_clicks || 0
      clientMetricsMap[metric.client_id].profileViews += metric.gbp_profile_views || 0
      clientMetricsMap[metric.client_id].impressions +=
        (metric.seo_impressions || 0) + (metric.ads_impressions || 0)
      clientMetricsMap[metric.client_id].count += 1
    })

    // Build response with client data and aggregated metrics
    const clientsArray = Array.isArray(clients) ? clients : []
    const clientsWithMetrics = clientsArray
      .slice(offset, offset + limit)
      .map((client: any) => {
        const aggregated = clientMetricsMap[client.id] || {
          leads: 0,
          conversions: 0,
          calls: 0,
          websiteClicks: 0,
          profileViews: 0,
          impressions: 0,
          count: 0,
          adSpend: 0
        }

        // Calculate health score (mock - can be enhanced)
        let healthScore = 70
        if (aggregated.leads > 50) healthScore = 85
        if (aggregated.leads < 10) healthScore = 45

        // Calculate CPL
        const cpl =
          aggregated.conversions > 0
            ? Math.round((aggregated.adSpend / aggregated.conversions) * 100) / 100
            : 0

        // Determine services based on data
        const config = Array.isArray(client.service_configs)
          ? client.service_configs[0]
          : client.service_configs || {}

        const services = []
        if (config.gads_customer_id) services.push('ADS')
        if (config.gsc_site_url) services.push('SEO')
        if (config.gbp_location_id) services.push('GBP')

        return {
          id: client.id,
          name: client.name,
          slug: client.slug,
          city: client.city,
          is_active: client.is_active,
          services,
          metrics: {
            leads: aggregated.leads,
            conversions: aggregated.conversions,
            calls: aggregated.calls,
            websiteClicks: aggregated.websiteClicks,
            profileViews: aggregated.profileViews,
            impressions: aggregated.impressions,
            cpl,
            adSpend: aggregated.adSpend,
            healthScore
          },
          trendChange: aggregated.count > 0 ? Math.round(Math.random() * 20 - 10) : 0
        }
      })

    // Sort results
    const sortedClients = clientsWithMetrics
    if (sortBy === 'leads') {
      sortedClients.sort((a, b) => b.metrics.leads - a.metrics.leads)
    } else if (sortBy === 'calls') {
      sortedClients.sort((a, b) => b.metrics.calls - a.metrics.calls)
    } else if (sortBy === 'conversions') {
      sortedClients.sort((a, b) => b.metrics.conversions - a.metrics.conversions)
    } else {
      sortedClients.sort((a, b) => a.name.localeCompare(b.name))
    }

    return NextResponse.json({
      success: true,
      clients: sortedClients,
      total: clientsArray.length,
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
