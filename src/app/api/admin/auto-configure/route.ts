import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Normalize name for matching
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/chiropractic/g, 'chiro')
    .replace(/physical medicine/g, 'physmed')
    .replace(/wellness/g, 'well')
    .replace(/center/g, 'ctr')
    .replace(/centre/g, 'ctr');
};

// Calculate similarity score
const getSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);

  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

  // Simple word overlap
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const overlap = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

  return overlap.length / Math.max(words1.length, words2.length);
};

export async function GET(request: NextRequest) {
  try {
    // Get session to access OAuth token
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string; role?: string } } | null;

    if (!session?.user?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No access token. Please sign out and sign in again with Google to grant permissions.'
      }, { status: 401 });
    }

    // Get all active clients with their service configs
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          id,
          ga_property_id,
          gads_customer_id
        )
      `)
      .eq('is_active', true);

    if (clientsError) {
      return NextResponse.json({ success: false, error: clientsError.message }, { status: 500 });
    }

    // Filter clients that need configuration:
    // - No service_configs at all
    // - Or service_configs with empty/null ga_property_id
    const unconfiguredClients = clients?.filter(c => {
      if (!c.service_configs || c.service_configs.length === 0) return true;
      const config = Array.isArray(c.service_configs) ? c.service_configs[0] : c.service_configs;
      return !config.ga_property_id || config.ga_property_id.trim() === '';
    }) || [];

    console.log(`[Auto-Configure] Found ${clients?.length || 0} total clients, ${unconfiguredClients.length} need configuration`);

    // Create OAuth2 client with the user's access token
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: session.user.accessToken });

    // Get GA4 properties using the Admin API with user's OAuth token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client as any });

    const gaProperties: any[] = [];
    let gaError: string | null = null;
    try {
      console.log('[Auto-Configure] Fetching GA accounts with OAuth token...');
      const accountsResponse = await analyticsAdmin.accounts.list();
      const accounts = accountsResponse.data.accounts || [];
      console.log(`[Auto-Configure] Found ${accounts.length} GA accounts`);

      for (const account of accounts) {
        console.log(`[Auto-Configure] Fetching properties for account: ${account.displayName}`);
        const propsResponse = await analyticsAdmin.properties.list({
          filter: `parent:${account.name}`
        });

        const props = propsResponse.data.properties || [];
        console.log(`[Auto-Configure] Found ${props.length} properties in ${account.displayName}`);
        gaProperties.push(...props.map(p => ({
          propertyId: p.name?.replace('properties/', ''),
          displayName: p.displayName,
          account: account.displayName
        })));
      }
    } catch (err: any) {
      gaError = err.message;
      console.error('[Auto-Configure] Error fetching GA properties:', err.message);
    }

    // Get Google Ads customers using the user's access token
    const adsCustomers: any[] = [];
    let adsError: string | null = null;
    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

      if (developerToken) {
        console.log('[Auto-Configure] Fetching Ads customers with OAuth token...');

        // List accessible customers
        const customersResponse = await fetch(
          `https://googleads.googleapis.com/v14/customers:listAccessibleCustomers`,
          {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
              'developer-token': developerToken,
              'Content-Type': 'application/json'
            }
          }
        );
        const customersData = await customersResponse.json();

        if (customersData.error) {
          throw new Error(customersData.error.message);
        }

        console.log(`[Auto-Configure] Found ${customersData.resourceNames?.length || 0} accessible customers`);

        // Get details for each customer
        for (const resourceName of (customersData.resourceNames || [])) {
          const customerId = resourceName.replace('customers/', '');

          try {
            const detailResponse = await fetch(
              `https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:searchStream`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.user.accessToken}`,
                  'developer-token': developerToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  query: `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`
                })
              }
            );
            const detailData = await detailResponse.json();

            if (detailData[0]?.results?.[0]?.customer) {
              adsCustomers.push({
                customerId: detailData[0].results[0].customer.id,
                name: detailData[0].results[0].customer.descriptiveName
              });
            }
          } catch (err) {
            console.error(`Error fetching customer ${customerId}:`, err);
          }
        }
      } else {
        adsError = 'Missing GOOGLE_ADS_DEVELOPER_TOKEN';
      }
    } catch (err: any) {
      adsError = err.message;
      console.error('[Auto-Configure] Error fetching Ads customers:', err.message);
    }

    // Auto-match clients to GA properties and Ads customers
    const matches: any[] = [];

    for (const client of unconfiguredClients) {
      const match: any = {
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        gaMatch: null,
        adsMatch: null
      };

      // Find best GA match
      let bestGAScore = 0;
      for (const prop of gaProperties) {
        const score = getSimilarity(client.name, prop.displayName);
        if (score > bestGAScore && score >= 0.5) {
          bestGAScore = score;
          match.gaMatch = {
            propertyId: prop.propertyId,
            displayName: prop.displayName,
            score
          };
        }
      }

      // Find best Ads match
      let bestAdsScore = 0;
      for (const customer of adsCustomers) {
        const score = getSimilarity(client.name, customer.name);
        if (score > bestAdsScore && score >= 0.5) {
          bestAdsScore = score;
          match.adsMatch = {
            customerId: customer.customerId,
            name: customer.name,
            score
          };
        }
      }

      if (match.gaMatch || match.adsMatch) {
        matches.push(match);
      }
    }

    return NextResponse.json({
      success: true,
      unconfiguredClients: unconfiguredClients.length,
      gaPropertiesFound: gaProperties.length,
      adsCustomersFound: adsCustomers.length,
      matches,
      gaProperties,
      adsCustomers,
      errors: {
        ga: gaError,
        ads: adsError || (adsCustomers.length === 0 ? 'No Ads customers found' : null)
      },
      unconfiguredClientsList: unconfiguredClients.map(c => ({ id: c.id, name: c.name, slug: c.slug }))
    });

  } catch (error: any) {
    console.error('Auto-configure error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST to apply the configurations
export async function POST(request: Request) {
  try {
    const { configurations } = await request.json();

    if (!configurations || !Array.isArray(configurations)) {
      return NextResponse.json({
        success: false,
        error: 'configurations array is required'
      }, { status: 400 });
    }

    const results = [];

    for (const config of configurations) {
      const { clientId, gaPropertyId, gadsCustomerId, gscSiteUrl, gbpLocationId } = config;

      // Check if service_config already exists
      const { data: existing } = await supabaseAdmin
        .from('service_configs')
        .select('id')
        .eq('client_id', clientId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabaseAdmin
          .from('service_configs')
          .update({
            ga_property_id: gaPropertyId || null,
            gads_customer_id: gadsCustomerId || null,
            gsc_site_url: gscSiteUrl || null,
            gbp_location_id: gbpLocationId || null,
            updated_at: new Date().toISOString()
          })
          .eq('client_id', clientId);

        results.push({
          clientId,
          action: 'updated',
          success: !error,
          error: error?.message
        });
      } else {
        // Insert new
        const { error } = await supabaseAdmin
          .from('service_configs')
          .insert({
            client_id: clientId,
            ga_property_id: gaPropertyId || null,
            gads_customer_id: gadsCustomerId || null,
            gsc_site_url: gscSiteUrl || null,
            gbp_location_id: gbpLocationId || null,
            created_at: new Date().toISOString()
          });

        results.push({
          clientId,
          action: 'created',
          success: !error,
          error: error?.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Apply config error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
