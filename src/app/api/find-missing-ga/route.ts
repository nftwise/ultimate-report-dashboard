import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/find-missing-ga
 * Find clients without GA4 and search for potential matches
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
        message: 'Please sign in with Google OAuth'
      }, { status: 401 });
    }

    console.log('[FindMissingGA] Fetching GA4 properties...');

    // Fetch all GA4 properties with their website URLs
    const gaResponse = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!gaResponse.ok) {
      const errorText = await gaResponse.text();
      return NextResponse.json({
        success: false,
        error: `GA4 Admin API error: ${gaResponse.status}`,
        details: errorText
      }, { status: gaResponse.status });
    }

    const gaData = await gaResponse.json();

    // Build list of all properties with website URLs
    const properties: Array<{
      id: string;
      name: string;
      url: string;
      accountName: string;
    }> = [];

    for (const account of gaData.accountSummaries || []) {
      const accountName = account.displayName || 'Unknown';

      for (const property of account.propertySummaries || []) {
        const propertyId = property.property.replace('properties/', '');

        // Fetch data streams to get website URL
        let websiteUrl = '';
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
              websiteUrl = webStream.webStreamData.defaultUri
                .replace(/^https?:\/\//, '')
                .replace('www.', '')
                .split('/')[0]
                .toLowerCase();
            }
          }
        } catch (e) {
          // Ignore
        }

        properties.push({
          id: propertyId,
          name: property.displayName,
          url: websiteUrl,
          accountName
        });
      }
    }

    console.log(`[FindMissingGA] Found ${properties.length} GA4 properties`);

    // Get all clients without GA4 property ID
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select(`
        id,
        name,
        slug,
        service_configs (
          ga_property_id,
          gsc_site_url
        )
      `)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Database error',
        details: error.message
      }, { status: 500 });
    }

    // Find clients without GA4
    const missingClients: Array<{
      name: string;
      domain: string;
      suggestions: Array<{
        propertyId: string;
        propertyName: string;
        propertyUrl: string;
        matchType: string;
        confidence: number;
      }>;
    }> = [];

    // All available domains from GA4 properties
    const availableDomains = properties.map(p => p.url).filter(Boolean);

    for (const client of clients || []) {
      const config = Array.isArray(client.service_configs)
        ? client.service_configs[0]
        : client.service_configs;

      // Skip if already has GA4
      if (config?.ga_property_id) continue;

      const gscUrl = config?.gsc_site_url;
      if (!gscUrl) continue;

      const clientDomain = gscUrl
        .replace(/^https?:\/\//, '')
        .replace('www.', '')
        .split('/')[0]
        .toLowerCase();

      const suggestions: Array<{
        propertyId: string;
        propertyName: string;
        propertyUrl: string;
        matchType: string;
        confidence: number;
      }> = [];

      // Check for exact match
      for (const prop of properties) {
        if (prop.url === clientDomain) {
          suggestions.push({
            propertyId: prop.id,
            propertyName: prop.name,
            propertyUrl: prop.url,
            matchType: 'exact',
            confidence: 100
          });
        }
      }

      // Check for partial domain match
      if (suggestions.length === 0) {
        const clientBase = clientDomain.replace(/\.(com|net|org|co\.uk)$/, '');

        for (const prop of properties) {
          const propBase = prop.url.replace(/\.(com|net|org|co\.uk)$/, '');

          // Check if domains share significant keywords
          if (propBase.includes(clientBase) || clientBase.includes(propBase)) {
            suggestions.push({
              propertyId: prop.id,
              propertyName: prop.name,
              propertyUrl: prop.url,
              matchType: 'partial',
              confidence: 70
            });
          }
        }
      }

      // Check for name-based match
      if (suggestions.length === 0) {
        const clientNameLower = client.name.toLowerCase();

        for (const prop of properties) {
          const propNameLower = prop.name.toLowerCase();

          // Check for common keywords
          const clientWords = clientNameLower.split(/\s+/).filter((w: string) => w.length > 3);
          for (const word of clientWords) {
            if (propNameLower.includes(word) && word !== 'chiropractic' && word !== 'center') {
              suggestions.push({
                propertyId: prop.id,
                propertyName: prop.name,
                propertyUrl: prop.url,
                matchType: 'name',
                confidence: 50
              });
              break;
            }
          }
        }
      }

      missingClients.push({
        name: client.name,
        domain: clientDomain,
        suggestions: suggestions.slice(0, 3) // Top 3 suggestions
      });
    }

    // Sort by whether they have suggestions
    missingClients.sort((a, b) => b.suggestions.length - a.suggestions.length);

    return NextResponse.json({
      success: true,
      totalGaProperties: properties.length,
      totalMissingClients: missingClients.length,
      availableDomains: availableDomains.sort(),
      missingClients,
      message: missingClients.length === 0
        ? 'All clients have GA4 properties configured!'
        : `Found ${missingClients.length} clients without GA4 matches`
    });

  } catch (error: any) {
    console.error('[FindMissingGA] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to find missing GA properties',
      details: error.message
    }, { status: 500 });
  }
}
