import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch comprehensive GBP and Google Ads data analysis
    const { data: gbpAnalysis, error: gbpError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, gbp_calls')
      .order('date', { ascending: true })

    if (gbpError) {
      return NextResponse.json({ success: false, error: gbpError.message }, { status: 500 })
    }

    // Fetch Google Ads data
    const { data: adsAnalysis, error: adsError } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('client_id, date, google_ads_conversions, ads_impressions, ads_clicks')
      .order('date', { ascending: true })

    if (adsError) {
      return NextResponse.json({ success: false, error: adsError.message }, { status: 500 })
    }

    // Fetch client names for mapping
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, slug')

    if (clientError) {
      return NextResponse.json({ success: false, error: clientError.message }, { status: 500 })
    }

    // Build client name map
    const clientMap: { [key: string]: { name: string; slug: string } } = {}
    ;(clients || []).forEach((client: any) => {
      clientMap[client.id] = { name: client.name, slug: client.slug }
    })

    // Analyze GBP data
    const gbpStats = {
      total_records: gbpAnalysis?.length || 0,
      records_with_data: 0,
      records_without_data: 0,
      earliest_date: null as string | null,
      latest_date: null as string | null,
      total_gbp_calls: 0,
      clients_with_gbp: new Set<string>(),
      clients_without_gbp: new Set<string>(),
      gbp_by_client: {} as { [key: string]: { has_data: boolean; records: number; total_calls: number; date_range: { min: string; max: string } } }
    }

    const gbpByClient: { [key: string]: { records: number; total: number; dates: string[] } } = {}

    ;(gbpAnalysis || []).forEach((record: any) => {
      if (!gbpByClient[record.client_id]) {
        gbpByClient[record.client_id] = { records: 0, total: 0, dates: [] }
      }
      gbpByClient[record.client_id].records++
      gbpByClient[record.client_id].total += record.gbp_calls || 0
      gbpByClient[record.client_id].dates.push(record.date)

      if (record.gbp_calls && record.gbp_calls > 0) {
        gbpStats.records_with_data++
        gbpStats.clients_with_gbp.add(record.client_id)
        gbpStats.total_gbp_calls += record.gbp_calls
      } else {
        gbpStats.records_without_data++
        gbpStats.clients_without_gbp.add(record.client_id)
      }

      if (!gbpStats.earliest_date || record.date < gbpStats.earliest_date) {
        gbpStats.earliest_date = record.date
      }
      if (!gbpStats.latest_date || record.date > gbpStats.latest_date) {
        gbpStats.latest_date = record.date
      }
    })

    // Build GBP by client summary
    Object.entries(gbpByClient).forEach(([clientId, data]) => {
      const clientName = clientMap[clientId]?.name || clientId
      gbpStats.gbp_by_client[clientName] = {
        has_data: data.total > 0,
        records: data.records,
        total_calls: data.total,
        date_range: {
          min: data.dates.sort()[0],
          max: data.dates.sort().reverse()[0]
        }
      }
    })

    // Analyze Google Ads data
    const adsStats = {
      total_records: adsAnalysis?.length || 0,
      records_with_conversions: 0,
      records_with_impressions: 0,
      records_with_clicks: 0,
      earliest_date: null as string | null,
      latest_date: null as string | null,
      total_conversions: 0,
      total_impressions: 0,
      total_clicks: 0,
      clients_with_ads: new Set<string>(),
      ads_by_client: {} as { [key: string]: { conversions: number; impressions: number; clicks: number; date_range: { min: string; max: string } } }
    }

    const adsByClient: { [key: string]: { conversions: number; impressions: number; clicks: number; dates: string[] } } = {}

    ;(adsAnalysis || []).forEach((record: any) => {
      if (!adsByClient[record.client_id]) {
        adsByClient[record.client_id] = { conversions: 0, impressions: 0, clicks: 0, dates: [] }
      }
      adsByClient[record.client_id].conversions += record.google_ads_conversions || 0
      adsByClient[record.client_id].impressions += record.ads_impressions || 0
      adsByClient[record.client_id].clicks += record.ads_clicks || 0
      adsByClient[record.client_id].dates.push(record.date)

      if (record.google_ads_conversions && record.google_ads_conversions > 0) {
        adsStats.records_with_conversions++
      }
      if (record.ads_impressions && record.ads_impressions > 0) {
        adsStats.records_with_impressions++
      }
      if (record.ads_clicks && record.ads_clicks > 0) {
        adsStats.records_with_clicks++
      }

      if (record.google_ads_conversions > 0 || record.ads_impressions > 0 || record.ads_clicks > 0) {
        adsStats.clients_with_ads.add(record.client_id)
      }

      adsStats.total_conversions += record.google_ads_conversions || 0
      adsStats.total_impressions += record.ads_impressions || 0
      adsStats.total_clicks += record.ads_clicks || 0

      if (!adsStats.earliest_date || record.date < adsStats.earliest_date) {
        adsStats.earliest_date = record.date
      }
      if (!adsStats.latest_date || record.date > adsStats.latest_date) {
        adsStats.latest_date = record.date
      }
    })

    // Build Ads by client summary
    Object.entries(adsByClient).forEach(([clientId, data]) => {
      const clientName = clientMap[clientId]?.name || clientId
      adsStats.ads_by_client[clientName] = {
        conversions: data.conversions,
        impressions: data.impressions,
        clicks: data.clicks,
        date_range: {
          min: data.dates.sort()[0],
          max: data.dates.sort().reverse()[0]
        }
      }
    })

    return NextResponse.json({
      success: true,
      gbp: {
        summary: {
          total_clients: clients?.length || 0,
          clients_with_gbp_data: gbpStats.clients_with_gbp.size,
          clients_without_gbp_data: gbpStats.clients_without_gbp.size,
          total_records: gbpStats.total_records,
          records_with_data: gbpStats.records_with_data,
          records_without_data: gbpStats.records_without_data,
          percent_records_with_data: gbpStats.total_records > 0 ? ((gbpStats.records_with_data / gbpStats.total_records) * 100).toFixed(2) : '0',
          total_gbp_calls: gbpStats.total_gbp_calls,
          date_range: {
            earliest: gbpStats.earliest_date,
            latest: gbpStats.latest_date
          }
        },
        by_client: gbpStats.gbp_by_client
      },
      ads: {
        summary: {
          total_clients: clients?.length || 0,
          clients_with_ads_data: adsStats.clients_with_ads.size,
          total_records: adsStats.total_records,
          records_with_conversions: adsStats.records_with_conversions,
          records_with_impressions: adsStats.records_with_impressions,
          records_with_clicks: adsStats.records_with_clicks,
          percent_records_with_conversions: adsStats.total_records > 0 ? ((adsStats.records_with_conversions / adsStats.total_records) * 100).toFixed(2) : '0',
          percent_records_with_impressions: adsStats.total_records > 0 ? ((adsStats.records_with_impressions / adsStats.total_records) * 100).toFixed(2) : '0',
          total_conversions: adsStats.total_conversions,
          total_impressions: adsStats.total_impressions,
          total_clicks: adsStats.total_clicks,
          date_range: {
            earliest: adsStats.earliest_date,
            latest: adsStats.latest_date
          }
        },
        by_client: adsStats.ads_by_client
      }
    })
  } catch (error: any) {
    console.error('Error analyzing GBP/Ads data:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze data' },
      { status: 500 }
    )
  }
}
