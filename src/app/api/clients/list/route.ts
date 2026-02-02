import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    console.log('[clients/list] Date range params:', { dateFromParam, dateToParam })

    // Parallel fetch: clients and metrics at the same time for better performance
    const [clientsResult, metricsResult, gbpMetricsResult] = await Promise.all([
      // Fetch all clients (active and inactive) with their service configurations
      supabaseAdmin
        .from('clients')
        .select(`
          id,
          name,
          slug,
          city,
          contact_email,
          is_active,
          service_configs (
            ga_property_id,
            gads_customer_id,
            gbp_location_id,
            gsc_site_url,
            callrail_account_id
          )
        `)
        .order('name', { ascending: true }),

      // Fetch metrics with date range filter (for leads, forms, ads)
      (() => {
        let query = supabaseAdmin
          .from('client_metrics_summary')
          .select('client_id, total_leads, form_fills, google_ads_conversions, cpl, date')

        if (dateFromParam) {
          query = query.gte('date', dateFromParam)
        }
        if (dateToParam) {
          query = query.lte('date', dateToParam)
        }

        return query
      })(),

      // Fetch GBP phone calls from gbp_location_daily_metrics table
      (() => {
        let query = supabaseAdmin
          .from('gbp_location_daily_metrics')
          .select('client_id, phone_calls, date')

        if (dateFromParam) {
          query = query.gte('date', dateFromParam)
        }
        if (dateToParam) {
          query = query.lte('date', dateToParam)
        }

        return query
      })()
    ])

    const { data: clients, error } = clientsResult
    const { data: metrics, error: metricsError } = metricsResult
    const { data: gbpMetrics, error: gbpError } = gbpMetricsResult

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError)
    }

    if (gbpError) {
      console.error('Error fetching GBP metrics:', gbpError)
    }

    console.log('[clients/list] Metrics fetched:', metrics?.length, 'records')
    console.log('[clients/list] GBP metrics fetched:', gbpMetrics?.length, 'records')
    if (gbpMetrics && gbpMetrics.length > 0) {
      const gbpSample = gbpMetrics.filter((m: any) => m.phone_calls && m.phone_calls > 0)
      console.log('[clients/list] Records with phone calls:', gbpSample.length)
      console.log('[clients/list] Sample GBP records:', gbpSample.slice(0, 3))
    }

    // Build optimized metrics map with aggregation
    const metricsMap: { [key: string]: any } = {}
    ;(metrics || []).forEach((metric: any) => {
      if (!metricsMap[metric.client_id]) {
        metricsMap[metric.client_id] = {
          total_leads: 0,
          seo_form_submits: 0,
          gbp_calls: 0,
          ads_conversions: 0,
          ads_cpl: 0,
          ads_cpl_count: 0
        }
      }
      metricsMap[metric.client_id].total_leads += metric.total_leads || 0
      metricsMap[metric.client_id].seo_form_submits += metric.form_fills || 0
      metricsMap[metric.client_id].ads_conversions += metric.google_ads_conversions || 0
      // Track CPL average (sum of CPL values and count)
      if (metric.cpl && metric.cpl > 0) {
        metricsMap[metric.client_id].ads_cpl += metric.cpl
        metricsMap[metric.client_id].ads_cpl_count += 1
      }
    })

    // Add GBP phone calls from gbp_location_daily_metrics table
    ;(gbpMetrics || []).forEach((gbpMetric: any) => {
      if (!metricsMap[gbpMetric.client_id]) {
        metricsMap[gbpMetric.client_id] = {
          total_leads: 0,
          seo_form_submits: 0,
          gbp_calls: 0,
          ads_conversions: 0,
          ads_cpl: 0,
          ads_cpl_count: 0
        }
      }
      metricsMap[gbpMetric.client_id].gbp_calls += gbpMetric.phone_calls || 0
    })

    // Process clients to determine which services they have
    const clientsWithServices = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      const hasGoogleAds = !!(config.gads_customer_id && config.gads_customer_id.trim())
      const hasSeo = !!(config.gsc_site_url && config.gsc_site_url.trim())

      // Debug: Log first few clients
      if (clients.indexOf(client) < 3) {
        console.log(`[API] Client: ${client.name}`, {
          gads_customer_id: config.gads_customer_id,
          hasGoogleAds,
          gsc_site_url: config.gsc_site_url,
          hasSeo
        })
      }

      const clientMetrics = metricsMap[client.id] || {
        total_leads: 0,
        seo_form_submits: 0,
        gbp_calls: 0,
        ads_conversions: 0,
        ads_cpl: 0,
        ads_cpl_count: 0
      }

      // Calculate average CPL if we have data
      const avgCpl = clientMetrics.ads_cpl_count > 0
        ? clientMetrics.ads_cpl / clientMetrics.ads_cpl_count
        : 0

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        city: client.city,
        contact_email: client.contact_email,
        is_active: client.is_active,
        total_leads: clientMetrics.total_leads,
        seo_form_submits: clientMetrics.seo_form_submits,
        gbp_calls: clientMetrics.gbp_calls,
        ads_conversions: clientMetrics.ads_conversions,
        ads_cpl: avgCpl,
        services: {
          googleAds: hasGoogleAds,
          seo: hasSeo,
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false,
        }
      }
    })

    // Log service distribution for debugging
    const serviceDistribution = {
      total: clientsWithServices.length,
      withAds: clientsWithServices.filter((c: any) => c.services.googleAds).length,
      withSeo: clientsWithServices.filter((c: any) => c.services.seo).length,
      withBoth: clientsWithServices.filter((c: any) => c.services.googleAds && c.services.seo).length,
      adsOnly: clientsWithServices.filter((c: any) => c.services.googleAds && !c.services.seo).length,
      seoOnly: clientsWithServices.filter((c: any) => c.services.seo && !c.services.googleAds).length,
      neither: clientsWithServices.filter((c: any) => !c.services.googleAds && !c.services.seo).length,
    }
    console.log('[API] Service distribution:', serviceDistribution)

    // Log ALL clients with their service flags for detailed debugging
    console.log('[API] Full service config list:')
    clientsWithServices.forEach((c: any) => {
      console.log(`  ${c.name}: googleAds=${c.services.googleAds}, seo=${c.services.seo}`)
    })

    // Return with cache headers
    // Don't cache when date range is specified (usually for filtered views)
    // Cache only for full date range requests
    const response = NextResponse.json({ success: true, clients: clientsWithServices })
    if (!dateFromParam || !dateToParam) {
      // Cache for 5 minutes for default requests
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    } else {
      // No cache for filtered date ranges (for real-time data)
      response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
    }
    return response
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
