import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/discover-all-properties
 * Auto-discover GA4 properties and GSC sites for ALL clients
 * Maps discovered properties to clients based on website URL matching
 */
export async function GET(request: NextRequest) {
  try {
    // Get session for OAuth token
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string } } | null;
    const accessToken = session?.user?.accessToken;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No OAuth access token available',
        message: 'Please sign in with Google OAuth to discover properties'
      }, { status: 401 });
    }

    console.log('[DiscoverAll] Starting property discovery for all clients...');

    // Get all clients with their current service configs
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          ga_property_id,
          gsc_site_url,
          gads_customer_id
        )
      `);

    if (clientsError || !clients) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch clients',
        details: clientsError?.message
      }, { status: 500 });
    }

    console.log(`[DiscoverAll] Found ${clients.length} clients`);

    // 1. Discover all GA4 Properties
    // First try Admin API, then fallback to testing known property IDs from database
    const gaProperties: Array<{ id: string; displayName: string; websiteUrl?: string }> = [];

    // Try Admin API first
    let adminApiWorked = false;
    try {
      console.log('[DiscoverAll] Fetching GA4 properties via Admin API...');
      const gaResponse = await fetch(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (gaResponse.ok) {
        adminApiWorked = true;
        const gaData = await gaResponse.json();
        if (gaData.accountSummaries) {
          for (const account of gaData.accountSummaries) {
            if (account.propertySummaries) {
              for (const property of account.propertySummaries) {
                const propertyId = property.property.replace('properties/', '');
                const propEntry: { id: string; displayName: string; websiteUrl?: string } = {
                  id: propertyId,
                  displayName: property.displayName,
                };

                // Fetch data streams to get website URL
                try {
                  const streamsResponse = await fetch(
                    `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                      },
                    }
                  );

                  if (streamsResponse.ok) {
                    const streamsData = await streamsResponse.json();
                    const webStream = streamsData.dataStreams?.find(
                      (s: any) => s.type === 'WEB_DATA_STREAM' && s.webStreamData?.defaultUri
                    );
                    if (webStream) {
                      propEntry.websiteUrl = webStream.webStreamData.defaultUri;
                    }
                  }
                } catch (e) {
                  // Ignore stream fetch errors
                }

                gaProperties.push(propEntry);
                console.log(`[DiscoverAll] Found GA4: ${property.displayName} (${propertyId}) - ${propEntry.websiteUrl || 'no website'}`);
              }
            }
          }
        }
      } else {
        const errorText = await gaResponse.text();
        console.error('[DiscoverAll] GA4 Admin API error:', gaResponse.status);
        console.log('[DiscoverAll] Will try alternative discovery method...');
      }
    } catch (error) {
      console.error('[DiscoverAll] Error fetching GA4 properties:', error);
    }

    // If Admin API failed (403), try alternative: test existing property IDs from database
    if (!adminApiWorked) {
      console.log('[DiscoverAll] Using alternative GA4 discovery via Data API...');

      // Get all existing GA property IDs from database
      const { data: existingConfigs } = await supabaseAdmin
        .from('service_configs')
        .select('ga_property_id, client_id')
        .not('ga_property_id', 'is', null);

      const testedPropertyIds = new Set<string>();

      if (existingConfigs) {
        for (const config of existingConfigs) {
          if (config.ga_property_id && !testedPropertyIds.has(config.ga_property_id)) {
            testedPropertyIds.add(config.ga_property_id);

            // Test if we have access via Data API metadata
            try {
              const metadataResponse = await fetch(
                `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga_property_id}/metadata`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );

              if (metadataResponse.ok) {
                gaProperties.push({
                  id: config.ga_property_id,
                  displayName: `Property ${config.ga_property_id}`,
                });
                console.log(`[DiscoverAll] Verified GA4 access: ${config.ga_property_id}`);
              }
            } catch (e) {
              // No access to this property
            }
          }
        }
      }

      // Also try common property patterns or hardcoded known properties
      // For now, we'll rely on GSC domain matching for discovery
      console.log(`[DiscoverAll] Found ${gaProperties.length} accessible GA4 properties from existing configs`);
    }

    // 2. Discover all GSC Sites
    const gscSites: Array<{ siteUrl: string; permissionLevel: string }> = [];
    try {
      console.log('[DiscoverAll] Fetching GSC sites...');
      const gscResponse = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (gscResponse.ok) {
        const gscData = await gscResponse.json();
        if (gscData.siteEntry) {
          for (const site of gscData.siteEntry) {
            gscSites.push({
              siteUrl: site.siteUrl,
              permissionLevel: site.permissionLevel,
            });
            console.log(`[DiscoverAll] Found GSC: ${site.siteUrl}`);
          }
        }
      } else {
        console.error('[DiscoverAll] GSC API error:', await gscResponse.text());
      }
    } catch (error) {
      console.error('[DiscoverAll] Error fetching GSC sites:', error);
    }

    // 3. Discover Google Ads accounts
    const adsAccounts: Array<{ customerId: string; descriptiveName: string }> = [];
    try {
      console.log('[DiscoverAll] Fetching Google Ads accounts...');
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

      if (developerToken) {
        const adsResponse = await fetch(
          'https://googleads.googleapis.com/v20/customers:listAccessibleCustomers',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': developerToken,
            },
          }
        );

        if (adsResponse.ok) {
          const adsData = await adsResponse.json();
          if (adsData.resourceNames) {
            for (const resourceName of adsData.resourceNames) {
              const customerId = resourceName.replace('customers/', '');
              adsAccounts.push({
                customerId,
                descriptiveName: customerId,
              });
              console.log(`[DiscoverAll] Found Ads: ${customerId}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[DiscoverAll] Error fetching Ads accounts:', error);
    }

    // 4. Match and update clients
    const results: Array<{
      clientName: string;
      clientSlug: string;
      matched: {
        ga?: string;
        gsc?: string;
        ads?: string;
      };
      updated: boolean;
    }> = [];

    for (const client of clients) {
      const matched: { ga?: string; gsc?: string; ads?: string } = {};

      // Get current service config from joined data
      const currentConfig = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs;

      // Match GA4 property by GSC URL domain (most reliable method)
      if (!currentConfig?.ga_property_id && currentConfig?.gsc_site_url) {
        const clientDomain = extractDomain(currentConfig.gsc_site_url);

        for (const property of gaProperties) {
          if (property.websiteUrl) {
            const propDomain = extractDomain(property.websiteUrl);
            if (clientDomain === propDomain) {
              matched.ga = property.id;
              console.log(`[DiscoverAll] Matched GA4 for ${client.name}: ${property.displayName} (${property.websiteUrl})`);
              break;
            }
          }
        }
      }

      // Fallback: Match GA4 by name similarity if no GSC URL match
      if (!matched.ga && !currentConfig?.ga_property_id) {
        const clientNameLower = client.name.toLowerCase();
        const clientSlugParts = client.slug.split('-');

        for (const property of gaProperties) {
          const propNameLower = property.displayName.toLowerCase();

          // Check if property name contains client name or slug parts
          if (
            propNameLower.includes(clientNameLower) ||
            clientNameLower.includes(propNameLower) ||
            clientSlugParts.some((part: string) => part.length > 3 && propNameLower.includes(part))
          ) {
            matched.ga = property.id;
            console.log(`[DiscoverAll] Matched GA4 (by name) for ${client.name}: ${property.displayName}`);
            break;
          }
        }
      }

      // Match GSC site by existing GSC URL domain or client name
      if (!currentConfig?.gsc_site_url) {
        const clientNameLower = client.name.toLowerCase();
        const clientSlugClean = client.slug.replace(/-/g, '');

        for (const site of gscSites) {
          const siteDomain = extractDomain(site.siteUrl);
          const siteDomainClean = siteDomain.replace(/\./g, '').replace(/-/g, '');

          // Check if site domain contains client name parts
          if (
            siteDomainClean.includes(clientSlugClean) ||
            clientSlugClean.includes(siteDomainClean.replace('chiro', '').replace('chiropractic', ''))
          ) {
            matched.gsc = site.siteUrl;
            console.log(`[DiscoverAll] Matched GSC for ${client.name}: ${site.siteUrl}`);
            break;
          }
        }
      }

      // Update database if we found matches
      if (matched.ga || matched.gsc || matched.ads) {
        const updateData: Record<string, string> = {};
        if (matched.ga) updateData.ga_property_id = matched.ga;
        if (matched.gsc) updateData.gsc_site_url = matched.gsc;
        if (matched.ads) updateData.gads_customer_id = matched.ads;

        if (currentConfig) {
          // Update existing config
          const { error } = await supabaseAdmin
            .from('service_configs')
            .update(updateData)
            .eq('client_id', client.id);

          if (error) {
            console.error(`[DiscoverAll] Error updating ${client.name}:`, error);
          }
        } else {
          // Insert new config
          const { error } = await supabaseAdmin
            .from('service_configs')
            .insert({
              client_id: client.id,
              ...updateData,
            });

          if (error) {
            console.error(`[DiscoverAll] Error inserting ${client.name}:`, error);
          }
        }

        results.push({
          clientName: client.name,
          clientSlug: client.slug,
          matched,
          updated: true,
        });
      } else {
        results.push({
          clientName: client.name,
          clientSlug: client.slug,
          matched: {},
          updated: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      discovered: {
        gaProperties: gaProperties.length,
        gscSites: gscSites.length,
        adsAccounts: adsAccounts.length,
      },
      results,
      summary: {
        totalClients: clients.length,
        clientsUpdated: results.filter(r => r.updated).length,
      },
    });

  } catch (error: any) {
    console.error('[DiscoverAll] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to discover properties',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extract domain from URL for matching
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0].toLowerCase();
  }
}
