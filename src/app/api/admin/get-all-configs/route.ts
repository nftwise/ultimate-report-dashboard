import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all active clients with their service configs
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gsc_site_url,
          gbp_location_id
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Flatten the service_configs into the client object
    const flattenedClients = clients?.map(client => {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs;

      return {
        id: client.id,
        name: client.name,
        slug: client.slug,
        ga_property_id: config?.ga_property_id || '',
        gads_customer_id: config?.gads_customer_id || '',
        gsc_site_url: config?.gsc_site_url || '',
        gbp_location_id: config?.gbp_location_id || ''
      };
    }) || [];

    return NextResponse.json({
      success: true,
      clients: flattenedClients
    });

  } catch (error: any) {
    console.error('Error fetching client configs:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
