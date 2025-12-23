import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/clients-list
 * FAST endpoint - returns just the client list with service configs (no metrics)
 * This allows the UI to render immediately while metrics load separately
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Fetch all clients with their service configs in ONE query (super fast ~100ms)
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
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

    if (clientsError) {
      console.error('[Clients List] Error fetching clients:', clientsError)
      return NextResponse.json({ success: false, error: clientsError.message }, { status: 500 })
    }

    // Process clients and return with service flags
    const clientsData = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      // OPTIMIZED: Only return fields actually used in the admin table
      // REMOVED: traffic (not displayed anywhere)
      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        services: {
          googleAds: !!(config.gads_customer_id && config.gads_customer_id.trim()),
          seo: !!(config.gsc_site_url && config.gsc_site_url.trim()),
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false,
        },
        // Placeholder values - will be populated by metrics endpoint
        googleAdsConversions: null,
        formFills: null,
        adSpend: null,
        cpl: null,
        googleRank: null,
        topKeywords: null,
        totalLeads: null,
      }
    })

    const duration = Date.now() - startTime
    console.log(`⚡ [Clients List] Returned ${clientsData.length} clients in ${duration}ms`)

    return NextResponse.json({
      success: true,
      clients: clientsData,
      duration
    })

  } catch (error: any) {
    console.error('[Clients List] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
