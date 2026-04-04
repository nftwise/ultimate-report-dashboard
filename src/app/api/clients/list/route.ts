import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    // Parallel fetch: clients and metrics at the same time for better performance
    const [clientsResult, metricsResult, gbpLocResult] = await Promise.all([
      // Fetch clients — admin sees all, client role sees only their own
      (() => {
        let query = supabaseAdmin
          .from('clients')
          .select(`
          id,
          name,
          slug,
          city,
          contact_email,
          notes,
          is_active,
          service_configs (
            ga_property_id,
            gads_customer_id,
            gsc_site_url,
            callrail_account_id
          )
        `)
        .order('name', { ascending: true })
        if (session.user.role === 'client' && session.user.clientId) {
          query = query.eq('id', session.user.clientId)
        }
        return query
      })(),

      // Fetch metrics with date range filter (for leads, forms, ads, and GBP calls).
      // gbp_calls in client_metrics_summary is already aggregated correctly per day —
      // reading from the raw gbp_location_daily_metrics without a date filter would
      // sum all historical data and massively overcount.
      (() => {
        let query = supabaseAdmin
          .from('client_metrics_summary')
          .select('client_id, total_leads, form_fills, google_ads_conversions, gbp_calls, cpl, date')

        if (dateFromParam) {
          query = query.gte('date', dateFromParam)
        }
        if (dateToParam) {
          query = query.lte('date', dateToParam)
        }

        return query
      })(),

      // Fetch active GBP location client_ids
      supabaseAdmin
        .from('gbp_locations')
        .select('client_id')
        .eq('is_active', true),
    ])

    const { data: clients, error } = clientsResult
    const { data: metrics, error: metricsError } = metricsResult
    const { data: gbpLocRows } = gbpLocResult
    const gbpSet = new Set<string>((gbpLocRows || []).map((r: any) => r.client_id))

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError)
    }

    // Build optimized metrics map with aggregation.
    // gbp_calls comes from client_metrics_summary (already correctly aggregated per day)
    // to avoid overcounting from the raw gbp_location_daily_metrics table.
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
      metricsMap[metric.client_id].gbp_calls += metric.gbp_calls || 0
      // Track CPL average (sum of CPL values and count)
      if (metric.cpl && metric.cpl > 0) {
        metricsMap[metric.client_id].ads_cpl += metric.cpl
        metricsMap[metric.client_id].ads_cpl_count += 1
      }
    })

    // Process clients to determine which services they have
    const clientsWithServices = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      const hasGoogleAds = !!(config.gads_customer_id && config.gads_customer_id.trim())
      const hasSeo = !!(config.gsc_site_url && config.gsc_site_url.trim())

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
        notes: client.notes || null,
        is_active: client.is_active,
        total_leads: clientMetrics.total_leads,
        seo_form_submits: clientMetrics.seo_form_submits,
        gbp_calls: clientMetrics.gbp_calls,
        ads_conversions: clientMetrics.ads_conversions,
        ads_cpl: avgCpl,
        services: {
          googleAds: hasGoogleAds,
          seo: hasSeo,
          googleLocalService: gbpSet.has(client.id),
          fbAds: false,
        }
      }
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
