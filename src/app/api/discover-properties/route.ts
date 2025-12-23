import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';

/**
 * GET /api/discover-properties
 * Auto-discover GA4 properties, Google Ads accounts, and Search Console sites
 * using the user's OAuth access token
 */
export async function GET(request: NextRequest) {
  try {
    // Get session for OAuth token
    const session = await getServerSession(authOptions) as { user?: { accessToken?: string; clientId?: string } } | null;
    const accessToken = session?.user?.accessToken;
    const clientId = session?.user?.clientId;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No OAuth access token available',
        message: 'Please sign in with Google OAuth to discover properties'
      }, { status: 401 });
    }

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'No client ID in session',
        message: 'User must be associated with a client'
      }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const saveToDb = searchParams.get('save') === 'true';

    console.log('[Discover] Starting property discovery for client:', clientId);
    console.log('[Discover] Will save to database:', saveToDb);

    // Initialize results
    const discovered: {
      gaProperties: Array<{ id: string; name: string; displayName: string }>;
      adsAccounts: Array<{ customerId: string; descriptiveName: string }>;
      searchConsoleSites: Array<{ siteUrl: string; permissionLevel: string }>;
    } = {
      gaProperties: [],
      adsAccounts: [],
      searchConsoleSites: [],
    };

    // 1. Discover GA4 Properties
    try {
      console.log('[Discover] Fetching GA4 properties...');
      const gaResponse = await fetch(
        'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (gaResponse.ok) {
        const gaData = await gaResponse.json();
        if (gaData.accountSummaries) {
          for (const account of gaData.accountSummaries) {
            if (account.propertySummaries) {
              for (const property of account.propertySummaries) {
                // Extract property ID from the resource name (e.g., "properties/123456")
                const propertyId = property.property.replace('properties/', '');
                discovered.gaProperties.push({
                  id: propertyId,
                  name: property.property,
                  displayName: property.displayName,
                });
                console.log(`[Discover] Found GA4 property: ${property.displayName} (${propertyId})`);
              }
            }
          }
        }
      } else {
        const errorText = await gaResponse.text();
        console.error('[Discover] GA4 API error:', gaResponse.status, errorText);
      }
    } catch (error) {
      console.error('[Discover] Error fetching GA4 properties:', error);
    }

    // 2. Discover Google Ads Accounts
    try {
      console.log('[Discover] Fetching Google Ads accounts...');
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

      if (developerToken) {
        // List accessible customers
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
              // Extract customer ID from resource name (e.g., "customers/1234567890")
              const customerId = resourceName.replace('customers/', '');

              // Get customer details
              try {
                const customerResponse = await fetch(
                  `https://googleads.googleapis.com/v20/${resourceName}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'developer-token': developerToken,
                    },
                  }
                );

                if (customerResponse.ok) {
                  const customerData = await customerResponse.json();
                  discovered.adsAccounts.push({
                    customerId,
                    descriptiveName: customerData.descriptiveName || customerId,
                  });
                  console.log(`[Discover] Found Ads account: ${customerData.descriptiveName || customerId}`);
                } else {
                  // Still add the account even if we can't get details
                  discovered.adsAccounts.push({
                    customerId,
                    descriptiveName: customerId,
                  });
                }
              } catch (e) {
                discovered.adsAccounts.push({
                  customerId,
                  descriptiveName: customerId,
                });
              }
            }
          }
        } else {
          const errorText = await adsResponse.text();
          console.error('[Discover] Google Ads API error:', adsResponse.status, errorText);
        }
      } else {
        console.log('[Discover] No developer token configured for Google Ads');
      }
    } catch (error) {
      console.error('[Discover] Error fetching Google Ads accounts:', error);
    }

    // 3. Discover Search Console Sites
    try {
      console.log('[Discover] Fetching Search Console sites...');
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
            discovered.searchConsoleSites.push({
              siteUrl: site.siteUrl,
              permissionLevel: site.permissionLevel,
            });
            console.log(`[Discover] Found GSC site: ${site.siteUrl}`);
          }
        }
      } else {
        const errorText = await gscResponse.text();
        console.error('[Discover] GSC API error:', gscResponse.status, errorText);
      }
    } catch (error) {
      console.error('[Discover] Error fetching Search Console sites:', error);
    }

    // Save to database if requested
    if (saveToDb && (discovered.gaProperties.length > 0 || discovered.adsAccounts.length > 0 || discovered.searchConsoleSites.length > 0)) {
      console.log('[Discover] Saving discovered properties to database...');

      // Determine which property to use (first one for each type)
      const updateData: Record<string, string | null> = {};

      if (discovered.gaProperties.length > 0) {
        updateData.ga_property_id = discovered.gaProperties[0].id;
        console.log('[Discover] Saving GA property:', discovered.gaProperties[0].id);
      }

      if (discovered.adsAccounts.length > 0) {
        // Use the first non-MCC account, or the first account if all are MCCs
        updateData.gads_customer_id = discovered.adsAccounts[0].customerId;
        console.log('[Discover] Saving Ads account:', discovered.adsAccounts[0].customerId);
      }

      if (discovered.searchConsoleSites.length > 0) {
        updateData.gsc_site_url = discovered.searchConsoleSites[0].siteUrl;
        console.log('[Discover] Saving GSC site:', discovered.searchConsoleSites[0].siteUrl);
      }

      if (Object.keys(updateData).length > 0) {
        // Check if service_configs entry exists
        const { data: existingConfig } = await supabaseAdmin
          .from('service_configs')
          .select('client_id')
          .eq('client_id', clientId)
          .single();

        if (existingConfig) {
          // Update existing record
          const { error } = await supabaseAdmin
            .from('service_configs')
            .update(updateData)
            .eq('client_id', clientId);

          if (error) {
            console.error('[Discover] Error updating service_configs:', error);
          } else {
            console.log('[Discover] Successfully updated service_configs');
          }
        } else {
          // Insert new record
          const { error } = await supabaseAdmin
            .from('service_configs')
            .insert({
              client_id: clientId,
              ...updateData,
            });

          if (error) {
            console.error('[Discover] Error inserting service_configs:', error);
          } else {
            console.log('[Discover] Successfully inserted service_configs');
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      discovered,
      counts: {
        gaProperties: discovered.gaProperties.length,
        adsAccounts: discovered.adsAccounts.length,
        searchConsoleSites: discovered.searchConsoleSites.length,
      },
      savedToDatabase: saveToDb,
    });

  } catch (error: any) {
    console.error('[Discover] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to discover properties',
      details: error.message
    }, { status: 500 });
  }
}
