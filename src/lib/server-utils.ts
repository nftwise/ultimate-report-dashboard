import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase';

export async function getClientConfig(clientId: string): Promise<any | null> {
  try {
    // Try database first (new approach)
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        slug,
        name,
        contact_email,
        city,
        owner,
        is_active,
        service_configs (
          ga_property_id,
          gads_customer_id,
          gsc_site_url,
          callrail_account_id,
          gbp_location_id
        )
      `)
      .eq('slug', clientId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.log(`[getClientConfig] Database query error for ${clientId}:`, error.message);
    }

    if (!error && client) {
      // Transform database format to match JSON format for backwards compatibility
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs || {};

      console.log(`[getClientConfig] Found client ${clientId} in database with GA: ${config?.ga_property_id || 'none'}`);

      return {
        id: client.slug,
        uuid: client.id,
        email: client.contact_email,
        companyName: client.name,
        owner: client.owner || '',
        city: client.city || '',
        googleAnalyticsPropertyId: config.ga_property_id || '',
        googleAdsCustomerId: config.gads_customer_id || '',
        googleAdsMccId: '8432700368', // Default MCC ID
        searchConsoleSiteUrl: config.gsc_site_url || '',
        callrailAccountId: config.callrail_account_id || '',
        gbpLocationId: config.gbp_location_id || ''
      };
    }

    // Fallback to JSON file (for backwards compatibility during migration)
    console.log(`[getClientConfig] Client ${clientId} not found in database, trying JSON fallback...`);
    const filePath = path.join(process.cwd(), 'src', 'data', 'clients.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const clientsData = JSON.parse(fileContents);

    const jsonClient = clientsData.clients.find((c: any) => c.id === clientId);
    return jsonClient || null;
  } catch (error) {
    console.error('Error reading client config:', error);
    return null;
  }
}