import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Fetch all active clients with their service configurations (if any)
    // Using left join to include clients even without service_configs
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
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
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Process clients to determine which services they have
    const clientsWithServices = (clients || []).map((client: any) => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {}

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        contact_email: client.contact_email,
        is_active: client.is_active,
        services: {
          googleAds: !!(config.gads_customer_id && config.gads_customer_id.trim()),
          seo: !!(config.gsc_site_url && config.gsc_site_url.trim()),
          googleLocalService: !!(config.gbp_location_id && config.gbp_location_id.trim()),
          fbAds: false, // Will need to add fb_ads_account_id to service_configs table
        }
      }
    })

    return NextResponse.json({ success: true, clients: clientsWithServices })
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
