import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Fetch ALL clients (active and inactive) with their service configurations
    const { data: clients, error } = await supabaseAdmin
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
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Get metrics for last 30 days (standard leads/ads/seo)
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - 30)
    const dateFromStr = dateFrom.toISOString().split('T')[0]

    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, total_leads, form_fills, gbp_calls, google_ads_conversions')
      .gte('date', dateFromStr)

    // Get ALL GBP data (not limited by date, since it may have been backfilled)
    const { data: gbpMetrics, error: gbpError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, gbp_calls')
      .gt('gbp_calls', 0)

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError)
    }

    if (gbpError) {
      console.error('Error fetching GBP metrics:', gbpError)
    }

    // Build metrics map (30-day data)
    const metricsMap: { [key: string]: any } = {}
    ;(metrics || []).forEach((metric: any) => {
      if (!metricsMap[metric.client_id]) {
        metricsMap[metric.client_id] = {
          total_leads: 0,
          seo_form_submits: 0,
          gbp_calls: 0,
          ads_conversions: 0
        }
      }
      metricsMap[metric.client_id].total_leads += metric.total_leads || 0
      metricsMap[metric.client_id].seo_form_submits += metric.form_fills || 0
      metricsMap[metric.client_id].gbp_calls += metric.gbp_calls || 0
      metricsMap[metric.client_id].ads_conversions += metric.google_ads_conversions || 0
    })

    // Add GBP data from all time (not just 30 days)
    ;(gbpMetrics || []).forEach((metric: any) => {
      if (!metricsMap[metric.client_id]) {
        metricsMap[metric.client_id] = {
          total_leads: 0,
          seo_form_submits: 0,
          gbp_calls: 0,
          ads_conversions: 0
        }
      }
      metricsMap[metric.client_id].gbp_calls += metric.gbp_calls || 0
    })

    // Process clients to determine which services they have
    const clientsWithServices = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      const clientMetrics = metricsMap[client.id] || {
        total_leads: 0,
        seo_form_submits: 0,
        gbp_calls: 0,
        ads_conversions: 0
      }

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
        services: {
          googleAds: !!(config.gads_customer_id && config.gads_customer_id.trim()),
          seo: !!(config.gsc_site_url && config.gsc_site_url.trim()),
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false,
        }
      }
    })

    return NextResponse.json({
      success: true,
      total: clientsWithServices.length,
      active: clientsWithServices.filter(c => c.is_active).length,
      inactive: clientsWithServices.filter(c => !c.is_active).length,
      clients: clientsWithServices
    })
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
